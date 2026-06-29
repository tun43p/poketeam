import { useMemo, useState, type KeyboardEvent } from "react";
import { levenshtein, norm, TYPE_COLORS, type Boxes, type Mon } from "./lib";
import wp1 from "./assets/wp1.png";
import wp2 from "./assets/wp2.png";
import wp3 from "./assets/wp3.png";
import wp4 from "./assets/wp4.png";

// Vrais papiers peints de boîte (gen3). Chaque boîte garde le sien (hash du nom).
const WALLPAPERS = [wp1, wp2, wp3, wp4];
function wpFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return WALLPAPERS[h % WALLPAPERS.length] ?? wp1;
}

// ---------- Écran boîtes : créer / éditer / supprimer ----------
export function BoxesPage({
  all,
  byEn,
  boxes,
  setBoxes,
}: {
  all: Mon[];
  byEn: Map<string, Mon>;
  boxes: Boxes;
  setBoxes: (b: Boxes) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Mon[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const s = norm(q.trim());
    if (!s) return [];
    const hits = all.filter((m) => norm(m.fr).includes(s) || norm(m.en).includes(s));
    // Complète par distance de Levenshtein (tolérance aux fautes de frappe).
    if (hits.length < 8) {
      const seen = new Set(hits.map((m) => m.id));
      const fuzzy = all
        .filter((m) => !seen.has(m.id))
        .map((m) => ({ m, d: Math.min(levenshtein(s, norm(m.fr)), levenshtein(s, norm(m.en))) }))
        .filter((x) => x.d <= 2)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.m);
      hits.push(...fuzzy);
    }
    return hits.slice(0, 8);
  }, [q, all]);

  // Réinitialise l'index surligné quand la recherche change (ajustement au rendu,
  // pattern React recommandé plutôt qu'un effet qui appelle setState).
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setActive(0);
  }

  const add = (m: Mon) => {
    if (!picked.some((p) => p.id === m.id)) setPicked([...picked, m]);
    setQ("");
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[active]) add(matches[active]);
    } else if (e.key === "Escape") {
      setQ("");
    }
  };

  const edit = (slot: string) => {
    setName(slot);
    setPicked((boxes[slot] ?? []).map((en) => byEn.get(en)).filter(Boolean) as Mon[]);
  };

  async function save() {
    if (!name.trim() || !picked.length) return;
    setBoxes(
      await fetch("/api/boxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), mons: picked.map((p) => p.en) }),
      }).then((r) => r.json() as Promise<Boxes>),
    );
    setName("");
    setPicked([]);
  }

  async function del(slot: string) {
    if (!window.confirm(`Supprimer la boîte « ${slot} » ?`)) return;
    setBoxes(
      await fetch(`/api/boxes/${encodeURIComponent(slot)}`, { method: "DELETE" }).then(
        (r) => r.json() as Promise<Boxes>,
      ),
    );
  }

  async function duplicate(slot: string) {
    setBoxes(
      await fetch(`/api/boxes/${encodeURIComponent(slot)}/duplicate`, { method: "POST" }).then(
        (r) => r.json() as Promise<Boxes>,
      ),
    );
  }

  async function rename(slot: string) {
    const to = window.prompt("Nouveau nom de la boîte :", slot);
    if (!to?.trim()) return;
    setBoxes(
      await fetch(`/api/boxes/${encodeURIComponent(slot)}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() }),
      }).then((r) => r.json() as Promise<Boxes>),
    );
  }

  const slots = Object.entries(boxes);
  const names = Object.keys(boxes);

  // Navigation ◀ ▶ entre boîtes (charge la précédente / suivante pour édition).
  function cycle(dir: number) {
    if (!names.length) return;
    const i = name in boxes ? names.indexOf(name) : dir > 0 ? -1 : 0;
    const next = names[(i + dir + names.length) % names.length];
    if (next) edit(next);
  }

  return (
    <>
      <h2>Mes boîtes</h2>
      {slots.length > 0 && (
        <div className="slots">
          {slots.map(([slot, mons]) => (
            <span key={slot} className="slot">
              <button
                className="load"
                onClick={() => {
                  edit(slot);
                }}
              >
                {slot} ({mons.length}) ✎
              </button>
              <button className="dup" title="Dupliquer" onClick={() => void duplicate(slot)}>
                ⧉
              </button>
              <button className="ren" title="Renommer" onClick={() => void rename(slot)}>
                ✎
              </button>
              <button className="del" title="Supprimer" onClick={() => void del(slot)}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="editor">
        <h3>{name && name in boxes ? `Éditer « ${name} »` : "Nouvelle boîte"}</h3>

        <input
          className="slotname"
          placeholder="Nom de la boîte (ex. « Boîte PC 1 »)"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />

        <div className="search">
          <input
            placeholder="Chercher un Pokémon (accents ignorés)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            onKeyDown={onSearchKey}
          />
          {matches.length > 0 && (
            <ul className="dropdown">
              {matches.map((m, idx) => (
                <li
                  key={m.id}
                  className={idx === active ? "active" : ""}
                  onMouseEnter={() => {
                    setActive(idx);
                  }}
                  onClick={() => {
                    add(m);
                  }}
                >
                  {m.sprite && <img src={m.sprite} alt="" />} {m.fr}{" "}
                  <span className="muted">/ {m.en}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pcbox">
          <div className="pcbox-banner">
            <button
              className="box-nav"
              onClick={() => {
                cycle(-1);
              }}
              disabled={!names.length}
            >
              ◀
            </button>
            <span className="box-name">{name.trim() || "Nouvelle boîte"}</span>
            <span className="box-count">{picked.length}</span>
            <button
              className="box-nav"
              onClick={() => {
                cycle(1);
              }}
              disabled={!names.length}
            >
              ▶
            </button>
          </div>
          <div
            className="pcbox-grid"
            style={{ backgroundImage: `url(${wpFor(name || "Nouvelle boîte")})` }}
          >
            {picked.map((m) => (
              <button
                key={m.id}
                className="cell filled"
                onClick={() => {
                  setPicked(picked.filter((p) => p.id !== m.id));
                }}
              >
                {m.sprite && <img src={m.sprite} alt={m.fr} />}
                <span className="tip">
                  <b>{m.fr}</b>
                  <em>{m.en}</em>
                  {m.types && m.types.length > 0 && (
                    <span className="tip-types">
                      {m.types.map((t) => (
                        <i key={t} style={{ background: TYPE_COLORS[t] ?? "#777" }}>
                          {t}
                        </i>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {Array.from({
              length: Math.max(30, Math.ceil((picked.length + 1) / 6) * 6) - picked.length,
            }).map((_, k) => (
              <span key={`e${k}`} className="cell empty" />
            ))}
          </div>
        </div>

        <div className="editor-actions">
          <span className="muted">{picked.length} Pokémon</span>
          <button
            className="generate"
            onClick={() => void save()}
            disabled={!name.trim() || !picked.length}
          >
            💾 Enregistrer la boîte
          </button>
          {(picked.length > 0 || name) && (
            <button
              className="clear"
              onClick={() => {
                setPicked([]);
                setName("");
              }}
            >
              annuler
            </button>
          )}
        </div>
      </div>
    </>
  );
}
