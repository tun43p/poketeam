// Safeguard: poke.db exists and canonicalizes any spelling → EN name.
import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";

const db = new Database(`${import.meta.dir}/../../poke.db`, { readonly: true });
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const canon = (cat: string, name: string) =>
  db
    .query<{ en: string }, [string, string]>(
      "SELECT en FROM lookup WHERE category=? AND norm=? LIMIT 1",
    )
    .get(cat, norm(name))?.en ?? null;
const display = (cat: string, en: string, lang: string) =>
  db
    .query<{ name: string }, [string, string, string]>(
      "SELECT name FROM lookup WHERE category=? AND lang=? AND en=? LIMIT 1",
    )
    .get(cat, lang, en)?.name ?? null;

test("canonicalise toute graphie → EN", () => {
  expect(canon("move", "Lance-Soleil")).toBe("Solar Beam");
  expect(canon("move", "lance soleil")).toBe("Solar Beam");
  expect(canon("move", "Solar Beam")).toBe("Solar Beam");
  expect(canon("ability", "Isograisse")).toBe("Thick Fat");
  expect(canon("item", "Bandeau Choix")).toBe("Choice Band");
  expect(canon("nature", "Rigide")).toBe("Adamant");
  expect(canon("pokemon", "Dracaufeu")).toBe("Charizard");
  expect(canon("type", "Feu")).toBe("Fire");
  expect(canon("move", "Nom Bidon Inexistant")).toBeNull();
});

test("affiche EN → FR (lookup inverse)", () => {
  expect(display("move", "Solar Beam", "fr")).toBe("Lance-Soleil");
  expect(display("type", "Fire", "fr")).toBe("Feu");
  expect(display("pokemon", "Charizard", "fr")).toBe("Dracaufeu");
});

test("matrice d'efficacité des types (type_chart)", () => {
  const mult = (att: string, def: string) =>
    db
      .query<{ m: number }, [string, string]>(
        "SELECT multiplier m FROM type_chart WHERE attacker=? AND defender=?",
      )
      .get(att, def)?.m ?? 1;
  expect(mult("Water", "Fire")).toBe(2);
  expect(mult("Fire", "Water")).toBe(0.5);
  expect(mult("Normal", "Ghost")).toBe(0);
  expect(mult("Normal", "Normal")).toBe(1); // neutral = absent → fallback 1
});

test("tables de détail sans aucune colonne FR", () => {
  const cols = (t: string) =>
    db
      .query<{ name: string }, []>(`PRAGMA table_info(${t})`)
      .all()
      .map((c) => c.name);
  for (const t of ["pokemon", "moves", "abilities", "items", "natures", "types"]) {
    expect(cols(t).some((c) => /fr/i.test(c))).toBe(false);
  }
});
