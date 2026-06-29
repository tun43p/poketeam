// Language setting: chosen ONCE on first launch, then locked for the life of the store.
import { read, write } from "./read";

// null = not chosen yet (first launch) → the UI must ask.
export const getLang = async () => (await read()).lang ?? null;

// Writes the language only if none is set yet; returns the effective (locked) language.
export async function chooseLang(lang: "fr" | "en"): Promise<"fr" | "en"> {
  const s = await read();
  if (s.lang) return s.lang; // already locked, ignore the request
  s.lang = lang;
  await write(s);
  return lang;
}
