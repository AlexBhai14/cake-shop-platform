import { Global, Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';

// The notification service only CONSUMES events, so there is no outbox publisher here.
@Global()
@Module({ providers: [RabbitMqService], exports: [RabbitMqService] })
export class MessagingModule {}
