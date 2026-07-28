import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

/** Request a password-reset email for the given address. */
export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'A valid email address is required.' })
  email!: string;
}
