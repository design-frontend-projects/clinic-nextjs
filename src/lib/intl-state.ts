export const DEFAULT_TIME_ZONE = "UTC";

export interface LocaleOverride<TLocale extends string, TMessages> {
  locale: TLocale;
  messages: TMessages;
}

/**
 * Resolves the active locale and message bundle, preferring fresh server props
 * unless the user has explicitly toggled to a different locale client-side.
 */
export function resolveActiveIntlState<TLocale extends string, TMessages>(
  initialLocale: string,
  initialMessages: TMessages,
  override: LocaleOverride<TLocale, TMessages> | null,
  supportedLocales: readonly TLocale[],
  defaultLocale: TLocale,
): {
  normalizedInitialLocale: TLocale;
  locale: TLocale;
  messages: TMessages;
} {
  const normalizedInitialLocale: TLocale = (
    supportedLocales as readonly string[]
  ).includes(initialLocale)
    ? (initialLocale as TLocale)
    : defaultLocale;
  const hasActiveOverride =
    override !== null && override.locale !== normalizedInitialLocale;
  return {
    normalizedInitialLocale,
    locale: hasActiveOverride ? override.locale : normalizedInitialLocale,
    messages: hasActiveOverride ? override.messages : initialMessages,
  };
}
