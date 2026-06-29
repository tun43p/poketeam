import { useEffect, useState } from "react";
import { exportPdf, streamNdjson, type Mon } from "./lib";
import { Result } from "./Result";
import type { StoredTeam } from "@poketeam/types";

// Fil unique sous une équipe : l'agent comprend tout seul question vs modification.
// Chaque modif crée une version restaurable. Tout est persisté côté serveur.
function TeamThread({
  index,
  entry,
  onUpdate,
}: {
  index: number;
  entry: StoredTeam;
  onUpdate: (e: StoredTeam) => void;
}) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  const versions = entry.versions ?? [];
  const active = entry.active ?? 0;
  const chat = entry.chat ?? [];

  async function send() {
    const message = msg.trim();
    if (!message) return;
    setMsg("");
    setError("");
    setStep("");
    setLoading(true);
    try {
      await streamNdjson(`/api/teams/${index}/message`, { message }, (ev) => {
        if (ev.type === "progress") setStep(ev.text);
        else if (ev.type === "error") setError(ev.error);
        else if (ev.type === "saved") onUpdate(ev.entry);
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  async function revert(v: number) {
    const teams = await fetch(`/api/teams/${index}/version`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ v }),
    }).then((r) => r.json() as Promise<StoredTeam[]>);
    onUpdate(teams[index]);
  }

  return (
    <div className="console">
      <details className="sub">
        <summary>Versions ({versions.length})</summary>
        <ul className="versionlist">
          {versions.map((vv, idx) => (
            <li key={idx} className={idx === active ? "on" : ""}>
              <button onClick={() => void revert(idx)} disabled={idx === active}>
                {idx === active ? "✓ actuelle" : "Restaurer"}
              </button>
              <span className="vmeta">
                v{versions.length - idx} · {new Date(vv.at).toLocaleString("fr-FR")}
              </span>
              {vv.prompt && <span className="vprompt">« {vv.prompt} »</span>}
            </li>
          ))}
        </ul>
      </details>

      {chat.length > 0 && (
        <details className="sub" open>
          <summary>Messages ({chat.length})</summary>
          <div className="chat">
            {chat.map((m, k) => (
              <p key={k} className={`bubble ${m.role}`}>
                {m.text}
              </p>
            ))}
          </div>
        </details>
      )}

      {loading && step && <p className="current">🧠 {step}</p>}
      {error && <p className="error">{error}</p>}

      <textarea
        placeholder="Pose une question ou demande une modif : « comment la jouer ? », « rends-la plus défensive », « change l'objet de… »"
        value={msg}
        onChange={(e) => {
          setMsg(e.target.value);
        }}
        rows={2}
        disabled={loading}
      />
      <button className="generate" onClick={() => void send()} disabled={loading || !msg.trim()}>
        {loading ? "Réflexion en cours…" : "➤ Envoyer"}
      </button>
    </div>
  );
}

// ---------- Écran équipes : liste des équipes générées ----------
export function TeamsPage({
  byEn,
  typeImg,
}: {
  byEn: Map<string, Mon>;
  typeImg: Map<string, string>;
}) {
  const [teams, setTeams] = useState<StoredTeam[] | null>(null);
  useEffect(() => {
    void fetch("/api/teams")
      .then((r) => r.json() as Promise<StoredTeam[]>)
      .then(setTeams);
  }, []);

  async function renameTeam(i: number) {
    const name = window.prompt("Nouveau nom de l'équipe :");
    if (name == null) return;
    setTeams(
      await fetch(`/api/teams/${i}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      }).then((r) => r.json() as Promise<StoredTeam[]>),
    );
  }

  async function deleteTeam(i: number) {
    if (!window.confirm("Supprimer cette équipe ?")) return;
    setTeams(
      await fetch(`/api/teams/${i}`, { method: "DELETE" }).then(
        (r) => r.json() as Promise<StoredTeam[]>,
      ),
    );
  }

  if (teams === null) return <p className="muted">Chargement…</p>;
  if (!teams.length)
    return (
      <p className="muted">
        Aucune équipe sauvegardée pour l'instant. Génère-en une depuis l'<a href="#/">accueil</a>.
      </p>
    );

  return (
    <>
      <h2>
        Mes équipes <span className="muted">({teams.length})</span>
      </h2>
      {teams.map((t, i) => (
        <details key={i} open={i === 0}>
          <summary>
            <strong>{t.name ?? t.team.team.map((m) => m.name_fr).join(", ")}</strong>
            <span className="meta">
              {" "}
              · {t.format} · {new Date(t.savedAt).toLocaleString("fr-FR")}
            </span>
            <span className="team-actions">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  exportPdf(`pdf-team-${i}`, t.name ?? "Équipe PokéTeam");
                }}
              >
                📄 PDF
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  void renameTeam(i);
                }}
              >
                Renommer
              </button>
              <button
                className="del"
                onClick={(e) => {
                  e.preventDefault();
                  void deleteTeam(i);
                }}
              >
                Supprimer
              </button>
            </span>
          </summary>
          <details className="sub" open>
            <summary>Pokémon</summary>
            <div id={`pdf-team-${i}`}>
              <Result result={{ team: t.team }} byEn={byEn} typeImg={typeImg} />
            </div>
          </details>
          <TeamThread
            index={i}
            entry={t}
            onUpdate={(entry) => {
              setTeams((ts) => (ts ?? []).map((x, k) => (k === i ? entry : x)));
            }}
          />
        </details>
      ))}
    </>
  );
}
