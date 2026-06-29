// Construit poke.db : TOUTE la data de référence (offline, commitée).
// Principe : les tables de détail sont 100% ANGLAIS. La table `lookup` est la SEULE
// multilingue — elle répartit n'importe quelle graphie (toute langue) → nom EN canonique,
// et sert aussi à l'affichage (EN → langue cible).
// Sources : Tyradex (pokédex + types + stats + résistances) et PokéAPI (attaques,
// talents, objets, natures — noms FR + descriptions). Lancement : `bun run build:db`.
import { Database } from "bun:sqlite";

// ---- Formes des réponses externes (uniquement les champs lus) ----
type Loc = { name: string }[]; // tableau de noms localisés (PokéAPI)
interface TypeNode {
  en?: Loc;
  fr?: Loc;
}
interface TypeEff {
  damage_factor: number;
  att?: { en?: Loc };
  def?: { en?: Loc };
}
interface MoveNode {
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number | null;
  move_effect_chance: number | null;
  pokemon_v2_movedamageclass?: { name: string } | null;
  type?: { en?: Loc };
  en?: Loc;
  fr?: Loc;
  eff?: { texts?: { short_effect: string | null }[] } | null;
}
interface AbilityNode {
  en?: Loc;
  fr?: Loc;
  eff?: { short_effect: string | null }[];
}
interface ItemNode {
  cat?: { name: string } | null;
  en?: Loc;
  fr?: Loc;
  eff?: { short_effect: string | null }[];
}
interface NatureNode {
  up?: { name: string } | null;
  down?: { name: string } | null;
  en?: Loc;
  fr?: Loc;
}
interface TyType {
  name?: { fr?: string };
  sprites: string;
}
interface DexMon {
  name?: { en?: string; fr?: string };
  pokedex_id: number;
  sprites?: { regular?: string | null };
  types?: { name: string }[];
  talents?: { name: string }[];
  stats?: unknown;
  resistances?: { name: string; multiplier: number }[];
}
interface ChampForm {
  abilities?: string;
  hidden_ability?: string;
}
interface ChampMon {
  battleName?: string;
  name: string;
  learnableMoveNames?: string[];
  summary?: { forms?: ChampForm[] };
}
interface ChampIndex {
  pokemon: ChampMon[];
}
interface BattleData {
  rows?: { category: string; name: string }[];
}

const GQL = "https://beta.pokeapi.co/graphql/v1beta";
async function gql<T>(query: string): Promise<T> {
  const r = (await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  }).then((res) => res.json())) as { errors?: unknown; data: T };
  if (r.errors) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

// Clé de recherche : minuscule, sans accent, sans ponctuation (les slugs "solar-beam"
// se normalisent comme "Solar Beam" → pas besoin de les stocker en plus).
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// poke.db est écrit à la RACINE du projet (résolu via import.meta.dir → ../.., pas le cwd).
const db = new Database(`${import.meta.dir}/../../poke.db`, { create: true });

