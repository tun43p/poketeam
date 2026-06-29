import { useEffect, useRef, useState } from "react";
import type { Boxes, Mon } from "./lib";
import { Home } from "./Home";
import { BoxesPage } from "./Boxes";
import { TeamsPage } from "./Teams";
import centerBg from "./assets/center.png";
import playerSheet from "./assets/player.png";
import nurseSheet from "./assets/nurse.png";

// ---------------------------------------------------------------------------
// Sprites authentiques (gen3, décompilation pokeemerald) : l'intérieur du
// Centre Pokémon (FRLG, l'infirmière est déjà dessinée dessus = Claudia) et
// la planche de marche du dresseur (9 frames de 16×32).
// Ordre des frames pokeemerald : 0 sud, 1 nord, 2 ouest, 3/4 marche sud,
// 5/6 marche nord, 7/8 marche ouest.
// ---------------------------------------------------------------------------
type Facing = "down" | "up" | "left" | "right";
const STAND: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 2 };
const STEP: Record<Facing, number> = { down: 3, up: 5, left: 7, right: 7 };

// ---------------------------------------------------------------------------
// Boîte de dialogue façon Pokémon : texte qui s'écrit lettre par lettre,
// flèche ▼ clignotante, puis menu de choix au curseur ▸.
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
  const [count, setCount] = useState(0); // nb de caractères révélés
  const [prevPage, setPrevPage] = useState(0);
  const [cursor, setCursor] = useState(0);
  const full = lines[page] ?? "";

  // Reset du compteur au changement de page (pattern « ajustement au rendu »).
  if (page !== prevPage) {
    setPrevPage(page);
    setCount(0);
  }

  const shown = full.slice(0, count);
  const done = count >= full.length;
  const lastPage = page >= lines.length - 1;

  // Machine à écrire : l'effet ne fait que programmer le tick suivant
  // (le setState vit dans le callback async, jamais dans le corps de l'effet).
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
      setCount(full.length); // 1er clic : finir la ligne d'un coup
      return;
    }
    if (!lastPage) {
      setPage((p) => Math.min(p + 1, lines.length - 1)); // clamp : un double-clic ne dépasse pas
      return;
    }
    if (!choices || choices.length === 0) onClose();
  }

  // Clavier : ↑/↓ pour le menu, Entrée/Espace pour valider/avancer.
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
// Panneau plein écran : un « écran de jeu » qui recouvre la scène quand tu
// utilises le PC ou que tu discutes avec Claudia. Réutilise les pages existantes.
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
          ◀ Quitter
        </button>
        <span className="panel-title">{title}</span>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

// Positions (en %) : point d'arrêt du dresseur devant chaque station, et
// position de l'étiquette cliquable au-dessus de la station dans l'image FRLG.
const SPOTS = {
  home: { x: 49, y: 80 },
  claudia: { x: 50, y: 44 },
  pc: { x: 72, y: 42 },
};
const LABELS = {
  claudia: { x: 50, y: 11 },
  pc: { x: 72, y: 13 },
};
const NURSE = { x: 50, y: 25 }; // position du sprite Claudia derrière le comptoir

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
  const [pos, setPos] = useState(SPOTS.home);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<Facing>("down");
  const [step, setStep] = useState(false);
  const after = useRef<() => void>(() => undefined);

  // Marche jusqu'à une station, puis exécute l'action (ouvre dialogue / écran).
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

  // Animation de marche : alterne frame fixe / frame de pas pendant le déplacement.
  useEffect(() => {
    if (!walking) return;
    const id = setInterval(() => {
      setStep((s) => !s);
    }, 150);
    return () => {
      clearInterval(id);
    };
  }, [walking]);

  // Les pages réutilisées contiennent des liens internes (#/teams, #/boxes) :
  // on les rebranche sur les panneaux au lieu de l'ancienne navigation par hash.
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
      <div className={`room ${inScene ? "" : "dim"}`} style={{ backgroundImage: `url(${centerBg})` }}>
        {/* Claudia (infirmière gen3) derrière le comptoir */}
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

        {/* Zones cliquables (au-dessus de Claudia et du PC, déjà dessinés) */}
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

        {/* Le dresseur (toi) — sprite gen3 animé */}
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

      {/* Dialogue avec Claudia */}
      {view === "talk" && (
        <Dialogue
          speaker="CLAUDIA"
          lines={["Bienvenue au Centre Pokémon !", "Que puis-je faire pour toi aujourd'hui ?"]}
          choices={[
            {
              label: "Créer une nouvelle équipe",
              onSelect: () => {
                setView("create");
              },
            },
            {
              label: "Consulter une équipe",
              onSelect: () => {
                setView("consult");
              },
            },
            { label: "Rien, merci", onSelect: backToScene },
          ]}
          onClose={backToScene}
        />
      )}

      {view === "create" && (
        <Panel title="Claudia — Nouvelle équipe" onBack={backToScene}>
          <Home byEn={byEn} boxes={boxes} typeImg={typeImg} />
        </Panel>
      )}
      {view === "consult" && (
        <Panel title="Claudia — Tes équipes" onBack={backToScene}>
          <TeamsPage byEn={byEn} typeImg={typeImg} />
        </Panel>
      )}
      {view === "pc" && (
        <Panel title="PC — Boîtes de stockage" onBack={backToScene}>
          <BoxesPage all={all} byEn={byEn} boxes={boxes} setBoxes={setBoxes} />
        </Panel>
      )}
    </div>
  );
}
