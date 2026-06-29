// Traduit une équipe stockée (ANGLAIS canonique) vers la langue d'affichage et
// l'enrichit avec les infos BDD pour les cartes (stats, détails d'attaque, résistances,
// effets). Ne mute pas l'équipe stockée.
import { db } from "./db";
import { localize, display, localizeProse, type Category } from "./names";
import { getPokemon, getMove, getAbility, getItem, getType } from "./reference";

const DMG_CLASS_FR: Record<string, string> = { physical: "Physique", special: "Spéciale", status: "Statut" };

// Effet (description) traduit en FR au build (table effects). Fallback : l'anglais.
const qEffFr = db.query("SELECT fr FROM effects WHERE en=? LIMIT 1");
function effectFr(en?: string | null, lang: "fr" | "en" = "fr"): string | null {
  if (!en || lang === "en") return en ?? null;
  return (qEffFr.get(en) as any)?.fr ?? en;
}

// Traduit une équipe stockée (ANGLAIS canonique) vers la langue d'affichage, au format
// attendu par l'UI (name_fr/name_en + champs localisés), ET l'enrichit avec les infos
// BDD pour les cartes : stats de base, détails d'attaque, résistances/immunités, effets
// (les effets restent en anglais tant qu'il n'y a pas de cache de traduction).
// La prose (role/note/strategy) est laissée telle quelle. Ne mute pas l'équipe stockée.
export function localizeTeam(team: any, lang: "fr" | "en" = "fr") {
  if (!team?.team) return team;
  const L = (cat: Category, v?: string | null) => localize(cat, v, lang);
  const T = (t?: string | null) => display("type", t, lang);
  return {
    ...team,
    strategy: localizeProse(team.strategy, lang),
    team: team.team.map((m: any) => {
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
        ability_effect: effectFr(getAbility(m.ability)?.effect, lang),
        item_effect: effectFr(getItem(m.item)?.effect, lang),
        base_stats: pok?.base_stats ?? null,
        types: (m.types ?? []).map((t: string) => T(t)),
        moves: (m.moves ?? []).map((mv: any) => {
          if (typeof mv === "string") return mv;
          const info = getMove(mv.name);
          // Types contre lesquels l'attaque tape ×2 (seulement les attaques de dégâts).
          const isDamage = info && info.damage_class !== "status";
          const strong = isDamage ? (getType(mv.type)?.attacking.super_effective ?? []).map((t) => T(t)) : [];
          return {
            name: L("move", mv.name),
            type: T(mv.type),
            power: info?.power ?? null,
            accuracy: info?.accuracy ?? null,
            priority: info?.priority ?? 0,
            category: info ? DMG_CLASS_FR[info.damage_class] ?? info.damage_class : null,
            effect: effectFr(info?.effect, lang),
            strong_against: strong,
          };
        }),
        weaknesses: (pok?.weaknesses ?? m.weaknesses ?? []).map((w: any) => ({ type: T(w.type), multiplier: w.multiplier })),
        resistances: (pok?.resistances ?? []).map((w: any) => ({ type: T(w.type), multiplier: w.multiplier })),
        immunities: (pok?.immunities ?? []).map((t: string) => T(t)),
      };
    }),
  };
}
