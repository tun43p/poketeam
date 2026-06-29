import { useEffect, useRef, useState } from "react";
import type { Boxes, Mon } from "./lib";
import { t, lang } from "./i18n";
import { Home } from "./Home";
import { BoxesPage } from "./Boxes";
import { TeamsPage } from "./Teams";
import centerBg from "./assets/center.png";
import playerSheet from "./assets/player.png";
import nurseSheet from "./assets/nurse.png";

// ---------------------------------------------------------------------------
// Authentic sprites (gen3, pokeemerald decompilation): the interior of the
// Pokémon Center (FRLG, the nurse is already drawn on it = Claudia) and
// the trainer's walking sheet (9 frames of 16×32).
// pokeemerald frame order: 0 south, 1 north, 2 west, 3/4 walk south,
// 5/6 walk north, 7/8 walk west.
// ---------------------------------------------------------------------------
type Facing = "down" | "up" | "left" | "right";
const STAND: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 2 };
const STEP: Record<Facing, number> = { down: 3, up: 5, left: 7, right: 7 };

// ---------------------------------------------------------------------------
// Pokémon-style dialogue box: text that writes itself letter by letter,
// blinking ▼ arrow, then a choice menu with a ▸ cursor.
// ---------------------------------------------------------------------------
interface Choice {
  label: string;
  onSelect: () => void;
}

