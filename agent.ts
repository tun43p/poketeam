import {
  query,
  tool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getPokemon, getMeta, getMove, getAbility, getItem, getType, canon, inChampions } from "./data";

// L'IA ne produit que de l'anglais. Le serveur RECANONICALISE chaque nom via la BDD
// (aucune valeur n'entre sans passer par canon()) et réinjecte les données
// déterministes (types/faiblesses, type d'attaque). L'équipe stockée est 100% EN.
function enrichTeam(team: any) {
  if (!team?.team) return;
  for (const m of team.team) {
    m.name = canon("pokemon", m.name) ?? m.name;
    const p = getPokemon(m.name);
    if (!("error" in p)) {
      m.types = p.types;
      m.weaknesses = p.weaknesses; // [{type, multiplier}], EN, autoritaire
    } else {
      m.types = [];
      m.weaknesses = [];
    }
    m.item = canon("item", m.item) ?? m.item;
    m.ability = canon("ability", m.ability) ?? m.ability;
    m.nature = canon("nature", m.nature) ?? m.nature;
    m.tera_type = canon("type", m.tera_type) ?? m.tera_type;
    for (const mv of m.moves ?? []) {
      if (typeof mv === "string") continue;
      const c = canon("move", mv.name);
      if (c) mv.name = c;
      mv.type = getMove(mv.name)?.type ?? mv.type ?? null; // type d'attaque = BDD, jamais l'IA
    }
  }
}

const ok = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
});

const ro = { annotations: { readOnlyHint: true } };
const tools = createSdkMcpServer({
  name: "poke",
  version: "1.0.0",
  tools: [
    tool(
      "get_pokemon",
      "Validate a species and get its English typing, base stats, abilities, weaknesses/resistances/immunities, and `champions` (true if the species is in Pokémon Champions). Returns {error} if the name is unknown. NEVER put a species where champions is false in the team.",
      { name: z.string().describe("English species name") },
      async ({ name }) => ok(getPokemon(name)),
      ro,
    ),
    tool(
      "get_move",
      "Look up a move: official English name, type, power, accuracy, PP, priority, damage class, effect description, and `champions` (true if the move is in Pokémon Champions). Returns null if unknown — VALIDATE every move name, choose by real effect, and NEVER use a move where champions is false.",
      { name: z.string().describe("Move name (English preferred, any language accepted)") },
      async ({ name }) => ok(getMove(name) ?? { error: `Unknown move: ${name}` }),
      ro,
    ),
    tool(
      "get_ability",
      "Look up an ability: official English name, effect description, and `champions` (true if the ability is in Pokémon Champions). Returns null if unknown — validate ability names, reason from the effect, and NEVER use an ability where champions is false.",
      { name: z.string().describe("Ability name (English preferred, any language accepted)") },
      async ({ name }) => ok(getAbility(name) ?? { error: `Unknown ability: ${name}` }),
      ro,
    ),
    tool(
      "get_item",
      "Look up a held item: official English name, category, effect description, and `champions` (true if legal in Pokémon Champions). Returns null if unknown — validate item names, reason from the effect, and NEVER use an item where champions is false.",
      { name: z.string().describe("Item name (English preferred, any language accepted)") },
      async ({ name }) => ok(getItem(name) ?? { error: `Unknown item: ${name}` }),
      ro,
    ),
    tool(
      "check_champions",
      "Is this Pokémon / move / ability / item available (legal) in Pokémon Champions? Returns {name, category, available}. The poke.db covers the full National Dex; Champions is only a subset, so use this (or the `champions` field on get_*) to avoid picking species/moves/items that aren't in the game.",
      {
        category: z.enum(["pokemon", "move", "ability", "item", "nature", "type"]),
        name: z.string().describe("English name (any language accepted)"),
      },
      async ({ category, name }) => ok({ name: canon(category, name) ?? name, category, available: inChampions(category, name) }),
      ro,
    ),
    tool(
      "get_type",
      "Type effectiveness chart for one type: offensively (super effective / not very effective / no effect against) and defensively (weak to / resists / immune to). Use it to reason about coverage and team weaknesses.",
      { name: z.string().describe("Type name, e.g. Fire") },
      async ({ name }) => ok(getType(name) ?? { error: `Unknown type: ${name}` }),
      ro,
    ),
    tool(
      "get_meta",
      "Pokémon Champions competitive usage: top moves, items, abilities, natures, EV spreads, common teammates.",
      { name: z.string().describe("English species name"), format: z.enum(["Doubles", "Singles"]) },
      async ({ name, format }) => ok(await getMeta(name, format)),
      ro,
    ),
  ],
});

