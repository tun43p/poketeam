import index from "@poketeam/web/index.html";
import { getLang } from "@poketeam/store";
import { setLang } from "@poketeam/data";
import { pokemonRoutes } from "./routes/pokemon";
import { generateRoutes } from "./routes/generate";
import { boxesRoutes } from "./routes/boxes";
import { teamsRoutes } from "./routes/teams";
import { langRoutes } from "./routes/lang";

// Lock the process-wide language to the stored choice (defaults to FR until chosen).
setLang((await getLang()) ?? "fr");

const server = Bun.serve({
  port: Number(Bun.env.PORT) || 3000,
  // hmr: hot-reloads JS/CSS (otherwise the bundler serves cached CSS until restart).
  development: Bun.env.NODE_ENV !== "production" ? { hmr: true } : false,
  idleTimeout: 255, // long generation: no cutoff during final writing (Bun max)
  routes: {
    "/": index,
    ...pokemonRoutes,
    ...generateRoutes,
    ...boxesRoutes,
    ...teamsRoutes,
    ...langRoutes,
  },
});

console.log(`poketeam → http://localhost:${server.port}`);
