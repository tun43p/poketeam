// Lookups de référence pour l'agent et l'UI (typage, stats, attaques, talents, objets,
// efficacité des types). Tout en ANGLAIS (l'IA travaille en EN). null/{error} si inconnu.
import { db } from "./db";
import { canon, inChampions, display } from "./names";
import type { BaseStats, Weakness } from "@poketeam/types";

interface PokemonRow {
  en: string;
  types: string | null;
  abilities: string | null;
  stats: string | null;
  resistances: string | null;
}

// Outil agent : typage, stats, talents, faiblesses — tout en ANGLAIS (l'IA travaille en EN).
export function getPokemon(name: string) {
  const en = canon("pokemon", name);
  const p = en
    ? db
        .query<PokemonRow, [string]>(
          "SELECT en, types, abilities, stats, resistances FROM pokemon WHERE en=?",
        )
        .get(en)
    : null;
  if (!p) return { error: `Unknown pokemon: ${name}` };
  const res = JSON.parse(p.resistances ?? "[]") as Weakness[];
  return {
    name: p.en,
    champions: inChampions("pokemon", p.en), // dispo dans Pokémon Champions ?
    types: JSON.parse(p.types ?? "[]") as string[],
    abilities: JSON.parse(p.abilities ?? "[]") as string[],
    base_stats: JSON.parse(p.stats ?? "null") as BaseStats | null,
    weaknesses: res.filter((r) => r.multiplier > 1),
    resistances: res.filter((r) => r.multiplier < 1 && r.multiplier > 0),
    immunities: res.filter((r) => r.multiplier === 0).map((r) => r.type),
  };
}

// Efficacité d'un type (offensif + défensif), tout en anglais. null si type inconnu.
const qAtt = db.query<{ t: string; m: number }, [string]>(
  "SELECT defender AS t, multiplier AS m FROM type_chart WHERE attacker=?",
);
const qDef = db.query<{ t: string; m: number }, [string]>(
  "SELECT attacker AS t, multiplier AS m FROM type_chart WHERE defender=?",
);
export function getType(name: string) {
  const en = canon("type", name);
  if (!en) return null;
  const att = qAtt.all(en);
  const def = qDef.all(en);
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

interface MoveRow {
  en: string;
  type: string | null;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number | null;
  damage_class: string;
  effect: string | null;
}

// Infos riches (pour rendre l'IA plus intelligente) : null si inconnu.
export function getMove(name: string) {
  const en = canon("move", name);
  if (!en) return null;
  const m = db
    .query<MoveRow, [string]>(
      "SELECT en, type, power, accuracy, pp, priority, damage_class, effect FROM moves WHERE en=?",
    )
    .get(en);
  if (!m) return null;
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
  const a = db
    .query<{ en: string; effect: string | null }, [string]>(
      "SELECT en, effect FROM abilities WHERE en=?",
    )
    .get(en);
  if (!a) return null;
  return { ...a, champions: inChampions("ability", en), fr: display("ability", en) };
}
export function getItem(name: string) {
  const en = canon("item", name);
  if (!en) return null;
  const it = db
    .query<{ en: string; category: string | null; effect: string | null }, [string]>(
      "SELECT en, category, effect FROM items WHERE en=?",
    )
    .get(en);
  if (!it) return null;
  return { ...it, champions: inChampions("item", en), fr: display("item", en) };
}