// ---- Schéma : détail en anglais pur, `lookup` = unique table multilingue ----
db.run(`DROP TABLE IF EXISTS lookup`);
db.run(`CREATE TABLE lookup (category TEXT, lang TEXT, en TEXT, name TEXT, norm TEXT)`);
db.run(`DROP TABLE IF EXISTS pokemon`);
db.run(
  `CREATE TABLE pokemon (en TEXT PRIMARY KEY, dex_id INTEGER, sprite TEXT, types TEXT, abilities TEXT, stats TEXT, resistances TEXT)`,
);
db.run(`DROP TABLE IF EXISTS moves`);
db.run(
  `CREATE TABLE moves (en TEXT PRIMARY KEY, type TEXT, power INTEGER, accuracy INTEGER, pp INTEGER, priority INTEGER, damage_class TEXT, effect TEXT)`,
);
db.run(`DROP TABLE IF EXISTS abilities`);
db.run(`CREATE TABLE abilities (en TEXT PRIMARY KEY, effect TEXT)`);
db.run(`DROP TABLE IF EXISTS items`);
db.run(`CREATE TABLE items (en TEXT PRIMARY KEY, category TEXT, effect TEXT)`);
db.run(`DROP TABLE IF EXISTS natures`);
db.run(`CREATE TABLE natures (en TEXT PRIMARY KEY, up TEXT, down TEXT)`);
db.run(`DROP TABLE IF EXISTS types`);
db.run(`CREATE TABLE types (en TEXT PRIMARY KEY, sprite TEXT)`);
db.run(`DROP TABLE IF EXISTS type_chart`);
// Matrice d'efficacité attaquant→défenseur (anglais). On ne stocke que le ≠1 ;
// l'absence d'une paire = neutre (×1). multiplier ∈ {0, 0.5, 2}.
db.run(
  `CREATE TABLE type_chart (attacker TEXT, defender TEXT, multiplier REAL, PRIMARY KEY (attacker, defender))`,
);

const insLookup = db.prepare(
  "INSERT INTO lookup (category, lang, en, name, norm) VALUES (?,?,?,?,?)",
);
// Enregistre le nom EN canonique + ses graphies par langue. Une ligne par langue.
function names(category: string, en: string, fr?: string | null) {
  insLookup.run(category, "en", en, en, norm(en));
  if (fr) insLookup.run(category, "fr", en, fr, norm(fr));
}
const qCanon = db.query<{ en: string }, [string, string]>(
  "SELECT en FROM lookup WHERE category=? AND norm=? LIMIT 1",
);
const canon = (cat: string, name: string): string => qCanon.get(cat, norm(name))?.en ?? name;

const tx = db.transaction((fn: () => void) => {
  fn();
});

// ---- Types (PokéAPI = EN/FR ; Tyradex = icônes UI) ----
console.log("Types…");
const tyTypes = (await fetch("https://tyradex.app/api/v1/types").then((r) => r.json())) as TyType[];
const spriteByFr = new Map<string, string>(tyTypes.map((t) => [norm(t.name?.fr ?? ""), t.sprites]));
const typeData = await gql<{
  pokemon_v2_type: TypeNode[];
}>(`{ pokemon_v2_type(where:{id:{_lte:18}}){
  en:pokemon_v2_typenames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name}
  fr:pokemon_v2_typenames(where:{pokemon_v2_language:{name:{_eq:"fr"}}}){name} } }`);
const insType = db.prepare("INSERT OR REPLACE INTO types (en, sprite) VALUES (?,?)");
tx(() => {
  for (const t of typeData.pokemon_v2_type) {
    const en = t.en?.[0]?.name,
      fr = t.fr?.[0]?.name;
    if (!en) continue;
    insType.run(en, spriteByFr.get(norm(fr ?? "")) ?? null);
    names("type", en, fr);
  }
});

// ---- Matrice d'efficacité des types (PokéAPI) ----
console.log("Efficacité des types…");
const teData = await gql<{
  pokemon_v2_typeefficacy: TypeEff[];
}>(`{ pokemon_v2_typeefficacy(where:{damage_type_id:{_lte:18}, target_type_id:{_lte:18}, damage_factor:{_neq:100}}){
  damage_factor
  att:pokemon_v2_type{ en:pokemon_v2_typenames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name} }
  def:pokemonV2TypeByTargetTypeId{ en:pokemon_v2_typenames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name} } }}`);
const insChart = db.prepare(
  "INSERT OR REPLACE INTO type_chart (attacker, defender, multiplier) VALUES (?,?,?)",
);
tx(() => {
  for (const e of teData.pokemon_v2_typeefficacy) {
    const att = e.att?.en?.[0]?.name,
      def = e.def?.en?.[0]?.name;
    if (!att || !def) continue;
    insChart.run(att, def, e.damage_factor / 100);
  }
});

