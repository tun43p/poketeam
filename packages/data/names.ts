// Résolution de noms. `canon` est LE point de passage : n'importe quelle graphie
// (EN/FR/faute) → nom EN canonique, ou null si inconnu. display/localize font le
// chemin inverse (EN → langue cible). localizeProse traduit la prose libre.
import { db, norm, type Category } from "./db";

const qCanon = db.query("SELECT en FROM lookup WHERE category=? AND norm=? LIMIT 1");
// N'importe quelle graphie (EN/FR/faute) → nom EN canonique, ou null si inconnu.
// LE point de passage : rien n'entre dans le système sans passer par ici.
export function canon(category: Category, name?: string | null): string | null {
  if (!name) return null;
  return (qCanon.get(category, norm(name)) as any)?.en ?? null;
}

// Disponible dans Pokémon Champions ? (sous-ensemble du national dex stocké au build).
// Natures et types : tous légaux. Sinon : présence dans la table `champions` (par norm
// du nom EN canonique). Voir build.ts → section "Pokémon Champions".
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
