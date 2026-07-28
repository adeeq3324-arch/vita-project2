import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Credentials for logging into an existing email/password account. */
export class SignInDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'A valid email address is required.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  @MaxLength(72)
  password!: string;
}
