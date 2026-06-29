// Accès à la data de référence : tout vient de poke.db (offline, `bun run build:db`).
// Les tables sont en ANGLAIS ; `lookup` traduit dans les deux sens. Seul getMeta
// reste un fetch live (usage compétitif temps réel).
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";

const db = new Database("poke.db", { readonly: true });
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

type Category = "pokemon" | "move" | "ability" | "item" | "nature" | "type";

const qCanon = db.query("SELECT en FROM lookup WHERE category=? AND norm=? LIMIT 1");
// N'importe quelle graphie (EN/FR/faute) → nom EN canonique, ou null si inconnu.
// LE point de passage : rien n'entre dans le système sans passer par ici.
export function canon(category: Category, name?: string | null): string | null {
  if (!name) return null;
  return (qCanon.get(category, norm(name)) as any)?.en ?? null;
}

// Disponible dans Pokémon Champions ? (sous-ensemble du national dex stocké au build).
// Natures et types : tous légaux. Sinon : présence dans la table `champions` (par norm
// du nom EN canonique). Voir build-db.ts → section "Pokémon Champions".
const qChamp = db.query("SELECT 1 FROM champions WHERE category=? AND norm=? LIMIT 1");
export function inChampions(category: Category, name?: string | null): boolean {
  if (!name) return false;
  if (category === "nature" || category === "type") return true;
  return !!qChamp.get(category, norm(canon(category, name) ?? name));
}

const qDisplay = db.query("SELECT name FROM lookup WHERE category=? AND lang=? AND en=? LIMIT 1");
// Nom EN canonique → nom affiché dans la langue cible (fallback : l'EN lui-même).
export function display(category: Category, en?: string | null, lang: "fr" | "en" = "fr"): string | null {
  if (!en) return null;
  if (lang === "en") return en;
  return (qDisplay.get(category, lang, en) as any)?.name ?? en;
}

// Graphie quelconque → nom dans la langue cible. Inconnu : on garde l'entrée d'origine.
export function localize(category: Category, name?: string | null, lang: "fr" | "en" = "fr") {
  const en = canon(category, name);
  return en ? display(category, en, lang) : (name ?? null);
}

// Traduit la PROSE libre (strategy/role/note/chat) : l'IA l'écrit en français mais y
// laisse les noms propres en ANGLAIS (Pokémon, attaques, talents…). On les remplace via
// `lookup`, en find/replace dictionnaire — aucun appel LLM (coût/latence/incohérence).
// ponytail: dico plat EN→FR ; les ~4 homographes inter-catégories (ex. type vs move
//   "Psychic") prennent la 1re catégorie chargée. Désambiguïser par catégorie si besoin.
let proseRe: RegExp | null = null;
let proseMap: Map<string, string> | null = null;
// La BDD écrit les apostrophes en ’ (U+2019), l'IA/les users en ' — on unifie.
const apos = (s: string) => s.replace(/[’‘]/g, "'");
function buildProse() {
  const rows = db.query("SELECT en, name FROM lookup WHERE lang='fr' AND en<>name").all() as { en: string; name: string }[];
  proseMap = new Map();
  for (const r of rows) {
    const k = apos(r.en).toLowerCase();
    if (!proseMap.has(k)) proseMap.set(k, r.name); // 1re catégorie gagne
  }
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // longest-first : "King's Shield" doit matcher avant "Shield".
  const keys = [...proseMap.keys()].sort((a, b) => b.length - a.length).map(esc);
  // bornes alphanum (gère espaces/apostrophes/tirets internes aux noms).
  proseRe = new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}
export function localizeProse(text?: string | null, lang: "fr" | "en" = "fr"): string | null {
  if (!text || lang === "en") return text ?? null;
  if (!proseRe) buildProse();
  return apos(text).replace(proseRe!, (m) => proseMap!.get(m.toLowerCase()) ?? m);
}

// Liste de sélection UI : espèces réelles, nom FR+EN + sprite + types (FR pour l'affichage).
export function pokemonList() {
  return db
    .query("SELECT dex_id, en, sprite, types FROM pokemon ORDER BY dex_id")
    .all()
    .map((p: any) => ({
      id: p.dex_id,
      en: p.en,
      fr: display("pokemon", p.en),
      sprite: p.sprite,
      types: (JSON.parse(p.types ?? "[]") as string[]).map((t) => display("type", t)),
    }));
}

// Les 18 types (nom FR + icône) pour l'UI.
export function getTypes(): { name: string; image: string }[] {
  return db
    .query("SELECT en, sprite FROM types WHERE sprite IS NOT NULL")
    .all()
    .map((t: any) => ({ name: display("type", t.en)!, image: t.sprite }));
}

