import { useState } from "react";
import { streamGenerate, type Boxes, type Mon } from "./lib";
import { exportPdf } from "./lib";
import { Result } from "./Result";
import type { Team } from "@poketeam/types";

// "Refine" bar: re-prompt an existing team to apply changes to it.
function RefineBar({
  pool,
  format,
  current,
  onDone,
}: {
  pool: string[];
  format: string;
  current: Team;
  onDone: (team: Team, prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function run() {
    if (!prompt.trim() || !pool.length) return;
    setLoading(true);
    setError("");
    setSteps([]);
    try {
      await streamGenerate(
        { selected: pool, prompt, format, refine: current },
        {
          onProgress: (t) => {
            setSteps((s) => [...s, t]);
          },
          onError: setError,
          onDone: (team) => {
            onDone(team, prompt);
            setPrompt("");
          },
        },
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="refine">
      <textarea
        placeholder="Affiner : « remplace le mur par un sweeper », « plus de résistance au Feu », « change la nature de… »"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
        }}
        rows={2}
        disabled={loading}
      />
      <button className="generate" onClick={() => void run()} disabled={loading || !prompt.trim()}>
        {loading ? "Affinage en cours…" : "✨ Affiner l'équipe"}
      </button>
      {loading && steps.length > 0 && <p className="current">🧠 {steps[steps.length - 1]}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------- Home: choose a box + prompt + generate ----------
export function Home({
  byEn,
  boxes,
  typeImg,
}: {
  byEn: Map<string, Mon>;
  boxes: Boxes;
  typeImg: Map<string, string>;
}) {
  const [selected, setSelected] = useState("");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<"Doubles" | "Singles">("Doubles");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [result, setResult] = useState<{ team: Team } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const slots = Object.entries(boxes);
  const pool = boxes[selected] ?? [];

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);
    setSteps([]);
    setSaved(false);
    try {
      await streamGenerate(
        { selected: pool, prompt, format },
        {
          onProgress: (t) => {
            setSteps((s) => [...s, t]);
          },
          onError: setError,
          // The server persists the team (in English) before emitting "done".
          onDone: (team) => {
            setResult({ team });
            setSaved(true);
          },
        },
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2>Générer une équipe</h2>
      <div className="formats">
        {(["Doubles", "Singles"] as const).map((f) => (
          <button
            key={f}
            className={format === f ? "on" : ""}
            onClick={() => {
              setFormat(f);
            }}
          >
            {f === "Doubles" ? "Duo (Double)" : "Solo (Simple)"}
          </button>
        ))}
      </div>

      <label className="field-label">Boîte</label>
      {slots.length === 0 ? (
        <p className="muted">
          Aucune boîte. <a href="#/boxes">Crée ta première boîte →</a>
        </p>
      ) : (
        <div className="slots">
          {slots.map(([name, mons]) => (
            <button
              key={name}
              className={selected === name ? "load on" : "load"}
              onClick={() => {
                setSelected(name);
              }}
            >
              {name} ({mons.length})
            </button>
          ))}
        </div>
      )}

      {pool.length > 0 && (
        <div className="picked small">
          {pool.map((en) => {
            const m = byEn.get(en);
            return (
              <span key={en} className="chip">
                {m?.sprite && <img src={m.sprite} alt="" />} {m?.fr ?? en}
              </span>
            );
          })}
        </div>
      )}

      <textarea
        placeholder="Décris ce que tu veux : « team plutôt défensive, autour du Trick Room… »"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
        }}
        rows={3}
      />

      <button
        className="generate"
        onClick={() => void generate()}
        disabled={loading || !pool.length}
      >
        {loading ? "Génération en cours…" : `Composer la meilleure team (depuis ${pool.length})`}
      </button>

      {loading && steps.length > 0 && (
        <div className="steps">
          <p className="current">🧠 {steps[steps.length - 1]}</p>
          <ul>
            {steps.slice(0, -1).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <div className="resultbar">
            <span className="muted">{saved ? "✓ Sauvegardée automatiquement" : "Sauvegarde…"}</span>
            <a href="#/teams" className="muted">
              voir Mes équipes →
            </a>
            <button
              onClick={() => {
                exportPdf("pdf-home", "Mon équipe PokéTeam");
              }}
            >
              📄 Export PDF
            </button>
          </div>
          <div id="pdf-home">
            <Result result={result} byEn={byEn} typeImg={typeImg} />
          </div>
          <RefineBar
            pool={pool}
            format={format}
            current={result.team}
            onDone={(team) => {
              setResult({ team });
              setSaved(false);
            }}
          />
        </>
      )}
    </>
  );
}
