import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DailyMetricView } from './daily-metric.view';
import { DailyMetricsService } from './daily-metrics.service';
import {
  DailyMetricsDayQueryDto,
  DailyMetricsRangeQueryDto,
} from './dto/query-daily-metrics.dto';
import { AddWaterDto, UpdateDailyMetricsDto } from './dto/update-daily-metrics.dto';

/**
 * Daily metric endpoints, mounted at `/api/v1/daily-metrics`. All routes read
 * and write only the authenticated user's own days.
 */
@Controller({ path: 'daily-metrics', version: '1' })
export class DailyMetricsController {
  constructor(private readonly metrics: DailyMetricsService) {}

  /** One day's metrics and score. Defaults to today. */
  @Get()
  getDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyMetricsDayQueryDto,
  ): Promise<DailyMetricView> {
    return this.metrics.getDay(user.id, query.date);
  }

  /** A window of days, ascending — the series behind the trend charts. */
  @Get('range')
  getRange(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyMetricsRangeQueryDto,
  ): Promise<DailyMetricView[]> {
    return this.metrics.getRange(user.id, query);
  }

  /** Writes steps, water, weight or workout status for a day. */
  @Patch()
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDailyMetricsDto,
  ): Promise<DailyMetricView> {
    return this.metrics.upsert(user.id, dto);
  }

  /** Adds a drink to the day's total — the water card's primary action. */
  @Post('water')
  @HttpCode(HttpStatus.OK)
  addWater(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddWaterDto,
  ): Promise<DailyMetricView> {
    return this.metrics.addWater(user.id, dto);
  }
}
