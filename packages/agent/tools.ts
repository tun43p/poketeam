// Outils MCP exposés à l'agent : tous lisent poke.db (lecture seule, déterministe) et
// renvoient les noms ANGLAIS officiels + un champ `champions` (légal dans Champions ?).
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  getPokemon,
  getMeta,
  getMove,
  getAbility,
  getItem,
  getType,
  canon,
  inChampions,
} from "@poketeam/data";

const ok = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});

const ro = { annotations: { readOnlyHint: true } };

// Liste blanche d'outils partagée par les deux générateurs (génération + coaching).
export const ALLOWED_TOOLS = [
  "mcp__poke__get_pokemon",
  "mcp__poke__get_move",
  "mcp__poke__get_ability",
  "mcp__poke__get_item",
  "mcp__poke__get_type",
  "mcp__poke__get_meta",
  "mcp__poke__check_champions",
  "WebSearch",
  "WebFetch",
];

export const tools = createSdkMcpServer({
  name: "poke",
  version: "1.0.0",
  tools: [
    tool(
      "get_pokemon",
      "Validate a species and get its English typing, base stats, abilities, weaknesses/resistances/immunities, and `champions` (true if the species is in Pokémon Champions). Returns {error} if the name is unknown. NEVER put a species where champions is false in the team.",
      { name: z.string().describe("English species name") },
      async ({ name }) => ok(getPokemon(name)),
      ro,
    ),
    tool(
      "get_move",
      "Look up a move: official English name, type, power, accuracy, PP, priority, damage class, effect description, and `champions` (true if the move is in Pokémon Champions). Returns null if unknown — VALIDATE every move name, choose by real effect, and NEVER use a move where champions is false.",
      { name: z.string().describe("Move name (English preferred, any language accepted)") },
      async ({ name }) => ok(getMove(name) ?? { error: `Unknown move: ${name}` }),
      ro,
    ),
    tool(
      "get_ability",
      "Look up an ability: official English name, effect description, and `champions` (true if the ability is in Pokémon Champions). Returns null if unknown — validate ability names, reason from the effect, and NEVER use an ability where champions is false.",
      { name: z.string().describe("Ability name (English preferred, any language accepted)") },
      async ({ name }) => ok(getAbility(name) ?? { error: `Unknown ability: ${name}` }),
      ro,
    ),
    tool(
      "get_item",
      "Look up a held item: official English name, category, effect description, and `champions` (true if legal in Pokémon Champions). Returns null if unknown — validate item names, reason from the effect, and NEVER use an item where champions is false.",
      { name: z.string().describe("Item name (English preferred, any language accepted)") },
      async ({ name }) => ok(getItem(name) ?? { error: `Unknown item: ${name}` }),
      ro,
    ),
    tool(
      "check_champions",
      "Is this Pokémon / move / ability / item available (legal) in Pokémon Champions? Returns {name, category, available}. The poke.db covers the full National Dex; Champions is only a subset, so use this (or the `champions` field on get_*) to avoid picking species/moves/items that aren't in the game.",
      {
        category: z.enum(["pokemon", "move", "ability", "item", "nature", "type"]),
        name: z.string().describe("English name (any language accepted)"),
      },
      async ({ category, name }) =>
        ok({
          name: canon(category, name) ?? name,
          category,
          available: inChampions(category, name),
        }),
      ro,
    ),
    tool(
      "get_type",
      "Type effectiveness chart for one type: offensively (super effective / not very effective / no effect against) and defensively (weak to / resists / immune to). Use it to reason about coverage and team weaknesses.",
      { name: z.string().describe("Type name, e.g. Fire") },
      async ({ name }) => ok(getType(name) ?? { error: `Unknown type: ${name}` }),
      ro,
    ),
    tool(
      "get_meta",
      "Pokémon Champions competitive usage: top moves, items, abilities, natures, EV spreads, common teammates.",
      { name: z.string().describe("English species name"), format: z.enum(["Doubles", "Singles"]) },
      async ({ name, format }) => ok(await getMeta(name, format)),
      ro,
    ),
  ],
});
