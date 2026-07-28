import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { snapshotPeriodEnum } from '../../database/schema';

const PERIODS = snapshotPeriodEnum.enumValues;

/** Upper bound on how many stored periods one request may return. */
export const MAX_SNAPSHOT_LIMIT = 52;
export const DEFAULT_SNAPSHOT_LIMIT = 12;

/**
 * Selects which of the Progress tab's two segments to build. Defaults to `week`,
 * matching the tab the screen opens on.
 */
export class ProgressOverviewQueryDto {
  @IsOptional()
  @IsIn(PERIODS, { message: 'period must be week or month.' })
  period?: (typeof PERIODS)[number];
}

/** Pages a user's stored roll-ups, newest first. */
export class ProgressSnapshotsQueryDto {
  @IsOptional()
  @IsIn(PERIODS, { message: 'period must be week or month.' })
  period?: (typeof PERIODS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SNAPSHOT_LIMIT)
  limit?: number;
}