// ---- Attaques (PokéAPI) ----
console.log("Attaques…");
const moveData = await gql<{ pokemon_v2_move: MoveNode[] }>(`{ pokemon_v2_move {
  power accuracy pp priority move_effect_chance
  pokemon_v2_movedamageclass{name}
  type:pokemon_v2_type{ en:pokemon_v2_typenames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name} }
  en:pokemon_v2_movenames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name}
  fr:pokemon_v2_movenames(where:{pokemon_v2_language:{name:{_eq:"fr"}}}){name}
  eff:pokemon_v2_moveeffect{texts:pokemon_v2_moveeffecteffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){short_effect}} } }`);
const insMove = db.prepare(
  "INSERT OR REPLACE INTO moves (en, type, power, accuracy, pp, priority, damage_class, effect) VALUES (?,?,?,?,?,?,?,?)",
);
tx(() => {
  for (const m of moveData.pokemon_v2_move) {
    const en = m.en?.[0]?.name;
    if (!en) continue;
    // PokéAPI laisse un token $effect_chance dans le texte → on le remplace par la valeur réelle.
    const effect =
      (m.eff?.texts?.[0]?.short_effect ?? null)?.replaceAll(
        "$effect_chance",
        String(m.move_effect_chance ?? ""),
      ) ?? null;
    insMove.run(
      en,
      m.type?.en?.[0]?.name ?? null,
      m.power,
      m.accuracy,
      m.pp,
      m.priority,
      m.pokemon_v2_movedamageclass?.name ?? null,
      effect,
    );
    names("move", en, m.fr?.[0]?.name);
  }
});

// ---- Talents (PokéAPI) ----
console.log("Talents…");
const abData = await gql<{ pokemon_v2_ability: AbilityNode[] }>(`{ pokemon_v2_ability {
  en:pokemon_v2_abilitynames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name}
  fr:pokemon_v2_abilitynames(where:{pokemon_v2_language:{name:{_eq:"fr"}}}){name}
  eff:pokemon_v2_abilityeffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){short_effect} } }`);
const insAb = db.prepare("INSERT OR REPLACE INTO abilities (en, effect) VALUES (?,?)");
tx(() => {
  for (const a of abData.pokemon_v2_ability) {
    const en = a.en?.[0]?.name;
    if (!en) continue;
    insAb.run(en, a.eff?.[0]?.short_effect ?? null);
    names("ability", en, a.fr?.[0]?.name);
  }
});

// ---- Objets (PokéAPI) ----
console.log("Objets…");
const itemData = await gql<{ pokemon_v2_item: ItemNode[] }>(`{ pokemon_v2_item {
  cat:pokemon_v2_itemcategory{name}
  en:pokemon_v2_itemnames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name}
  fr:pokemon_v2_itemnames(where:{pokemon_v2_language:{name:{_eq:"fr"}}}){name}
  eff:pokemon_v2_itemeffecttexts(where:{pokemon_v2_language:{name:{_eq:"en"}}}){short_effect} } }`);
const insItem = db.prepare("INSERT OR REPLACE INTO items (en, category, effect) VALUES (?,?,?)");
tx(() => {
  for (const it of itemData.pokemon_v2_item) {
    const en = it.en?.[0]?.name;
    if (!en) continue;
    insItem.run(en, it.cat?.name ?? null, it.eff?.[0]?.short_effect ?? null);
    names("item", en, it.fr?.[0]?.name);
  }
});

// ---- Natures (PokéAPI) ----
console.log("Natures…");
const natData = await gql<{ pokemon_v2_nature: NatureNode[] }>(`{ pokemon_v2_nature {
  up:pokemonV2StatByIncreasedStatId{name}
  down:pokemon_v2_stat{name}
  en:pokemon_v2_naturenames(where:{pokemon_v2_language:{name:{_eq:"en"}}}){name}
  fr:pokemon_v2_naturenames(where:{pokemon_v2_language:{name:{_eq:"fr"}}}){name} } }`);
