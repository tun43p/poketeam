import type { Team, StoredTeam } from "@poketeam/types";
import { lang } from "./i18n";

export interface Mon {
  id: number;
  fr: string;
  en: string;
  sprite: string;
  types?: string[];
}
export type Boxes = Record<string, string[]>;

// ndjson events emitted by the server during generation / chat.
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

// Levenshtein distance (tolerance for typos in the search).
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

// Official type colors, keyed by BOTH the FR (Tyradex) and EN type names, since the
// chips display whichever language is active.
export const TYPE_COLORS: Record<string, string> = {
  Normal: "#a8a878",
  Feu: "#f08030",
  Fire: "#f08030",
  Eau: "#6890f0",
  Water: "#6890f0",
  Plante: "#78c850",
  Grass: "#78c850",
  Électrik: "#f8d030",
  Electric: "#f8d030",
  Glace: "#98d8d8",
  Ice: "#98d8d8",
  Combat: "#c03028",
  Fighting: "#c03028",
  Poison: "#a040a0",
  Sol: "#e0c068",
  Ground: "#e0c068",
  Vol: "#a890f0",
  Flying: "#a890f0",
  Psy: "#f85888",
  Psychic: "#f85888",
  Insecte: "#a8b820",
  Bug: "#a8b820",
  Roche: "#b8a038",
  Rock: "#b8a038",
  Spectre: "#705898",
  Ghost: "#705898",
  Dragon: "#7038f8",
  Ténèbres: "#705848",
  Dark: "#705848",
  Acier: "#b8b8d0",
  Steel: "#b8b8d0",
  Fée: "#ee99ac",
  Fairy: "#ee99ac",
};

export const Pokeball = () => <span className="pokeball" aria-hidden="true" />;

// Native PDF export: clones a team's rendering + the stylesheets into a
// print window. ponytail: the browser's window.print(), no PDF lib.
export function exportPdf(id: string, title: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const styles = [...document.querySelectorAll("link[rel=stylesheet],style")]
    .map((s) => s.outerHTML)
    .join("");
  // Keep the web rendering (gradient background + CRT overlay); print-color-adjust forces
  // the colors to print, otherwise the browser whitens the backgrounds.
  const print = `<style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { min-height: 0 !important; }
    #pdfwrap { width: 210mm; padding: 14mm; box-sizing: border-box; }
  </style>`;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  // document.write remains the right API for a print window: it guarantees
  // the `load` event (wait for the sprites to load before measuring the height).
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  w.document.write(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>${styles}${print}</head>` +
      `<body><div id="pdfwrap">${node.outerHTML}</div></body></html>`,
  );
  w.document.close();
  w.addEventListener("load", () => {
    // Custom page: @page = A4 width × actual content height → everything
    // on a single giant page, no cuts. px → mm @96dpi.
    const wrap = w.document.getElementById("pdfwrap");
    const h = wrap ? Math.ceil(wrap.scrollHeight / 3.7795) : 297;
    const s = w.document.createElement("style");
    s.textContent = `@page { size: 210mm ${h}mm; margin: 0; }`;
    w.document.head.appendChild(s);
    w.focus();
    w.print();
  });
}

// Reads an ndjson stream and passes each event to onEvent.
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
