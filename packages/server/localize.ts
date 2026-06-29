// Data is stored in English; we localize it for display on output, in the language
// chosen on first launch (data layer's process-wide LANG, set at boot from the store).
import { localizeTeam, localizeProse, LANG } from "@poketeam/data";
import type { StoredTeam } from "@poketeam/types";

export { LANG };
export const enc = new TextEncoder();
// Pick the right string for the current language (server-side user-facing strings).
export const t = (fr: string, en: string) => (LANG === "en" ? en : fr);

export const localizeEntry = (e: StoredTeam): StoredTeam => ({
  ...e,
  team: localizeTeam(e.team, LANG),
  chat: (e.chat ?? []).map((m) => ({ ...m, text: localizeProse(m.text, LANG) ?? m.text })),
});
export const localizeTeams = (arr: StoredTeam[]) => arr.map(localizeEntry);
