// Lookups de référence pour l'agent et l'UI (typage, stats, attaques, talents, objets,
// efficacité des types). Tout en ANGLAIS (l'IA travaille en EN). null/{error} si inconnu.
import { db } from "./db";
import { canon, inChampions, display } from "./names";

// Outil agent : typage, stats, talents, faiblesses — tout en ANGLAIS (l'IA travaille en EN).
export function getPokemon(name: string) {
  const en = canon("pokemon", name);
  const p = en
    ? (db
        .query("SELECT en, types, abilities, stats, resistances FROM pokemon WHERE en=?")
        .get(en) as any)
    : null;
  if (!p) return { error: `Unknown pokemon: ${name}` };
  const res: any[] = JSON.parse(p.resistances ?? "[]");
  return {
    name: p.en,
    champions: inChampions("pokemon", p.en), // dispo dans Pokémon Champions ?
    types: JSON.parse(p.types ?? "[]") as string[],
    abilities: JSON.parse(p.abilities ?? "[]") as string[],
    base_stats: JSON.parse(p.stats ?? "null"),
    weaknesses: res
      .filter((r) => r.multiplier > 1)
      .map((r) => ({ type: r.type, multiplier: r.multiplier })),
    resistances: res
      .filter((r) => r.multiplier < 1 && r.multiplier > 0)
      .map((r) => ({ type: r.type, multiplier: r.multiplier })),
    immunities: res.filter((r) => r.multiplier === 0).map((r) => r.type),
  };
}

// Efficacité d'un type (offensif + défensif), tout en anglais. null si type inconnu.
const qAtt = db.query("SELECT defender AS t, multiplier AS m FROM type_chart WHERE attacker=?");
const qDef = db.query("SELECT attacker AS t, multiplier AS m FROM type_chart WHERE defender=?");
export function getType(name: string) {
  const en = canon("type", name);
  if (!en) return null;
  const att = qAtt.all(en) as { t: string; m: number }[];
  const def = qDef.all(en) as { t: string; m: number }[];
  const pick = (rows: { t: string; m: number }[], m: number) =>
    rows.filter((r) => r.m === m).map((r) => r.t);
  return {
    name: en,
    attacking: {
      super_effective: pick(att, 2),
      not_very_effective: pick(att, 0.5),
      no_effect: pick(att, 0),
    },
    defending: { weak_to: pick(def, 2), resists: pick(def, 0.5), immune_to: pick(def, 0) },
  };
}

// Infos riches (pour rendre l'IA plus intelligente) : null si inconnu.
export function getMove(name: string) {
  const en = canon("move", name);
  if (!en) return null;
  const m = db
    .query(
      "SELECT en, type, power, accuracy, pp, priority, damage_class, effect FROM moves WHERE en=?",
    )
    .get(en) as any;
  return {
    ...m,
    champions: inChampions("move", en),
    fr: display("move", en),
    type_fr: display("type", m.type),
  };
}
export function getAbility(name: string) {
  const en = canon("ability", name);
  if (!en) return null;
  const a = db.query("SELECT en, effect FROM abilities WHERE en=?").get(en) as any;
  return { ...a, champions: inChampions("ability", en), fr: display("ability", en) };
}
export function getItem(name: string) {
  const en = canon("item", name);
  if (!en) return null;
  const it = db.query("SELECT en, category, effect FROM items WHERE en=?").get(en) as any;
  return { ...it, champions: inChampions("item", en), fr: display("item", en) };
}
