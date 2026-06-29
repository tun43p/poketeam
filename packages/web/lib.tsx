import type { Team, StoredTeam } from "@poketeam/types";

export interface Mon {
  id: number;
  fr: string;
  en: string;
  sprite: string;
  types?: string[];
}
export type Boxes = Record<string, string[]>;

// Évènements ndjson émis par le serveur pendant la génération / le chat.
export type StreamEvent =
  | { type: "progress"; text: string }
  | { type: "error"; error: string }
  | { type: "done"; team: Team }
  | { type: "version"; team: Team }
  | { type: "answer"; text: string }
  | { type: "saved"; entry: StoredTeam };

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Distance de Levenshtein (tolérance aux fautes de frappe dans la recherche).
export function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// Couleurs officielles des types (noms FR de Tyradex) pour les pastilles de faiblesses.
export const TYPE_COLORS: Record<string, string> = {
  Normal: "#a8a878",
  Feu: "#f08030",
  Eau: "#6890f0",
  Plante: "#78c850",
  Électrik: "#f8d030",
  Glace: "#98d8d8",
  Combat: "#c03028",
  Poison: "#a040a0",
  Sol: "#e0c068",
  Vol: "#a890f0",
  Psy: "#f85888",
  Insecte: "#a8b820",
  Roche: "#b8a038",
  Spectre: "#705898",
  Dragon: "#7038f8",
  Ténèbres: "#705848",
  Acier: "#b8b8d0",
  Fée: "#ee99ac",
};

export const Pokeball = () => <span className="pokeball" aria-hidden="true" />;

// Export PDF natif : clone le rendu d'une équipe + les feuilles de style dans une
// fenêtre d'impression. ponytail: window.print() du navigateur, pas de lib PDF.
export function exportPdf(id: string, title: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const styles = [...document.querySelectorAll("link[rel=stylesheet],style")]
    .map((s) => s.outerHTML)
    .join("");
  // Garde le rendu web (fond dégradé + overlay CRT) ; print-color-adjust force
  // l'impression des couleurs, sinon le navigateur blanchit les fonds.
  const print = `<style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { min-height: 0 !important; }
    #pdfwrap { width: 210mm; padding: 14mm; box-sizing: border-box; }
  </style>`;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  // document.write reste l'API adaptée à une fenêtre d'impression : elle garantit
  // l'évènement `load` (attendre le chargement des sprites avant de mesurer la hauteur).
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  w.document.write(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>${styles}${print}</head>` +
      `<body><div id="pdfwrap">${node.outerHTML}</div></body></html>`,
  );
  w.document.close();
  w.addEventListener("load", () => {
    // Page sur-mesure : @page = largeur A4 × hauteur réelle du contenu → tout
    // sur une seule page géante, aucune coupe. px → mm @96dpi.
    const wrap = w.document.getElementById("pdfwrap");
    const h = wrap ? Math.ceil(wrap.scrollHeight / 3.7795) : 297;
    const s = w.document.createElement("style");
    s.textContent = `@page { size: 210mm ${h}mm; margin: 0; }`;
    w.document.head.appendChild(s);
    w.focus();
    w.print();
  });
}

// Lit un flux ndjson et passe chaque évènement à onEvent.
export async function streamNdjson(url: string, body: unknown, onEvent: (ev: StreamEvent) => void) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onEvent(JSON.parse(l) as StreamEvent);
  }
}

export function streamGenerate(
  body: { selected: string[]; prompt: string; format: string; refine?: Team },
  h: {
    onProgress: (t: string) => void;
    onError: (e: string) => void;
    onDone: (team: Team) => void;
  },
) {
  return streamNdjson("/api/generate", body, (ev) => {
    if (ev.type === "progress") h.onProgress(ev.text);
    else if (ev.type === "error") h.onError(ev.error);
    else if (ev.type === "done") h.onDone(ev.team);
  });
}
