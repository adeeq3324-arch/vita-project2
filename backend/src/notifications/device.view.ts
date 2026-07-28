import type { DeviceToken } from '../database/schema';

/**
 * A registered device, as the client sees it.
 *
 * The token itself is never returned. It is a delivery credential: echoing it
 * back would put it in logs, caches and screenshots for no benefit, since the
 * only party that needs it already has it.
 */
export interface DeviceView {
  id: string;
  platform: DeviceToken['platform'];
  deviceName: string | null;
  /** Last time the app confirmed this registration is current. */
  lastSeenAt: string;
  /** False once the push service reported the token as gone. */
  active: boolean;
  registeredAt: string;
}

export function toDeviceView(device: DeviceToken): DeviceView {
  return {
    id: device.id,
    platform: device.platform,
    deviceName: device.deviceName,
    lastSeenAt: device.lastSeenAt.toISOString(),
    active: device.revokedAt === null,
    registeredAt: device.createdAt.toISOString(),
  };
}
