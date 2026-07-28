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
import type { AccentColor, WorkoutType } from '../database/schema';
import { CreateWorkoutLogDto } from './dto/create-workout-log.dto';
import {
  RecentWorkoutsQueryDto,
  WorkoutDayQueryDto,
  WorkoutHistoryQueryDto,
} from './dto/query-workout-logs.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import type {
  WorkoutDayView,
  WorkoutHistoryDayView,
  WorkoutLogView,
  WorkoutSummaryView,
} from './workout-log.view';
import { WorkoutLogsService } from './workout-logs.service';
import { workoutTypeCatalog } from './workout.presentation';

/**
 * Training diary endpoints, mounted at `/api/v1/workout-logs`. Every route is
 * protected by the global auth guard and operates strictly on the authenticated
 * user's own sessions.
 *
 * The static routes are declared before the `:id` parameter route so they are
 * matched literally rather than being swallowed as an id.
 */
@Controller({ path: 'workout-logs', version: '1' })
export class WorkoutLogsController {
  constructor(private readonly workouts: WorkoutLogsService) {}

  /** Logs a completed session. */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkoutLogDto,
  ): Promise<WorkoutLogView> {
    return this.workouts.create(user.id, dto);
  }

  /** A training day with its sessions and totals. Defaults to today. */
  @Get()
  getDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WorkoutDayQueryDto,
  ): Promise<WorkoutDayView> {
    return this.workouts.getDay(user.id, query.date);
  }

  /**
   * The workout types the app offers, with their icon and accent. Static, so the
   * picker's labels and colours are owned by the API rather than duplicated in the
   * client. Unauthenticated-safe content, but kept behind the guard like every
   * other route for consistency.
   */
  @Get('types')
  getTypes(): { type: WorkoutType; label: string; icon: string; accent: AccentColor }[] {
    return workoutTypeCatalog();
  }

  /** The newest sessions across all days, for quick re-logging. */
  @Get('recent')
  getRecent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentWorkoutsQueryDto,
  ): Promise<WorkoutLogView[]> {
    return this.workouts.getRecent(user.id, query);
  }

  /** Per-day roll-ups over a window, newest day first. */
  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WorkoutHistoryQueryDto,
  ): Promise<WorkoutHistoryDayView[]> {
    return this.workouts.getHistory(user.id, query);
  }

  /** Sessions, minutes, streak and per-type breakdown over a window. */
  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WorkoutHistoryQueryDto,
  ): Promise<WorkoutSummaryView> {
    return this.workouts.getSummaryFor(user.id, query);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkoutLogView> {
    return this.workouts.getById(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutLogDto,
  ): Promise<WorkoutLogView> {
    return this.workouts.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workouts.remove(user.id, id);
  }
}
