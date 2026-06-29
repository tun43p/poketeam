// Process-wide display/response language. Set ONCE at server boot from the store
// (store.lang) and never again — the language is locked for the life of the store.
// The AI is told to answer in it and every DB lookup localizes to it.
export let LANG: "fr" | "en" = "fr";
export const setLang = (l: "fr" | "en") => {
  LANG = l;
};
