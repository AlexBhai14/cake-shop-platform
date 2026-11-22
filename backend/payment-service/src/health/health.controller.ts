import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
  ) {}

  @Get()
  live() {
    return { status: 'ok', service: 'payment-service' };
  }

  // Ready = database reachable. RabbitMQ status is reported too (the outbox keeps events safe while it is down).
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('database not reachable');
    }
    return { status: 'ready', rabbitmq: this.rabbit.isConnected() ? 'up' : 'down' };
  }
}
