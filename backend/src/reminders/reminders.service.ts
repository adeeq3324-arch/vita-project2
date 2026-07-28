import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import {
  normalizeTimeOfDay,
  resolveTimeZone,
  toLocalTimeOfDay,
  todayIn,
} from '../common/util/date.util';
import { DRIZZLE, type Database } from '../database/database.constants';
import { profiles, reminders, type NewReminder, type Reminder } from '../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateReminderDto } from './dto/create-reminder.dto';
import type { ReminderFilter } from './dto/query-reminders.dto';
import type { UpdateReminderDto } from './dto/update-reminder.dto';
import { toReminderView, type ReminderView } from './reminder.view';
import {
  reminderAccent,
  reminderDefaultMessage,
  reminderIcon,
} from './reminder.presentation';
import { nextRunAt } from './reminder.schedule';

/** How many due reminders one claim takes, keeping a single lock brief. */
export const CLAIM_BATCH_SIZE = 200;

/** A reminder claimed for delivery, with the firing it was claimed for. */
export interface ClaimedReminder {
  reminderId: string;
  userId: string;
  /** The firing this claim represents — the `next_run_at` that came due. */
  dueAt: Date;
}

/**
 * Reminders: the user's list, and the delivery machinery behind it.
 *
 * Every read and write is scoped to the caller's `user_id`, so a user can only ever
 * touch their own reminders — the application-level guarantee in front of the
 * database's RLS policies. The one exception is {@link claimDue}, which is the
 * delivery sweep and is deliberately cross-user; it is reachable only from the queue
 * worker, never from a request.
 *
 * The scheduling contract is worth stating plainly, because everything else depends
 * on it: `time_of_day` + `days_of_week` is the user's intent, `next_run_at` is the
 * resolved instant, and **the two are recomputed together** on every write. A
 * reminder is therefore never left pointing at an instant its own rule no longer
 * implies.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly profiles: ProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── the user's list ───────────────────────────────────────────────────────

  async create(userId: string, dto: CreateReminderDto): Promise<ReminderView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const category = dto.category ?? 'custom';
    const timeOfDay = normalizeTimeOfDay(dto.time);
    const daysOfWeek = normalizeDays(dto.daysOfWeek);

    const values: NewReminder = {
      userId,
      name: dto.name.trim(),
      category,
      message: dto.message?.trim() || null,
      timeOfDay,
      daysOfWeek,
      enabled: dto.enabled ?? true,
      icon: dto.icon ?? reminderIcon(category),
      accent: dto.accent ?? reminderAccent(category),
      nextRunAt: nextRunAt({ timeOfDay, daysOfWeek, timeZone }),
    };

    const [created] = await this.db.insert(reminders).values(values).returning();
    return this.present(created, timeZone, todayIn(timeZone));
  }

  /**
   * The caller's reminders, ordered by time of day as the screen lists them.
   *
   * Schedules are re-synced as a side effect: a reminder whose stored firing no
   * longer lands on its own wall-clock time — which is what a time-zone change to
   * the profile looks like — is corrected here. Doing it on the read the user is
   * about to look at means a traveller's 8am reminder fixes itself the moment they
   * open the screen, rather than firing at the wrong hour until they edit it.
   */
  async list(userId: string, filter: ReminderFilter = 'all'): Promise<ReminderView[]> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);

    const stored = await this.db
      .select()
      .from(reminders)
      .where(eq(reminders.userId, userId))
      .orderBy(asc(reminders.timeOfDay), asc(reminders.createdAt));

    const rows = await this.resync(stored, timeZone);
    const views = rows.map((row) => this.present(row, timeZone, today));
    return filter === 'all' ? views : views.filter((view) => view.when === filter);
  }

  async getById(userId: string, id: string): Promise<ReminderView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const reminder = await this.findOwned(userId, id);
    return this.present(reminder, timeZone, todayIn(timeZone));
  }

  /**
   * Partial update, including the list's on/off switch.
   *
   * The next firing is recomputed whenever anything that determines it changes —
   * the time, the days, or the reminder being switched back on. Re-enabling
   * recomputes from *now* rather than resuming the stored instant, so a reminder
   * switched off for a fortnight does not fire the moment it comes back.
   */
  async update(userId: string, id: string, dto: UpdateReminderDto): Promise<ReminderView> {
    const existing = await this.findOwned(userId, id);
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);

    const changes: Partial<NewReminder> = {};

    if (dto.name !== undefined) changes.name = dto.name.trim();
    if (dto.category !== undefined) changes.category = dto.category;
    if (dto.message !== undefined) changes.message = dto.message.trim() || null;
    if (dto.icon !== undefined) changes.icon = dto.icon;
    if (dto.accent !== undefined) changes.accent = dto.accent;
    if (dto.enabled !== undefined) changes.enabled = dto.enabled;
    if (dto.time !== undefined) changes.timeOfDay = normalizeTimeOfDay(dto.time);
    if (dto.daysOfWeek !== undefined) changes.daysOfWeek = normalizeDays(dto.daysOfWeek);

    if (Object.keys(changes).length === 0) {
      return this.present(existing, timeZone, today);
    }

    const reschedule =
      changes.timeOfDay !== undefined ||
      changes.daysOfWeek !== undefined ||
      (changes.enabled === true && !existing.enabled);

    if (reschedule) {
      changes.nextRunAt = nextRunAt({
        timeOfDay: changes.timeOfDay ?? existing.timeOfDay,
        daysOfWeek: changes.daysOfWeek ?? existing.daysOfWeek,
        timeZone,
      });
    }

    const [updated] = await this.db
      .update(reminders)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
      .returning();

    return this.present(updated, timeZone, today);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
      .returning({ id: reminders.id });

    if (deleted.length === 0) {
      throw new NotFoundException(`No reminder found with id "${id}".`);
    }
  }

  // ── delivery ──────────────────────────────────────────────────────────────

  /**
   * Claims the reminders that have come due and advances their schedules.
   *
   * This is the concurrency-critical operation in the whole feature, and it is one
   * transaction for a reason. The rows are selected `FOR UPDATE SKIP LOCKED`, so two
   * API instances sweeping at the same instant take *disjoint* sets rather than both
   * taking the same one; each claimed row then has `next_run_at` advanced before the
   * transaction commits. A reminder is therefore claimed exactly once per firing, and
   * the claim is what a delivery job is issued against.
   *
   * The advance is computed from *now*, not from the firing that came due, which is
   * what discards missed firings after an outage instead of replaying them.
   */
  async claimDue(now: Date = new Date(), limit = CLAIM_BATCH_SIZE): Promise<ClaimedReminder[]> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(reminders)
        .where(and(eq(reminders.enabled, true), lte(reminders.nextRunAt, now)))
        .orderBy(asc(reminders.nextRunAt))
        .limit(limit)
        .for('update', { skipLocked: true });

      if (due.length === 0) {
        return [];
      }

      const zones = await this.timeZonesFor(
        tx,
        due.map((reminder) => reminder.userId),
      );

      const claimed: ClaimedReminder[] = [];

      for (const reminder of due) {
        const timeZone = zones.get(reminder.userId) ?? 'UTC';

        await tx
          .update(reminders)
          .set({
            lastSentAt: reminder.nextRunAt,
            nextRunAt: nextRunAt(
              {
                timeOfDay: reminder.timeOfDay,
                daysOfWeek: reminder.daysOfWeek,
                timeZone,
              },
              now,
            ),
            updatedAt: now,
          })
          .where(eq(reminders.id, reminder.id));

        claimed.push({
          reminderId: reminder.id,
          userId: reminder.userId,
          dueAt: reminder.nextRunAt,
        });
      }

      return claimed;
    });
  }

  /**
   * Delivers one claimed reminder as a push notification.
   *
   * Re-reads the row rather than trusting the claim's copy, so a nudge that waited
   * briefly in the queue carries the name and message the user has *now*. A reminder
   * deleted or switched off in that interval is skipped: the claim has already
   * advanced the schedule, so nothing is left dangling.
   *
   * Never throws. The claim is committed and the schedule already advanced, so a
   * failure here means one missed notification — retrying the job would only risk
   * delivering the same nudge twice.
   */
  async deliver(reminderId: string, userId: string): Promise<boolean> {
    const reminder = await this.db.query.reminders.findFirst({
      where: and(eq(reminders.id, reminderId), eq(reminders.userId, userId)),
    });

    if (!reminder || !reminder.enabled) {
      return false;
    }

    const result = await this.notifications.sendToUser(userId, {
      title: reminder.name,
      body: reminder.message?.trim() || reminderDefaultMessage(reminder.category),
      data: { type: 'reminder', reminderId: reminder.id, category: reminder.category },
    });

    if (result.skipped) {
      // Push is switched off, or the user has no device registered. The reminder
      // still fired — its schedule advanced — there was simply nowhere to send it.
      return false;
    }

    if (result.delivered === 0) {
      this.logger.warn(`Reminder ${reminder.id} reached no device`);
    }
    return result.delivered > 0;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private present(reminder: Reminder, timeZone: string, today: string): ReminderView {
    return toReminderView(
      reminder,
      timeZone,
      today,
      reminder.message?.trim() || reminderDefaultMessage(reminder.category),
    );
  }

  private async findOwned(userId: string, id: string): Promise<Reminder> {
    const reminder = await this.db.query.reminders.findFirst({
      where: and(eq(reminders.id, id), eq(reminders.userId, userId)),
    });
    if (!reminder) {
      throw new NotFoundException(`No reminder found with id "${id}".`);
    }
    return reminder;
  }

  /**
   * Corrects any reminder whose stored firing no longer matches its own wall-clock
   * time in the user's current zone.
   *
   * The usual cause is the profile's time zone changing after the firing was
   * computed. Comparing the *local* time of the stored instant against `time_of_day`
   * detects that, and costs nothing in the overwhelming majority of cases where they
   * agree — no rows are written.
   *
   * A mismatch is not sufficient on its own, though: a firing that landed in a
   * daylight-saving gap legitimately reads an hour later than the time it was set
   * for. Recomputing and comparing *instants* separates the two — the gap case
   * recomputes to the value already stored and is left alone, so it cannot provoke a
   * pointless write on every read of the list.
   */
  private async resync(rows: Reminder[], timeZone: string): Promise<Reminder[]> {
    const now = new Date();
    const corrected = new Map<string, Date>();

    for (const row of rows) {
      if (toLocalTimeOfDay(row.nextRunAt, timeZone) === row.timeOfDay.slice(0, 5)) {
        continue;
      }

      const expected = nextRunAt(
        { timeOfDay: row.timeOfDay, daysOfWeek: row.daysOfWeek, timeZone },
        now,
      );
      if (expected.getTime() !== row.nextRunAt.getTime()) {
        corrected.set(row.id, expected);
      }
    }

    if (corrected.size === 0) {
      return rows;
    }

    try {
      for (const [id, instant] of corrected) {
        await this.db
          .update(reminders)
          .set({ nextRunAt: instant, updatedAt: now })
          .where(eq(reminders.id, id));
      }
      this.logger.log(`Re-synced ${corrected.size} reminder schedule(s) to ${timeZone}`);
    } catch (error) {
      // A correction that cannot be persisted must not fail the user's list. The
      // returned rows still show the right schedule, and the next read retries.
      this.logger.warn(
        `Could not re-sync reminder schedules: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return rows.map((row) => {
      const instant = corrected.get(row.id);
      return instant ? { ...row, nextRunAt: instant } : row;
    });
  }

  /**
   * The time zones of a set of users, in one query.
   *
   * The sweep needs a zone per claimed reminder to advance its schedule; looking
   * each one up individually would turn a batch of two hundred into two hundred
   * round trips inside an open transaction.
   */
  private async timeZonesFor(
    tx: Pick<Database, 'select'>,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return new Map();
    }

    const rows = await tx
      .select({ userId: profiles.userId, timezone: profiles.timezone })
      .from(profiles)
      .where(inArray(profiles.userId, unique));

    return new Map(rows.map((row) => [row.userId, resolveTimeZone(row.timezone)]));
  }
}

/**
 * Normalises a repeat rule.
 *
 * A full week and an unset list mean the same thing — every day — so both are stored
 * as the empty array. One representation of "daily" keeps the delivery query and the
 * repeat label from disagreeing about the same reminder.
 */
function normalizeDays(daysOfWeek: number[] | undefined): number[] {
  if (!daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.length === 7) {
    return [];
  }
  return [...new Set(daysOfWeek)].sort((a, b) => a - b);
}
