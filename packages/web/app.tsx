import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Pokeball, type Boxes, type Mon } from "./lib";
import { Home } from "./Home";
import { TeamsPage } from "./Teams";
import { BoxesPage } from "./Boxes";

function useHash() {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => {
    const f = () => setH(location.hash || "#/");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return h;
}

function App() {
  const [all, setAll] = useState<Mon[]>([]);
  const [byEn, setByEn] = useState<Map<string, Mon>>(new Map());
  const [boxes, setBoxes] = useState<Boxes>({});
  const [typeImg, setTypeImg] = useState<Map<string, string>>(new Map());
  const hash = useHash();

  useEffect(() => {
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
  }, []);

  return (
    <main>
      <header>
        <h1>
          <a href="#/">
            <Pokeball />
            PokéTeam <span className="sub">Champions</span>
          </a>
        </h1>
        <nav>
          <a href="#/" className={hash === "#/" ? "on" : ""}>
            Générer une équipe
          </a>
          <a href="#/boxes" className={hash.startsWith("#/boxes") ? "on" : ""}>
            Mes boîtes
          </a>
          <a href="#/teams" className={hash.startsWith("#/teams") ? "on" : ""}>
            Mes équipes
          </a>
        </nav>
      </header>

      {hash.startsWith("#/boxes") ? (
        <BoxesPage all={all} byEn={byEn} boxes={boxes} setBoxes={setBoxes} />
      ) : hash.startsWith("#/teams") ? (
        <TeamsPage byEn={byEn} typeImg={typeImg} />
      ) : (
        <Home byEn={byEn} boxes={boxes} typeImg={typeImg} />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
