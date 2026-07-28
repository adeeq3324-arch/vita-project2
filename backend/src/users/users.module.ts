import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Users module. Exposes {@link UsersService} for other feature modules (auth,
 * profiles, onboarding) that need to reconcile the local user record with
 * Supabase Auth. The database client is provided globally by `DatabaseModule`.
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
