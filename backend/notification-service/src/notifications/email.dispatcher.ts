import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

export const MAX_ATTEMPTS = 5;

// Sends the saved notifications. A failed send is retried later (30 s, 60 s, 90 s ...)
// and marked FAILED after MAX_ATTEMPTS, so one broken mail server never blocks the event queue.
@Injectable()
export class EmailDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), Number(process.env.EMAIL_POLL_MS ?? 2000));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const due = await this.prisma.notification.findMany({
        where: { status: 'PENDING', nextAttemptAt: { lte: now } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      for (const n of due) {
        try {
          await this.email.send({ to: n.toEmail, subject: n.subject, text: n.bodyText, html: n.bodyHtml });
          await this.prisma.notification.update({
            where: { id: n.id },
            data: { status: 'SENT', sentAt: new Date(), attempts: n.attempts + 1, lastError: null },
          });
          sent++;
        } catch (e) {
          const attempts = n.attempts + 1;
          await this.prisma.notification.update({
            where: { id: n.id },
            data: {
              attempts,
              status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
              nextAttemptAt: new Date(now.getTime() + attempts * 30_000),
              lastError: String(e).slice(0, 300),
            },
          });
          console.error(JSON.stringify({ level: 'error', service: 'notification-service', msg: 'email send failed', notificationId: n.id, attempts }));
        }
      }
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', service: 'notification-service', msg: 'dispatcher tick failed', error: String(e) }));
    } finally {
      this.running = false;
    }
    return sent;
  }
}
