import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.constants';
import { users, type User } from '../database/schema';

/**
 * Owns the local `users` table, which mirrors Supabase Auth users. The row is
 * created lazily the first time we see an authenticated user (at sign-up, and
 * defensively on any authenticated request) so the rest of the domain can rely
 * on a local user record with foreign keys.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Ensures a local user row exists for the given Supabase auth identity.
   * Idempotent: inserts on first sight, otherwise refreshes the email so the
   * local copy stays consistent with Auth. Returns the persisted row.
   */
  async ensureUser(authUserId: string, email: string): Promise<User> {
    return this.db.transaction(async (tx) => {
      // Reconcile any stale row that holds this email under a *different* auth
      // id — left behind when a previous Auth account with the same address was
      // deleted and recreated (Auth issues a fresh UUID each time). `email` is
      // unique, so without clearing it the insert below would fail with
      // users_email_key even though `id` is new. The orphaned row's child data
      // (profile, goals, …) cascade-deletes with it, which is correct: it
      // belonged to an account that no longer exists.
      await tx.delete(users).where(and(eq(users.email, email), ne(users.id, authUserId)));

      const [row] = await tx
        .insert(users)
        .values({ id: authUserId, email })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, updatedAt: new Date() },
        })
        .returning();

      return row;
    });
  }

  async findById(authUserId: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({ where: eq(users.id, authUserId) });
  }
}
