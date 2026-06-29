// La data est stockée en anglais ; on la traduit pour l'affichage à la sortie.
// ponytail: langue figée en "fr" pour l'instant — la Phase 5 la lira depuis le store.
import { localizeTeam, localizeProse } from "@poketeam/data";

export const LANG = "fr";
export const enc = new TextEncoder();

export const localizeEntry = (e: any) => ({
  ...e,
  team: localizeTeam(e.team, LANG),
  chat: (e.chat ?? []).map((m: any) => ({ ...m, text: localizeProse(m.text, LANG) })),
});
export const localizeTeams = (arr: any[]) => arr.map(localizeEntry);
