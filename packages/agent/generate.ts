// Team generation: emits progress steps as the agent's tool calls happen, then the
// final team. If the model returns unusable JSON, we retry the generation (up to
// MAX_ATTEMPTS): the user NEVER sees the raw JSON.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { LANG } from "@poketeam/data";
import { tools, ALLOWED_TOOLS } from "./tools";
import { systemPrompt } from "./prompts";
import { enrichTeam } from "./enrich";
import { parseTeam } from "./parse";
import type { Team } from "@poketeam/types";

// User-facing progress strings follow the chosen language; prompts stay English.
const tr = (fr: string, en: string) => (LANG === "en" ? en : fr);

type Event =
  | { type: "progress"; text: string }
  | { type: "done"; team: Team }
  | { type: "error"; error: string };

// Tool inputs that we inspect for the progress messages.
interface ToolInput {
  query?: string;
  url?: string;
  name?: string;
}

const MAX_ATTEMPTS = 3;

export async function* generateTeamStream(opts: {
  selected: string[];
  prompt: string;
  format: "Doubles" | "Singles";
  refine?: Team; // current team to modify (re-prompt)
}): AsyncGenerator<Event> {
  const base = `Format: ${opts.format === "Doubles" ? "Doubles" : "Singles"}.
Player's box (available pool, ${opts.selected.length} Pokémon): ${opts.selected.join(", ")}.`;

  const userMsg = opts.refine
    ? `${base}
CURRENT TEAM to modify (JSON):
${JSON.stringify(opts.refine)}
Requested change: ${opts.prompt || "(none)"}.
Apply ONLY this request. Keep the Pokémon, sets and choices that are not concerned. Re-validate via the tools whatever you change. Return the FULL updated team in the same schema.`
    : `${base}
User request: ${opts.prompt || "(no particular preference)"}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    yield {
      type: "progress",
      text:
        attempt === 1
          ? opts.refine
            ? tr(
                "Application de tes modifications à l'équipe…",
                "Applying your changes to the team…",
              )
            : tr(
                "Analyse de la boîte et présélection des candidats…",
                "Analyzing the box and shortlisting candidates…",
              )
          : tr(
              `Le format de l'équipe était invalide, nouvelle tentative (${attempt}/${MAX_ATTEMPTS})…`,
              `The team format was invalid, retrying (${attempt}/${MAX_ATTEMPTS})…`,
            ),
    };

    let raw = "";
    for await (const m of query({
      prompt: userMsg,
      options: {
        systemPrompt: systemPrompt(LANG),
        mcpServers: { poke: tools },
        allowedTools: ALLOWED_TOOLS,
        permissionMode: "bypassPermissions",
        persistSession: false, // do not write anything to disk (~/.claude/projects)
        maxTurns: 30,
      },
    })) {
      if (m.type === "assistant") {
        for (const block of m.message.content) {
          if (block.type === "tool_use") {
            const inp = block.input as ToolInput;
            const bn = block.name;
            if (bn === "WebSearch")
              yield {
                type: "progress",
                text: tr(
                  `Recherche les meilleures équipes : ${inp.query ?? ""}`,
                  `Searching for the best teams: ${inp.query ?? ""}`,
                ),
              };
            else if (bn === "WebFetch")
              yield {
                type: "progress",
                text: tr(
                  `Consulte une source : ${inp.url ?? ""}`,
                  `Reading a source: ${inp.url ?? ""}`,
                ),
              };
            else if (bn.endsWith("get_meta"))
              yield {
                type: "progress",
                text: tr(
                  `Consulte le méta Champions : ${inp.name ?? ""}`,
                  `Checking the Champions meta: ${inp.name ?? ""}`,
                ),
              };
            else if (bn.endsWith("get_pokemon"))
              yield {
                type: "progress",
                text: tr(
                  `Analyse le typage : ${inp.name ?? ""}`,
                  `Analyzing typing: ${inp.name ?? ""}`,
                ),
              };
          }
        }
      } else if (m.type === "result" && m.subtype === "success") {
        raw = m.result;
      }
    }

    const team = parseTeam(raw);
    if (team) {
      yield { type: "progress", text: tr("Finalisation de l'équipe…", "Finalizing the team…") };
      enrichTeam(team);
      yield { type: "done", team };
      return;
    }
  }

  yield {
    type: "error",
    error: tr(
      "Impossible de générer une équipe valide. Réessaie.",
      "Couldn't generate a valid team. Try again.",
    ),
  };
}
