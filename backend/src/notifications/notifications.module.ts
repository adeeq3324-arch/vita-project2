import { Module } from '@nestjs/common';
import { ExpoPushProvider } from './expo-push.provider';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Push notification delivery and the device registry behind it.
 *
 * Exported for the features that notify users — reminders and achievement
 * unlocks — so neither of them holds a device token or knows which push service
 * is configured. The transport (`ExpoPushProvider`) is intentionally *not*
 * exported: swapping it is meant to be invisible outside this module.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
