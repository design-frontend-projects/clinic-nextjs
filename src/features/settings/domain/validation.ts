// src/features/settings/domain/validation.ts
// Builds a Zod schema from a setting definition (value_type + validation JSON).
// This is the server-side gate for every settings write, and values are also
// re-parsed through it on read so a stale row after a definition change falls
// back to the next resolution layer instead of leaking an invalid value.
import { z } from "zod";
import type { SettingDefinition } from "./models";
import { WEEK_DAYS } from "./models";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(TIME_PATTERN, "Invalid time (expected HH:MM)"),
  end: z.string().regex(TIME_PATTERN, "Invalid time (expected HH:MM)"),
});

export const weeklyScheduleSchema = z.object(
  Object.fromEntries(WEEK_DAYS.map((day) => [day, dayScheduleSchema])) as Record<
    (typeof WEEK_DAYS)[number],
    typeof dayScheduleSchema
  >
);

interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  itemKeys?: string[];
}

function parseRules(validation: unknown): ValidationRules {
  if (validation && typeof validation === "object" && !Array.isArray(validation)) {
    return validation as ValidationRules;
  }
  return {};
}

function stringSchema(rules: ValidationRules): z.ZodTypeAny {
  let schema = z.string();
  if (rules.minLength !== undefined) schema = schema.min(rules.minLength);
  if (rules.maxLength !== undefined) schema = schema.max(rules.maxLength);
  if (rules.pattern) schema = schema.regex(new RegExp(rules.pattern), "Value does not match the required pattern");
  return schema;
}

function numberSchema(rules: ValidationRules): z.ZodTypeAny {
  let schema = z.number();
  if (rules.min !== undefined) schema = schema.min(rules.min);
  if (rules.max !== undefined) schema = schema.max(rules.max);
  return schema;
}

function enumSchema(rules: ValidationRules): z.ZodTypeAny {
  if (Array.isArray(rules.enum) && rules.enum.length > 0) {
    return z.enum(rules.enum as [string, ...string[]]);
  }
  return z.string();
}

function jsonSchema(rules: ValidationRules): z.ZodTypeAny {
  const base = z.unknown().refine((value) => value !== undefined, "Value is required");
  if (!Array.isArray(rules.itemKeys) || rules.itemKeys.length === 0) return base;
  const requiredKeys = rules.itemKeys;
  return base.refine(
    (value) => {
      if (!Array.isArray(value)) return true;
      return value.every(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          requiredKeys.every((key) => key in (item as Record<string, unknown>))
      );
    },
    { message: `Each item must contain the keys: ${requiredKeys.join(", ")}` }
  );
}

/**
 * Builds the runtime Zod schema for a setting definition.
 */
export function zodFromDefinition(definition: Pick<SettingDefinition, "value_type" | "validation">): z.ZodTypeAny {
  const rules = parseRules(definition.validation);
  switch (definition.value_type) {
    case "string":
      return stringSchema(rules);
    case "number":
      return numberSchema(rules);
    case "boolean":
      return z.boolean();
    case "enum":
      return enumSchema(rules);
    case "color":
      return z.string().regex(COLOR_PATTERN, "Invalid color (expected #RRGGBB)");
    case "email":
      // Empty string is allowed so unconfigured defaults ("") validate.
      return z.union([z.literal(""), z.string().email()]);
    case "weekly_schedule":
      return weeklyScheduleSchema;
    case "json":
      return jsonSchema(rules);
    default:
      return z.unknown();
  }
}

/**
 * Validates a value against a definition. Returns the parsed value or an error message.
 */
export function validateSettingValue(
  definition: Pick<SettingDefinition, "key" | "value_type" | "validation">,
  value: unknown
): { success: true; value: unknown } | { success: false; error: string } {
  const result = zodFromDefinition(definition).safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { success: false, error: `${definition.key}: ${issue?.message ?? "Invalid value"}` };
  }
  return { success: true, value: result.data };
}
