// Méta compétitif Champions : le SEUL accès réseau au runtime (usage temps réel),
// avec cache disque court. Le cache vit dans .cache/ (relatif au cwd, ignoré par git).
import { mkdir } from "node:fs/promises";

const CACHE = ".cache";
await mkdir(CACHE, { recursive: true });
async function cachedJson(key: string, url: string, ttlMs = 6 * 3600_000): Promise<any> {
  const f = Bun.file(`${CACHE}/${key}.json`);
  if ((await f.exists()) && Date.now() - f.lastModified < ttlMs) return f.json();
  const data = await fetch(url).then((r) => r.json());
  await Bun.write(f, JSON.stringify(data));
  return data;
}

export async function getMeta(name: string, format: "Doubles" | "Singles") {
  const slug = name.replace(/\s+/g, "-").toLowerCase();
  let data: any;
  try {
    data = await cachedJson(
      `meta-${format}-${slug}`,
      `https://championsbattledata.com/api/battle/${format}/${encodeURIComponent(name)}`,
    );
  } catch {
    return { error: `No meta data for ${name} (${format})` };
  }

  const rows: any[] = data?.rows ?? [];
  if (!rows.length) return { note: `No Champions usage data for ${name}.` };

  const top = (cat: string, n = 5) => rows.filter((r) => r.category === cat).slice(0, n);
  return {
    pokemon: data.pokemon,
    format,
    moves: top("move", 8).map((r) => ({ name: r.name, usage: r.percentage })),
    items: top("item").map((r) => ({ name: r.name, usage: r.percentage })),
    abilities: top("ability").map((r) => ({ name: r.name, usage: r.percentage })),
    natures: top("nature").map((r) => ({
      name: r.name,
      up: r.stat_up,
      down: r.stat_down,
      usage: r.percentage,
    })),
    ev_spreads: top("spread", 3).map((r) => ({
      usage: r.percentage,
      hp: r.hp_points,
      atk: r.attack_points,
      def: r.defense_points,
      spa: r.sp_atk_points,
      spd: r.sp_def_points,
      spe: r.speed_points,
    })),
    teammates: top("teammate").map((r) => ({ name: r.name, usage: r.percentage })),
  };
}
