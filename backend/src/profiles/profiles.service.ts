import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { resolveTimeZone } from '../common/util/date.util';
import { DRIZZLE, type Database } from '../database/database.constants';
import { profiles, type Profile } from '../database/schema';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { toProfileView, type ProfileView } from './profile.view';

/**
 * Read/update access to the current user's profile. Every query is scoped to
 * the caller's `user_id`, so a user can only ever touch their own row (belt to
 * the RLS braces enforced in the database).
 */
@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly cache: CacheService,
  ) {}

  async getByUserId(userId: string): Promise<ProfileView> {
    const profile = await this.findOwned(userId);
    return toProfileView(profile);
  }

  /** The raw profile row, or undefined when onboarding is incomplete. */
  async findRawByUserId(userId: string): Promise<Profile | undefined> {
    return this.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  }

  /**
   * The time zone every day-scoped feature resolves "today" in. Falls back to
   * UTC for users who have not completed onboarding yet, so day-based endpoints
   * stay answerable rather than erroring on a missing profile.
   */
  async getTimeZone(userId: string): Promise<string> {
    const profile = await this.findRawByUserId(userId);
    return resolveTimeZone(profile?.timezone);
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<ProfileView> {
    // Ensure the profile exists and belongs to the caller before mutating.
    await this.findOwned(userId);

    const changes = this.toColumnChanges(dto);

    // Nothing to change — return the current state without a write.
    if (Object.keys(changes).length === 0) {
      return this.getByUserId(userId);
    }

    const [updated] = await this.db
      .update(profiles)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();

    // Age, weight, height and activity level are all inputs to the user's
    // nutrition targets — drop the cached copy so the next read re-derives it.
    await this.cache.del(CacheKeys.nutritionTargets(userId));

    return toProfileView(updated);
  }

  private async findOwned(userId: string): Promise<Profile> {
    const profile = await this.findRawByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Profile not found. Complete onboarding first.');
    }
    return profile;
  }

  /** Translates the DTO's client field names to database columns, skipping unset fields. */
  private toColumnChanges(dto: UpdateProfileDto): Partial<typeof profiles.$inferInsert> {
    const changes: Partial<typeof profiles.$inferInsert> = {};
    if (dto.username !== undefined) changes.name = dto.username;
    if (dto.age !== undefined) changes.age = dto.age;
    if (dto.gender !== undefined) changes.gender = dto.gender;
    if (dto.height !== undefined) changes.heightCm = dto.height.toString();
    if (dto.weight !== undefined) changes.weightKg = dto.weight.toString();
    if (dto.activityLevel !== undefined) changes.activityLevel = dto.activityLevel;
    if (dto.unitSystem !== undefined) changes.unitSystem = dto.unitSystem;
    if (dto.timezone !== undefined) changes.timezone = dto.timezone;
    return changes;
  }
}
