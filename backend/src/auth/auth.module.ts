import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

/**
 * Auth module. Provides the email/password auth flows and registers
 * {@link SupabaseAuthGuard} as a global guard so every route is protected by
 * default; entry-point routes opt out with `@Public()`. Supabase clients and
 * Redis are provided by their global modules.
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
})
export class AuthModule {}
