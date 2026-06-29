import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { type Boxes, type Mon } from "./lib";
import { Center } from "./Center";

function App() {
  const [all, setAll] = useState<Mon[]>([]);
  const [byEn, setByEn] = useState<Map<string, Mon>>(new Map());
  const [boxes, setBoxes] = useState<Boxes>({});
  const [typeImg, setTypeImg] = useState<Map<string, string>>(new Map());

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
    <Center all={all} byEn={byEn} boxes={boxes} setBoxes={setBoxes} typeImg={typeImg} />
  );
}

const rootEl = document.getElementById("root");
if (rootEl) createRoot(rootEl).render(<App />);
