// The model does not always wrap the JSON the same way. We try, in order:
// ```json block, plain ``` block, then from the first "{" to the last "}". We only
// return a result if it actually contains a `team` key (otherwise null).
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
