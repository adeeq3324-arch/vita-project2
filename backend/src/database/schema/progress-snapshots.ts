import { relations } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { snapshotPeriodEnum } from './enums';
import { users } from './users';

/**
 * A frozen roll-up of one week or one month of a user's progress.
 *
 * The Progress tab's charts are always computed live from the underlying diaries,
 * so this table is not a cache of them — it is *history*. Two things make it
 * worth persisting rather than deriving:
 *
 *   - **Body measurements have no other home.** Body fat, muscle mass and the
 *     tape measurements are values the user reports periodically, not something
 *     any other table can produce. They arrive with the snapshot and live here.
 *   - **Long-range comparisons stay cheap and stable.** "vs last month" reads two
 *     rows instead of re-aggregating two months of diaries, and a past period's
 *     figures keep reading the same even as targets and scoring rules evolve.
 *
 * One row per user per period start (`week` rows key on the Monday, `month` rows
 * on the 1st), enforced by a unique index — so re-running a period's roll-up
 * updates it in place and can never fork into two versions of the same week.
 */
export const progressSnapshots = pgTable(
  'progress_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    period: snapshotPeriodEnum('period').notNull(),
    /** Monday of the week, or the 1st of the month, in the user's time zone. */
    periodStart: date('period_start').notNull(),
    /** Inclusive last day of the period. */
    periodEnd: date('period_end').notNull(),

    // ── body ────────────────────────────────────────────────────────────────
    /** First and last real weigh-in inside the period, kilograms. */
    weightStartKg: numeric('weight_start_kg', { precision: 5, scale: 2 }),
    weightEndKg: numeric('weight_end_kg', { precision: 5, scale: 2 }),
    /** `weight_end - weight_start`; negative means weight was lost. */
    weightDeltaKg: numeric('weight_delta_kg', { precision: 5, scale: 2 }),
    /** Body mass index at the end of the period, from height and closing weight. */
    bmi: numeric('bmi', { precision: 4, scale: 1 }),

    /** User-reported body composition. Null until they measure it. */
    bodyFatPercent: numeric('body_fat_percent', { precision: 4, scale: 1 }),
    muscleMassPercent: numeric('muscle_mass_percent', { precision: 4, scale: 1 }),

    /** User-reported tape measurements, centimetres. */
    waistCm: numeric('waist_cm', { precision: 5, scale: 1 }),
    chestCm: numeric('chest_cm', { precision: 5, scale: 1 }),
    hipsCm: numeric('hips_cm', { precision: 5, scale: 1 }),
    armCm: numeric('arm_cm', { precision: 5, scale: 1 }),
    thighCm: numeric('thigh_cm', { precision: 5, scale: 1 }),

    // ── nutrition (daily averages over the period) ───────────────────────────
    avgCalories: numeric('avg_calories', { precision: 8, scale: 2 }).notNull().default('0'),
    avgProteinG: numeric('avg_protein_g', { precision: 7, scale: 2 }).notNull().default('0'),
    avgCarbsG: numeric('avg_carbs_g', { precision: 7, scale: 2 }).notNull().default('0'),
    avgFatG: numeric('avg_fat_g', { precision: 7, scale: 2 }).notNull().default('0'),
    avgFiberG: numeric('avg_fiber_g', { precision: 7, scale: 2 }).notNull().default('0'),
    /** Average daily fluid intake, millilitres. */
    avgWaterMl: integer('avg_water_ml').notNull().default(0),
    avgSteps: integer('avg_steps').notNull().default(0),

    // ── fitness ──────────────────────────────────────────────────────────────
    workoutCount: integer('workout_count').notNull().default(0),
    workoutMinutes: integer('workout_minutes').notNull().default(0),
    workoutCaloriesBurned: integer('workout_calories_burned').notNull().default(0),

    /** Mean of the days that could be scored, 0–100; null when none could. */
    avgHealthScore: smallint('avg_health_score'),
    /** Days inside the period on which the user logged anything at all. */
    daysLogged: integer('days_logged').notNull().default(0),
    /** Longest run of consecutive logged days ending inside the period. */
    streakDays: integer('streak_days').notNull().default(0),

    /** When these figures were last computed. */
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('progress_snapshots_user_period_key').on(
      table.userId,
      table.period,
      table.periodStart,
    ),
    index('progress_snapshots_user_period_start_idx').on(
      table.userId,
      table.period,
      table.periodStart.desc(),
    ),
  ],
);

export const progressSnapshotsRelations = relations(progressSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [progressSnapshots.userId],
    references: [users.id],
  }),
}));

export type ProgressSnapshot = typeof progressSnapshots.$inferSelect;
export type NewProgressSnapshot = typeof progressSnapshots.$inferInsert;
export type SnapshotPeriod = ProgressSnapshot['period'];
