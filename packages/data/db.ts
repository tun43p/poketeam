// Connexion à la data de référence (poke.db, offline, `bun run build:db`).
// poke.db vit à la RACINE du projet, résolue relativement au module (import.meta.dir
// → packages/data, donc ../../), pas au cwd, pour marcher depuis n'importe quel package.
// Les tables sont en ANGLAIS ; la traduction (dans les deux sens) vit dans names.ts.
import { Database } from "bun:sqlite";

export const db = new Database(`${import.meta.dir}/../../poke.db`, { readonly: true });

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export type Category = "pokemon" | "move" | "ability" | "item" | "nature" | "type";
