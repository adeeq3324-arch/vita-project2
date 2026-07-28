import { Transform } from 'class-transformer';
import { Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Scans a packaged product by its code.
 *
 * The pattern accepts the numeric symbologies a phone camera reads off grocery
 * packaging — EAN-8/13, UPC-A/E, ITF-14 — which in practice means 8 to 14
 * digits. Validating the shape here keeps junk out of the shared `products`
 * cache, where a bad key would be looked up by every future scan.
 */
export class ScanBarcodeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(8, { message: 'barcode must be between 8 and 14 digits.' })
  @MaxLength(14, { message: 'barcode must be between 8 and 14 digits.' })
  @Matches(/^\d+$/, { message: 'barcode must contain digits only.' })
  barcode!: string;
}
