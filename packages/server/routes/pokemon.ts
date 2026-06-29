// Listes de référence pour l'UI (déjà localisées par la couche data).
import { pokemonList, getTypes } from "@poketeam/data";

export const pokemonRoutes = {
  "/api/pokemon": async () => Response.json(await pokemonList()),
  "/api/types": async () => Response.json(await getTypes()),
};
