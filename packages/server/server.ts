import index from "@poketeam/web/index.html";
import { pokemonRoutes } from "./routes/pokemon";
import { generateRoutes } from "./routes/generate";
import { boxesRoutes } from "./routes/boxes";
import { teamsRoutes } from "./routes/teams";

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
  },
});

console.log(`poketeam → http://localhost:${server.port}`);
