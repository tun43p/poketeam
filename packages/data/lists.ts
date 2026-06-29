// Lists for the UI: Pokémon selection (FR+EN+sprite+types) and the 18 types.
import { db } from "./db";
import { display } from "./names";
import type { PokemonListItem } from "@poketeam/types";

interface PokemonListRow {
  dex_id: number;
  en: string;
  sprite: string | null;
  types: string | null;
}

// UI selection list: real species, FR+EN name + sprite + types (FR for display).
export function pokemonList(): PokemonListItem[] {
  return db
    .query<PokemonListRow, []>("SELECT dex_id, en, sprite, types FROM pokemon ORDER BY dex_id")
    .all()
    .map((p) => ({
      id: p.dex_id,
      en: p.en,
      fr: display("pokemon", p.en),
      sprite: p.sprite,
      types: (JSON.parse(p.types ?? "[]") as string[]).map((t) => display("type", t)),
    }));
}

// The 18 types (FR name + icon) for the UI.
export function getTypes(): { name: string; image: string }[] {
  return db
    .query<{ en: string; sprite: string }, []>(
      "SELECT en, sprite FROM types WHERE sprite IS NOT NULL",
    )
    .all()
    .map((t) => ({ name: display("type", t.en) ?? t.en, image: t.sprite }));
}
