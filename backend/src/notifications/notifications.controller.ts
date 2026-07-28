import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DeviceView } from './device.view';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationsService } from './notifications.service';

/**
 * Device registration for push notifications, mounted at
 * `/api/v1/notifications/devices`.
 *
 * There is deliberately no "send a notification" endpoint. Pushes originate from
 * the platform — a reminder falling due, an achievement unlocking — never from a
 * client asking for one, which would be an open invitation to spam another user's
 * lock screen.
 */
@Controller({ path: 'notifications/devices', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * Registers this device's push token. Idempotent — safe to call on every launch
   * and whenever the platform reissues the token.
   */
  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceView> {
    return this.notifications.registerDevice(user.id, dto);
  }

  /** The caller's registered devices. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<DeviceView[]> {
    return this.notifications.listDevices(user.id);
  }

  /** Unregisters a device — sign-out, or turning this phone's notifications off. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.removeDevice(user.id, id);
  }
}
