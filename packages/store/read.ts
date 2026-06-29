// User persistence: boxes (Pokémon slots) + generated teams.
// A single JSON file, stored 100% in canonical ENGLISH (display is localized
// at render time on the server side). ponytail: no lock, a single local user.
// Overridden by STORE_FILE for tests, so as to NEVER touch the real store.json.
import { migrate } from "./migrate";
import type { Store } from "@poketeam/types";

const FILE = Bun.env.STORE_FILE ?? "store.json";

export async function read(): Promise<Store> {
  const f = Bun.file(FILE);
  const s: Store = (await f.exists()) ? ((await f.json()) as Store) : { boxes: {}, teams: [] };
  const before = JSON.stringify(s.teams);
  s.teams.forEach(migrate);
  // Auto-repair of the on-disk file: we rewrite ONCE if the migration changed anything.
  if (JSON.stringify(s.teams) !== before) await write(s);
  return s;
}

export const write = (s: Store) => Bun.write(FILE, JSON.stringify(s, null, 2));
