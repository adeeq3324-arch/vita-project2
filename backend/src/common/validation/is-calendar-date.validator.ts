import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidIsoDate } from '../util/date.util';

/**
 * Validates a `YYYY-MM-DD` calendar date. Stricter than a regex or `Date.parse`:
 * it rejects both malformed strings and dates that merely look plausible but do
 * not exist (`2025-02-30`), which `Date` would otherwise silently roll over
 * into March.
 */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && isValidIsoDate(value),
        defaultMessage: () => `${String(propertyName)} must be a valid date in YYYY-MM-DD format.`,
      },
    });
  };
}
