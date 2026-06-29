// Le modèle n'emballe pas toujours le JSON de façon identique. On tente, dans l'ordre :
// bloc ```json, bloc ``` simple, puis du premier "{" au dernier "}". On ne renvoie un
// résultat que s'il contient bien une clé `team` (sinon null).
import type { Team } from "@poketeam/types";

export function parseTeam(raw: string): Team | null {
  const tryParse = (s?: string): Team | null => {
    try {
      return s ? (JSON.parse(s) as Team) : null;
    } catch {
      return null;
    }
  };

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  let t = tryParse(fenced?.[1]?.trim());
  if (t?.team) return t;

  const a = raw.indexOf("{"),
    b = raw.lastIndexOf("}");

  if (a >= 0 && b > a) {
    t = tryParse(raw.slice(a, b + 1)) ?? t;
  }

  return t?.team ? t : null;
}
