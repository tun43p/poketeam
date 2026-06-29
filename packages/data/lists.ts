// Listes pour l'UI : sélection de Pokémon (FR+EN+sprite+types) et les 18 types.
import { db } from "./db";
import { display } from "./names";

// Liste de sélection UI : espèces réelles, nom FR+EN + sprite + types (FR pour l'affichage).
export function pokemonList() {
  return db
    .query("SELECT dex_id, en, sprite, types FROM pokemon ORDER BY dex_id")
    .all()
    .map((p: any) => ({
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
    .query("SELECT en, sprite FROM types WHERE sprite IS NOT NULL")
    .all()
    .map((t: any) => ({ name: display("type", t.en)!, image: t.sprite }));
}
