import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { LoggingModule } from './common/logging/logging.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { GoalsModule } from './goals/goals.module';
import { HealthConditionsModule } from './health-conditions/health-conditions.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CacheModule } from './common/cache/cache.module';
import { FoodsModule } from './foods/foods.module';
import { MealLogsModule } from './meal-logs/meal-logs.module';
import { NutritionTargetsModule } from './nutrition-targets/nutrition-targets.module';
import { DailyMetricsModule } from './daily-metrics/daily-metrics.module';
import { HomeModule } from './home/home.module';
import { AiModule } from './ai/ai.module';
import { AiContextModule } from './ai-context/ai-context.module';
import { AiJobsModule } from './ai-jobs/ai-jobs.module';
import { StorageModule } from './storage/storage.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { SupplementPlansModule } from './supplement-plans/supplement-plans.module';
import { CoachModule } from './coach/coach.module';
import { ScannerModule } from './scanner/scanner.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WorkoutLogsModule } from './workout-logs/workout-logs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ProgressModule } from './progress/progress.module';
import { RemindersModule } from './reminders/reminders.module';
import {
  ThrottlerCoreModule,
  UserThrottlerModule,
} from './common/throttler/throttler.module';
import { ObservabilityModule } from './common/observability/observability.module';

/**
 * Root application module. Wires the cross-cutting foundation:
 *   - configuration & env validation
 *   - structured logging
 *   - database (Drizzle/Postgres), Redis, and BullMQ queue backend
 *   - a global RFC 7807 exception filter
 *   - the health module
 *
 * Phase 1 adds the auth & onboarding domain (Supabase auth, users, profiles,
 * goals, health conditions).
 *
 * Phase 2 adds nutrition core: the food catalogue, the food diary, derived
 * daily nutrition targets, daily metrics, and the aggregated home feed.
 *
 * Phase 3 adds the AI layer: a provider-agnostic model client, the background
 * job ledger behind every generation, weekly meal plans, monthly supplement
 * plans, the streaming health coach, and the three scanners.
 *
 * Phase 4 adds progress & engagement: the training diary, the shared analytics
 * read layer, the Progress tab with its weekly/monthly snapshot history,
 * achievement tracking, and reminders delivered as push notifications.
 *
 * Phase 5 hardens all of the above for production: two-layer rate limiting,
 * error tracking and metrics, and the subscriptions ledger. It adds no
 * behaviour to the feature modules it protects.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    RedisModule,
    CacheModule,
    QueueModule,
    // Installs the pre-authentication IP shield. Imported ahead of AuthModule
    // deliberately: global guards run in module-initialisation order, and this
    // one has to meter a flood of invalid tokens *before* the auth guard spends
    // a Supabase call verifying each one.
    ThrottlerCoreModule,
    HealthModule,
    SupabaseModule,
    UsersModule,
    AuthModule,
    // …and this one has to run after AuthModule, so `request.user` exists and
    // limits are keyed by identity rather than by shared carrier address.
    UserThrottlerModule,
    ProfilesModule,
    GoalsModule,
    HealthConditionsModule,
    OnboardingModule,
    FoodsModule,
    MealLogsModule,
    NutritionTargetsModule,
    DailyMetricsModule,
    HomeModule,
    AiModule,
    AiJobsModule,
    AiContextModule,
    StorageModule,
    MealPlansModule,
    SupplementPlansModule,
    CoachModule,
    ScannerModule,
    NotificationsModule,
    WorkoutLogsModule,
    AnalyticsModule,
    AchievementsModule,
    ProgressModule,
    RemindersModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
