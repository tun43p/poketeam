// Persistance utilisateur : boîtes (slots de Pokémon) + équipes générées.
// Un seul fichier JSON, stocké 100% en ANGLAIS canonique (l'affichage est localisé
// au rendu côté serveur). ponytail: pas de lock, un seul utilisateur local.
// Surchargé par STORE_FILE pour les tests, afin de ne JAMAIS toucher le vrai store.json.
import { migrate } from "./migrate";
import type { Store } from "@poketeam/types";

const FILE = Bun.env.STORE_FILE ?? "store.json";

export async function read(): Promise<Store> {
  const f = Bun.file(FILE);
  const s: Store = (await f.exists()) ? ((await f.json()) as Store) : { boxes: {}, teams: [] };
  const before = JSON.stringify(s.teams);
  s.teams.forEach(migrate);
  // Auto-réparation du fichier sur disque : on réécrit UNE fois si la migration a changé quelque chose.
  if (JSON.stringify(s.teams) !== before) await write(s);
  return s;
}

export const write = (s: Store) => Bun.write(FILE, JSON.stringify(s, null, 2));
