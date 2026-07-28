import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Sends one turn to the coach.
 *
 * The length ceiling is a cost control as much as a validation rule: the whole
 * conversation is replayed to the model on every turn, so an unbounded message
 * inflates the price of every subsequent one in the same thread.
 */
export class SendMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'content cannot be empty.' })
  @MaxLength(4000)
  content!: string;
}
