import { Global, Module } from '@nestjs/common';
import { OutboxPublisher } from './outbox.publisher';
import { RabbitMqService } from './rabbitmq.service';

@Global()
@Module({ providers: [RabbitMqService, OutboxPublisher], exports: [RabbitMqService, OutboxPublisher] })
export class MessagingModule {}
