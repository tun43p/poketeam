// Teams: list, delete, free message (question/edit via the agent), version restore,
// rename. Everything is localized to FR on output; persisted in EN.
import {
  getTeams,
  deleteTeam,
  renameTeam,
  addVersion,
  setActiveVersion,
  appendChat,
} from "@poketeam/store";
import { teamMessageStream } from "@poketeam/agent";
import { localizeTeam, localizeProse } from "@poketeam/data";
import { LANG, enc, localizeEntry, localizeTeams } from "../localize";
import type { Team } from "@poketeam/types";

type Req<P> = Request & { params: P };

export const teamsRoutes = {
  "/api/teams": {
    GET: async () => Response.json(localizeTeams(await getTeams())),
  },
  "/api/teams/:i": {
    DELETE: async (req: Req<{ i: string }>) =>
      Response.json(localizeTeams(await deleteTeam(Number(req.params.i)))),
  },
  "/api/teams/:i/message": {
    POST: async (req: Req<{ i: string }>) => {
      const i = Number(req.params.i);
      const { message } = (await req.json()) as { message?: string };
      const entry = (await getTeams()).at(i);
      if (!entry) {
        return Response.json({ error: "Équipe introuvable." }, { status: 404 });
      }
      if (!message?.trim()) {
        return Response.json({ error: "Message vide." }, { status: 400 });
      }

      const pool = entry.team.team.map((m) => m.name).filter(Boolean);
      const stream = new ReadableStream({
        async start(controller) {
          let answer = "";
          let version: Team | null = null;
          try {
            for await (const ev of teamMessageStream({
              team: entry.team,
              pool,
              format: entry.format === "Singles" ? "Singles" : "Doubles",
              history: entry.chat ?? [],
              message: message.trim(),
            })) {
              if (ev.type === "version") {
                version = ev.team; // ENGLISH, to persist
                controller.enqueue(
                  enc.encode(
                    JSON.stringify({ type: "version", team: localizeTeam(ev.team, LANG) }) + "\n",
                  ),
                );
                continue;
              }
              if (ev.type === "answer") {
                answer = ev.text; // English-laden, to persist as-is
                controller.enqueue(
                  enc.encode(
                    JSON.stringify({ type: "answer", text: localizeProse(ev.text, LANG) }) + "\n",
                  ),
                );
                continue;
              }
              controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
            }

            let teams;
            if (version) {
              const note = version.strategy
                ? `✅ Équipe mise à jour. ${version.strategy}`
                : "✅ Équipe mise à jour.";
              teams = await addVersion(i, version, message.trim(), note);
            } else if (answer) {
              teams = await appendChat(i, message.trim(), answer);
            }
            if (teams) {
              controller.enqueue(
                enc.encode(
                  JSON.stringify({ type: "saved", entry: localizeEntry(teams[i]) }) + "\n",
                ),
              );
            }
          } catch (e) {
            controller.enqueue(
              enc.encode(JSON.stringify({ type: "error", error: String(e) }) + "\n"),
            );
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    },
  },
  "/api/teams/:i/version": {
    POST: async (req: Req<{ i: string }>) => {
      const { v } = (await req.json()) as { v?: number };
      return Response.json(localizeTeams(await setActiveVersion(Number(req.params.i), Number(v))));
    },
  },
  "/api/teams/:i/rename": {
    PUT: async (req: Req<{ i: string }>) => {
      const { name } = (await req.json()) as { name?: string };
      return Response.json(localizeTeams(await renameTeam(Number(req.params.i), name ?? "")));
    },
  },
};
