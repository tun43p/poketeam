// Team generation as an ndjson stream. The team arrives in ENGLISH; we persist it as-is
// (except refinement, which only re-displays), then send it localized to the UI.
import { generateTeamStream } from "@poketeam/agent";
import { saveTeam } from "@poketeam/store";
import { localizeTeam } from "@poketeam/data";
import { LANG, enc } from "../localize";
import type { Team } from "@poketeam/types";

export const generateRoutes = {
  "/api/generate": {
    POST: async (req: Request) => {
      const body = (await req.json()) as {
        selected?: string[];
        prompt?: string;
        format?: string;
        refine?: Team;
      };

      const selected = body.selected ?? [];
      if (!selected.length) {
        return Response.json({ error: "Sélectionne au moins un Pokémon." }, { status: 400 });
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
                // The team arrives in ENGLISH. We persist it as-is (except refinement,
                // which only re-displays), then send it localized to the UI.
                if (!body.refine) {
                  await saveTeam({ format, prompt: body.prompt ?? "", team: ev.team });
                }
                controller.enqueue(
                  enc.encode(
                    JSON.stringify({ type: "done", team: localizeTeam(ev.team, LANG) }) + "\n",
                  ),
                );
              } else {
                controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
              }
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
};
