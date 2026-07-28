import { IsString, MinLength } from 'class-validator';

/** Payload to exchange a refresh token for a fresh session. */
export class RefreshTokenDto {
  @IsString()
  @MinLength(1, { message: 'A refresh token is required.' })
  refreshToken!: string;
}
