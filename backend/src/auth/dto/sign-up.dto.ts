import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Minimum password length — mirrors the client's sign-up validation. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt/Supabase upper bound.

/** Credentials for creating a new email/password account. */
export class SignUpDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'A valid email address is required.' })
  email!: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
