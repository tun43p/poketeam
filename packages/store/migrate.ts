// Migration : ramène une équipe (ancien format FR avec name_fr/name_en, OU déjà EN)
// vers l'ANGLAIS canonique via la BDD. Idempotent : une équipe déjà EN reste identique.
import { canon } from "@poketeam/data";
import type { Store } from "./read";

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

// Migration additive : `versions` ajoutées si absentes, puis canonicalisation EN
// de l'équipe active et de toutes ses versions. Idempotent.
export function migrate(t: Store["teams"][number]) {
  if (!t.versions) {
    t.versions = [{ team: t.team, prompt: t.prompt, at: t.savedAt }];
    t.active = 0;
  }
  toCanonicalTeam(t.team);
  t.versions.forEach((v) => toCanonicalTeam(v.team));
  return t;
}
