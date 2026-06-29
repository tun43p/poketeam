// Listes pour l'UI : sélection de Pokémon (FR+EN+sprite+types) et les 18 types.
import { db } from "./db";
import { display } from "./names";
import type { PokemonListItem } from "@poketeam/types";

interface PokemonListRow {
  dex_id: number;
  en: string;
  sprite: string | null;
  types: string | null;
}

// Liste de sélection UI : espèces réelles, nom FR+EN + sprite + types (FR pour l'affichage).
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

// Les 18 types (nom FR + icône) pour l'UI.
export function getTypes(): { name: string; image: string }[] {
  return db
    .query<{ en: string; sprite: string }, []>(
      "SELECT en, sprite FROM types WHERE sprite IS NOT NULL",
    )
    .all()
    .map((t) => ({ name: display("type", t.en)!, image: t.sprite }));
}
