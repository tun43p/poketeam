// Migration: brings a team (old FR format with name_fr/name_en, OR already EN)
// to canonical ENGLISH via the DB. Idempotent: a team already in EN stays identical.
import { canon, type Category } from "@poketeam/data";
import type { StoredTeam, Team } from "@poketeam/types";

function canonName(cat: Category, ...cands: (string | undefined | null)[]): string | null {
  for (const c of cands) {
    const r = canon(cat, c);
    if (r) return r;
  }
  return cands.find(Boolean) ?? null;
}

function toCanonicalTeam(team: Team | undefined): Team | undefined {
  if (!team?.team) return team;
  for (const m of team.team) {
    m.name = canonName("pokemon", m.name_en, m.name, m.name_fr) ?? m.name;
    delete m.name_fr;
    delete m.name_en;
    if (m.item) m.item = canon("item", m.item) ?? m.item;
    m.ability = canonName("ability", m.ability_en, m.ability);
    delete m.ability_en;
    if (m.nature) m.nature = canon("nature", m.nature) ?? m.nature;
    if (m.tera_type) m.tera_type = canon("type", m.tera_type) ?? m.tera_type;
    m.types = (m.types ?? []).map((t) => canon("type", t) ?? t);
    for (const mv of m.moves ?? []) {
      if (typeof mv === "string") continue;
      mv.name = canonName("move", mv.name_en, mv.name) ?? mv.name;
      delete mv.name_en;
      if (mv.type) mv.type = canon("type", mv.type) ?? mv.type;
    }
    m.weaknesses = (m.weaknesses ?? []).map((w) => ({
      type: canon("type", w.type) ?? w.type,
      multiplier: w.multiplier,
    }));
  }
  return team;
}

// Additive migration: `versions` added if absent, then EN canonicalization
// of the active team and all its versions. Idempotent.
export function migrate(t: StoredTeam) {
  if (!t.versions) {
    t.versions = [{ team: t.team, prompt: t.prompt, at: t.savedAt }];
    t.active = 0;
  }
  toCanonicalTeam(t.team);
  t.versions.forEach((v) => toCanonicalTeam(v.team));
  return t;
}
