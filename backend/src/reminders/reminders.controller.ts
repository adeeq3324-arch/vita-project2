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
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderListQueryDto } from './dto/query-reminders.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import type { ReminderView } from './reminder.view';
import { RemindersService } from './reminders.service';

/**
 * Reminder endpoints, mounted at `/api/v1/reminders`. Every route is protected by
 * the global auth guard and operates strictly on the authenticated user's own
 * reminders.
 *
 * The list's on/off switch is a `PATCH :id` with `{ "enabled": … }` rather than a
 * separate toggle route: it is a partial update of one field, and giving it its own
 * verb would mean two ways to change the same column.
 */
@Controller({ path: 'reminders', version: '1' })
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /** Creates a reminder. Enabled and repeating daily unless told otherwise. */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReminderDto,
  ): Promise<ReminderView> {
    return this.reminders.create(user.id, dto);
  }

  /** The caller's reminders, ordered by time of day. Filterable as the screen does. */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReminderListQueryDto,
  ): Promise<ReminderView[]> {
    return this.reminders.list(user.id, query.filter ?? 'all');
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReminderView> {
    return this.reminders.getById(user.id, id);
  }

  /** Partial update — the switch, the time, the days, the wording. */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReminderDto,
  ): Promise<ReminderView> {
    return this.reminders.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.reminders.remove(user.id, id);
  }
}
