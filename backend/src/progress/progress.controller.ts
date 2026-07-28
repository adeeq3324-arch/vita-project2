import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ProgressOverviewQueryDto,
  ProgressSnapshotsQueryDto,
} from './dto/query-progress.dto';
import { RecordSnapshotDto } from './dto/record-snapshot.dto';
import type { ProgressSnapshotView } from './progress-snapshot.view';
import { ProgressService } from './progress.service';
import type { ProgressOverviewView } from './progress.view';

/**
 * Progress analytics endpoints, mounted at `/api/v1/progress`.
 *
 * `GET /progress` is the whole Progress tab in one response — every chart, the
 * measurement row, the macro legend, the badge rail and the milestone bars. One
 * request rather than eight is deliberate: the screen renders as a unit, and eight
 * round trips would show it filling in piecemeal.
 */
@Controller({ path: 'progress', version: '1' })
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  /** The Progress tab for one segment. Defaults to `week`. */
  @Get()
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProgressOverviewQueryDto,
  ): Promise<ProgressOverviewView> {
    return this.progress.getOverview(user.id, query.period ?? 'week');
  }

  /** Stored period roll-ups, newest first — the long-range history. */
  @Get('snapshots')
  listSnapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProgressSnapshotsQueryDto,
  ): Promise<ProgressSnapshotView[]> {
    return this.progress.listSnapshots(user.id, query);
  }

  /**
   * Rolls up a period, optionally recording the body measurements that belong to
   * it. Idempotent — the same period recomputes in place.
   *
   * Returns 201 with the stored snapshot. This is how the app's "log my
   * measurements" sheet saves, and how a user pulling to refresh materialises the
   * period in progress ahead of the scheduled sweep.
   */
  @Post('snapshots')
  recordSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordSnapshotDto,
  ): Promise<ProgressSnapshotView> {
    return this.progress.recordSnapshot(user.id, dto);
  }
}
