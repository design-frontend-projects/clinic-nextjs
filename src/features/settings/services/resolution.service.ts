// src/features/settings/services/resolution.service.ts
// Pure layered-resolution logic (no I/O — unit-testable in isolation).
//
// Resolution order per key:
//   user value   (only if 'user'     is in the definition's allowed_scopes)
// > tenant value (only if 'tenant'   is in allowed_scopes)
// > platform value from global_settings, matched by key
//                (only if 'platform' is in allowed_scopes)
// > definition default_value.
//
// Every candidate is re-parsed against the definition's Zod schema; an invalid
// stale value (e.g. after a definition change) falls through to the next layer.
import type { ResolvedSetting, SettingDefinition } from "../domain/models";
import { MASKED_VALUE } from "../domain/models";
import { zodFromDefinition } from "../domain/validation";

export interface ScopeValues {
  /** key -> raw stored value */
  platform?: Map<string, unknown>;
  tenant?: Map<string, unknown>;
  user?: Map<string, unknown>;
}

export interface ResolutionOptions {
  /** Only definitions of this module. */
  module?: string;
  /** Only definitions flagged is_public (for unauthenticated surfaces). */
  publicOnly?: boolean;
  /**
   * When false (default) sensitive values resolve to a mask marker.
   * The engine never returns plaintext secrets; senders read them from Vault.
   */
  includeSensitive?: boolean;
}

export class ResolutionService {
  resolveSetting(definition: SettingDefinition, values: ScopeValues): ResolvedSetting {
    const schema = zodFromDefinition(definition);
    const layers: { source: ResolvedSetting["source"]; value: unknown }[] = [];

    if (definition.allowed_scopes.includes("user") && values.user?.has(definition.key)) {
      layers.push({ source: "user", value: values.user.get(definition.key) });
    }
    if (definition.allowed_scopes.includes("tenant") && values.tenant?.has(definition.key)) {
      layers.push({ source: "tenant", value: values.tenant.get(definition.key) });
    }
    if (definition.allowed_scopes.includes("platform") && values.platform?.has(definition.key)) {
      layers.push({ source: "platform", value: values.platform.get(definition.key) });
    }
    layers.push({ source: "default", value: definition.default_value });

    let resolved: { source: ResolvedSetting["source"]; value: unknown } = layers[layers.length - 1];
    for (const layer of layers) {
      const parsed = schema.safeParse(layer.value);
      if (parsed.success) {
        resolved = { source: layer.source, value: parsed.data };
        break;
      }
      if (layer.source !== "default" && process.env.NODE_ENV !== "test") {
        console.warn(
          `[settings] Stale/invalid ${layer.source} value for "${definition.key}" — falling back to the next layer`
        );
      }
    }

    const value = definition.is_sensitive ? { ...MASKED_VALUE, hasValue: resolved.source !== "default" } : resolved.value;

    return {
      key: definition.key,
      module: definition.module,
      category: definition.category,
      value_type: definition.value_type,
      value,
      source: resolved.source,
      is_sensitive: definition.is_sensitive,
      is_public: definition.is_public,
      description: definition.description,
      display_order: definition.display_order,
      allowed_scopes: definition.allowed_scopes,
      validation: definition.validation,
    };
  }

  resolveAll(
    definitions: SettingDefinition[],
    values: ScopeValues,
    options: ResolutionOptions = {}
  ): ResolvedSetting[] {
    return definitions
      .filter((definition) => (options.module ? definition.module === options.module : true))
      .filter((definition) => (options.publicOnly ? definition.is_public : true))
      .map((definition) => this.resolveSetting(definition, values));
  }

  /** Flattens resolved settings into a key -> value record. */
  toValueMap(resolved: ResolvedSetting[]): Record<string, unknown> {
    return resolved.reduce<Record<string, unknown>>((acc, setting) => {
      return { ...acc, [setting.key]: setting.value };
    }, {});
  }
}

export const resolutionService = new ResolutionService();
