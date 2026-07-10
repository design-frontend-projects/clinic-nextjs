// src/features/settings/__tests__/templates.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  TemplateService,
  extractVariables,
  pickTemplate,
  renderTemplateText,
} from "../services/template.service";
import type { SettingsRepository } from "../repositories/settings.repository";

function template(overrides: Record<string, unknown>) {
  return {
    tenant_id: null,
    channel: "email",
    template_key: "appointment.reminder",
    locale: "en",
    subject: "Reminder",
    body: "Hello {{patient_name}}",
    is_active: true,
    ...overrides,
  };
}

describe("renderTemplateText", () => {
  it("substitutes provided variables", () => {
    const { rendered, missing } = renderTemplateText("Hi {{name}}, see you {{when}}", {
      name: "Sara",
      when: "tomorrow",
    });
    expect(rendered).toBe("Hi Sara, see you tomorrow");
    expect(missing).toEqual([]);
  });

  it("keeps unresolved placeholders visible and reports them", () => {
    const { rendered, missing } = renderTemplateText("Hi {{name}}, ref {{ref}}", { name: "Sara" });
    expect(rendered).toBe("Hi Sara, ref {{ref}}");
    expect(missing).toEqual(["ref"]);
  });

  it("tolerates whitespace inside braces", () => {
    const { rendered } = renderTemplateText("Hi {{ name }}", { name: "Sara" });
    expect(rendered).toBe("Hi Sara");
  });
});

describe("extractVariables", () => {
  it("returns unique placeholder names", () => {
    expect(extractVariables("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});

describe("pickTemplate — fallback chain", () => {
  const all = [
    template({ tenant_id: null, locale: "en", body: "global-en" }),
    template({ tenant_id: null, locale: "ar", body: "global-ar" }),
    template({ tenant_id: "tenant-1", locale: "en", body: "tenant-en" }),
    template({ tenant_id: "tenant-1", locale: "ar", body: "tenant-ar" }),
  ];

  it("prefers tenant + requested locale", () => {
    const picked = pickTemplate(all, "email", "appointment.reminder", "ar");
    expect(picked?.body).toBe("tenant-ar");
  });

  it("falls back to tenant + en when the tenant lacks the locale", () => {
    const withoutTenantAr = all.filter((t) => !(t.tenant_id && t.locale === "ar"));
    const picked = pickTemplate(withoutTenantAr, "email", "appointment.reminder", "ar");
    expect(picked?.body).toBe("tenant-en");
  });

  it("falls back to global + locale when the tenant has no override", () => {
    const globalsOnly = all.filter((t) => t.tenant_id === null);
    const picked = pickTemplate(globalsOnly, "email", "appointment.reminder", "ar");
    expect(picked?.body).toBe("global-ar");
  });

  it("falls back to global + en as the last resort", () => {
    const globalEnOnly = [template({ tenant_id: null, locale: "en", body: "global-en" })];
    const picked = pickTemplate(globalEnOnly, "email", "appointment.reminder", "ar");
    expect(picked?.body).toBe("global-en");
  });

  it("returns null when nothing matches and skips inactive templates", () => {
    expect(pickTemplate([], "email", "appointment.reminder", "en")).toBeNull();
    const inactiveOnly = [template({ is_active: false })];
    expect(pickTemplate(inactiveOnly, "email", "appointment.reminder", "en")).toBeNull();
  });
});

describe("TemplateService.render", () => {
  it("renders the resolved template with data and reports the source", async () => {
    const repo = {
      findTemplates: vi.fn().mockResolvedValue([
        template({
          tenant_id: "tenant-1",
          subject: "Visit on {{appointment_date}}",
          body: "Dear {{patient_name}}, see you on {{appointment_date}}.",
        }),
      ]),
    } as unknown as SettingsRepository;
    const service = new TemplateService(repo);

    const rendered = await service.render("tenant-1", "email", "appointment.reminder", "en", {
      patient_name: "Sara",
      appointment_date: "2026-07-15",
    });

    expect(rendered).not.toBeNull();
    expect(rendered?.subject).toBe("Visit on 2026-07-15");
    expect(rendered?.body).toBe("Dear Sara, see you on 2026-07-15.");
    expect(rendered?.source).toBe("tenant");
    expect(rendered?.missingVariables).toEqual([]);
  });

  it("collects missing variables from subject and body", async () => {
    const repo = {
      findTemplates: vi.fn().mockResolvedValue([template({})]),
    } as unknown as SettingsRepository;
    const service = new TemplateService(repo);
    const rendered = await service.render("tenant-1", "email", "appointment.reminder", "en", {});
    expect(rendered?.missingVariables).toEqual(["patient_name"]);
  });

  it("returns null for an unknown template key", async () => {
    const repo = {
      findTemplates: vi.fn().mockResolvedValue([]),
    } as unknown as SettingsRepository;
    const service = new TemplateService(repo);
    await expect(service.render("tenant-1", "email", "unknown.key", "en", {})).resolves.toBeNull();
  });
});
