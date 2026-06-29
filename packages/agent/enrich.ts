// L'IA ne produit que de l'anglais. Le serveur RECANONICALISE chaque nom via la BDD
// (aucune valeur n'entre sans passer par canon()) et réinjecte les données
// déterministes (types/faiblesses, type d'attaque). L'équipe stockée est 100% EN.
import { canon, getPokemon, getMove } from "@poketeam/data";

export function enrichTeam(team: any) {
  if (!team?.team) return;
  for (const m of team.team) {
    m.name = canon("pokemon", m.name) ?? m.name;
    const p = getPokemon(m.name);
    if (!("error" in p)) {
      m.types = p.types;
      m.weaknesses = p.weaknesses; // [{type, multiplier}], EN, autoritaire
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
      mv.type = getMove(mv.name)?.type ?? mv.type ?? null; // type d'attaque = BDD, jamais l'IA
    }
  }
}
