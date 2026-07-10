// src/features/settings/services/template.service.ts
// Notification template resolution + {{variable}} rendering.
// Fallback chain: tenant+locale > tenant+'en' > global+locale > global+'en'.
// Upserts use find-then-write in a transaction (partial unique indexes).
import { Prisma } from "@prisma/client";
import { SettingsRepository } from "../repositories/settings.repository";
import { SettingsCacheService, settingsCacheService } from "./cache.service";
import type { RenderedTemplate } from "../domain/models";
import type { TemplateUpsertInput } from "../domain/dtos";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1]);
  }
  return [...found];
}

export function renderTemplateText(
  text: string,
  data: Record<string, string>
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const rendered = text.replace(VARIABLE_PATTERN, (placeholder, name: string) => {
    if (name in data) return data[name];
    if (!missing.includes(name)) missing.push(name);
    return placeholder; // keep unresolved placeholders visible
  });
  return { rendered, missing };
}

interface TemplateRow {
  tenant_id: string | null;
  channel: string;
  template_key: string;
  locale: string;
  subject: string | null;
  body: string;
  is_active: boolean;
}

export function pickTemplate<T extends TemplateRow>(
  templates: T[],
  channel: string,
  templateKey: string,
  locale: string
): T | null {
  const candidates = templates.filter(
    (t) => t.channel === channel && t.template_key === templateKey && t.is_active
  );
  const attempts: { tenant: boolean; locale: string }[] = [
    { tenant: true, locale },
    { tenant: true, locale: "en" },
    { tenant: false, locale },
    { tenant: false, locale: "en" },
  ];
  for (const attempt of attempts) {
    const match = candidates.find(
      (t) => (attempt.tenant ? t.tenant_id !== null : t.tenant_id === null) && t.locale === attempt.locale
    );
    if (match) return match;
  }
  return null;
}

export class TemplateService {
  constructor(
    private repo: SettingsRepository = new SettingsRepository(),
    private cache: SettingsCacheService = settingsCacheService
  ) {}

  async getTemplates(tenantId: string, channel?: string) {
    return this.repo.findTemplates(tenantId, channel);
  }

  private async upsertByNaturalKey(tenantId: string | null, input: TemplateUpsertInput, actorId: string | null) {
    const variables = (input.variables ?? null) as Prisma.InputJsonValue | null;
    return this.repo.runInTransaction(async (tx) => {
      const existing = await this.repo.findTemplateByNaturalKey(
        tenantId,
        input.channel,
        input.template_key,
        input.locale,
        tx
      );
      if (existing) {
        return this.repo.updateTemplate(
          existing.id,
          { subject: input.subject ?? null, body: input.body, variables },
          actorId,
          tx
        );
      }
      return this.repo.createTemplate(
        {
          tenantId,
          channel: input.channel,
          templateKey: input.template_key,
          locale: input.locale,
          subject: input.subject ?? null,
          body: input.body,
          variables,
        },
        actorId,
        tx
      );
    });
  }

  /** Creates or updates a TENANT override of a template. */
  async upsertTenantTemplate(tenantId: string, input: TemplateUpsertInput, actorId: string | null) {
    const result = await this.upsertByNaturalKey(tenantId, input, actorId);
    await this.cache.invalidateTemplates(tenantId);
    return result;
  }

  /** App-owner: creates or updates a GLOBAL default template. */
  async upsertGlobalTemplate(input: TemplateUpsertInput, actorId: string | null) {
    return this.upsertByNaturalKey(null, input, actorId);
  }

  async render(
    tenantId: string,
    channel: string,
    templateKey: string,
    locale: string,
    data: Record<string, string>
  ): Promise<RenderedTemplate | null> {
    const templates = await this.repo.findTemplates(tenantId, channel);
    const template = pickTemplate(templates, channel, templateKey, locale);
    if (!template) return null;

    const body = renderTemplateText(template.body, data);
    const subject = template.subject ? renderTemplateText(template.subject, data) : null;
    const missingVariables = [...new Set([...body.missing, ...(subject?.missing ?? [])])];

    return {
      subject: subject?.rendered ?? null,
      body: body.rendered,
      missingVariables,
      source: template.tenant_id === null ? "global" : "tenant",
      locale: template.locale,
    };
  }
}

export const templateService = new TemplateService();
