import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { RemindersController } from './reminders.controller';
import { RemindersProcessor } from './reminders.processor';
import { RemindersScheduler } from './reminders.scheduler';
import { RemindersService } from './reminders.service';

/**
 * Reminders module — the user's nudge list and its scheduled delivery.
 *
 * The scheduler only triggers; the worker claims and fans out, and the delivery
 * itself goes through {@link NotificationsModule}, so this module holds no device
 * token and knows nothing about which push service is configured. Depends on profiles
 * because a reminder's time is a *local* wall-clock time, and only the profile knows
 * which clock that is.
 */
@Module({
  imports: [ProfilesModule, NotificationsModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersProcessor, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersModule {}
