// The AI only produces English. The server RECANONICALIZES every name via the DB
// (no value enters without going through canon()) and re-injects the deterministic
// data (types/weaknesses, move type). The stored team is 100% EN.
import { canon, getPokemon, getMove } from "@poketeam/data";
import type { Team } from "@poketeam/types";

export function enrichTeam(team: Team) {
  for (const m of team.team) {
    m.name = canon("pokemon", m.name) ?? m.name;
    const p = getPokemon(m.name);
    if (!("error" in p)) {
      m.types = p.types;
      m.weaknesses = p.weaknesses; // [{type, multiplier}], EN, authoritative
    } else {
      m.types = [];
      m.weaknesses = [];
    }
    m.item = canon("item", m.item) ?? m.item;
    m.ability = canon("ability", m.ability) ?? m.ability;
    m.nature = canon("nature", m.nature) ?? m.nature;
    m.tera_type = canon("type", m.tera_type) ?? m.tera_type;
    for (const mv of m.moves ?? []) {
      if (typeof mv === "string") continue;
      const c = canon("move", mv.name);
      if (c) mv.name = c;
      mv.type = getMove(mv.name)?.type ?? mv.type ?? null; // move type = DB, never the AI
    }
  }
}
