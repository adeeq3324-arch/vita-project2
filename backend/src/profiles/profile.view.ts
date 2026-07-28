import type { Profile } from '../database/schema';

/**
 * Client-facing profile representation. Height/weight are exposed as numbers
 * (the database stores them as fixed-precision `numeric`, which Drizzle returns
 * as strings) so the API contract stays clean and JSON-native.
 */
export interface ProfileView {
  id: string;
  userId: string;
  username: string;
  age: number;
  gender: Profile['gender'];
  height: number;
  weight: number;
  activityLevel: Profile['activityLevel'];
  unitSystem: Profile['unitSystem'];
  /** IANA time zone the user's calendar days are resolved in. */
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

/** Maps a persisted profile row to its client-facing view. */
export function toProfileView(profile: Profile): ProfileView {
  return {
    id: profile.id,
    userId: profile.userId,
    username: profile.name,
    age: profile.age,
    gender: profile.gender,
    height: Number(profile.heightCm),
    weight: Number(profile.weightKg),
    activityLevel: profile.activityLevel,
    unitSystem: profile.unitSystem,
    timezone: profile.timezone,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
