// Boxes (Pokémon slots): read, create/edit, delete, duplicate, rename.
import { getBoxes, saveBox, deleteBox, duplicateBox, renameBox } from "@poketeam/store";

type Req<P> = Request & { params: P };

export const boxesRoutes = {
  "/api/boxes": {
    GET: async () => Response.json(await getBoxes()),
    PUT: async (req: Request) => {
      const { name, mons } = (await req.json()) as {
        name?: string;
        mons?: string[];
      };

      if (!name?.trim()) {
        return Response.json({ error: "Nom de slot requis." }, { status: 400 });
      }

      return Response.json(await saveBox(name.trim(), mons ?? []));
    },
  },
  "/api/boxes/:name": {
    DELETE: async (req: Req<{ name: string }>) =>
      Response.json(await deleteBox(decodeURIComponent(req.params.name))),
  },
  "/api/boxes/:name/duplicate": {
    POST: async (req: Req<{ name: string }>) =>
      Response.json(await duplicateBox(decodeURIComponent(req.params.name))),
  },
  "/api/boxes/:name/rename": {
    PUT: async (req: Req<{ name: string }>) => {
      const { to } = (await req.json()) as { to?: string };
      if (!to?.trim()) {
        return Response.json({ error: "Nouveau nom requis." }, { status: 400 });
      }

      return Response.json(await renameBox(decodeURIComponent(req.params.name), to.trim()));
    },
  },
};
