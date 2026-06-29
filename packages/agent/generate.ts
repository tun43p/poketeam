// Génération d'équipe : émet des étapes de progression au fil des appels d'outils de
// l'agent, puis l'équipe finale. Si le modèle renvoie un JSON inexploitable, on relance
// la génération (jusqu'à MAX_ATTEMPTS) : l'utilisateur ne voit JAMAIS le JSON brut.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { tools, ALLOWED_TOOLS } from "./tools";
import { SYSTEM } from "./prompts";
import { enrichTeam } from "./enrich";
import { parseTeam } from "./parse";
import type { Team } from "@poketeam/types";

type Event =
  | { type: "progress"; text: string }
  | { type: "done"; team: Team }
  | { type: "error"; error: string };

// Entrées d'outils que l'on inspecte pour les messages de progression.
type ToolInput = { query?: string; url?: string; name?: string };

const MAX_ATTEMPTS = 3;

export async function* generateTeamStream(opts: {
  selected: string[];
  prompt: string;
  format: "Doubles" | "Singles";
  refine?: Team; // équipe actuelle à modifier (re-prompt)
}): AsyncGenerator<Event> {
  const base = `Format: ${opts.format === "Doubles" ? "Double (duo)" : "Simple (solo)"}.
Boîte du joueur (pool disponible, ${opts.selected.length} Pokémon): ${opts.selected.join(", ")}.`;

  const userMsg = opts.refine
    ? `${base}
ÉQUIPE ACTUELLE à modifier (JSON):
${JSON.stringify(opts.refine)}
Modification demandée: ${opts.prompt || "(aucune)"}.
Applique UNIQUEMENT cette demande. Conserve les Pokémon, sets et choix qui ne sont pas concernés. Re-vérifie via les outils ce que tu changes. Renvoie l'équipe COMPLÈTE mise à jour dans le même schéma.`
    : `${base}
Demande de l'utilisateur: ${opts.prompt || "(aucune préférence particulière)"}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    yield {
      type: "progress",
      text:
        attempt === 1
          ? opts.refine
            ? "Application de tes modifications à l'équipe…"
            : "Analyse de la boîte et présélection des candidats…"
          : `Le format de l'équipe était invalide, nouvelle tentative (${attempt}/${MAX_ATTEMPTS})…`,
    };

    let raw = "";
    for await (const m of query({
      prompt: userMsg,
      options: {
        systemPrompt: SYSTEM,
        mcpServers: { poke: tools },
        allowedTools: ALLOWED_TOOLS,
        permissionMode: "bypassPermissions",
        persistSession: false, // ne rien écrire sur disque (~/.claude/projects)
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
                text: `Recherche les meilleures équipes : ${inp.query ?? ""}`,
              };
            else if (bn === "WebFetch")
              yield { type: "progress", text: `Consulte une source : ${inp.url ?? ""}` };
            else if (bn.endsWith("get_meta"))
              yield { type: "progress", text: `Consulte le méta Champions : ${inp.name ?? ""}` };
            else if (bn.endsWith("get_pokemon"))
              yield { type: "progress", text: `Analyse le typage : ${inp.name ?? ""}` };
          }
        }
      } else if (m.type === "result" && m.subtype === "success") {
        raw = m.result;
      }
    }

    const team = parseTeam(raw);
    if (team) {
      yield { type: "progress", text: "Finalisation de l'équipe…" };
      enrichTeam(team);
      yield { type: "done", team };
      return;
    }
  }

  yield {
    type: "error",
    error: "Impossible de générer une équipe valide. Réessaie.",
  };
}
