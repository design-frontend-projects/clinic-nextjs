// src/features/settings/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateSettingValue, zodFromDefinition } from "../domain/validation";

describe("zodFromDefinition — per value_type", () => {
  it("string enforces maxLength and pattern", () => {
    const definition = { value_type: "string", validation: { maxLength: 5 } };
    expect(zodFromDefinition(definition).safeParse("abcdef").success).toBe(false);
    expect(zodFromDefinition(definition).safeParse("abc").success).toBe(true);

    const patterned = { value_type: "string", validation: { pattern: "^[A-Z]{3}$" } };
    expect(zodFromDefinition(patterned).safeParse("USD").success).toBe(true);
    expect(zodFromDefinition(patterned).safeParse("usd").success).toBe(false);
  });

  it("number enforces min/max and rejects strings", () => {
    const definition = { value_type: "number", validation: { min: 5, max: 240 } };
    expect(zodFromDefinition(definition).safeParse(30).success).toBe(true);
    expect(zodFromDefinition(definition).safeParse(4).success).toBe(false);
    expect(zodFromDefinition(definition).safeParse(241).success).toBe(false);
    expect(zodFromDefinition(definition).safeParse("30").success).toBe(false);
  });

  it("boolean accepts only booleans", () => {
    const definition = { value_type: "boolean", validation: null };
    expect(zodFromDefinition(definition).safeParse(true).success).toBe(true);
    expect(zodFromDefinition(definition).safeParse("true").success).toBe(false);
  });

  it("enum restricts to the declared options", () => {
    const definition = { value_type: "enum", validation: { enum: ["en", "ar"] } };
    expect(zodFromDefinition(definition).safeParse("ar").success).toBe(true);
    expect(zodFromDefinition(definition).safeParse("fr").success).toBe(false);
  });

  it("color requires #RRGGBB", () => {
    const definition = { value_type: "color", validation: null };
    expect(zodFromDefinition(definition).safeParse("#0ea5e9").success).toBe(true);
    expect(zodFromDefinition(definition).safeParse("blue").success).toBe(false);
    expect(zodFromDefinition(definition).safeParse("#0ea5e").success).toBe(false);
  });

  it("email allows a valid address or empty string", () => {
    const definition = { value_type: "email", validation: null };
    expect(zodFromDefinition(definition).safeParse("clinic@example.com").success).toBe(true);
    expect(zodFromDefinition(definition).safeParse("").success).toBe(true);
    expect(zodFromDefinition(definition).safeParse("not-an-email").success).toBe(false);
  });

  it("json with itemKeys requires those keys on every array item", () => {
    const definition = { value_type: "json", validation: { itemKeys: ["channel", "offset_hours"] } };
    expect(
      zodFromDefinition(definition).safeParse([{ channel: "email", offset_hours: 24 }]).success
    ).toBe(true);
    expect(zodFromDefinition(definition).safeParse([{ channel: "email" }]).success).toBe(false);
  });
});

describe("zodFromDefinition — weekly_schedule", () => {
  const definition = { value_type: "weekly_schedule", validation: null };
  const day = { enabled: true, start: "09:00", end: "17:00" };
  const fullWeek = {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: day,
    sunday: { ...day, enabled: false },
  };

  it("accepts a full 7-day schedule", () => {
    expect(zodFromDefinition(definition).safeParse(fullWeek).success).toBe(true);
  });

  it("rejects a schedule missing a day", () => {
    const { sunday: _sunday, ...missingDay } = fullWeek;
    expect(zodFromDefinition(definition).safeParse(missingDay).success).toBe(false);
  });

  it("rejects invalid time strings", () => {
    const invalid = { ...fullWeek, monday: { enabled: true, start: "9am", end: "17:00" } };
    expect(zodFromDefinition(definition).safeParse(invalid).success).toBe(false);
  });
});

describe("validateSettingValue", () => {
  it("returns the parsed value on success", () => {
    const result = validateSettingValue(
      { key: "appointments.slot_duration_minutes", value_type: "number", validation: { min: 5 } },
      30
    );
    expect(result).toEqual({ success: true, value: 30 });
  });

  it("prefixes errors with the setting key", () => {
    const result = validateSettingValue(
      { key: "appointments.slot_duration_minutes", value_type: "number", validation: { min: 5 } },
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("appointments.slot_duration_minutes");
    }
  });
});
