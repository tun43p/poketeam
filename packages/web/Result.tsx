import { TYPE_COLORS, type Mon } from "./lib";
import { t } from "./i18n";
import type { Team, BaseStats, Move } from "@poketeam/types";

// Type chip with color + icon (if available).
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

// Base stats (Tyradex keys → short labels, in the chosen language).
const STATS: [keyof BaseStats, string][] = [
  ["hp", t("PV", "HP")],
  ["atk", t("Attaque", "Attack")],
  ["def", t("Défense", "Defense")],
  ["spe_atk", t("Atq. Spé", "Sp. Atk")],
  ["spe_def", t("Déf. Spé", "Sp. Def")],
  ["vit", t("Vitesse", "Speed")],
];

// Labels for EVs (keys spa/spd/spe, distinct from the base stats).
const EV_LABELS: Record<string, string> = {
  hp: t("PV", "HP"),
  atk: t("Attaque", "Attack"),
  def: t("Défense", "Defense"),
  spa: t("Atq. Spé", "Sp. Atk"),
  spd: t("Déf. Spé", "Sp. Def"),
  spe: t("Vitesse", "Speed"),
};

// Effect (description), translated to FR at build time.
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
                  <dt>{t("Objet", "Item")}</dt>
                  <dd>
                    {m.item}
                    {m.item_effect && <Effect text={m.item_effect} />}
                  </dd>
                </div>
                <div>
                  <dt>{t("Talent", "Ability")}</dt>
                  <dd>
                    {m.ability}
                    {m.ability_effect && <Effect text={m.ability_effect} />}
                  </dd>
                </div>
                <div>
                  <dt>{t("Nature", "Nature")}</dt>
                  <dd>{m.nature}</dd>
                </div>
                <div>
                  <dt>{t("Téra", "Tera")}</dt>
                  <dd>{m.tera_type}</dd>
                </div>
              </dl>

              {m.evs && (
                <p className="evs">
                  {t("EV :", "EVs:")}{" "}
                  {Object.entries(m.evs)
                    .filter(([, v]) => v > 0)
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
                            <span className="ms-label">{t("Fort vs", "Strong vs")}</span>
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
                  <span className="weak-label">{t("Faiblesses", "Weaknesses")}</span>
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
                  <span className="weak-label">{t("Résiste", "Resists")}</span>
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
                  <span className="weak-label">{t("Immunité", "Immune")}</span>
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
