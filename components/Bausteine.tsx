"use client";

import type { BausteinName } from "@/lib/types";

/** Feste, geprüfte Grafiken. Das Modell liefert nur die Daten. */

const C = { teal: "#0B5761", ink: "#10242A", orange: "#EA7A3C", orangeTxt: "#9A3412", grey: "#C9D3D2", soft: "#EEF1EF", fg2: "#3D5156", fg3: "#5A6C70", amber: "#B0760E" };
const STATE: Record<string, string> = { abgerechnet: C.ink, bestaetigt: C.teal, offen: C.orange, leer: C.grey, unbekannt: C.amber };

function safe<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

function Timeline({ d }: { d: { steps?: { label?: string; state?: string; note?: string }[]; badge?: string } }) {
  const steps = (d.steps ?? []).slice(0, 8);
  if (!steps.length) return null;
  const W = 412, pad = 30, gap = steps.length > 1 ? (W - 2 * pad) / (steps.length - 1) : 0;
  const nowIdx = steps.findIndex((s) => s.state === "now");
  const lastDone = steps.reduce((m, s, i) => (s.state === "done" || s.state === "now" ? i : m), -1);
  return (
    <svg className="g" viewBox="0 0 412 124" role="img" aria-label="Zeitleiste">
      <line x1={pad} y1={70} x2={W - pad} y2={70} stroke="rgba(16,36,42,.12)" strokeWidth={6} strokeLinecap="round" />
      {lastDone > 0 && <path className="draw" d={`M${pad} 70 L${pad + lastDone * gap} 70`} stroke={C.teal} strokeWidth={6} strokeLinecap="round" fill="none" />}
      {steps.map((s, i) => {
        const x = pad + i * gap, st = s.state ?? "next";
        return (
          <g key={i} className="pop" style={{ animationDelay: `${0.25 + i * 0.15}s` }} fontSize={11} fontWeight={700} textAnchor="middle">
            {st === "done" && <circle cx={x} cy={70} r={9} fill={C.teal} />}
            {st === "now" && <circle cx={x} cy={70} r={12} fill="#fff" stroke={C.orange} strokeWidth={4} />}
            {st === "next" && <circle cx={x} cy={70} r={9} fill="#fff" stroke="rgba(16,36,42,.25)" strokeWidth={3} />}
            <text x={x} y={st === "now" ? 104 : 100} fill={st === "now" ? C.orangeTxt : st === "next" ? C.fg3 : C.fg2}>{str(s.label)}</text>
            {s.note && <text x={x} y={118} fill={C.fg3} fontWeight={500} fontSize={10}>{s.note}</text>}
          </g>
        );
      })}
      {d.badge && nowIdx >= 0 && (
        <g className="pop" style={{ animationDelay: "1s" }}>
          <rect x={Math.min(W - 124, Math.max(2, pad + nowIdx * gap - 60))} y={14} width={120} height={26} rx={8} fill="#FFF0E6" stroke={C.orange} />
          <text x={Math.min(W - 64, Math.max(62, pad + nowIdx * gap))} y={31} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.orangeTxt}>{d.badge}</text>
        </g>
      )}
    </svg>
  );
}

function Pool({ d }: { d: { label?: string; total?: number; used?: number; today?: number } }) {
  const total = Math.min(20, Math.max(1, num(d.total, 1))), used = Math.min(total, num(d.used)), today = Math.min(total - used, num(d.today));
  const w = Math.min(40, 400 / total);
  return (
    <svg className="g" viewBox="0 0 412 112" role="img" aria-label="Topf">
      <text x={6} y={18} fontSize={10.5} fontWeight={700} fill={C.fg3} letterSpacing=".08em">{str(d.label, "TOPF").toUpperCase()}</text>
      {Array.from({ length: total }).map((_, i) => {
        const isUsed = i < used, isToday = !isUsed && i < used + today;
        return <rect key={i} className="pop" style={{ animationDelay: `${0.1 + i * 0.06}s` }} x={6 + i * w} y={30} width={w - 8} height={44} rx={9} fill={isUsed ? C.teal : isToday ? "#fff" : C.soft} stroke={isToday ? C.teal : "none"} strokeWidth={2.5} strokeDasharray={isToday ? "4 3" : undefined} />;
      })}
      <g fontSize={11} fontWeight={700}>
        <text className="pop" style={{ animationDelay: ".9s" }} x={6} y={96} fill={C.teal}>{used} verbraucht</text>
        {today > 0 && <text className="pop" style={{ animationDelay: "1s" }} x={6 + used * w} y={96} fill={C.teal}>heute</text>}
        <text className="pop" style={{ animationDelay: "1.1s" }} x={406} y={96} textAnchor="end" fill={C.fg3}>{total - used - today} frei</text>
      </g>
    </svg>
  );
}

