// Le modèle n'emballe pas toujours le JSON de façon identique. On tente, dans l'ordre :
// bloc ```json, bloc ``` simple, puis du premier "{" au dernier "}".
export function parseTeam(raw: string): any {
  const tryParse = (s?: string) => {
    try {
      return s ? JSON.parse(s) : null;
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
