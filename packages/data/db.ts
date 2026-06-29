// Connection to the reference data (poke.db, offline, `bun run build:db`).
// poke.db lives at the project ROOT, resolved relative to the module (import.meta.dir
// → packages/data, hence ../../), not the cwd, so it works from any package.
// The tables are in ENGLISH; translation (in both directions) lives in names.ts.
import { Database } from "bun:sqlite";

export const db = new Database(`${import.meta.dir}/../../poke.db`, { readonly: true });

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export type Category = "pokemon" | "move" | "ability" | "item" | "nature" | "type";
