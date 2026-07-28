import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { coachPersonalityEnum } from '../../database/schema';

const PERSONALITIES = coachPersonalityEnum.enumValues;

/**
 * Opens a coach thread. Both fields are optional: the app's "ask the coach"
 * entry point starts a conversation without making the user choose anything
 * first, and the title is derived from the opening question if none is given.
 */
export class CreateConversationDto {
  @IsOptional()
  @IsIn(PERSONALITIES, {
    message: 'personality must be scientist, motivator or zenMaster.',
  })
  personality?: (typeof PERSONALITIES)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;
}
