// Persistance utilisateur : boîtes (slots de Pokémon) + équipes générées.
// Un seul fichier JSON, stocké 100% en ANGLAIS canonique (l'affichage est localisé
// au rendu côté serveur). ponytail: pas de lock, un seul utilisateur local.
// Surchargé par STORE_FILE pour les tests, afin de ne JAMAIS toucher le vrai store.json.
import { canon } from "@poketeam/data";
const FILE = process.env.STORE_FILE || "store.json";

// Ramène une équipe (ancien format FR avec name_fr/name_en, OU déjà EN) vers
// l'ANGLAIS canonique via la BDD. Idempotent : une équipe déjà EN reste identique.
function canonName(cat: any, ...cands: (string | undefined | null)[]) {
  for (const c of cands) {
    const r = canon(cat, c);
    if (r) return r;
  }
  return cands.find(Boolean) ?? null;
}
function toCanonicalTeam(team: any) {
  if (!team?.team) return team;
  for (const m of team.team) {
    m.name = canonName("pokemon", m.name_en, m.name, m.name_fr);
    delete m.name_fr;
    delete m.name_en;
    if (m.item) m.item = canon("item", m.item) ?? m.item;
    m.ability = canonName("ability", m.ability_en, m.ability);
    delete m.ability_en;
    if (m.nature) m.nature = canon("nature", m.nature) ?? m.nature;
    if (m.tera_type) m.tera_type = canon("type", m.tera_type) ?? m.tera_type;
    m.types = (m.types ?? []).map((t: string) => canon("type", t) ?? t);
    for (const mv of m.moves ?? []) {
      if (typeof mv === "string") continue;
      mv.name = canonName("move", mv.name_en, mv.name);
      delete mv.name_en;
      if (mv.type) mv.type = canon("type", mv.type) ?? mv.type;
    }
    m.weaknesses = (m.weaknesses ?? []).map((w: any) => ({
      type: canon("type", w.type) ?? w.type,
      multiplier: w.multiplier,
    }));
  }
  return team;
}

type Store = {
  boxes: Record<string, string[]>; // nom du slot -> noms EN
  teams: Array<{
    savedAt: string;
    format: string;
    prompt: string;
    team: any; // version active (rétro-compat)
    name?: string;
    chat?: Array<{ role: "user" | "assistant"; text: string }>;
    versions?: Array<{ team: any; prompt: string; at: string }>;
    active?: number;
  }>;
};

// Migration additive : `versions` ajoutées si absentes, puis canonicalisation EN
// de l'équipe active et de toutes ses versions. Idempotent.
function migrate(t: Store["teams"][number]) {
  if (!t.versions) {
    t.versions = [{ team: t.team, prompt: t.prompt, at: t.savedAt }];
    t.active = 0;
  }
  toCanonicalTeam(t.team);
  t.versions.forEach((v) => toCanonicalTeam(v.team));
  return t;
}

async function read(): Promise<Store> {
  const f = Bun.file(FILE);
  const s: Store = (await f.exists()) ? await f.json() : { boxes: {}, teams: [] };
  const before = JSON.stringify(s.teams);
  s.teams?.forEach(migrate);
  // Auto-réparation du fichier sur disque : on réécrit UNE fois si la migration a changé quelque chose.
  if (JSON.stringify(s.teams) !== before) await write(s);
  return s;
}
const write = (s: Store) => Bun.write(FILE, JSON.stringify(s, null, 2));

export const getBoxes = async () => (await read()).boxes;

export async function saveBox(name: string, mons: string[]) {
  const s = await read();
  s.boxes[name] = mons;
  await write(s);
  return s.boxes;
}

export async function deleteBox(name: string) {
  const s = await read();
  delete s.boxes[name];
  await write(s);
  return s.boxes;
}

export async function duplicateBox(name: string) {
  const s = await read();
  if (!(name in s.boxes)) return s.boxes;
  let to = `${name} (copie)`;
  for (let i = 2; to in s.boxes; i++) to = `${name} (copie ${i})`;
  s.boxes[to] = [...s.boxes[name]];
  await write(s);
  return s.boxes;
}

export async function renameBox(old: string, to: string) {
  const s = await read();
  if (old in s.boxes && old !== to) {
    s.boxes[to] = s.boxes[old];
    delete s.boxes[old];
    await write(s);
  }

  return s.boxes;
}

export const getTeams = async () => (await read()).teams;

export async function saveTeam(entry: {
  format: string;
  prompt: string;
  team: any;
}) {
  const s = await read();
  s.teams.unshift({ savedAt: new Date().toISOString(), ...entry });
  await write(s);
  return s.teams;
}

export async function deleteTeam(index: number) {
  const s = await read();
  if (index >= 0 && index < s.teams.length) {
    s.teams.splice(index, 1);
    await write(s);
  }

  return s.teams;
}

// Nouvelle version d'équipe (suite à une modif) + trace dans le fil de discussion.
export async function addVersion(
  index: number,
  team: any,
  prompt: string,
  note: string,
) {
  const s = await read();
  const t = s.teams[index];
  if (t) {
    const at = new Date().toISOString();
    t.versions!.unshift({ team, prompt, at });
    t.active = 0;
    t.team = team;
    t.savedAt = at;
    (t.chat ??= []).push(
      { role: "user", text: prompt },
      { role: "assistant", text: note },
    );
    await write(s);
  }

  return s.teams;
}

// Revenir à une version : la version active devient celle demandée.
export async function setActiveVersion(index: number, v: number) {
  const s = await read();
  const t = s.teams[index];
  if (t && v >= 0 && v < t.versions!.length) {
    t.active = v;
    t.team = t.versions![v].team;
    await write(s);
  }

  return s.teams;
}

export async function appendChat(
  index: number,
  user: string,
  assistant: string,
) {
  const s = await read();
  const t = s.teams[index];
  if (t) {
    (t.chat ??= []).push(
      { role: "user", text: user },
      { role: "assistant", text: assistant },
    );
    await write(s);
  }

  return s.teams;
}

export async function renameTeam(index: number, name: string) {
  const s = await read();
  if (index >= 0 && index < s.teams.length) {
    s.teams[index].name = name;
    await write(s);
  }

  return s.teams;
}
