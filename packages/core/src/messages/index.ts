// Message lookup. The codes are the contract; the text is copy in one of the
// shipped locales.

import type { Locale, RejectionReason } from "../types.js";
import { MESSAGES_EN } from "./en.js";
import { MESSAGES_ES } from "./es.js";

export { MESSAGES_EN, MESSAGES_ES };

/** Mensajes por idioma. Añadir uno nuevo es añadir una input aquí y su file. */
export const MESSAGES: Record<Locale, Record<RejectionReason, string>> = {
  en: MESSAGES_EN,
  es: MESSAGES_ES,
};

/**
 * Message for a rejection reason in the requested locale, honouring the
 * caller's overrides.
 *
 * A blank override is ignored on purpose: an empty message is worse than the
 * default one, because it leaves the person without anything to correct.
 */
export function rejectionMessage(
  reason: RejectionReason,
  locale: Locale = "en",
  messages?: Partial<Record<RejectionReason, string>>
): string {
  const custom = messages?.[reason]?.trim();
  if (custom) return custom;
  return (MESSAGES[locale] ?? MESSAGES_EN)[reason]!;
}
