import { Fragment, useEffect, useState } from "react";
import { exportPdf, streamNdjson, type Mon } from "./lib";
import { t, locale } from "./i18n";
import { Result } from "./Result";
import type { StoredTeam } from "@poketeam/types";

// Tiny markdown for the chat: **bold**, *italic*, and line breaks. ponytail: no md
//   lib — the AI's "1." / "- " list markers read fine as plain text. Add react-markdown
//   if headings/links/code blocks are ever needed.
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {inline(line)}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

// Single thread under a team: the agent figures out question vs modification on its own.
// Each modification creates a restorable version. Everything is persisted server-side.
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
        <summary>
          {t("Versions", "Versions")} ({versions.length})
        </summary>
        <ul className="versionlist">
          {versions.map((vv, idx) => (
            <li key={idx} className={idx === active ? "on" : ""}>
              <button onClick={() => void revert(idx)} disabled={idx === active}>
                {idx === active ? t("✓ actuelle", "✓ current") : t("Restaurer", "Restore")}
              </button>
              <span className="vmeta">
                v{versions.length - idx} · {new Date(vv.at).toLocaleString(locale())}
              </span>
              {vv.prompt && <span className="vprompt">« {vv.prompt} »</span>}
            </li>
          ))}
        </ul>
      </details>

      {chat.length > 0 && (
        <details className="sub" open>
          <summary>
            {t("Messages", "Messages")} ({chat.length})
          </summary>
          <div className="chat">
            {chat.map((m, k) => (
              <p key={k} className={`bubble ${m.role}`}>
                <Markdown text={m.text} />
              </p>
            ))}
          </div>
        </details>
      )}

      {loading && step && <p className="current">🧠 {step}</p>}
      {error && <p className="error">{error}</p>}

      <textarea
        placeholder={t(
          "Pose une question ou demande une modif : « comment la jouer ? », « rends-la plus défensive », « change l'objet de… »",
          "Ask a question or request a change: “how do I play it?”, “make it more defensive”, “change the item of…”",
        )}
        value={msg}
        onChange={(e) => {
          setMsg(e.target.value);
        }}
        rows={2}
        disabled={loading}
      />
      <button className="generate" onClick={() => void send()} disabled={loading || !msg.trim()}>
        {loading ? t("Réflexion en cours…", "Thinking…") : t("➤ Envoyer", "➤ Send")}
      </button>
    </div>
  );
}

// ---------- Teams screen: list of generated teams ----------
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
    const name = window.prompt(t("Nouveau nom de l'équipe :", "New team name:"));
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
    if (!window.confirm(t("Supprimer cette équipe ?", "Delete this team?"))) return;
    setTeams(
      await fetch(`/api/teams/${i}`, { method: "DELETE" }).then(
        (r) => r.json() as Promise<StoredTeam[]>,
      ),
    );
  }

  if (teams === null) return <p className="muted">{t("Chargement…", "Loading…")}</p>;
  if (!teams.length)
    return (
      <p className="muted">
        {t(
          "Aucune équipe sauvegardée pour l'instant. Génère-en une depuis l'",
          "No saved team yet. Generate one from the ",
        )}
        <a href="#/">{t("accueil", "home page")}</a>.
      </p>
    );

  return (
    <>
      <h2>
        {t("Mes équipes", "My teams")} <span className="muted">({teams.length})</span>
      </h2>
      {teams.map((entry, i) => (
        <details key={i} open={i === 0}>
          <summary>
            <strong>{entry.name ?? entry.team.team.map((m) => m.name_fr).join(", ")}</strong>
            <span className="meta">
              {" "}
              · {entry.format} · {new Date(entry.savedAt).toLocaleString(locale())}
            </span>
            <span className="team-actions">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  exportPdf(`pdf-team-${i}`, entry.name ?? t("Équipe PokéTeam", "PokéTeam team"));
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
                {t("Renommer", "Rename")}
              </button>
              <button
                className="del"
                onClick={(e) => {
                  e.preventDefault();
                  void deleteTeam(i);
                }}
              >
                {t("Supprimer", "Delete")}
              </button>
            </span>
          </summary>
          <details className="sub" open>
            <summary>Pokémon</summary>
            <div id={`pdf-team-${i}`}>
              <Result result={{ team: entry.team }} byEn={byEn} typeImg={typeImg} />
            </div>
          </details>
          <TeamThread
            index={i}
            entry={entry}
            onUpdate={(entry) => {
              setTeams((ts) => (ts ?? []).map((x, k) => (k === i ? entry : x)));
            }}
          />
        </details>
      ))}
    </>
  );
}
