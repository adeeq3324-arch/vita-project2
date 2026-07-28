import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.constants';
import { healthConditions, type HealthConditionRow } from '../database/schema';

type ConditionValue = HealthConditionRow['condition'];

/**
 * Owns the current user's declared health conditions (a set, modelled as a join
 * table). Reads and fully-replaces the set; every query is scoped to the
 * caller's `user_id`.
 */
@Injectable()
export class HealthConditionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Lists the user's currently declared conditions. */
  async list(userId: string): Promise<ConditionValue[]> {
    const rows = await this.db.query.healthConditions.findMany({
      where: eq(healthConditions.userId, userId),
    });
    return rows.map((row) => row.condition);
  }

  /**
   * Replaces the user's condition set with exactly `input` (after dropping the
   * UI-only `none` sentinel and de-duplicating). Clear + insert runs in a
   * transaction so the set is never left partially updated.
   */
  async replace(userId: string, input: readonly string[]): Promise<ConditionValue[]> {
    const conditions = this.normalise(input);

    return this.db.transaction(async (tx) => {
      await tx.delete(healthConditions).where(eq(healthConditions.userId, userId));

      if (conditions.length > 0) {
        await tx
          .insert(healthConditions)
          .values(conditions.map((condition) => ({ userId, condition })));
      }

      return conditions;
    });
  }

  /** Drops the UI-only `none` sentinel and de-duplicates. */
  private normalise(input: readonly string[]): ConditionValue[] {
    const real = input.filter((value): value is ConditionValue => value !== 'none');
    return Array.from(new Set(real));
  }
}
