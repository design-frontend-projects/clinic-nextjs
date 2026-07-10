// src/features/settings/services/sequence.service.ts
// Document numbering: claims go through public.claim_document_number() so the
// database row lock serializes concurrent claims. This service handles config
// CRUD and non-consuming previews; formatting mirrors the SQL function.
import { SettingsRepository } from "../repositories/settings.repository";
import type { SequenceUpsertInput } from "../domain/dtos";

export function computePeriodKey(resetPeriod: string, now: Date = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  if (resetPeriod === "yearly") return year;
  if (resetPeriod === "monthly") return `${year}-${month}`;
  return "";
}

export function formatDocumentNumber(
  config: { prefix: string; padding: number; include_period: boolean },
  periodKey: string,
  value: number | bigint
): string {
  const period = config.include_period && periodKey !== "" ? `${periodKey}-` : "";
  return `${config.prefix}${period}${String(value).padStart(config.padding, "0")}`;
}

export function defaultPrefix(documentType: string): string {
  return `${documentType.slice(0, 3).toUpperCase()}-`;
}

export class SequenceService {
  constructor(private repo: SettingsRepository = new SettingsRepository()) {}

  /** Claims the next number for (tenant, type) — atomic at the DB level. */
  async claim(tenantId: string, documentType: string): Promise<string> {
    return this.repo.claimDocumentNumber(tenantId, documentType);
  }

  async getSequences(tenantId: string) {
    return this.repo.findSequences(tenantId);
  }

  /**
   * Creates or updates the sequence config for the CURRENT period of
   * (tenant, type). claim_document_number() reads config from the latest row,
   * so updating the current-period row is what future claims will honor.
   */
  async upsertConfig(tenantId: string, input: SequenceUpsertInput, actorId: string | null) {
    const periodKey = computePeriodKey(input.reset_period);
    const existing = await this.repo.findSequenceByPeriod(tenantId, input.document_type, periodKey);
    if (existing) {
      return this.repo.updateSequenceConfig(
        existing.id,
        {
          prefix: input.prefix,
          padding: input.padding,
          resetPeriod: input.reset_period,
          includePeriod: input.include_period,
        },
        actorId
      );
    }
    return this.repo.createSequence(
      tenantId,
      {
        documentType: input.document_type,
        prefix: input.prefix,
        padding: input.padding,
        resetPeriod: input.reset_period,
        includePeriod: input.include_period,
        periodKey,
      },
      actorId
    );
  }

  /** What the next claimed number WOULD look like — does not consume a number. */
  async previewNext(tenantId: string, input: SequenceUpsertInput): Promise<string> {
    const periodKey = computePeriodKey(input.reset_period);
    const row = await this.repo.findSequenceByPeriod(tenantId, input.document_type, periodKey);
    const nextValue = row ? BigInt(row.current_value) + BigInt(1) : BigInt(1);
    return formatDocumentNumber(
      { prefix: input.prefix, padding: input.padding, include_period: input.include_period },
      periodKey,
      nextValue
    );
  }
}

export const sequenceService = new SequenceService();
