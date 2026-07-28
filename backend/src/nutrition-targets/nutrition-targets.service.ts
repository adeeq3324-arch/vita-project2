import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CacheKeys, CacheTtl } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import { nutritionTargets, type NewNutritionTarget, type NutritionTarget } from '../database/schema';
import { GoalsService } from '../goals/goals.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { SetNutritionTargetsDto } from './dto/set-nutrition-targets.dto';
import {
  deriveTargets,
  fingerprintInputs,
  toTargetInputs,
  type DerivedTargets,
} from './nutrition.calculator';
import { toNutritionTargetView, type NutritionTargetView } from './nutrition-target.view';

/**
 * The user's daily nutrition targets.
 *
 * Reads are served from Redis, falling back to the stored row, falling back to
 * a fresh derivation — a three-tier path that keeps the common case (the home
 * feed asking for targets on every load) off both the calculator and the
 * database.
 *
 * Correctness does not depend on cache invalidation alone. Every stored row
 * carries a fingerprint of the profile and goal it was derived from, so even if
 * an invalidation were missed, the next read detects the mismatch and
 * recomputes. `custom` targets are exempt: an explicit user choice is never
 * silently overwritten.
 */
@Injectable()
export class NutritionTargetsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly profiles: ProfilesService,
    private readonly goals: GoalsService,
    private readonly cache: CacheService,
  ) {}

  /** Current targets, deriving and persisting them on first use. */
  async get(userId: string): Promise<NutritionTargetView> {
    const cached = await this.cache.get<NutritionTargetView>(CacheKeys.nutritionTargets(userId));
    if (cached) {
      return cached;
    }

    const view = toNutritionTargetView(await this.resolve(userId));
    await this.cache.set(CacheKeys.nutritionTargets(userId), view, CacheTtl.nutritionTargets);
    return view;
  }

  /**
   * Overrides one or more targets. Unspecified fields keep whatever the current
   * targets hold, and the row switches to `custom` so the derivation stops
   * overwriting it.
   */
  async setCustom(userId: string, dto: SetNutritionTargetsDto): Promise<NutritionTargetView> {
    const current = await this.resolve(userId);

    const saved = await this.persist(userId, {
      source: 'custom',
      calories: dto.calories ?? current.calories,
      proteinG: dto.protein ?? current.proteinG,
      carbsG: dto.carbs ?? current.carbsG,
      fatG: dto.fat ?? current.fatG,
      fiberG: dto.fiber ?? current.fiberG,
      waterMl: dto.waterMl ?? current.waterMl,
      mealsPerDay: dto.mealsPerDay ?? current.mealsPerDay,
      bmr: current.bmr,
      tdee: current.tdee,
      // Kept current so switching back to `derived` starts from a clean slate.
      inputsFingerprint: current.inputsFingerprint,
    });

    return this.publish(userId, saved);
  }

  /** Discards any override and re-derives the targets from the profile and goal. */
  async recalculate(userId: string): Promise<NutritionTargetView> {
    const saved = await this.derive(userId);
    return this.publish(userId, saved);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * The authoritative stored row: reused when it is still valid, re-derived when
   * the inputs behind it have changed, created when there is none yet.
   */
  private async resolve(userId: string): Promise<NutritionTarget> {
    const [stored, profile, goal] = await Promise.all([
      this.db.query.nutritionTargets.findFirst({ where: eq(nutritionTargets.userId, userId) }),
      this.profiles.findRawByUserId(userId),
      this.goals.findRawByUserId(userId),
    ]);

    // A user-set target stands on its own and needs no profile to remain valid.
    if (stored?.source === 'custom') {
      return stored;
    }

    if (!profile || !goal) {
      throw new NotFoundException(
        'Nutrition targets need a profile and a goal. Complete onboarding first.',
      );
    }

    const fingerprint = fingerprintInputs(toTargetInputs(profile, goal));
    if (stored && stored.inputsFingerprint === fingerprint) {
      return stored;
    }

    return this.derive(userId);
  }

  /** Computes fresh targets from the profile and goal, and stores them. */
  private async derive(userId: string): Promise<NutritionTarget> {
    const [profile, goal] = await Promise.all([
      this.profiles.findRawByUserId(userId),
      this.goals.findRawByUserId(userId),
    ]);

    if (!profile || !goal) {
      throw new NotFoundException(
        'Nutrition targets need a profile and a goal. Complete onboarding first.',
      );
    }

    const inputs = toTargetInputs(profile, goal);
    const derived: DerivedTargets = deriveTargets(inputs);

    return this.persist(userId, {
      source: 'derived',
      calories: derived.calories,
      proteinG: derived.proteinG,
      carbsG: derived.carbsG,
      fatG: derived.fatG,
      fiberG: derived.fiberG,
      waterMl: derived.waterMl,
      mealsPerDay: derived.mealsPerDay,
      bmr: derived.bmr.toString(),
      tdee: derived.tdee.toString(),
      inputsFingerprint: fingerprintInputs(inputs),
    });
  }

  /** Upserts the single target row for a user. */
  private async persist(
    userId: string,
    values: Omit<NewNutritionTarget, 'userId'>,
  ): Promise<NutritionTarget> {
    const now = new Date();
    const row = { ...values, computedAt: now };

    const [saved] = await this.db
      .insert(nutritionTargets)
      .values({ userId, ...row })
      .onConflictDoUpdate({
        target: nutritionTargets.userId,
        set: { ...row, updatedAt: now },
      })
      .returning();

    return saved;
  }

  /** Refreshes the cache with a freshly written row and returns its view. */
  private async publish(userId: string, target: NutritionTarget): Promise<NutritionTargetView> {
    const view = toNutritionTargetView(target);
    await this.cache.set(CacheKeys.nutritionTargets(userId), view, CacheTtl.nutritionTargets);
    return view;
  }
}