function Dialogue({
  speaker,
  lines,
  choices,
  onClose,
}: {
  speaker?: string;
  lines: string[];
  choices?: Choice[];
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0); // number of characters revealed
  const [prevPage, setPrevPage] = useState(0);
  const [cursor, setCursor] = useState(0);
  const full = lines[page] ?? "";

  // Reset the counter when the page changes ("adjustment during render" pattern).
  if (page !== prevPage) {
    setPrevPage(page);
    setCount(0);
  }

  const shown = full.slice(0, count);
  const done = count >= full.length;
  const lastPage = page >= lines.length - 1;

  // Typewriter: the effect only schedules the next tick
  // (the setState lives in the async callback, never in the effect body).
  useEffect(() => {
    if (count >= full.length) return;
    const id = setTimeout(() => {
      setCount((c) => c + 1);
    }, 22);
    return () => {
      clearTimeout(id);
    };
  }, [count, full]);

  const showChoices = done && lastPage && choices && choices.length > 0;

  function advance() {
    if (!done) {
      setCount(full.length); // 1st click: finish the line all at once
      return;
    }
    if (!lastPage) {
      setPage((p) => Math.min(p + 1, lines.length - 1)); // clamp: a double-click does not overshoot
      return;
    }
    if (!choices || choices.length === 0) onClose();
  }

  // Keyboard: ↑/↓ for the menu, Enter/Space to confirm/advance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showChoices) {
        if (e.key === "ArrowDown") setCursor((c) => (c + 1) % choices.length);
        else if (e.key === "ArrowUp") setCursor((c) => (c - 1 + choices.length) % choices.length);
        else if (e.key === "Enter" || e.key === " ") choices[cursor]?.onSelect();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance();
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  });

  return (
    <div className="dlg-layer" onClick={showChoices ? undefined : advance}>
      <div className="dlg-box">
        {speaker && <span className="dlg-name">{speaker}</span>}
        <p className="dlg-text">
          {shown}
          {done && !showChoices && <span className="dlg-arrow">▼</span>}
        </p>
        {showChoices && (
          <ul
            className="dlg-menu"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {choices.map((c, i) => (
              <li
                key={c.label}
                className={i === cursor ? "on" : ""}
                onMouseEnter={() => {
                  setCursor(i);
                }}
                onClick={c.onSelect}
              >
                <span className="dlg-cursor">{i === cursor ? "▸" : " "}</span>
                {c.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full-screen panel: a "game screen" that covers the scene when you
// use the PC or talk with Claudia. Reuses the existing pages.
// ---------------------------------------------------------------------------
function Panel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-bar">
        <button className="panel-back" onClick={onBack}>
          ◀ {t("Quitter", "Leave")}
        </button>
        <span className="panel-title">{title}</span>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

// Positions (in %): the trainer's stopping point in front of each station, and
// the position of the clickable label above the station in the FRLG image.
const SPOTS = {
  home: { x: 49, y: 80 },
  claudia: { x: 50, y: 44 },
  pc: { x: 72, y: 42 },
};
const LABELS = {
  claudia: { x: 50, y: 11 },
  pc: { x: 72, y: 13 },
};
const NURSE = { x: 50, y: 25 }; // position of the Claudia sprite behind the counter

type View = "scene" | "talk" | "create" | "consult" | "pc";

export function Center({
  all,
  byEn,
  boxes,
  setBoxes,
  typeImg,
}: {
  all: Mon[];
  byEn: Map<string, Mon>;
  boxes: Boxes;
  setBoxes: (b: Boxes) => void;
  typeImg: Map<string, string>;
}) {
  const [view, setView] = useState<View>("scene");
  const [langLock, setLangLock] = useState(false); // alert: language can't be changed
  const [pos, setPos] = useState(SPOTS.home);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<Facing>("down");
  const [step, setStep] = useState(false);
  const after = useRef<() => void>(() => undefined);

  // Walk to a station, then run the action (open dialogue / screen).
  function walkTo(spot: { x: number; y: number }, then: () => void) {
    if (walking) return;
    const dx = spot.x - pos.x;
    const dy = spot.y - pos.y;
    setFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    after.current = then;
    setWalking(true);
    setPos(spot);
  }

  function backToScene() {
    setView("scene");
    setFacing("down");
    setWalking(true);
    after.current = () => undefined;
    setPos(SPOTS.home);
  }

  // Walking animation: alternate fixed frame / step frame while moving.
  useEffect(() => {
    if (!walking) return;
    const id = setInterval(() => {
      setStep((s) => !s);
    }, 150);
    return () => {
      clearInterval(id);
    };
  }, [walking]);

  // The reused pages contain internal links (#/teams, #/boxes):
  // we rewire them to the panels instead of the old hash-based navigation.
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#/teams") setView("consult");
      else if (location.hash === "#/boxes") setView("pc");
    };
    addEventListener("hashchange", onHash);
    return () => {
      removeEventListener("hashchange", onHash);
    };
  }, []);

  const inScene = view === "scene";
  const frame = walking && step ? STEP[facing] : STAND[facing];

  return (
    <div className="center-shell">
      {/* Language switch: shown in the scene only (panels have their own top bar),
          but LOCKED — clicking it explains it can't change. */}
      {inScene && (
        <button
          className="lang-badge"
          onClick={() => {
            setLangLock(true);
          }}
        >
          {lang === "en" ? "🇬🇧 EN" : "🇫🇷 FR"} 🔒
        </button>
      )}
      {langLock && (
        <Dialogue
          lines={[
            t(
              "La langue est verrouillée et ne peut plus être changée.",
              "The language is locked and can no longer be changed.",
            ),
          ]}
          onClose={() => {
            setLangLock(false);
          }}
        />
      )}
      <div
        className={`room ${inScene ? "" : "dim"}`}
        style={{ backgroundImage: `url(${centerBg})` }}
      >
        {/* Claudia (gen3 nurse) behind the counter */}
        <div
          className="npc"
          style={{
            left: `${NURSE.x}%`,
            top: `${NURSE.y}%`,
            backgroundImage: `url(${nurseSheet})`,
            backgroundSize: "400% 100%",
            backgroundPositionX: "0%",
          }}
        />

        {/* Clickable areas (above Claudia and the PC, already drawn) */}
        {inScene && (
          <>
            <button
              className="hotspot"
              style={{ left: `${LABELS.claudia.x}%`, top: `${LABELS.claudia.y}%` }}
              onClick={() => {
                walkTo(SPOTS.claudia, () => {
                  setView("talk");
                });
              }}
            >
              Claudia ▸
            </button>
            <button
              className="hotspot"
              style={{ left: `${LABELS.pc.x}%`, top: `${LABELS.pc.y}%` }}
              onClick={() => {
                walkTo(SPOTS.pc, () => {
                  setView("pc");
                });
              }}
            >
              PC ▸
            </button>
          </>
        )}

        {/* The trainer (you) — animated gen3 sprite */}
        <div
          className={`player ${walking ? "walking" : ""}`}
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            backgroundImage: `url(${playerSheet})`,
            backgroundPositionX: `${frame * 12.5}%`,
            transform: `translate(-50%, -100%) scaleX(${facing === "right" ? -1 : 1})`,
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName !== "left" && e.propertyName !== "top") return;
            setWalking(false);
            const fn = after.current;
            after.current = () => undefined;
            fn();
          }}
        />
      </div>

      {/* Dialogue with Claudia */}
      {view === "talk" && (
        <Dialogue
          speaker="CLAUDIA"
          lines={[
            t("Bienvenue au Centre Pokémon !", "Welcome to the Pokémon Center!"),
            t("Que puis-je faire pour toi aujourd'hui ?", "What can I do for you today?"),
          ]}
          choices={[
            {
              label: t("Créer une nouvelle équipe", "Create a new team"),
              onSelect: () => {
                setView("create");
              },
            },
            {
              label: t("Consulter une équipe", "View a team"),
              onSelect: () => {
                setView("consult");
              },
            },
            { label: t("Rien, merci", "Nothing, thanks"), onSelect: backToScene },
          ]}
          onClose={backToScene}
        />
      )}

      {view === "create" && (
        <Panel title={t("Claudia — Nouvelle équipe", "Claudia — New team")} onBack={backToScene}>
          <Home byEn={byEn} boxes={boxes} typeImg={typeImg} />
        </Panel>
      )}
      {view === "consult" && (
        <Panel title={t("Claudia — Tes équipes", "Claudia — Your teams")} onBack={backToScene}>
          <TeamsPage byEn={byEn} typeImg={typeImg} />
        </Panel>
      )}
      {view === "pc" && (
        <Panel title={t("PC — Boîtes de stockage", "PC — Storage boxes")} onBack={backToScene}>
          <BoxesPage all={all} byEn={byEn} boxes={boxes} setBoxes={setBoxes} />
        </Panel>
      )}
    </div>
  );
}