const insNat = db.prepare("INSERT OR REPLACE INTO natures (en, up, down) VALUES (?,?,?)");
tx(() => {
  for (const n of natData.pokemon_v2_nature) {
    const en = n.en?.[0]?.name;
    if (!en) continue;
    insNat.run(en, n.up?.name ?? null, n.down?.name ?? null);
    names("nature", en, n.fr?.[0]?.name);
  }
});

// ---- Traduction FR des effets (machine translation gratuite + cache disque) ----
// L'effet détaillé n'existe qu'en anglais dans PokéAPI. On le traduit une fois au build
// (endpoint public Google, sans clé), dédoublonné + caché dans .cache/mt-fr.json (les
// re-builds sont alors instantanés). Le résultat est figé dans poke.db (offline au runtime).
console.log("Traduction des effets (FR)…");
const MT_CACHE = ".cache/mt-fr.json";
let mtCache: Record<string, string> = {};
try {
  mtCache = (await Bun.file(MT_CACHE).json()) as Record<string, string>;
} catch {
  /* best effort : échecs réseau ignorés */
}

async function mt(q: string): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encodeURIComponent(q)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = (await fetch(url).then((res) => res.json())) as [(string | null)[][]];
      const out = r[0].map((s) => s[0] ?? "").join("");
      if (out) return out;
    } catch {
      /* best effort : échecs réseau ignorés */
    }
  }
  return null; // échec → on gardera l'anglais au runtime
}

const effSet = new Set<string>();
for (const t of ["moves", "abilities", "items"])
  for (const row of db
    .query<{ e: string }, []>(`SELECT effect e FROM ${t} WHERE effect IS NOT NULL AND effect != ''`)
    .all())
    effSet.add(row.e);
const todo = [...effSet].filter((e) => !(e in mtCache));
console.log(
  `  ${effSet.size} effets uniques · ${todo.length} à traduire · ${effSet.size - todo.length} en cache`,
);

let done = 0;
const POOL = 8;
const chunks: string[][] = Array.from({ length: POOL }, () => []);
todo.forEach((e, i) => chunks[i % POOL].push(e));
await Promise.all(
  chunks.map(async (items) => {
    for (const e of items) {
      const fr = await mt(e);
      if (fr) mtCache[e] = fr;
      if (++done % 200 === 0) console.log(`  ${done}/${todo.length}…`);
    }
  }),
);
await Bun.write(MT_CACHE, JSON.stringify(mtCache));

db.run(`DROP TABLE IF EXISTS effects`);
db.run(`CREATE TABLE effects (en TEXT PRIMARY KEY, fr TEXT)`);
const insEff = db.prepare("INSERT OR REPLACE INTO effects (en, fr) VALUES (?,?)");
let translated = 0;
tx(() => {
  for (const en of effSet) {
    if (mtCache[en]) {
      insEff.run(en, mtCache[en]);
      translated++;
    }
  }
});
console.log(`  ✓ ${translated}/${effSet.size} effets traduits en BDD`);

// ---- Pokémon (Tyradex) — EN DERNIER : on canonicalise types/talents/résistances
// FR de Tyradex → EN via la table `lookup` désormais remplie. ----
console.log("Pokémon…");
const dex = (await fetch("https://tyradex.app/api/v1/pokemon").then((r) => r.json())) as DexMon[];
const insPoke = db.prepare(
  "INSERT OR REPLACE INTO pokemon (en, dex_id, sprite, types, abilities, stats, resistances) VALUES (?,?,?,?,?,?,?)",
);
tx(() => {
  for (const p of dex) {
    const en = p.name?.en;
    if (!en || p.pokedex_id < 1) continue;
    insPoke.run(
      en,
      p.pokedex_id,
      p.sprites?.regular ?? null,
      JSON.stringify((p.types ?? []).map((t) => canon("type", t.name))),
      JSON.stringify((p.talents ?? []).map((t) => canon("ability", t.name))),
      JSON.stringify(p.stats ?? null),
      JSON.stringify(
        (p.resistances ?? []).map((r) => ({
          type: canon("type", r.name),
          multiplier: r.multiplier,
        })),
      ),
    );
    names("pokemon", en, p.name?.fr);
  }
});

