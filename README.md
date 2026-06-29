# PokéTeam

Pokémon Champions team generator (solo / duo) powered by the Claude Agent SDK.

Pick your Pokémon, describe what you want in plain text, and the agent builds a
team: items, abilities, natures, EV spreads, moves and weaknesses — grounded in
real Champions meta usage stats.

## Stack

- **Bun** — server + front-end bundling (native fullstack, no Vite)
- **React 19** — UI
- **[@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)** — agent reasoning + tools
- **[Tyradex](https://tyradex.app)** — full FR/EN pokédex (types, stats, weaknesses)
- **[championsbattledata.com](https://championsbattledata.com)** — Champions meta (sets, EV spreads, usage)

## Requirements

- **[Bun](https://bun.sh)** ≥ 1.3 — runtime, bundler and package manager
- **[Claude Code](https://claude.com/claude-code)** — the Agent SDK runs through the Claude Code
  CLI, so it must be installed and authenticated:

  ```bash
  curl -fsSL https://claude.ai/install.sh | bash   # or: bun install -g @anthropic-ai/claude-code
  claude login                                      # authenticate once
  ```

  Alternatively, skip the login and export an API key instead:

  ```bash
  export ANTHROPIC_API_KEY=sk-ant-...
  ```

## Run

```bash
bun install
bun run dev        # http://localhost:3000
```

`dev` runs with hot reload. Use `bun run start` for a plain run.

The reference data (`poke.db`) is committed, so there's nothing to fetch. To
rebuild it from the upstream sources: `bun run build:db`.

## Scripts

| Command             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `bun run dev`       | Dev server with hot reload (port 3000, override with `PORT`) |
| `bun run start`     | Run the server without hot reload                            |
| `bun run build:db`  | Rebuild `poke.db` from PokéAPI / Tyradex / Champions         |
| `bun run typecheck` | `tsc --noEmit`                                               |
| `bun run lint`      | ESLint                                                       |
| `bun run format`    | Prettier write                                               |

## Limits (MVP)

- No import of your in-game box: Pokémon Champions exposes no public API, so you
  pick from the full pokédex.
- Name mapping to the Champions meta assumes standard English names (special
  names/forms are not guaranteed).
