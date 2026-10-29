import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value as Record<string, unknown>, fullPath));
    } else {
      result[fullPath] = value;
    }
  }
  return result;
}

function getByPath(obj: Record<string, unknown>, keyPath: string): unknown {
  if (!keyPath) return obj;
  return keyPath.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
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
  const flatFr = flattenKeys(fr as Record<string, unknown>);

  it("includes required pages.admin and pages.staff dashboard namespaces in all locales", () => {
    for (const localeObj of [en, ar, fr]) {
      expect(localeObj.pages.admin).toBeDefined();
      expect(localeObj.pages.admin.title).toBeTruthy();
      expect(localeObj.pages.admin.subtitle).toBeTruthy();
      expect(localeObj.pages.staff).toBeDefined();
      expect(localeObj.pages.staff.title).toBeTruthy();
      expect(localeObj.pages.staff.patients).toBeDefined();
    }
  });

  it("maintains full key parity between en.json, ar.json, and fr.json", () => {
    const missingInAr = Object.keys(flatEn).filter((k) => !(k in flatAr));
    const missingInFr = Object.keys(flatEn).filter((k) => !(k in flatFr));

    expect(missingInAr).toEqual([]);
    expect(missingInFr).toEqual([]);
  });

  it("contains no corrupted encoding characters in any locale", () => {
    for (const [localeName, flatLocale] of [
      ["en", flatEn],
      ["ar", flatAr],
      ["fr", flatFr],
    ] as const) {
      const corrupted = Object.entries(flatLocale).filter(
        ([, val]) =>
          typeof val === "string" && (val.includes("\ufffd") || val.includes("???")),
      );
      expect(corrupted, `Corrupted strings found in ${localeName}.json`).toEqual([]);
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
        const callRegex = new RegExp(`\\b${varName}\\(\\s*["']([^"']+)["']`, "g");
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
});

