import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { DevicePlatform } from '../../database/schema';

const PLATFORMS: DevicePlatform[] = ['ios', 'android', 'web'];

/**
 * Registers the calling device for push notifications.
 *
 * Called on sign-in and whenever the platform reissues a token — the endpoint is
 * an upsert, so the client can safely send the same token on every launch without
 * checking whether it already registered it.
 */
export class RegisterDeviceDto {
  /** Push token issued to the app by the platform's push service. */
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token!: string;

  @IsIn(PLATFORMS)
  platform!: DevicePlatform;

  /** Optional label for a "your devices" list ("Abshir's iPhone"). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}
