import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.constants';
import { deviceTokens, type DeviceToken } from '../database/schema';
import { toDeviceView, type DeviceView } from './device.view';
import type { RegisterDeviceDto } from './dto/register-device.dto';
import { ExpoPushProvider } from './expo-push.provider';
import { EMPTY_PUSH_RESULT, type PushMessage, type PushResult } from './push.types';

/**
 * Push notification delivery, and the device registry behind it.
 *
 * Sits below every feature that notifies a user (reminders, achievement unlocks)
 * so that "which devices does this user have, and which of their tokens are still
 * good" is answered in exactly one place. Callers pass a user id and a message;
 * fan-out, batching and the retirement of dead tokens are not their problem.
 *
 * Delivery never throws. A notification is an *additional* channel — the
 * reminder has already fired and been recorded either way — so a push service
 * outage must not fail the request or the background job that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly expo: ExpoPushProvider,
  ) {}

  /**
   * Registers (or refreshes) a device for the caller.
   *
   * Upserts on the token rather than on (user, token): a handset signed into a
   * second account reissues the same token, and the row has to *move* to the new
   * owner. Leaving both accounts registered against one device would deliver one
   * user's reminders to another — a privacy fault, not just a duplicate.
   *
   * A previously revoked token is reactivated by the same call, which is what makes
   * an app reinstall self-healing.
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<DeviceView> {
    const now = new Date();

    const [device] = await this.db
      .insert(deviceTokens)
      .values({
        userId,
        token: dto.token.trim(),
        platform: dto.platform,
        deviceName: dto.deviceName?.trim() || null,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId,
          platform: dto.platform,
          deviceName: dto.deviceName?.trim() || null,
          lastSeenAt: now,
          revokedAt: null,
          updatedAt: now,
        },
      })
      .returning();

    return toDeviceView(device);
  }

  /** The caller's registered devices, oldest first. */
  async listDevices(userId: string): Promise<DeviceView[]> {
    const rows = await this.db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId))
      .orderBy(asc(deviceTokens.createdAt));

    return rows.map(toDeviceView);
  }

  /**
   * Unregisters one of the caller's devices — sign-out, or "stop notifying this
   * phone". Deleted rather than revoked: this is the user's own decision, and
   * keeping a record of it would only be a row that re-registration has to undo.
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const deleted = await this.db
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.id, deviceId), eq(deviceTokens.userId, userId)))
      .returning({ id: deviceTokens.id });

    if (deleted.length === 0) {
      throw new NotFoundException(`No registered device found with id "${deviceId}".`);
    }
  }

  /**
   * Delivers `message` to every active device the user has.
   *
   * Tokens the transport reports as permanently gone are revoked here, so an
   * uninstalled app stops costing a delivery attempt on every future reminder
   * without anyone having to prune the table by hand.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<PushResult> {
    if (!this.expo.enabled) {
      return { ...EMPTY_PUSH_RESULT };
    }

    const tokens = await this.activeTokens(userId);
    if (tokens.length === 0) {
      return { ...EMPTY_PUSH_RESULT };
    }

    const tickets = await this.expo.send(
      tokens.map((row) => row.token),
      message,
    );

    const dead = tickets.filter((ticket) => ticket.fatal).map((ticket) => ticket.token);
    if (dead.length > 0) {
      await this.revoke(dead);
    }

    const delivered = tickets.filter((ticket) => ticket.ok).length;
    return {
      delivered,
      failed: tickets.length - delivered - dead.length,
      revoked: dead.length,
      skipped: false,
    };
  }

  /** True when a push to this user would actually reach a device. */
  async canNotify(userId: string): Promise<boolean> {
    if (!this.expo.enabled) {
      return false;
    }
    return (await this.activeTokens(userId)).length > 0;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async activeTokens(userId: string): Promise<Pick<DeviceToken, 'token'>[]> {
    return this.db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)));
  }

  /**
   * Retires tokens the push service has disowned. Best-effort: failing to record
   * the retirement costs a wasted attempt next time, which is not worth turning
   * into a delivery failure.
   */
  private async revoke(tokens: string[]): Promise<void> {
    const now = new Date();
    try {
      for (const token of tokens) {
        await this.db
          .update(deviceTokens)
          .set({ revokedAt: now, updatedAt: now })
          .where(eq(deviceTokens.token, token));
      }
      this.logger.log(`Revoked ${tokens.length} unreachable device token(s)`);
    } catch (error) {
      this.logger.warn(
        `Could not revoke unreachable device tokens: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
