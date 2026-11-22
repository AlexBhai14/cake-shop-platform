import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EXCHANGE, EventEnvelope, RETRY_EXCHANGE } from './events';

export interface ConsumerDef {
  queue: string; // for example "inventory.events"
  bindings: string[]; // routing keys this queue listens to
  handler: (event: EventEnvelope) => Promise<void>;
}

const MAX_ATTEMPTS = 3;
const log = (level: string, msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level, msg, ...extra }));

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  // amqplib types differ between versions, so the handles are kept loosely typed
  private conn: any;
  private pub: any; // confirm channel: resolves only when the broker has the message
  private sub: any;
  private consumers: ConsumerDef[] = [];
  private connected = false;
  private closing = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    void this.connectLoop(); // never blocks start-up: the service starts even if RabbitMQ is down
  }

  async onModuleDestroy() {
    this.closing = true;
    try {
      await this.sub?.close();
      await this.pub?.close();
      await this.conn?.close();
    } catch {
      /* already closed */
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  registerConsumer(def: ConsumerDef) {
    this.consumers.push(def);
    if (this.connected) void this.startConsumer(def);
  }

  // Resolves when RabbitMQ confirms it stored the message.
  publish(routingKey: string, envelope: EventEnvelope): Promise<void> {
    if (!this.connected) return Promise.reject(new Error('RabbitMQ is not connected'));
    return new Promise((resolve, reject) => {
      this.pub.publish(
        EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(envelope)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: envelope.eventId,
          headers: { 'x-correlation-id': envelope.correlationId },
        },
        (err: unknown) => (err ? reject(err) : resolve()),
      );
    });
  }

  private async connectLoop() {
    while (!this.closing) {
      try {
        await this.connect();
        return;
      } catch (e) {
        log('error', 'rabbitmq connection failed, retrying in 3s', { error: String(e) });
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  private async connect() {
    const url = this.config.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    this.conn = await amqp.connect(url);
    this.conn.on('error', (e: unknown) => log('error', 'rabbitmq connection error', { error: String(e) }));
    this.conn.on('close', () => {
      this.connected = false;
      if (!this.closing) {
        log('warn', 'rabbitmq connection closed, reconnecting');
        void this.connectLoop();
      }
    });
    this.pub = await this.conn.createConfirmChannel();
    this.sub = await this.conn.createChannel();
    await this.sub.prefetch(10);
    await this.pub.assertExchange(EXCHANGE, 'topic', { durable: true });
    await this.pub.assertExchange(RETRY_EXCHANGE, 'direct', { durable: true });
    this.connected = true;
    log('info', 'rabbitmq connected');
    for (const c of this.consumers) await this.startConsumer(c);
  }

  // Queue layout for a consumer "X":
  //   X        main queue, bound to the topic exchange (and to the retry exchange)
  //   X.retry  holds a failed message for a few seconds, then returns it to X
  //   X.dlq    dead letter queue: messages that failed MAX_ATTEMPTS times wait here for a human
  private async startConsumer(def: ConsumerDef) {
    const q = def.queue;
    const delay = Number(this.config.get('RETRY_DELAY_MS') ?? 5000);
    await this.sub.assertQueue(q, { durable: true });
    await this.sub.assertQueue(`${q}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': delay,
        'x-dead-letter-exchange': RETRY_EXCHANGE,
        'x-dead-letter-routing-key': q,
      },
    });
    await this.sub.assertQueue(`${q}.dlq`, { durable: true });
    await this.sub.bindQueue(q, RETRY_EXCHANGE, q);
    for (const key of def.bindings) await this.sub.bindQueue(q, EXCHANGE, key);

    await this.sub.consume(q, (msg: any) => {
      if (msg) void this.handleMessage(def, msg);
    });
    log('info', 'consumer started', { queue: q, bindings: def.bindings });
  }

  private async handleMessage(def: ConsumerDef, msg: any) {
    const q = def.queue;
    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(msg.content.toString());
    } catch {
      this.sub.sendToQueue(`${q}.dlq`, msg.content, { persistent: true });
      this.sub.ack(msg);
      return;
    }
    try {
      await def.handler(envelope);
      this.sub.ack(msg);
    } catch (e) {
      const attempt = Number(msg.properties.headers?.['x-attempt'] ?? 0) + 1;
      const target = attempt >= MAX_ATTEMPTS ? `${q}.dlq` : `${q}.retry`;
      log('error', 'event handler failed', { queue: q, eventId: envelope.eventId, attempt, target, error: String(e) });
      this.sub.sendToQueue(target, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: { ...msg.properties.headers, 'x-attempt': attempt, 'x-last-error': String(e).slice(0, 200) },
      });
      this.sub.ack(msg);
    }
  }
}
