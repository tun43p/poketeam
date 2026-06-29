// Name resolution. `canon` is THE choke point: any spelling
// (EN/FR/typo) → canonical EN name, or null if unknown. display/localize do the
// reverse path (EN → target language). localizeProse translates free prose.
import { db, norm, type Category } from "./db";

const qCanon = db.query<{ en: string }, [string, string]>(
  "SELECT en FROM lookup WHERE category=? AND norm=? LIMIT 1",
);
// Any spelling (EN/FR/typo) → canonical EN name, or null if unknown.
// THE choke point: nothing enters the system without going through here.
export function canon(category: Category, name?: string | null): string | null {
  if (!name) return null;
  return qCanon.get(category, norm(name))?.en ?? null;
}

// Available in Pokémon Champions? (subset of the national dex stored at build time).
// Natures and types: all legal. Otherwise: presence in the `champions` table (by norm
// of the canonical EN name). See build.ts → "Pokémon Champions" section.
const qChamp = db.query<Record<string, number>, [string, string]>(
  "SELECT 1 FROM champions WHERE category=? AND norm=? LIMIT 1",
);
export function inChampions(category: Category, name?: string | null): boolean {
  if (!name) return false;
  if (category === "nature" || category === "type") return true;
  return !!qChamp.get(category, norm(canon(category, name) ?? name));
}

const qDisplay = db.query<{ name: string }, [string, string, string]>(
  "SELECT name FROM lookup WHERE category=? AND lang=? AND en=? LIMIT 1",
);
// Canonical EN name → name displayed in the target language (fallback: the EN itself).
export function display(
  category: Category,
  en?: string | null,
  lang: "fr" | "en" = "fr",
): string | null {
  if (!en) return null;
  if (lang === "en") return en;
  return qDisplay.get(category, lang, en)?.name ?? en;
}

// Any spelling → name in the target language. Unknown: we keep the original entry.
export function localize(category: Category, name?: string | null, lang: "fr" | "en" = "fr") {
  const en = canon(category, name);
  return en ? display(category, en, lang) : (name ?? null);
}

// Translates free PROSE (strategy/role/note/chat): the AI writes it in French but
// leaves proper nouns in ENGLISH (Pokémon, moves, abilities…). We replace them via
// `lookup`, with a dictionary find/replace — no LLM call (cost/latency/inconsistency).
// ponytail: flat EN→FR dict; the ~4 cross-category homographs (e.g. type vs move
//   "Psychic") take the 1st category loaded. Disambiguate by category if needed.
let proseRe: RegExp | null = null;
let proseMap: Map<string, string> | null = null;
// The DB writes apostrophes as ’ (U+2019), the AI/users as ' — we unify them.
const apos = (s: string) => s.replace(/[’‘]/g, "'");
function buildProse() {
  const rows = db
    .query<{ en: string; name: string }, []>(
      "SELECT en, name FROM lookup WHERE lang='fr' AND en<>name",
    )
    .all();
  const map = new Map<string, string>();
  for (const r of rows) {
    const k = apos(r.en).toLowerCase();
    if (!map.has(k)) map.set(k, r.name); // 1st category wins
  }
  proseMap = map;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // longest-first: "King's Shield" must match before "Shield".
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(esc);
  // alphanum boundaries (handles spaces/apostrophes/hyphens internal to names).
  proseRe = new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}
export function localizeProse(text?: string | null, lang: "fr" | "en" = "fr"): string | null {
  if (!text || lang === "en") return text ?? null;
  if (!proseRe || !proseMap) buildProse();
  const re = proseRe;
  const map = proseMap;
  if (!re || !map) return text;
  return apos(text).replace(re, (m) => map.get(m.toLowerCase()) ?? m);
}