function Teeth({ d }: { d: { label?: string; teeth?: { n?: number; state?: string }[]; callout?: { n?: number; text?: string } } }) {
  const teeth = (d.teeth ?? []).slice(0, 16);
  if (!teeth.length) return null;
  const step = Math.min(40, 400 / teeth.length), size = step - 8;
  const ci = d.callout ? teeth.findIndex((t) => t.n === d.callout?.n) : -1;
  return (
    <svg className="g" viewBox="0 0 412 120" role="img" aria-label="Zähne">
      <text x={6} y={26} fontSize={10.5} fontWeight={700} fill={C.fg3} letterSpacing=".08em">{str(d.label).toUpperCase()}</text>
      {teeth.map((t, i) => {
        const x = 6 + i * step, st = t.state ?? "abgerechnet", off = st === "offen";
        return (
          <g key={i} className="pop" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
            <rect x={x} y={42} width={size} height={size} rx={9} fill="#FBF9F5" stroke={off ? C.orange : C.grey} strokeWidth={off ? 2.5 : 1.2} />
            {st !== "leer" && <rect x={x + size / 2 - 6} y={42 + size / 2 - 6} width={12} height={12} rx={3} fill={STATE[st] ?? C.ink} />}
            <text x={x + size / 2} y={42 + size + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill={off ? C.orangeTxt : C.fg3}>{num(t.n)}</text>
          </g>
        );
      })}
      {ci >= 0 && d.callout?.text && (
        <g className="pop" style={{ animationDelay: ".9s" }}>
          <rect x={Math.min(406 - 128, Math.max(2, 6 + ci * step + size / 2 - 64))} y={4} width={128} height={24} rx={8} fill="#FFF0E6" stroke={C.orange} />
          <text x={Math.min(406 - 64, Math.max(66, 6 + ci * step + size / 2))} y={20} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={C.orangeTxt}>{d.callout.text}</text>
        </g>
      )}
    </svg>
  );
}

function Bars({ d }: { d: { rows?: { label?: string; segments?: { value?: number; label?: string; state?: string }[] }[]; foot?: string } }) {
  const rows = (d.rows ?? []).slice(0, 5);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => (r.segments ?? []).reduce((s, x) => s + num(x.value), 0)));
  const H = 30 + rows.length * 44 + (d.foot ? 18 : 0);
  return (
    <svg className="g" viewBox={`0 0 412 ${H}`} role="img" aria-label="Balken">
      {rows.map((r, ri) => {
        const y = 14 + ri * 44;
        let x = 100;
        return (
          <g key={ri} fontSize={11} fontWeight={700}>
            <text x={0} y={y + 14} fill={C.fg2}>{str(r.label)}</text>
            <rect x={100} y={y} width={300} height={20} rx={7} fill={C.soft} />
            {(r.segments ?? []).map((s, si) => {
              const w = (num(s.value) / max) * 300, x0 = x;
              x += w;
              return (
                <g key={si} className="pop" style={{ animationDelay: `${0.2 + ri * 0.3 + si * 0.15}s` }}>
                  <rect x={x0} y={y} width={Math.max(0, w - 2)} height={20} rx={7} fill={STATE[s.state ?? ""] ?? C.ink} />
                  {w > 70 ? <text x={x0 + w / 2} y={y + 14} textAnchor="middle" fill="#fff">{num(s.value)} {str(s.label)}</text> : <text x={x0 + w / 2} y={y + 34} textAnchor="middle" fill={s.state === "offen" ? C.orangeTxt : C.fg3}>{num(s.value)} {str(s.label)}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
      {d.foot && <text x={100} y={H - 6} fontSize={11} fontWeight={600} fill={C.fg3}>{d.foot}</text>}
    </svg>
  );
}

function Steps({ d }: { d: { items?: { title?: string; text?: string }[] } }) {
  return (
    <ol className="ik-steps">
      {(d.items ?? []).slice(0, 6).map((s, i) => (
        <li key={i} className="pop" style={{ animationDelay: `${0.1 + i * 0.12}s` }}><b>{str(s.title)}</b>{s.text ? <span>{s.text}</span> : null}</li>
      ))}
    </ol>
  );
}

function Cards({ d }: { d: { items?: { value?: string; label?: string; tone?: string }[] } }) {
  return (
    <div className="ik-cards">
      {(d.items ?? []).slice(0, 6).map((c, i) => (
        <div key={i} className={"pop t-" + (c.tone ?? "ink")} style={{ animationDelay: `${0.1 + i * 0.1}s` }}><b>{str(c.value)}</b><small>{str(c.label)}</small></div>
      ))}
    </div>
  );
}

export default function Baustein({ name, raw }: { name: BausteinName; raw: string }) {
  if (name === "none" || name === "modell") return null;
  const d = safe<Record<string, never>>(raw);
  if (!d) return <p className="ik-warn">Die Grafikdaten waren nicht lesbar.</p>;
  switch (name) {
    case "timeline": return <Timeline d={d} />;
    case "pool": return <Pool d={d} />;
    case "teeth": return <Teeth d={d} />;
    case "bars": return <Bars d={d} />;
    case "steps": return <Steps d={d} />;
    case "cards": return <Cards d={d} />;
    default: return null;
  }
}
