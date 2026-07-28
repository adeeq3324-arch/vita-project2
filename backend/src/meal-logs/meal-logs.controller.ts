import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMealLogDto } from './dto/create-meal-log.dto';
import {
  DayQueryDto,
  MealHistoryQueryDto,
  RecentMealLogsQueryDto,
} from './dto/query-meal-logs.dto';
import { UpdateMealLogDto } from './dto/update-meal-log.dto';
import type {
  MealHistoryDayView,
  MealLogDayView,
  MealLogView,
} from './meal-log.view';
import { MealLogsService } from './meal-logs.service';

/**
 * Food diary endpoints, mounted at `/api/v1/meal-logs`. Every route is
 * protected by the global auth guard and operates strictly on the authenticated
 * user's own entries.
 *
 * The static `recent` and `history` routes are declared before the `:id`
 * parameter route so they are matched literally rather than being swallowed as
 * an id.
 */
@Controller({ path: 'meal-logs', version: '1' })
export class MealLogsController {
  constructor(private readonly mealLogs: MealLogsService) {}

  /** Logs a meal — from the catalogue (`foodId`) or a custom entry. */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMealLogDto,
  ): Promise<MealLogView> {
    return this.mealLogs.create(user.id, dto);
  }

  /** A diary day with its entries and totals. Defaults to today. */
  @Get()
  getDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DayQueryDto,
  ): Promise<MealLogDayView> {
    return this.mealLogs.getDay(user.id, query.date);
  }

  /** "Recent Meals" — newest entries across all days, for quick re-adding. */
  @Get('recent')
  getRecent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentMealLogsQueryDto,
  ): Promise<MealLogView[]> {
    return this.mealLogs.getRecent(user.id, query.limit);
  }

  /** "Meal History" — per-day roll-ups over a window, newest day first. */
  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MealHistoryQueryDto,
  ): Promise<MealHistoryDayView[]> {
    return this.mealLogs.getHistory(user.id, query);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MealLogView> {
    return this.mealLogs.getById(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealLogDto,
  ): Promise<MealLogView> {
    return this.mealLogs.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.mealLogs.remove(user.id, id);
  }
}
