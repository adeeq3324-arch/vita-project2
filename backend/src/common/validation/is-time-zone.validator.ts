import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidTimeZone } from '../util/date.util';

/**
 * Validates an IANA time-zone identifier (`Europe/London`, `America/New_York`)
 * by asking the runtime's own ICU database to resolve it. That is the only
 * check that matches how the value is later used — anything `Intl` accepts here
 * is guaranteed to format correctly downstream.
 */
export function IsTimeZone(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && value.length > 0 && isValidTimeZone(value),
        defaultMessage: () =>
          `${String(propertyName)} must be a valid IANA time zone, e.g. "Europe/London".`,
      },
    });
  };
}
