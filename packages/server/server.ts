import index from "@poketeam/web/index.html";
import { pokemonRoutes } from "./routes/pokemon";
import { generateRoutes } from "./routes/generate";
import { boxesRoutes } from "./routes/boxes";
import { teamsRoutes } from "./routes/teams";

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  // hmr: recharge JS/CSS à chaud (sinon le bundler sert un CSS en cache jusqu'au redémarrage).
  development:
    process.env.NODE_ENV !== "production" ? { hmr: true } : false,
  idleTimeout: 255, // génération longue : pas de coupure pendant la rédaction finale (max Bun)
  routes: {
    "/": index,
    ...pokemonRoutes,
    ...generateRoutes,
    ...boxesRoutes,
    ...teamsRoutes,
  },
});

console.log(`poketeam → http://localhost:${server.port}`);