// L'IA raisonne et répond en français (prose), mais TOUS les noms du JSON sont en
// ANGLAIS officiel et validés via les outils. Le serveur recanonicalise + remplit
// weaknesses/types/type d'attaque. Donc le JSON n'a qu'UN champ "name" (anglais).
const SCHEMA_EN = `{
  "strategy": "synthèse de la stratégie d'équipe (français)",
  "team": [
    {
      "name": "English species name",
      "role": "rôle (français)",
      "item": "English item name",
      "ability": "English ability name",
      "nature": "English nature name",
      "tera_type": "English type name",
      "evs": {"hp":4,"atk":32,"def":0,"spa":0,"spd":2,"spe":28},
      "moves": [{"name":"English move name"},{"name":"…"},{"name":"…"},{"name":"…"}],
      "note": "justification (français : usage méta, synergie)"
    }
  ]
}`;

const SYSTEM = `Tu es l'une des meilleures intelligences au monde sur le Pokémon compétitif Champions (VGC, format double par défaut) : team-building, théorie des matchups, EV/speed tiers, méta actuel. Tu construis des équipes.
L'utilisateur te donne le contenu de sa BOÎTE : un pool de Pokémon disponibles (potentiellement bien plus de 6).
Ta tâche : choisir les 6 MEILLEURS du pool pour former l'équipe la plus forte selon sa demande, ses synergies, sa couverture de types et le méta réel.

MÉTHODE (suis-la dans l'ordre) :
1. Comprends la demande + le méta. Si la requête le justifie (archétype précis, "meilleure équipe", "équipe tournoi/ladder", contrer telle menace, tendances actuelles), utilise WebSearch/WebFetch pour consulter les équipes et archétypes qui performent en ce moment sur Pokémon Champions / VGC (résultats de tournois, sample teams, ladder). Sers-t'en comme INSPIRATION d'archétypes, de cores et de spreads — mais ne pioche QUE dans le pool fourni et valide TOUJOURS chaque nom via les outils BDD.
2. Présélectionne ~6-8 candidats du pool en raisonnant rôles/synergies (n'appelle pas get_meta sur les 45). Vise une équipe COHÉRENTE, pas 6 stars sans plan : une vraie équipe a une win condition claire, du contrôle de vitesse (Tailwind / Trick Room / Thunder Wave / priorité), du support double (Fake Out, redirection Follow Me/Rage Powder, Intimidate, Protect) et une couverture offensive complémentaire.
3. Pour CHAQUE Pokémon de l'équipe FINALE, appelle get_pokemon (typage/faiblesses/stats) ET get_meta (sets méta réels).
4. Vérifie l'équipe AU NIVEAU GLOBAL avant de finaliser : faiblesses partagées (utilise get_type), trous de couverture, qui surpasse en vitesse les menaces clés, redondance de rôles. Corrige si un axe est manquant.

OUTILS DE VALIDATION : tu DOIS valider chaque attaque, talent et objet via get_move / get_ability / get_item AVANT de les écrire. Ces outils renvoient le nom anglais officiel + la description (effet) : appuie tes choix sur ces descriptions. Si un outil renvoie {error}, le nom n'existe pas → corrige-le.
DISPONIBILITÉ CHAMPIONS (CRITIQUE) : la BDD couvre TOUT le Pokédex National, mais Pokémon Champions n'en est qu'un sous-ensemble. Chaque outil renvoie un champ "champions" : tu n'as le DROIT d'utiliser un Pokémon, une attaque, un talent ou un objet QUE si son champ "champions" vaut true. Si "champions" vaut false, l'élément N'EXISTE PAS dans le jeu → choisis-en un autre, même s'il est excellent ailleurs. En cas de doute, vérifie avec check_champions. Ne mets JAMAIS dans l'équipe un élément dont la disponibilité Champions n'est pas confirmée.
Appuie tes choix d'objet/talent/nature/attaques sur les pourcentages d'usage de get_meta, adaptés à la demande de l'utilisateur. Les données web complètent get_meta mais ne le remplacent pas pour les sets.
EV (système Champions, PAS l'ancien /252) : plafond de 32 SP PAR statistique et 66 SP au TOTAL par Pokémon (1 SP = +1 point de stat au niveau 50, aucun calcul). Répartis intelligemment ces 66 points selon le rôle (offensif/défensif/vitesse, speed tiers à viser face aux menaces), en t'appuyant sur les ev_spreads de get_meta quand ils existent. NE DÉPASSE JAMAIS 32 sur une stat, ni 66 au total : le champ evs doit toujours sommer à ≤ 66.
OBJETS : chaque Pokémon de l'équipe porte un objet DIFFÉRENT — jamais deux fois le même objet dans l'équipe.
MÉGA-ÉVOLUTIONS : elles existent dans Pokémon Champions. Une bonne équipe en inclut souvent une ou deux : si le pool contient des Pokémon capables de méga-évoluer, privilégie-en une ou deux (objet = la Méga-Gemme correspondante) sauf si la demande de l'utilisateur l'en empêche.
RÈGLE ABSOLUE SUR LES NOMS : dans le bloc JSON, TOUS les noms (Pokémon, attaques, objets, talents, natures, tera_type) sont en ANGLAIS officiel, exactement tels que renvoyés par les outils (ex : "Charizard", "Solar Beam", "Choice Band", "Thick Fat", "Adamant", "Fire"). N'invente JAMAIS un nom : s'il ne sort pas d'un outil, ne l'écris pas.
N'inclus PAS de champ "weaknesses" ni de "type" d'attaque : le serveur les remplit. Le champ "name" des attaques est un objet {"name": "..."} uniquement.
Tu raisonnes et écris la prose (strategy, role, note) en FRANÇAIS. Termine ta réponse par UN SEUL bloc \`\`\`json contenant EXACTEMENT ce schéma :
${SCHEMA_EN}`;

