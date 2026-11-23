import { registerDecorator, type ValidationOptions } from "class-validator";

/** The ETA is entered in steps of a quarter hour (0.25, 0.5, 0.75, 1, ...).
 * class-validator's `IsDivisibleBy` truncates its divisor to an integer, so it
 * cannot express this. Quarter hours are exact in binary floating point, so the
 * remainder check is exact. */
export function IsQuarterHours(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: "isQuarterHours",
      target: target.constructor,
      propertyName: String(propertyKey),
      ...(options ? { options } : {}),
      validator: {
        validate: (value: unknown) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          value % 0.25 === 0,
        defaultMessage: (args) =>
          `${args?.property ?? "value"} must be a multiple of 0.25 (a quarter hour)`,
      },
    });
  };
}
