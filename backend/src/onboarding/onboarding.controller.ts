import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto';
import type { OnboardingOverview, OnboardingView } from './onboarding.view';
import { OnboardingService } from './onboarding.service';

/**
 * Onboarding endpoint, mounted at `/api/v1/onboarding`. Protected by the global
 * auth guard: the client submits the completed onboarding form once, after
 * signing up, and the whole payload is persisted in a single call.
 */
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitOnboardingDto,
  ): Promise<OnboardingView> {
    return this.onboarding.submit(user.id, user.email, dto);
  }

  /** Reads back the caller's persisted onboarding state for display after sign-in. */
  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<OnboardingOverview> {
    return this.onboarding.get(user.id);
  }
}
