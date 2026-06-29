// Listes de référence pour l'UI (déjà localisées par la couche data).
import { pokemonList, getTypes } from "@poketeam/data";

export const pokemonRoutes = {
  "/api/pokemon": () => Response.json(pokemonList()),
  "/api/types": () => Response.json(getTypes()),
};
