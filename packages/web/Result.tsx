import { TYPE_COLORS, type Mon } from "./lib";
import type { Team, BaseStats, Move } from "@poketeam/types";

// Pastille de type avec couleur + icône (si disponible).
function TypeChip({
  type,
  suffix,
  typeImg,
}: {
  type: string;
  suffix?: string;
  typeImg: Map<string, string>;
}) {
  const img = typeImg.get(type);
  return (
    <span className="type-chip" style={{ background: TYPE_COLORS[type] ?? "#777" }}>
      {img && <img className="type-ico" src={img} alt="" />}
      {type}
      {suffix}
    </span>
  );
}

// Stats de base (clés Tyradex → libellés FR courts).
const STATS: [keyof BaseStats, string][] = [
  ["hp", "PV"],
  ["atk", "Attaque"],
  ["def", "Défense"],
  ["spe_atk", "Atq. Spé"],
  ["spe_def", "Déf. Spé"],
  ["vit", "Vitesse"],
];

// Libellés FR des EV (clés spa/spd/spe, distinctes des stats de base).
const EV_LABELS: Record<string, string> = {
  hp: "PV",
  atk: "Attaque",
  def: "Défense",
  spa: "Atq. Spé",
  spd: "Déf. Spé",
  spe: "Vitesse",
};

// Effet (description), traduit en FR au build.
function Effect({ text }: { text?: string | null }) {
  if (!text) return null;
  return <p className="effect-en">{text}</p>;
}

export function Result({
  result,
  byEn,
  typeImg,
}: {
  result: { team: Team };
  byEn: Map<string, Mon>;
  typeImg: Map<string, string>;
}) {
  const team = result.team;
  if (!team.team) return null;
  return (
    <section className="result">
      {team.strategy && <p className="strategy">{team.strategy}</p>}
      <div className="grid">
        {team.team.map((m, i) => {
          const sprite = byEn.get(m.name_en ?? m.name)?.sprite;
          return (
            <article key={i} className="card">
              <div className="card-head">
                {sprite && <img className="portrait" src={sprite} alt={m.name_fr ?? ""} />}
                <div>
                  <h3>
                    {m.name_fr} <span className="muted">/ {m.name_en}</span>
                  </h3>
                  {m.role && <p className="role">{m.role}</p>}
                  {m.types && m.types.length > 0 && (
                    <div className="types">
                      {m.types.map((t, k) => (
                        <TypeChip key={k} type={t} typeImg={typeImg} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {m.base_stats && (
                <div className="stats">
                  {STATS.map(([k, label]) => (
                    <span key={label} className="stat">
                      <b>{label}</b> {m.base_stats?.[k] ?? "—"}
                    </span>
                  ))}
                </div>
              )}

              <dl>
                <div>
                  <dt>Objet</dt>
                  <dd>
                    {m.item}
                    {m.item_effect && <Effect text={m.item_effect} />}
                  </dd>
                </div>
                <div>
                  <dt>Talent</dt>
                  <dd>
                    {m.ability}
                    {m.ability_effect && <Effect text={m.ability_effect} />}
                  </dd>
                </div>
                <div>
                  <dt>Nature</dt>
                  <dd>{m.nature}</dd>
                </div>
                <div>
                  <dt>Téra</dt>
                  <dd>{m.tera_type}</dd>
                </div>
              </dl>

              {m.evs && (
                <p className="evs">
                  EV :{" "}
                  {Object.entries(m.evs)
                    .filter(([, v]) => Number(v) > 0)
                    .map(([k, v]) => `${v} ${EV_LABELS[k] ?? k.toUpperCase()}`)
                    .join(" · ") || "—"}
                </p>
              )}

              {m.moves && (
                <ul className="moves">
                  {m.moves.map((mv: Move | string, j: number) => {
                    if (typeof mv === "string") return <li key={j}>{mv}</li>;
                    const mvType = mv.type ?? "";
                    const img = typeImg.get(mvType);
                    const meta = [
                      mv.category,
                      mv.power ? `Puiss. ${mv.power}` : null,
                      mv.accuracy ? `Préc. ${mv.accuracy}` : null,
                      mv.priority ? `Prio ${mv.priority > 0 ? "+" : ""}${mv.priority}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li
                        key={j}
                        className="typed"
                        style={{ background: TYPE_COLORS[mvType] ?? "var(--navy)" }}
                      >
                        <span className="move-name">
                          {img && <img className="type-ico" src={img} alt="" />}
                          {mv.name}
                        </span>
                        {meta && <span className="move-meta">{meta}</span>}
                        {mv.strong_against && mv.strong_against.length > 0 && (
                          <div className="move-strong">
                            <span className="ms-label">Fort vs</span>
                            {mv.strong_against.map((t, k) => (
                              <TypeChip key={k} type={t} typeImg={typeImg} />
                            ))}
                          </div>
                        )}
                        {mv.effect && <Effect text={mv.effect} />}
                      </li>
                    );
                  })}
                </ul>
              )}

              {m.weaknesses && m.weaknesses.length > 0 && (
                <div className="weak">
                  <span className="weak-label">Faiblesses</span>
                  {m.weaknesses.map((w, k) => (
                    <TypeChip
                      key={k}
                      type={w.type}
                      suffix={` ×${w.multiplier}`}
                      typeImg={typeImg}
                    />
                  ))}
                </div>
              )}
              {m.resistances && m.resistances.length > 0 && (
                <div className="weak">
                  <span className="weak-label">Résiste</span>
                  {m.resistances.map((w, k) => (
                    <TypeChip
                      key={k}
                      type={w.type}
                      suffix={` ×${w.multiplier}`}
                      typeImg={typeImg}
                    />
                  ))}
                </div>
              )}
              {m.immunities && m.immunities.length > 0 && (
                <div className="weak">
                  <span className="weak-label">Immunité</span>
                  {m.immunities.map((t, k) => (
                    <TypeChip key={k} type={t} typeImg={typeImg} />
                  ))}
                </div>
              )}

              {m.note && <p className="note">{m.note}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
