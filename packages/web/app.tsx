import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { type Boxes, type Mon } from "./lib";
import { initLang } from "./i18n";
import { Center } from "./Center";

// First launch (store has no lang yet): ask once. The choice is then LOCKED.
function LangPicker({ onPick }: { onPick: (l: "fr" | "en") => void }) {
  const [busy, setBusy] = useState(false);
  async function choose(l: "fr" | "en") {
    setBusy(true);
    const r = (await fetch("/api/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: l }),
    }).then((res) => res.json())) as { lang: "fr" | "en" };
    onPick(r.lang);
  }
  return (
    <div className="lang-picker">
      <h1>PokéTeam</h1>
      <p>Choose your language · Choisis ta langue</p>
      <p className="lang-warn">⚠️ This choice is permanent · Ce choix est définitif</p>
      <div className="lang-buttons">
        <button disabled={busy} onClick={() => void choose("fr")}>
          🇫🇷 Français
        </button>
        <button disabled={busy} onClick={() => void choose("en")}>
          🇬🇧 English
        </button>
      </div>
    </div>
  );
}

function App() {
  const [all, setAll] = useState<Mon[]>([]);
  const [byEn, setByEn] = useState<Map<string, Mon>>(new Map());
  const [boxes, setBoxes] = useState<Boxes>({});
  const [typeImg, setTypeImg] = useState<Map<string, string>>(new Map());
  // null = still loading; false = must ask; true = language locked, app ready.
  const [ready, setReady] = useState<boolean | null>(null);

  // Decide the language BEFORE loading the rest (data is localized server-side by it).
  useEffect(() => {
    void fetch("/api/lang")
      .then((r) => r.json() as Promise<{ lang: "fr" | "en" | null }>)
      .then((r) => {
        if (r.lang) {
          initLang(r.lang);
          setReady(true);
        } else {
          setReady(false);
        }
      });
  }, []);

  // Load the app data only once the language is locked.
  useEffect(() => {
    if (ready !== true) return;
    void fetch("/api/pokemon")
      .then((r) => r.json())
      .then((list: Mon[]) => {
        setAll(list);
        setByEn(new Map(list.map((m) => [m.en, m])));
      });
    void fetch("/api/boxes")
      .then((r) => r.json())
      .then(setBoxes);
    void fetch("/api/types")
      .then((r) => r.json())
      .then((ts: { name: string; image: string }[]) => {
        setTypeImg(new Map(ts.map((t) => [t.name, t.image])));
      })
      .catch(() => undefined);
  }, [ready]);

  if (ready === null) return null;
  if (ready === false)
    return (
      <LangPicker
        onPick={(l) => {
          initLang(l);
          setReady(true);
        }}
      />
    );

  return <Center all={all} byEn={byEn} boxes={boxes} setBoxes={setBoxes} typeImg={typeImg} />;
}

const rootEl = document.getElementById("root");
if (rootEl) createRoot(rootEl).render(<App />);