// Outil agent : typage, stats, talents, faiblesses — tout en ANGLAIS (l'IA travaille en EN).
export function getPokemon(name: string) {
  const en = canon("pokemon", name);
  const p = en
    ? (db.query("SELECT en, types, abilities, stats, resistances FROM pokemon WHERE en=?").get(en) as any)
    : null;
  if (!p) return { error: `Unknown pokemon: ${name}` };
  const res: any[] = JSON.parse(p.resistances ?? "[]");
  return {
    name: p.en,
    champions: inChampions("pokemon", p.en), // dispo dans Pokémon Champions ?
    types: JSON.parse(p.types ?? "[]") as string[],
    abilities: JSON.parse(p.abilities ?? "[]") as string[],
    base_stats: JSON.parse(p.stats ?? "null"),
    weaknesses: res.filter((r) => r.multiplier > 1).map((r) => ({ type: r.type, multiplier: r.multiplier })),
    resistances: res.filter((r) => r.multiplier < 1 && r.multiplier > 0).map((r) => ({ type: r.type, multiplier: r.multiplier })),
    immunities: res.filter((r) => r.multiplier === 0).map((r) => r.type),
  };
}

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

// Efficacité d'un type (offensif + défensif), tout en anglais. null si type inconnu.
const qAtt = db.query("SELECT defender AS t, multiplier AS m FROM type_chart WHERE attacker=?");
const qDef = db.query("SELECT attacker AS t, multiplier AS m FROM type_chart WHERE defender=?");
export function getType(name: string) {
  const en = canon("type", name);
  if (!en) return null;
  const att = qAtt.all(en) as { t: string; m: number }[];
  const def = qDef.all(en) as { t: string; m: number }[];
  const pick = (rows: { t: string; m: number }[], m: number) => rows.filter((r) => r.m === m).map((r) => r.t);
  return {
    name: en,
    attacking: { super_effective: pick(att, 2), not_very_effective: pick(att, 0.5), no_effect: pick(att, 0) },
    defending: { weak_to: pick(def, 2), resists: pick(def, 0.5), immune_to: pick(def, 0) },
  };
}

// Infos riches (pour rendre l'IA plus intelligente) : null si inconnu.
export function getMove(name: string) {
  const en = canon("move", name);
  if (!en) return null;
  const m = db.query("SELECT en, type, power, accuracy, pp, priority, damage_class, effect FROM moves WHERE en=?").get(en) as any;
  return { ...m, champions: inChampions("move", en), fr: display("move", en), type_fr: display("type", m.type) };
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

// ---- Méta compétitif : seul accès réseau (usage temps réel) ----
const CACHE = ".cache";
await mkdir(CACHE, { recursive: true });
async function cachedJson(key: string, url: string, ttlMs = 6 * 3600_000): Promise<any> {
  const f = Bun.file(`${CACHE}/${key}.json`);
  if ((await f.exists()) && Date.now() - f.lastModified < ttlMs) return f.json();
  const data = await fetch(url).then((r) => r.json());
  await Bun.write(f, JSON.stringify(data));
  return data;
}

export async function getMeta(name: string, format: "Doubles" | "Singles") {
  const slug = name.replace(/\s+/g, "-").toLowerCase();
  let data: any;
  try {
    data = await cachedJson(
      `meta-${format}-${slug}`,
      `https://championsbattledata.com/api/battle/${format}/${encodeURIComponent(name)}`,
    );
  } catch {
    return { error: `No meta data for ${name} (${format})` };
  }

  const rows: any[] = data?.rows ?? [];
  if (!rows.length) return { note: `No Champions usage data for ${name}.` };

  const top = (cat: string, n = 5) => rows.filter((r) => r.category === cat).slice(0, n);
  return {
    pokemon: data.pokemon,
    format,
    moves: top("move", 8).map((r) => ({ name: r.name, usage: r.percentage })),
    items: top("item").map((r) => ({ name: r.name, usage: r.percentage })),
    abilities: top("ability").map((r) => ({ name: r.name, usage: r.percentage })),
    natures: top("nature").map((r) => ({ name: r.name, up: r.stat_up, down: r.stat_down, usage: r.percentage })),
    ev_spreads: top("spread", 3).map((r) => ({
      usage: r.percentage, hp: r.hp_points, atk: r.attack_points, def: r.defense_points,
      spa: r.sp_atk_points, spd: r.sp_def_points, spe: r.speed_points,
    })),
    teammates: top("teammate").map((r) => ({ name: r.name, usage: r.percentage })),
  };
}
