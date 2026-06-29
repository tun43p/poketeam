// Free-form message about a team: the agent answers (prose) OR returns a modified team.
// We distinguish via parseTeam. No SDK session on disk: we replay the whole thread.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { LANG } from "@poketeam/data";
import { tools, ALLOWED_TOOLS } from "./tools";
import { coachPrompt } from "./prompts";
import { enrichTeam } from "./enrich";
import { parseTeam } from "./parse";
import type { Team, ChatMessage } from "@poketeam/types";

const tr = (fr: string, en: string) => (LANG === "en" ? en : fr);

type MsgEvent =
  | { type: "progress"; text: string }
  | { type: "answer"; text: string }
  | { type: "version"; team: Team }
  | { type: "error"; error: string };

// Tool inputs that we inspect for the progress messages.
interface ToolInput {
  query?: string;
  url?: string;
  name?: string;
}

export async function* teamMessageStream(opts: {
  team: Team;
  pool: string[];
  format: "Doubles" | "Singles";
  history: ChatMessage[];
  message: string;
}): AsyncGenerator<MsgEvent> {
  const convo = opts.history
    .map((m) => `${m.role === "user" ? "Player" : "You"}: ${m.text}`)
    .join("\n");

  const userMsg = `Format: ${opts.format === "Doubles" ? "Doubles" : "Singles"}.
Available pool (${opts.pool.length}): ${opts.pool.join(", ")}.
Current team (JSON):
${JSON.stringify(opts.team)}
${convo ? `\nPrevious conversation:\n${convo}\n` : ""}
Player message: ${opts.message}`;

  yield { type: "progress", text: tr("Analyse de ta demande…", "Analyzing your request…") };

  let raw = "";
  try {
    for await (const m of query({
      prompt: userMsg,
      options: {
        systemPrompt: coachPrompt(LANG),
        mcpServers: { poke: tools },
        allowedTools: ALLOWED_TOOLS,
        permissionMode: "bypassPermissions",
        persistSession: false,
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
                  `Recherche sur internet : ${inp.query ?? ""}`,
                  `Searching the web: ${inp.query ?? ""}`,
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
            else
              yield {
                type: "progress",
                text: tr(
                  `Vérifie les données : ${inp.name ?? ""}`,
                  `Checking data: ${inp.name ?? ""}`,
                ),
              };
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
    yield { type: "progress", text: tr("Mise à jour de l'équipe…", "Updating the team…") };
    enrichTeam(team);
    yield { type: "version", team };
  } else if (raw.trim()) {
    yield { type: "answer", text: raw.trim() };
  } else {
    yield { type: "error", error: tr("Pas de réponse, réessaie.", "No response, try again.") };
  }
}
