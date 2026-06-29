# PokéTeam

Générateur d'équipes Pokémon Champions (solo / duo) propulsé par le Claude Agent SDK.

Sélectionne des Pokémon, décris ce que tu veux en texte libre, et l'agent compose une
équipe : objets, talents, natures, EV à monter, attaques et faiblesses — en s'appuyant
sur les stats d'usage réelles du méta Champions.

## Stack

- **Bun** — serveur + bundling front (fullstack natif, sans Vite)
- **React 19** — interface
- **[@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)** — raisonnement de l'agent + outils
- **[Tyradex](https://tyradex.app)** — pokédex complet FR/EN (types, stats, faiblesses)
- **[championsbattledata.com](https://championsbattledata.com)** — méta Champions (sets, EV spreads, usage)

## Lancer

```bash
bun install
bun run dev        # http://localhost:3000
```

Nécessite un accès à l'API Claude (`ANTHROPIC_API_KEY` ou une session Claude Code).

## Limites (MVP)

- Pas de récupération de la boîte du jeu : aucune API publique côté Pokémon Champions.
  On sélectionne dans le pokédex complet.
- Le mapping de noms vers le méta Champions suppose les noms anglais standards
  (formes/noms spéciaux non garantis).
