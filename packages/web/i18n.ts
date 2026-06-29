// Tiny i18n: the language is fetched once at boot and locked (never changes at
// runtime), so a module-level value + a t(fr, en) picker is enough — no context,
// no re-render. ponytail: inline both strings at the call site, no key dictionary.
export let lang: "fr" | "en" = "fr";
export const initLang = (l: "fr" | "en") => {
  lang = l;
};
export const t = (fr: string, en: string) => (lang === "en" ? en : fr);
export const locale = () => (lang === "en" ? "en-US" : "fr-FR");
