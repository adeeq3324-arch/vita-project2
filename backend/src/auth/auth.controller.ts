import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthRateLimit } from '../common/throttler/throttle.decorators';
import { AuthService, type AuthResult } from './auth.service';
import { AccessToken } from './decorators/access-token.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

/**
 * Email/password authentication endpoints, mounted at `/api/v1/auth`.
 *
 * Sign-up, login, refresh and password reset are public (no token required);
 * logout is protected by the global {@link SupabaseAuthGuard}. Social login
 * (Google/Apple) is intentionally out of scope for this phase.
 *
 * The credential routes carry a strict rate limit, keyed by address because a
 * caller attacking them has no identity yet. Refresh is left on the ordinary
 * allowance: a healthy session refreshes on a timer nobody sees, and throttling
 * that would sign people out for using the app normally.
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @AuthRateLimit()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() dto: SignUpDto): Promise<AuthResult> {
    return this.auth.signUp(dto.email, dto.password);
  }

  @Public()
  @AuthRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: SignInDto): Promise<AuthResult> {
    return this.auth.signIn(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResult> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@AccessToken() accessToken: string): Promise<void> {
    await this.auth.logout(accessToken);
  }

  @Public()
  @AuthRateLimit()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.auth.requestPasswordReset(dto.email);
    return {
      message: 'If an account exists for this email, a password reset link has been sent.',
    };
  }
}
