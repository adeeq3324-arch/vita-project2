import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import { goals, type Goal } from '../database/schema';
import type { UpdateGoalDto } from './dto/update-goal.dto';
import { toGoalView, type GoalView } from './goal.view';

/**
 * Read/update access to the current user's goal. Every query is scoped to the
 * caller's `user_id`, so a user can only ever touch their own goal (belt to the
 * RLS braces enforced in the database). The goal row itself is created during
 * onboarding; this service edits it afterwards.
 */
@Injectable()
export class GoalsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly cache: CacheService,
  ) {}

  async getByUserId(userId: string): Promise<GoalView> {
    return toGoalView(await this.findOwned(userId));
  }

  /** The raw goal row, or undefined when onboarding is incomplete. */
  async findRawByUserId(userId: string): Promise<Goal | undefined> {
    return this.db.query.goals.findFirst({ where: eq(goals.userId, userId) });
  }

  async update(userId: string, dto: UpdateGoalDto): Promise<GoalView> {
    // Ensure the goal exists and belongs to the caller before mutating.
    await this.findOwned(userId);

    const changes = this.toColumnChanges(dto);

    // Nothing to change — return the current state without a write.
    if (Object.keys(changes).length === 0) {
      return this.getByUserId(userId);
    }

    const [updated] = await this.db
      .update(goals)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(goals.userId, userId))
      .returning();

    // The goal drives the calorie adjustment and macro split, so cached
    // nutrition targets are stale the moment it changes.
    await this.cache.del(CacheKeys.nutritionTargets(userId));

    return toGoalView(updated);
  }

  private async findOwned(userId: string): Promise<Goal> {
    const goal = await this.findRawByUserId(userId);
    if (!goal) {
      throw new NotFoundException('Goal not found. Complete onboarding first.');
    }
    return goal;
  }

  /** Translates the DTO's client field names to database columns, skipping unset fields. */
  private toColumnChanges(dto: UpdateGoalDto): Partial<typeof goals.$inferInsert> {
    const changes: Partial<typeof goals.$inferInsert> = {};
    if (dto.primaryGoal !== undefined) changes.primaryGoal = dto.primaryGoal;
    if (dto.targetWeight !== undefined) changes.targetWeightKg = dto.targetWeight.toString();
    return changes;
  }
}
