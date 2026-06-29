// Message libre sur une équipe : l'agent répond (prose) OU renvoie une équipe modifiée.
// On distingue via parseTeam. Pas de session SDK sur disque : on rejoue tout le fil.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { tools, ALLOWED_TOOLS } from "./tools";
import { COACH_SYSTEM } from "./prompts";
import { enrichTeam } from "./enrich";
import { parseTeam } from "./parse";

type ChatMsg = { role: "user" | "assistant"; text: string };
type MsgEvent =
  | { type: "progress"; text: string }
  | { type: "answer"; text: string }
  | { type: "version"; team: any }
  | { type: "error"; error: string };

export async function* teamMessageStream(opts: {
  team: any;
  pool: string[];
  format: "Doubles" | "Singles";
  history: ChatMsg[];
  message: string;
}): AsyncGenerator<MsgEvent> {
  const convo = opts.history
    .map((m) => `${m.role === "user" ? "Joueur" : "Toi"}: ${m.text}`)
    .join("\n");

  const userMsg = `Format: ${opts.format === "Doubles" ? "Double (duo)" : "Simple (solo)"}.
Pool disponible (${opts.pool.length}): ${opts.pool.join(", ")}.
Équipe actuelle (JSON):
${JSON.stringify(opts.team)}
${convo ? `\nConversation précédente:\n${convo}\n` : ""}
Message du joueur: ${opts.message}`;

  yield { type: "progress", text: "Analyse de ta demande…" };

  let raw = "";
  try {
    for await (const m of query({
      prompt: userMsg,
      options: {
        systemPrompt: COACH_SYSTEM,
        mcpServers: { poke: tools },
        allowedTools: ALLOWED_TOOLS,
        permissionMode: "bypassPermissions",
        persistSession: false,
        maxTurns: 30,
      },
    })) {
      if (m.type === "assistant") {
        for (const block of m.message.content as any[]) {
          if (block.type === "tool_use") {
            const inp = block.input;
            const bn = String(block.name);
            if (bn === "WebSearch")
              yield { type: "progress", text: `Recherche sur internet : ${inp?.query ?? ""}` };
            else if (bn === "WebFetch")
              yield { type: "progress", text: `Consulte une source : ${inp?.url ?? ""}` };
            else yield { type: "progress", text: `Vérifie les données : ${inp?.name ?? ""}` };
          }
        }
      } else if (m.type === "result" && m.subtype === "success") {
        raw = m.result;
      }
    }
  } catch (e) {
    yield { type: "error", error: String(e) };
    return;
  }

  const team = parseTeam(raw);
  if (team) {
    yield { type: "progress", text: "Mise à jour de l'équipe…" };
    enrichTeam(team);
    yield { type: "version", team };
  } else if (raw.trim()) {
    yield { type: "answer", text: raw.trim() };
  } else {
    yield { type: "error", error: "Pas de réponse, réessaie." };
  }
}
