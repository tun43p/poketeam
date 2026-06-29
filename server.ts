import index from "./web/index.html";
import { pokemonList, getTypes, localizeTeam, localizeProse } from "@poketeam/data";
import { generateTeamStream, teamMessageStream } from "./agent";
import {
  getBoxes,
  saveBox,
  deleteBox,
  duplicateBox,
  renameBox,
  getTeams,
  saveTeam,
  deleteTeam,
  renameTeam,
  addVersion,
  setActiveVersion,
  appendChat,
} from "@poketeam/store";

const enc = new TextEncoder();

// La data est stockée en anglais ; on la traduit pour l'affichage à la sortie.
// ponytail: langue figée en "fr" pour l'instant — la Phase 5 la lira depuis le store.
const LANG = "fr";
const localizeEntry = (e: any) => ({
  ...e,
  team: localizeTeam(e.team, LANG),
  chat: (e.chat ?? []).map((m: any) => ({ ...m, text: localizeProse(m.text, LANG) })),
});
const localizeTeams = (arr: any[]) => arr.map(localizeEntry);

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  // hmr: recharge JS/CSS à chaud (sinon le bundler sert un CSS en cache jusqu'au redémarrage).
  development:
    process.env.NODE_ENV !== "production" ? { hmr: true } : false,
  idleTimeout: 255, // génération longue : pas de coupure pendant la rédaction finale (max Bun)
  routes: {
    "/": index,
    "/api/pokemon": async () => Response.json(await pokemonList()),
    "/api/types": async () => Response.json(await getTypes()),
    "/api/generate": {
      POST: async (req) => {
        const body = (await req.json()) as {
          selected?: string[];
          prompt?: string;
          format?: string;
          refine?: any;
        };

        const selected = body.selected ?? [];
        if (!selected.length) {
          return Response.json(
            { error: "Sélectionne au moins un Pokémon." },
            { status: 400 },
          );
        }

        const format = body.format === "Singles" ? "Singles" : "Doubles";
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const ev of generateTeamStream({
                selected,
                prompt: body.prompt ?? "",
                format,
                refine: body.refine,
              })) {
                if (ev.type === "done") {
                  // L'équipe arrive en ANGLAIS. On la persiste telle quelle (sauf affinage,
                  // qui ne fait que ré-afficher), puis on l'envoie localisée à l'UI.
                  if (!body.refine) {
                    await saveTeam({ format, prompt: body.prompt ?? "", team: ev.team });
                  }
                  controller.enqueue(
                    enc.encode(JSON.stringify({ type: "done", team: localizeTeam(ev.team, LANG) }) + "\n"),
                  );
                } else {
                  controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
                }
              }
            } catch (e) {
              controller.enqueue(
                enc.encode(
                  JSON.stringify({ type: "error", error: String(e) }) + "\n",
                ),
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
    "/api/boxes": {
      GET: async () => Response.json(await getBoxes()),
      PUT: async (req) => {
        const { name, mons } = (await req.json()) as {
          name?: string;
          mons?: string[];
        };

        if (!name?.trim()) {
          return Response.json(
            { error: "Nom de slot requis." },
            { status: 400 },
          );
        }

        return Response.json(await saveBox(name.trim(), mons ?? []));
      },
    },
    "/api/boxes/:name": {
      DELETE: async (req) =>
        Response.json(await deleteBox(decodeURIComponent(req.params.name))),
    },
    "/api/boxes/:name/duplicate": {
      POST: async (req) =>
        Response.json(await duplicateBox(decodeURIComponent(req.params.name))),
    },
    "/api/boxes/:name/rename": {
      PUT: async (req) => {
        const { to } = (await req.json()) as { to?: string };
        if (!to?.trim()) {
          return Response.json(
            { error: "Nouveau nom requis." },
            { status: 400 },
          );
        }

        return Response.json(
          await renameBox(decodeURIComponent(req.params.name), to.trim()),
        );
      },
    },
    "/api/teams": {
      GET: async () => Response.json(localizeTeams(await getTeams())),
    },
    "/api/teams/:i": {
      DELETE: async (req) =>
        Response.json(localizeTeams(await deleteTeam(Number(req.params.i)))),
    },
    "/api/teams/:i/message": {
      POST: async (req) => {
        const i = Number(req.params.i);
        const { message } = (await req.json()) as { message?: string };
        const entry = (await getTeams())[i];
        if (!entry) {
          return Response.json({ error: "Équipe introuvable." }, { status: 404 });
        }
        if (!message?.trim()) {
          return Response.json({ error: "Message vide." }, { status: 400 });
        }

        const pool = (entry.team?.team || [])
          .map((m: any) => m.name)
          .filter(Boolean);
        const stream = new ReadableStream({
          async start(controller) {
            let answer = "";
            let version: any = null;
            try {
              for await (const ev of teamMessageStream({
                team: entry.team,
                pool,
                format: entry.format === "Singles" ? "Singles" : "Doubles",
                history: entry.chat ?? [],
                message: message.trim(),
              })) {
                if (ev.type === "version") {
                  version = ev.team; // ANGLAIS, à persister
                  controller.enqueue(enc.encode(JSON.stringify({ type: "version", team: localizeTeam(ev.team, LANG) }) + "\n"));
                  continue;
                }
                if (ev.type === "answer") {
                  answer = ev.text; // ANGLAIS-truffé, à persister tel quel
                  controller.enqueue(enc.encode(JSON.stringify({ type: "answer", text: localizeProse(ev.text, LANG) }) + "\n"));
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
                enc.encode(
                  JSON.stringify({ type: "error", error: String(e) }) + "\n",
                ),
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
      POST: async (req) => {
        const { v } = (await req.json()) as { v?: number };
        return Response.json(
          localizeTeams(await setActiveVersion(Number(req.params.i), Number(v))),
        );
      },
    },
    "/api/teams/:i/rename": {
      PUT: async (req) => {
        const { name } = (await req.json()) as { name?: string };
        return Response.json(
          localizeTeams(await renameTeam(Number(req.params.i), name ?? "")),
        );
      },
    },
  },
});

console.log(`poketeam → http://localhost:${server.port}`);
