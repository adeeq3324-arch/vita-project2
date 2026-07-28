import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import {
  goals,
  healthConditions,
  profiles,
  type HealthConditionRow,
} from '../database/schema';
import { toProfileView } from '../profiles/profile.view';
import { UsersService } from '../users/users.service';
import type { SubmitOnboardingDto } from './dto/submit-onboarding.dto';
import { toGoalView, type OnboardingOverview, type OnboardingView } from './onboarding.view';

type ConditionValue = HealthConditionRow['condition'];

/**
 * Persists the entire onboarding payload — profile, goal, and health
 * conditions — in a single atomic transaction. Re-submitting is idempotent:
 * profile and goal are upserted, and the condition set is fully replaced to
 * match the payload, so the stored state always reflects the latest submission.
 */
@Injectable()
export class OnboardingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly cache: CacheService,
  ) {}

  async submit(
    userId: string,
    email: string,
    dto: SubmitOnboardingDto,
  ): Promise<OnboardingView> {
    // Guarantee the local user row exists so every foreign key resolves.
    await this.users.ensureUser(userId, email);

    const conditions = this.normaliseConditions(dto.conditions);

    // Onboarding rewrites every input the user's nutrition targets derive from,
    // so any cached copy from a previous submission is stale.
    await this.cache.del(CacheKeys.nutritionTargets(userId));

    return this.db.transaction(async (tx) => {
      const now = new Date();

      const [profile] = await tx
        .insert(profiles)
        .values({
          userId,
          name: dto.username,
          age: dto.age,
          gender: dto.gender,
          heightCm: dto.height.toString(),
          weightKg: dto.weight.toString(),
          activityLevel: dto.activityLevel,
          unitSystem: dto.unitSystem ?? 'metric',
          ...(dto.timezone ? { timezone: dto.timezone } : {}),
        })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: {
            name: dto.username,
            age: dto.age,
            gender: dto.gender,
            heightCm: dto.height.toString(),
            weightKg: dto.weight.toString(),
            activityLevel: dto.activityLevel,
            unitSystem: dto.unitSystem ?? 'metric',
            // Only overwritten when the client actually sent a zone, so a
            // re-submission from a client that omits it keeps the stored value.
            ...(dto.timezone ? { timezone: dto.timezone } : {}),
            updatedAt: now,
          },
        })
        .returning();

      const [goal] = await tx
        .insert(goals)
        .values({
          userId,
          primaryGoal: dto.goal,
          targetWeightKg: dto.targetWeight.toString(),
        })
        .onConflictDoUpdate({
          target: goals.userId,
          set: {
            primaryGoal: dto.goal,
            targetWeightKg: dto.targetWeight.toString(),
            updatedAt: now,
          },
        })
        .returning();

      const savedConditions = await this.replaceConditions(tx, userId, conditions);

      return {
        profile: toProfileView(profile),
        goal: toGoalView(goal),
        conditions: savedConditions,
      };
    });
  }

  /**
   * Reads back the current user's persisted onboarding state (profile, goal and
   * declared conditions) so the app can render it after sign-in. Any piece the
   * user has not filled in yet comes back null / empty rather than erroring.
   */
  async get(userId: string): Promise<OnboardingOverview> {
    const [profile, goal, conditionRows] = await Promise.all([
      this.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
      this.db.query.goals.findFirst({ where: eq(goals.userId, userId) }),
      this.db.query.healthConditions.findMany({ where: eq(healthConditions.userId, userId) }),
    ]);

    return {
      profile: profile ? toProfileView(profile) : null,
      goal: goal ? toGoalView(goal) : null,
      conditions: conditionRows.map((row) => row.condition),
    };
  }

  /**
   * Drops the UI-only `none` sentinel and de-duplicates, yielding the set of
   * real conditions to persist.
   */
  private normaliseConditions(input: readonly string[]): ConditionValue[] {
    const real = input.filter((value): value is ConditionValue => value !== 'none');
    return Array.from(new Set(real));
  }

  /**
   * Replaces the user's condition set with exactly `conditions`. Clears the
   * existing rows and inserts the desired set, so repeated submissions converge
   * deterministically on the payload without duplicate-key errors. Runs inside
   * the caller's transaction, so the clear/insert is atomic.
   */
  private async replaceConditions(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    userId: string,
    conditions: ConditionValue[],
  ): Promise<ConditionValue[]> {
    await tx.delete(healthConditions).where(eq(healthConditions.userId, userId));

    if (conditions.length > 0) {
      await tx
        .insert(healthConditions)
        .values(conditions.map((condition) => ({ userId, condition })));
    }

    return conditions;
  }
}
