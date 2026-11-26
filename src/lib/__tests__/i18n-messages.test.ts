import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { DEFAULT_TIME_ZONE, resolveActiveIntlState } from "@/lib/intl-state";
import {
  resolveStatusBadge,
  statusConfig,
  type StatusTranslator,
} from "@/components/ui/status-badge";

function flattenKeys(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenKeys(value as Record<string, unknown>, fullPath),
      );
    } else {
      result[fullPath] = value;
    }
  }
  return result;
}

function getByPath(obj: Record<string, unknown>, keyPath: string): unknown {
  if (!keyPath) return obj;
  return keyPath.split(".").reduce<unknown>((acc, key) => {
    if (
      acc &&
      typeof acc === "object" &&
      key in (acc as Record<string, unknown>)
    ) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function walkSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      results.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("i18n locale messages integrity", () => {
  const flatEn = flattenKeys(en as Record<string, unknown>);
  const flatAr = flattenKeys(ar as Record<string, unknown>);

  it("includes required pages.admin and pages.staff dashboard namespaces in all locales", () => {
    for (const localeObj of [en, ar]) {
      expect(localeObj.pages.admin).toBeDefined();
      expect(localeObj.pages.admin.title).toBeTruthy();
      expect(localeObj.pages.admin.subtitle).toBeTruthy();
      expect(localeObj.pages.staff).toBeDefined();
      expect(localeObj.pages.staff.title).toBeTruthy();
      expect(localeObj.pages.staff.patients).toBeDefined();
    }
  });

  it("maintains full bidirectional key parity between en.json and ar.json", () => {
    const missingInAr = Object.keys(flatEn).filter((k) => !(k in flatAr));
    const missingInEn = Object.keys(flatAr).filter((k) => !(k in flatEn));

    expect(missingInAr).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("contains no empty or whitespace-only strings in any locale", () => {
    for (const [localeName, flatLocale] of [
      ["en", flatEn],
      ["ar", flatAr],
    ] as const) {
      const emptyKeys = Object.entries(flatLocale).filter(
        ([, val]) => typeof val === "string" && val.trim().length === 0,
      );
      expect(
        emptyKeys,
        `Empty strings found in ${localeName}.json`,
      ).toEqual([]);
    }
  });

  it("contains no corrupted encoding characters in any locale", () => {
    for (const [localeName, flatLocale] of [
      ["en", flatEn],
      ["ar", flatAr],
    ] as const) {
      const corrupted = Object.entries(flatLocale).filter(
        ([, val]) =>
          typeof val === "string" &&
          (val.includes("\ufffd") || val.includes("???")),
      );
      expect(
        corrupted,
        `Corrupted strings found in ${localeName}.json`,
      ).toEqual([]);
    }
  });

  it("resolves all static useTranslations / getTranslations namespaces and keys in src/", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const files = walkSourceFiles(srcDir);
    const missing: Array<{ file: string; fullKey: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const nsRegex =
        /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:["']([^"']+)["'])?\s*\)/g;
      let match: RegExpExecArray | null;
      while ((match = nsRegex.exec(content)) !== null) {
        const varName = match[1];
        const ns = match[2] || "";
        if (ns && getByPath(en as Record<string, unknown>, ns) === undefined) {
          missing.push({ file: path.relative(srcDir, file), fullKey: ns });
        }
        const callRegex = new RegExp(
          `\\b${varName}\\(\\s*["']([^"']+)["']`,
          "g",
        );
        let callMatch: RegExpExecArray | null;
        while ((callMatch = callRegex.exec(content)) !== null) {
          const key = callMatch[1];
          const fullKey = ns ? `${ns}.${key}` : key;
          if (getByPath(en as Record<string, unknown>, fullKey) === undefined) {
            missing.push({ file: path.relative(srcDir, file), fullKey });
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("covers all StatusBadge variants and Prisma *Status enum values in en.json and ar.json", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf8");
    const enumBlockRegex = /enum\s+(\w+Status)\s*\{([^}]*)\}/g;

    const prismaStatusValues = new Set<string>();
    let enumMatch: RegExpExecArray | null;
    while ((enumMatch = enumBlockRegex.exec(schemaContent)) !== null) {
      const body = enumMatch[2];
      for (const line of body.split(/\r?\n/)) {
        const cleaned = line.replace(/\/\/.*$/, "").trim();
        if (cleaned) {
          prismaStatusValues.add(cleaned.toLowerCase());
        }
      }
    }

    expect(prismaStatusValues.size).toBeGreaterThan(0);

    const enStatuses = en.enums.status as Record<string, string>;
    const arStatuses = ar.enums.status as Record<string, string>;

    for (const statusKey of Object.keys(statusConfig)) {
      expect(
        enStatuses[statusKey],
        `Missing enums.status.${statusKey} in en.json`,
      ).toBeTruthy();
      expect(
        arStatuses[statusKey],
        `Missing enums.status.${statusKey} in ar.json`,
      ).toBeTruthy();
    }

    for (const statusValue of prismaStatusValues) {
      expect(
        statusValue in statusConfig,
        `Missing "${statusValue}" from statusConfig in status-badge.tsx`,
      ).toBe(true);
      expect(
        enStatuses[statusValue],
        `Missing enums.status.${statusValue} in en.json`,
      ).toBeTruthy();
      expect(
        arStatuses[statusValue],
        `Missing enums.status.${statusValue} in ar.json`,
      ).toBeTruthy();
    }
  });

  it("resolves translated status badges safely via t.has without calling t on missing keys", () => {
    const messages: Record<string, string> = {
      ordered: "Ordered",
      cancelled: "Cancelled",
    };
    const hasFn = vi.fn((key: string) => key in messages);
    const callFn = vi.fn(
      (key: string) => messages[key] ?? `enums.status.${key}`,
    );
    const t: StatusTranslator = Object.assign(callFn, { has: hasFn });

    expect(resolveStatusBadge("ordered", t)).toEqual({
      label: "Ordered",
      className: statusConfig.ordered.className,
    });
    expect(hasFn).toHaveBeenCalledWith("ordered");
    expect(callFn).toHaveBeenCalledWith("ordered");

    hasFn.mockClear();
    callFn.mockClear();

    expect(resolveStatusBadge("ORDERED", t)).toEqual({
      label: "Ordered",
      className: statusConfig.ordered.className,
    });
    expect(hasFn).toHaveBeenCalledWith("ordered");
    expect(callFn).toHaveBeenCalledWith("ordered");

    hasFn.mockClear();
    callFn.mockClear();

    expect(resolveStatusBadge("custom_unknown", t)).toEqual({
      label: "custom unknown",
      className: "bg-muted text-muted-foreground",
    });
    expect(hasFn).toHaveBeenCalledWith("custom_unknown");
    expect(callFn).not.toHaveBeenCalled();
  });
});

describe("IntlProvider state synchronization", () => {
  it("uses updated initialMessages immediately when no client override is active", () => {
    const staleAr = {
      pages: { staff: { title: "عمليات الموظفين" } },
    };
    const updatedAr = {
      pages: {
        staff: {
          title: "عمليات الموظفين",
          actionsMenuLabel: "المزيد من الإجراءات",
        },
      },
    };

    const initial = resolveActiveIntlState("ar", staleAr, null, ["en", "ar"] as const, "en");
    expect(initial.locale).toBe("ar");
    expect(initial.messages).toBe(staleAr);

    const refreshed = resolveActiveIntlState("ar", updatedAr, null, ["en", "ar"] as const, "en");
    expect(refreshed.locale).toBe("ar");
    expect(refreshed.messages).toBe(updatedAr);
  });

  it("uses override locale and messages when switched to a different locale client-side", () => {
    const initialEn = { pages: { staff: { title: "Staff Operations" } } };
    const loadedAr = {
      pages: {
        staff: {
          title: "عمليات الموظفين",
          actionsMenuLabel: "المزيد من الإجراءات",
        },
      },
    };

    const active = resolveActiveIntlState(
      "en",
      initialEn,
      {
        locale: "ar",
        messages: loadedAr,
      },
      ["en", "ar"] as const,
      "en",
    );
    expect(active.normalizedInitialLocale).toBe("en");
    expect(active.locale).toBe("ar");
    expect(active.messages).toBe(loadedAr);
  });

  it("falls back to fresh server initialMessages once initialLocale matches the override", () => {
    const staleOverrideAr = { pages: { staff: { title: "قديم" } } };
    const freshServerAr = {
      pages: {
        staff: {
          title: "عمليات الموظفين",
          actionsMenuLabel: "المزيد من الإجراءات",
        },
      },
    };

    const active = resolveActiveIntlState(
      "ar",
      freshServerAr,
      {
        locale: "ar",
        messages: staleOverrideAr,
      },
      ["en", "ar"] as const,
      "en",
    );
    expect(active.locale).toBe("ar");
    expect(active.messages).toBe(freshServerAr);
  });

  it("falls back to defaultLocale when initialLocale is unknown", () => {
    const enMessages = { pages: { staff: { title: "Staff Operations" } } };
    const active = resolveActiveIntlState("fr", enMessages, null, ["en", "ar"] as const, "en");
    expect(active.normalizedInitialLocale).toBe("en");
    expect(active.locale).toBe("en");
    expect(active.messages).toBe(enMessages);
  });
});

describe("i18n timeZone configuration", () => {
  it("defines a valid IANA DEFAULT_TIME_ZONE", () => {
    expect(DEFAULT_TIME_ZONE).toBeTruthy();
    const resolved = Intl.DateTimeFormat("en", {
      timeZone: DEFAULT_TIME_ZONE,
    }).resolvedOptions();
    expect(resolved.timeZone).toBe(DEFAULT_TIME_ZONE);
  });

  it("renders NextIntlClientProvider with DEFAULT_TIME_ZONE without triggering ENVIRONMENT_FALLBACK", () => {
    function SampleSignInProbe() {
      const t = useTranslations("auth.signIn");
      return createElement("span", null, t("signInButton"));
    }

    const onError = vi.fn();
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "en",
        messages: en,
        timeZone: DEFAULT_TIME_ZONE,
        onError,
        children: createElement(SampleSignInProbe),
      }),
    );

    expect(html).toContain(en.auth.signIn.signInButton);
    expect(onError).not.toHaveBeenCalled();
  });
});
