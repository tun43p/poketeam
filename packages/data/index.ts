// Public surface of the package: everything that store/agent/server consume.
export { canon, inChampions, display, localize, localizeProse } from "./names";
export { getPokemon, getMove, getAbility, getItem, getType } from "./reference";
export { pokemonList, getTypes } from "./lists";
export { localizeTeam } from "./team";
export { getMeta } from "./meta";
export type { Category } from "./db";
