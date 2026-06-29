// Language: chosen ONCE on first launch (lang === null → the UI asks), then LOCKED.
import { getLang, chooseLang } from "@poketeam/store";
import { setLang } from "@poketeam/data";

export const langRoutes = {
  "/api/lang": {
    GET: async () => {
      const lang = await getLang();
      return Response.json({ lang, locked: lang !== null });
    },
    POST: async (req: Request) => {
      const { lang } = (await req.json()) as { lang?: string };
      if (lang !== "fr" && lang !== "en") {
        return Response.json({ error: "lang must be 'fr' or 'en'" }, { status: 400 });
      }
      const effective = await chooseLang(lang);
      setLang(effective); // apply immediately, no restart needed
      return Response.json({ lang: effective, locked: true });
    },
  },
};
