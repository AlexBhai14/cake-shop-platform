import { Module } from '@nestjs/common';
import { EmailDispatcher } from './email.dispatcher';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsSaga } from './notifications.saga';

@Module({
  controllers: [NotificationsController],
  providers: [EmailService, EmailDispatcher, NotificationsSaga],
})
export class NotificationsModule {}
