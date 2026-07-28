import { Body, Controller, Get, Put } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateHealthConditionsDto } from './dto/update-health-conditions.dto';
import { HealthConditionsService } from './health-conditions.service';

/**
 * Current-user health-condition endpoints, mounted at `/api/v1/health-conditions`.
 * Protected by the global auth guard; the set is read and replaced wholesale.
 */
@Controller({ path: 'health-conditions', version: '1' })
export class HealthConditionsController {
  constructor(private readonly conditions: HealthConditionsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<string[]> {
    return this.conditions.list(user.id);
  }

  @Put('me')
  replaceMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHealthConditionsDto,
  ): Promise<string[]> {
    return this.conditions.replace(user.id, dto.conditions);
  }
}
