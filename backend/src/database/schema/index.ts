/**
 * Drizzle schema barrel.
 *
 * Every table, enum, and relation is re-exported here so the Drizzle client
 * and `drizzle-kit` see a single, unified schema. Feature modules import their
 * tables from `@/database/schema`.
 *
 * Phase 1 (Auth & Onboarding): users, profiles, goals, health conditions.
 * Phase 2 (Nutrition Core): foods, meal logs, nutrition targets, daily metrics.
 * Phase 3 (AI Layer): meal plans, supplement plans, scans, products, coach
 * conversations, and the background job ledger behind all of them.
 * Phase 4 (Progress & Engagement): workout logs, progress snapshots,
 * achievements, reminders, and the device tokens reminders are delivered to.
 */
export * from './enums';
export * from './users';
export * from './profiles';
export * from './goals';
export * from './health-conditions';
export * from './foods';
export * from './meal-logs';
export * from './nutrition-targets';
export * from './daily-metrics';
export * from './meal-plans';
export * from './supplement-plans';
export * from './products';
export * from './scan-results';
export * from './coach';
export * from './ai-jobs';
export * from './workout-logs';
export * from './progress-snapshots';
export * from './achievements';
export * from './reminders';
export * from './device-tokens';