// ---- Disponibilité Pokémon Champions (championsbattledata.com) ----
// poke.db contient TOUT le national dex ; Champions n'en est qu'un sous-ensemble.
// On stocke ce qui est LÉGAL dans Champions (par norm) → l'agent peut filtrer.
// Source unique : l'index donne pokémon + attaques apprenables + talents ; les objets
// ne sont QUE dans l'usage par Pokémon (held_item top 10), qu'on agrège (~141/148).
// Natures et types : tous légaux → non stockés (inChampions les renvoie true).
console.log("Pokémon Champions (disponibilité)…");
const CUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const cfetch = <T>(u: string) =>
  fetch(u, { headers: { "User-Agent": CUA } }).then((r) => r.json() as Promise<T>);
db.run(`DROP TABLE IF EXISTS champions`);
db.run(`CREATE TABLE champions (category TEXT, norm TEXT, PRIMARY KEY (category, norm))`);
const insChamp = db.prepare("INSERT OR IGNORE INTO champions (category, norm) VALUES (?,?)");
const champ = (cat: string, name?: string | null) => {
  if (name) insChamp.run(cat, norm(name));
};

const champIdx = await cfetch<ChampIndex>(
  "https://championsbattledata.com/data/pokemon-index.json",
);
const champNames: string[] = champIdx.pokemon.map((p) => p.battleName ?? p.name);
tx(() => {
  for (const p of champIdx.pokemon) {
    champ("pokemon", p.battleName ?? p.name);
    for (const mv of p.learnableMoveNames ?? []) champ("move", mv);
    for (const f of p.summary?.forms ?? []) {
      for (const a of (f.abilities ?? "").split("|")) champ("ability", a.trim());
      for (const a of (f.hidden_ability ?? "").split("|")) champ("ability", a.trim());
    }
  }
});

// Objets : agrège held_item sur chaque Pokémon × {Doubles, Singles} (pool de 16).
const jobs: [string, string][] = [];
for (const n of champNames) for (const fmt of ["Doubles", "Singles"]) jobs.push([n, fmt]);
let ci = 0;
const items: string[] = [];
await Promise.all(
  Array.from({ length: 16 }, async () => {
    while (ci < jobs.length) {
      const [n, fmt] = jobs[ci++];
      try {
        const d = await cfetch<BattleData>(
          `https://championsbattledata.com/api/battle/${fmt}/${encodeURIComponent(n)}`,
        );
        for (const r of d.rows ?? []) if (r.category === "held_item") items.push(r.name);
      } catch {
        /* best effort : échecs réseau ignorés */
      }
    }
  }),
);
tx(() => {
  for (const it of items) champ("item", it);
});

// Index de recherche (après insertion = plus rapide).
db.run(`CREATE INDEX idx_lookup_norm ON lookup (category, norm)`);
db.run(`CREATE INDEX idx_lookup_en ON lookup (category, lang, en)`);

const count = (t: string) => (db.query(`SELECT count(*) c FROM ${t}`).get() as { c: number }).c;
console.log(
  `\n✅ poke.db : ${count("pokemon")} pokémon, ${count("moves")} attaques, ${count("abilities")} talents, ` +
    `${count("items")} objets, ${count("natures")} natures, ${count("types")} types, ` +
    `${count("type_chart")} relations d'efficacité, ${count("effects")} effets FR, ${count("lookup")} entrées lookup, ` +
    `${count("champions")} entrées Champions.`,
);
db.close();
