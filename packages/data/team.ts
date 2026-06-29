// Translates a stored team (canonical ENGLISH) into the display language and
// enriches it with DB info for the cards (stats, move details, resistances,
// effects). Does not mutate the stored team.
import { db, type Category } from "./db";
import { localize, display, localizeProse } from "./names";
import { getPokemon, getMove, getAbility, getItem, getType } from "./reference";
import type { Team } from "@poketeam/types";

const DMG_CLASS_FR: Record<string, string> = {
  physical: "Physique",
  special: "Spéciale",
  status: "Statut",
};

// Effect (description) translated to FR at build time (effects table). Fallback: English.
const qEffFr = db.query<{ fr: string | null }, [string]>(
  "SELECT fr FROM effects WHERE en=? LIMIT 1",
);
function effectFr(en?: string | null, lang: "fr" | "en" = "fr"): string | null {
  if (!en || lang === "en") return en ?? null;
  return qEffFr.get(en)?.fr ?? en;
}

// Translates a stored team (canonical ENGLISH) into the display language, in the format
// expected by the UI (name_fr/name_en + localized fields), AND enriches it with DB
// info for the cards: base stats, move details, resistances/immunities, effects
// (effects stay in English as long as there is no translation cache).
// Prose (role/note/strategy) is left as is. Does not mutate the stored team.
export function localizeTeam(team: Team, lang: "fr" | "en" = "fr"): Team {
  const L = (cat: Category, v?: string | null) => localize(cat, v, lang);
  const T = (t?: string | null) => display("type", t, lang);
  return {
    ...team,
    strategy: localizeProse(team.strategy, lang),
    team: team.team.map((m) => {
      const p = getPokemon(m.name);
      const pok = "error" in p ? null : p;
      return {
        ...m,
        role: localizeProse(m.role, lang),
        note: localizeProse(m.note, lang),
        name_en: m.name,
        name_fr: L("pokemon", m.name),
        item: L("item", m.item),
        ability: L("ability", m.ability),
        nature: L("nature", m.nature),
        tera_type: L("type", m.tera_type),
        ability_effect: effectFr(getAbility(m.ability ?? "")?.effect, lang),
        item_effect: effectFr(getItem(m.item ?? "")?.effect, lang),
        base_stats: pok?.base_stats ?? null,
        types: (m.types ?? []).map((t) => T(t) ?? t),
        moves: (m.moves ?? []).map((mv) => {
          if (typeof mv === "string") return mv;
          const info = getMove(mv.name);
          // Types the move hits for ×2 (damage moves only).
          const isDamage = info && info.damage_class !== "status";
          const strong = isDamage
            ? (getType(mv.type ?? "")?.attacking.super_effective ?? []).map((t) => T(t) ?? t)
            : [];
          return {
            name: L("move", mv.name) ?? mv.name,
            type: T(mv.type),
            power: info?.power ?? null,
            accuracy: info?.accuracy ?? null,
            priority: info?.priority ?? 0,
            category: info ? (DMG_CLASS_FR[info.damage_class] ?? info.damage_class) : null,
            effect: effectFr(info?.effect, lang),
            strong_against: strong,
          };
        }),
        weaknesses: (pok?.weaknesses ?? m.weaknesses ?? []).map((w) => ({
          type: T(w.type) ?? w.type,
          multiplier: w.multiplier,
        })),
        resistances: (pok?.resistances ?? []).map((w) => ({
          type: T(w.type) ?? w.type,
          multiplier: w.multiplier,
        })),
        immunities: (pok?.immunities ?? []).map((t) => T(t) ?? t),
      };
    }),
  };
}
