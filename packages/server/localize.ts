// Data is stored in English; we translate it for display on output.
// ponytail: language hardcoded to "fr" for now — Phase 5 will read it from the store.
import { localizeTeam, localizeProse } from "@poketeam/data";
import type { StoredTeam } from "@poketeam/types";

export const LANG = "fr";
export const enc = new TextEncoder();

export const localizeEntry = (e: StoredTeam): StoredTeam => ({
  ...e,
  team: localizeTeam(e.team, LANG),
  chat: (e.chat ?? []).map((m) => ({ ...m, text: localizeProse(m.text, LANG) ?? m.text })),
});
export const localizeTeams = (arr: StoredTeam[]) => arr.map(localizeEntry);
