// Reference lists for the UI (already localized by the data layer).
import { pokemonList, getTypes } from "@poketeam/data";

export const pokemonRoutes = {
  "/api/pokemon": () => Response.json(pokemonList()),
  "/api/types": () => Response.json(getTypes()),
};
