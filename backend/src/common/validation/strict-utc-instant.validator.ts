import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const UTC_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function isStrictUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = UTC_INSTANT.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year === 0 || month < 1 || month > 12) return false;

  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    day >= 1 &&
    day <= days[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

export function IsStrictUtcInstant(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isStrictUtcInstant',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isStrictUtcInstant,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid UTC instant ending in Z`,
      },
    });
  };
}