// Le modèle n'emballe pas toujours le JSON de façon identique. On tente, dans l'ordre :
// bloc ```json, bloc ``` simple, puis du premier "{" au dernier "}".
export function parseTeam(raw: string): any {
  const tryParse = (s?: string) => {
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let t = tryParse(fenced?.[1]?.trim());
  if (t?.team) return t;

  const a = raw.indexOf("{"),
    b = raw.lastIndexOf("}");

  if (a >= 0 && b > a) {
    t = tryParse(raw.slice(a, b + 1)) ?? t;
  }

  return t?.team ? t : null;
}

type Event =
  | { type: "progress"; text: string }
  | { type: "done"; team: any }
  | { type: "error"; error: string };

const COACH_SYSTEM = `Tu es l'une des meilleures intelligences au monde sur le Pokémon compétitif Champions (VGC) : coach, théorie des matchups, méta actuel. On te donne une équipe existante (JSON, noms en anglais), le pool de Pokémon disponibles, et un message du joueur. Décide toi-même de l'intention :

CAS A — QUESTION (comment la jouer, leads, win conditions, matchups, gestion du Téra, contrer un Pokémon/archétype, pourquoi tel choix…) : réponds en français, en prose concrète et actionnable, en t'appuyant sur les sets. Tu peux appeler get_pokemon/get_move/get_ability/get_item/get_type/get_meta. Pour les questions de méta actuel, matchups réels ou menaces du moment, utilise aussi WebSearch/WebFetch (tournois, ladder, sample teams Pokémon Champions / VGC) et cite ce que tu en tires. N'écris AUCUN bloc \`\`\`json.

CAS B — MODIFICATION (changer un set, remplacer un Pokémon par un autre DU POOL, ajuster EV/objet/talent/nature/attaques, rendre plus offensif/défensif…) : applique UNIQUEMENT la demande, conserve le reste. VALIDE via get_move/get_ability/get_item/get_pokemon tout ce que tu changes (ces outils donnent le nom anglais officiel + la description). DISPONIBILITÉ CHAMPIONS : chaque outil renvoie un champ "champions" ; n'utilise QUE des éléments où "champions" vaut true (la BDD couvre tout le Pokédex National mais Champions n'en est qu'un sous-ensemble). Si false → l'élément n'est pas dans le jeu, prends-en un autre. En cas de doute, check_champions. EV système Champions : plafond 32 SP par stat, 66 SP au total (1 SP = +1 point au niveau 50) ; ne dépasse jamais ces limites. Chaque Pokémon porte un objet DIFFÉRENT (jamais deux fois le même dans l'équipe). N'utilise QUE des Pokémon du pool.
RÈGLE ABSOLUE SUR LES NOMS : dans le JSON, TOUS les noms (Pokémon, attaques, objets, talents, natures, tera_type) sont en ANGLAIS officiel, exactement tels que renvoyés par les outils. N'invente jamais un nom. N'inclus PAS "weaknesses" ni le "type" des attaques (le serveur les remplit) ; chaque attaque est {"name": "..."}. La prose (strategy, role, note) reste en FRANÇAIS. Termine par UN SEUL bloc \`\`\`json contenant EXACTEMENT ce schéma :
${SCHEMA_EN}

En cas de doute sur l'intention, traite comme une QUESTION. Réponds toujours en français.`;

type ChatMsg = { role: "user" | "assistant"; text: string };
type MsgEvent =
  | { type: "progress"; text: string }
  | { type: "answer"; text: string }
  | { type: "version"; team: any }
  | { type: "error"; error: string };

// Message libre sur une équipe : l'agent répond (prose) OU renvoie une équipe modifiée.
// On distingue via parseTeam. Pas de session SDK sur disque : on rejoue tout le fil.
export async function* teamMessageStream(opts: {
  team: any;
  pool: string[];
  format: "Doubles" | "Singles";
  history: ChatMsg[];
  message: string;
}): AsyncGenerator<MsgEvent> {
  const convo = opts.history
    .map((m) => `${m.role === "user" ? "Joueur" : "Toi"}: ${m.text}`)
    .join("\n");

  const userMsg = `Format: ${opts.format === "Doubles" ? "Double (duo)" : "Simple (solo)"}.
Pool disponible (${opts.pool.length}): ${opts.pool.join(", ")}.
Équipe actuelle (JSON):
${JSON.stringify(opts.team)}
${convo ? `\nConversation précédente:\n${convo}\n` : ""}
Message du joueur: ${opts.message}`;

  yield { type: "progress", text: "Analyse de ta demande…" };

  let raw = "";
  try {
    for await (const m of query({
      prompt: userMsg,
      options: {
        systemPrompt: COACH_SYSTEM,
        mcpServers: { poke: tools },
        allowedTools: ["mcp__poke__get_pokemon", "mcp__poke__get_move", "mcp__poke__get_ability", "mcp__poke__get_item", "mcp__poke__get_type", "mcp__poke__get_meta", "mcp__poke__check_champions", "WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        persistSession: false,
        maxTurns: 30,
      },
    })) {
      if (m.type === "assistant") {
        for (const block of m.message.content as any[]) {
          if (block.type === "tool_use") {
            const inp = block.input as any;
            const bn = String(block.name);
            if (bn === "WebSearch")
              yield { type: "progress", text: `Recherche sur internet : ${inp?.query ?? ""}` };
            else if (bn === "WebFetch")
              yield { type: "progress", text: `Consulte une source : ${inp?.url ?? ""}` };
            else
              yield { type: "progress", text: `Vérifie les données : ${inp?.name ?? ""}` };
          }
        }
      } else if (m.type === "result" && m.subtype === "success") {
        raw = m.result;
      }
    }
  } catch (e) {
    yield { type: "error", error: String(e) };
    return;
  }

  const team = parseTeam(raw);
  if (team) {
    yield { type: "progress", text: "Mise à jour de l'équipe…" };
    enrichTeam(team);
    yield { type: "version", team };
  } else if (raw.trim()) {
    yield { type: "answer", text: raw.trim() };
  } else {
    yield { type: "error", error: "Pas de réponse, réessaie." };
  }
}

const MAX_ATTEMPTS = 3;

// Générateur : émet des étapes de progression au fil des appels d'outils de l'agent,
// puis l'équipe finale. Si le modèle renvoie un JSON inexploitable, on relance la
// génération (jusqu'à MAX_ATTEMPTS) : l'utilisateur ne voit JAMAIS le JSON brut.
export async function* generateTeamStream(opts: {
  selected: string[];
  prompt: string;
  format: "Doubles" | "Singles";
  refine?: any; // équipe actuelle à modifier (re-prompt)
}): AsyncGenerator<Event> {
  const base = `Format: ${opts.format === "Doubles" ? "Double (duo)" : "Simple (solo)"}.
Boîte du joueur (pool disponible, ${opts.selected.length} Pokémon): ${opts.selected.join(", ")}.`;

  const userMsg = opts.refine
    ? `${base}
ÉQUIPE ACTUELLE à modifier (JSON):
${JSON.stringify(opts.refine)}
Modification demandée: ${opts.prompt || "(aucune)"}.
Applique UNIQUEMENT cette demande. Conserve les Pokémon, sets et choix qui ne sont pas concernés. Re-vérifie via les outils ce que tu changes. Renvoie l'équipe COMPLÈTE mise à jour dans le même schéma.`
    : `${base}
Demande de l'utilisateur: ${opts.prompt || "(aucune préférence particulière)"}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    yield {
      type: "progress",
      text:
        attempt === 1
          ? opts.refine
            ? "Application de tes modifications à l'équipe…"
            : "Analyse de la boîte et présélection des candidats…"
          : `Le format de l'équipe était invalide, nouvelle tentative (${attempt}/${MAX_ATTEMPTS})…`,
    };

    let raw = "";
    for await (const m of query({
      prompt: userMsg,
      options: {
        systemPrompt: SYSTEM,
        mcpServers: { poke: tools },
        allowedTools: ["mcp__poke__get_pokemon", "mcp__poke__get_move", "mcp__poke__get_ability", "mcp__poke__get_item", "mcp__poke__get_type", "mcp__poke__get_meta", "mcp__poke__check_champions", "WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        persistSession: false, // ne rien écrire sur disque (~/.claude/projects)
        maxTurns: 30,
      },
    })) {
      if (m.type === "assistant") {
        for (const block of m.message.content as any[]) {
          if (block.type === "tool_use") {
            const inp = block.input as any;
            const bn = String(block.name);
            if (bn === "WebSearch")
              yield { type: "progress", text: `Recherche les meilleures équipes : ${inp?.query ?? ""}` };
            else if (bn === "WebFetch")
              yield { type: "progress", text: `Consulte une source : ${inp?.url ?? ""}` };
            else if (bn.endsWith("get_meta"))
              yield { type: "progress", text: `Consulte le méta Champions : ${inp?.name ?? ""}` };
            else if (bn.endsWith("get_pokemon"))
              yield { type: "progress", text: `Analyse le typage : ${inp?.name ?? ""}` };
          }
        }
      } else if (m.type === "result" && m.subtype === "success") {
        raw = m.result;
      }
    }

    const team = parseTeam(raw);
    if (team) {
      yield { type: "progress", text: "Finalisation de l'équipe…" };
      enrichTeam(team);
      yield { type: "done", team };
      return;
    }
  }

  yield {
    type: "error",
    error: "Impossible de générer une équipe valide. Réessaie.",
  };
}
