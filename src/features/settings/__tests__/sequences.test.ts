// src/features/settings/__tests__/sequences.test.ts
// Formatting + period logic are pure; the atomicity contract itself lives in
// public.claim_document_number() (INSERT ... ON CONFLICT DO UPDATE row lock)
// and is exercised against the real database, not here.
import { describe, it, expect, vi } from "vitest";
import {
  SequenceService,
  computePeriodKey,
  defaultPrefix,
  formatDocumentNumber,
} from "../services/sequence.service";
import type { SettingsRepository } from "../repositories/settings.repository";

describe("computePeriodKey", () => {
  const june = new Date("2026-06-15T10:00:00Z");

  it("is empty for reset_period never", () => {
    expect(computePeriodKey("never", june)).toBe("");
  });

  it("is the year for yearly", () => {
    expect(computePeriodKey("yearly", june)).toBe("2026");
  });

  it("is YYYY-MM (zero-padded) for monthly", () => {
    expect(computePeriodKey("monthly", june)).toBe("2026-06");
  });
});

describe("formatDocumentNumber", () => {
  it("pads the counter to the configured width", () => {
    expect(formatDocumentNumber({ prefix: "INV-", padding: 5, include_period: true }, "", 7)).toBe("INV-00007");
  });

  it("includes the period key when configured", () => {
    expect(formatDocumentNumber({ prefix: "INV-", padding: 4, include_period: true }, "2026", 12)).toBe(
      "INV-2026-0012"
    );
  });

  it("omits the period key when include_period is false", () => {
    expect(formatDocumentNumber({ prefix: "INV-", padding: 4, include_period: false }, "2026", 12)).toBe("INV-0012");
  });

  it("handles bigint counters", () => {
    expect(formatDocumentNumber({ prefix: "", padding: 3, include_period: false }, "", BigInt(42))).toBe("042");
  });
});

describe("defaultPrefix", () => {
  it("derives a 3-letter prefix from the document type", () => {
    expect(defaultPrefix("invoice")).toBe("INV-");
    expect(defaultPrefix("receipt")).toBe("REC-");
  });
});

describe("SequenceService.previewNext", () => {
  const input = {
    document_type: "invoice",
    prefix: "INV-",
    padding: 5,
    reset_period: "never" as const,
    include_period: true,
  };

  it("previews 1 when no sequence row exists yet", async () => {
    const repo = {
      findSequenceByPeriod: vi.fn().mockResolvedValue(null),
    } as unknown as SettingsRepository;
    const service = new SequenceService(repo);
    await expect(service.previewNext("tenant-1", input)).resolves.toBe("INV-00001");
  });

  it("previews current_value + 1 without consuming a number", async () => {
    const repo = {
      findSequenceByPeriod: vi.fn().mockResolvedValue({ id: "row-1", current_value: BigInt(41) }),
    } as unknown as SettingsRepository;
    const service = new SequenceService(repo);
    await expect(service.previewNext("tenant-1", input)).resolves.toBe("INV-00042");
  });

  it("previews with the yearly period key when configured", async () => {
    const repo = {
      findSequenceByPeriod: vi.fn().mockResolvedValue(null),
    } as unknown as SettingsRepository;
    const service = new SequenceService(repo);
    const yearly = { ...input, reset_period: "yearly" as const };
    const expectedPeriod = computePeriodKey("yearly");
    await expect(service.previewNext("tenant-1", yearly)).resolves.toBe(`INV-${expectedPeriod}-00001`);
  });
});

describe("SequenceService.upsertConfig", () => {
  const input = {
    document_type: "invoice",
    prefix: "F-",
    padding: 6,
    reset_period: "monthly" as const,
    include_period: true,
  };

  it("updates the current-period row when one exists", async () => {
    const updateSequenceConfig = vi.fn().mockResolvedValue({ id: "row-1" });
    const repo = {
      findSequenceByPeriod: vi.fn().mockResolvedValue({ id: "row-1" }),
      updateSequenceConfig,
      createSequence: vi.fn(),
    } as unknown as SettingsRepository;
    const service = new SequenceService(repo);
    await service.upsertConfig("tenant-1", input, "actor-1");
    expect(updateSequenceConfig).toHaveBeenCalledWith(
      "row-1",
      { prefix: "F-", padding: 6, resetPeriod: "monthly", includePeriod: true },
      "actor-1"
    );
  });

  it("creates a row for the current period when none exists", async () => {
    const createSequence = vi.fn().mockResolvedValue({ id: "row-2" });
    const repo = {
      findSequenceByPeriod: vi.fn().mockResolvedValue(null),
      updateSequenceConfig: vi.fn(),
      createSequence,
    } as unknown as SettingsRepository;
    const service = new SequenceService(repo);
    await service.upsertConfig("tenant-1", input, "actor-1");
    expect(createSequence).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        documentType: "invoice",
        periodKey: computePeriodKey("monthly"),
      }),
      "actor-1"
    );
  });
});
