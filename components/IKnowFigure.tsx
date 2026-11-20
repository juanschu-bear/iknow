import { useId, type ReactNode } from "react";

/** Die IKnow-Figur. Ihr Kopf ist der Rahmen, den man zieht; der Zustand folgt den Schritten von IKnow. */
export type FigureState = "idle" | "draw" | "ask" | "think" | "answer";
export type FigureColor = "uv" | "gr" | "bk";

type Palette = { name: string; pill: string; b1: string; b2: string; arm: string; frame: string; ink: string; h1: string; h2: string; h3: string; acc: string; sig: string; leg: string; foot: string; hand: string };

export const FIGURE_COLORS: Record<FigureColor, Palette> = {
  uv: { name: "Ultraviolett", pill: "#1b1147", b1: "#9a7dff", b2: "#3a1d9e", arm: "#6a4bf0", frame: "#5b3df0", ink: "#17123a", h1: "#ffffff", h2: "#efecff", h3: "#cbc3ff", acc: "#45e6ff", sig: "#ff7a1a", leg: "#2c1780", foot: "#17123a", hand: "#f1eeff" },
  gr: { name: "Graphit", pill: "#1b212b", b1: "#6b7686", b2: "#1b212b", arm: "#4a5464", frame: "#323b49", ink: "#12161c", h1: "#ffffff", h2: "#f1f4f7", h3: "#cfd7e1", acc: "#b6ff3c", sig: "#ff7a1a", leg: "#1b212b", foot: "#0c0f14", hand: "#f1f4f7" },
  bk: { name: "Schwarz & Gold", pill: "#0d0d12", b1: "#4a4a57", b2: "#0d0d12", arm: "#2c2c36", frame: "#1d1d25", ink: "#0b0b10", h1: "#ffffff", h2: "#f6f3ea", h3: "#e3dcc8", acc: "#ffc83d", sig: "#ff5a3c", leg: "#0d0d12", foot: "#000000", hand: "#f6f3ea" },
};

export const FIGURE_COLOR_KEYS = Object.keys(FIGURE_COLORS) as FigureColor[];
export const isFigureColor = (v: unknown): v is FigureColor => typeof v === "string" && Object.hasOwn(FIGURE_COLORS, v);

/** Schritt von IKnow → Haltung der Figur. Beim Diktieren hört sie zu, egal in welchem Schritt. */
export function figureStateOf(phase: "idle" | "draw" | "ask" | "thinking" | "answer", listening: boolean): FigureState {
  if (listening) return "ask";
  if (phase === "thinking") return "think";
  return phase;
}

type Pt = [number, number];
const LEFT: Record<FigureState, [Pt, Pt]> = {
  idle: [[48, 178], [54, 201]], draw: [[48, 178], [54, 201]], ask: [[48, 178], [54, 201]], think: [[44, 176], [70, 192]], answer: [[32, 152], [30, 119]],
};
const RIGHT: Record<FigureState, [Pt, Pt]> = {
  idle: [[192, 178], [186, 201]], draw: [[202, 152], [208, 122]], ask: [[204, 158], [200, 120]], think: [[190, 180], [160, 153]], answer: [[208, 152], [210, 119]],
};

export default function IKnowFigure({ state = "idle", color = "uv", className = "" }: { state?: FigureState; color?: FigureColor; className?: string }) {
  const P = FIGURE_COLORS[color];
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = (k: string) => `url(#${id}${k})`;

  const arm = (key: string, sh: Pt, el: Pt, fi: Pt, flex: boolean): ReactNode => {
    const mx = (sh[0] + el[0]) / 2, by = (sh[1] + el[1]) / 2 - (flex ? 9 : 2);
    return (
      <g key={key}>
        <path d={`M${sh[0]} ${sh[1]} L${el[0]} ${el[1]}`} fill="none" stroke={P.arm} strokeWidth="23" strokeLinecap="round" />
        <path d={`M${el[0]} ${el[1]} L${fi[0]} ${fi[1]}`} fill="none" stroke={P.arm} strokeWidth="17" strokeLinecap="round" />
        <ellipse cx={mx} cy={by} rx={flex ? 15 : 13} ry={flex ? 14 : 11.5} fill={g("m")} />
        <path d={`M${mx - 8} ${by - 4} q8 -7 15 -1`} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx={fi[0]} cy={fi[1]} r="12" fill={P.hand} stroke={P.frame} strokeWidth="3.2" />
      </g>
    );
  };
  const eye = (cx: number, dx = 0, dy = 0, rx = 11, ry = 15, blink = true): ReactNode => (
    <g key={"e" + cx} className={blink ? "ikf-blink" : undefined}>
      <ellipse cx={cx} cy="90" rx={rx} ry={ry} fill={P.ink} />
      <circle cx={cx + 4 + dx} cy={84 + dy} r="4.2" fill="#fff" />
      <circle cx={cx - 4 + dx} cy={96 + dy} r="1.9" fill="#fff" opacity=".8" />
    </g>
  );
  const brow = (d: string) => <path key={d} d={d} fill="none" stroke={P.ink} strokeWidth="4.2" strokeLinecap="round" />;
  const mouth = (d: string) => <path d={d} fill="none" stroke={P.ink} strokeWidth="4.6" strokeLinecap="round" />;
  const LS: Pt = [62, 154], RS: Pt = [178, 154];
  const flex = state === "answer";

  return (
    <svg className={"ikf " + className} viewBox="-14 -6 268 268" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id + "h"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.h1} /><stop offset=".55" stopColor={P.h2} /><stop offset="1" stopColor={P.h3} /></linearGradient>
        <linearGradient id={id + "b"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={P.b1} /><stop offset="1" stopColor={P.b2} /></linearGradient>
        <radialGradient id={id + "m"} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor={P.b1} /><stop offset="1" stopColor={P.arm} /></radialGradient>
        <radialGradient id={id + "g"} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={P.sig} stopOpacity=".6" /><stop offset="1" stopColor={P.sig} stopOpacity="0" /></radialGradient>
        <radialGradient id={id + "a"} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={P.acc} stopOpacity=".7" /><stop offset="1" stopColor={P.acc} stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse className="ikf-shadow" cx="120" cy="247" rx="60" ry="9.5" fill="#0a0620" opacity=".28" />
      <g className="ikf-bob">
        {arm("l", LS, ...LEFT[state], flex)}
        {state !== "think" && <g className={state === "idle" ? "ikf-hello" : undefined}>{arm("r", RS, ...RIGHT[state], flex || state === "draw")}</g>}
        <rect x="89" y="200" width="23" height="36" rx="11" fill={P.leg} /><rect x="128" y="200" width="23" height="36" rx="11" fill={P.leg} />
        <ellipse cx="98" cy="238" rx="18" ry="9" fill={P.foot} /><ellipse cx="142" cy="238" rx="18" ry="9" fill={P.foot} />
        <path d="M66 152 Q66 138 82 138 L158 138 Q174 138 174 152 L156 204 Q154 212 145 212 L95 212 Q86 212 84 204 Z" fill={g("b")} />
        <circle cx="64" cy="153" r="16" fill={g("m")} /><circle cx="176" cy="153" r="16" fill={g("m")} />
        <path d="M92 158 Q106 172 120 160 Q134 172 148 158" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 164 V176" stroke="#fff" strokeOpacity=".16" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="120" cy="188" r="15" fill={g("a")} className={state === "think" || state === "answer" ? "ikf-pulse" : undefined} />
        <circle cx="120" cy="180" r="3.9" fill={P.acc} /><rect x="116.6" y="186" width="6.8" height="15" rx="3.4" fill={P.acc} />
        <line x1="120" y1="36" x2="120" y2="22" stroke={P.frame} strokeWidth="7" strokeLinecap="round" />
        {state === "answer"
          ? <><circle cx="120" cy="9" r="16" fill={g("g")} className="ikf-pulse" /><circle cx="120" cy="9" r="7.5" fill={P.sig} /></>
          : <circle cx="120" cy="9" r="7.5" fill={P.acc} className={state === "think" ? "ikf-pulse" : undefined} />}
        <rect x="48" y="36" width="144" height="110" rx="40" fill={g("h")} />
        <rect className={state === "draw" ? "ikf-march" : undefined} x="48" y="36" width="144" height="110" rx="40" fill="none" stroke={P.frame} strokeWidth="9"
          strokeDasharray={state === "draw" ? "17 12" : undefined} strokeLinecap={state === "draw" ? "round" : undefined} />
        <ellipse cx="92" cy="58" rx="26" ry="9" fill="#fff" opacity=".85" transform="rotate(-14 92 58)" />
        <circle cx="76" cy="112" r="8.5" fill="#ff9fb8" opacity=".5" /><circle cx="164" cy="112" r="8.5" fill="#ff9fb8" opacity=".5" />
        {state === "idle" && <><g className="ikf-look">{eye(96)}{eye(144)}</g>{mouth("M108 114 Q120 124 132 114")}</>}
        {state === "draw" && <>{eye(96, 3, -2, 11, 15, false)}{eye(144, 3, -2, 11, 15, false)}{brow("M86 70 Q96 67 106 71")}{brow("M134 71 Q144 66 154 68")}{mouth("M110 115 Q122 122 132 113")}</>}
        {state === "ask" && <>{eye(96, 0, 0, 12, 17)}{eye(144, 0, 0, 12, 17)}{brow("M84 66 Q96 60 108 65")}{brow("M132 65 Q144 60 156 66")}<ellipse cx="120" cy="118" rx="5.5" ry="6.5" fill={P.ink} /></>}
        {state === "think" && <>{eye(96, -5, -4, 11, 15, false)}{eye(144, -5, -4, 11, 15, false)}{brow("M84 73 L106 70")}{brow("M134 66 L156 70")}{mouth("M110 118 L130 115")}</>}
        {state === "answer" && <>
          <path d="M84 94 Q96 76 108 94" fill="none" stroke={P.ink} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M132 94 Q144 76 156 94" fill="none" stroke={P.ink} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M104 108 Q120 132 136 108 Z" fill={P.ink} /><path d="M111 119 Q120 127 129 119 Q120 115 111 119Z" fill="#ff8fa8" />
        </>}
        {state === "think" && arm("rf", RS, ...RIGHT.think, false)}
        {state === "draw" && <>
          <g transform="rotate(38 208 122)"><rect x="203" y="86" width="10" height="38" rx="4" fill={P.ink} /><path d="M203 86 h10 l-5 -11z" fill={P.sig} /></g>
          <circle cx="236" cy="84" r="13" fill={g("g")} className="ikf-pulse" />
          <path className="ikf-march" d="M235 82 C250 50 238 18 202 20" fill="none" stroke={P.sig} strokeWidth="4.5" strokeDasharray="9 8" strokeLinecap="round" />
        </>}
        {state === "ask" && ([[220, 16], [230, 30], [240, 20], [250, 10]] as Pt[]).map(([x, h], i) => (
          <rect key={x} className={"ikf-wave ikf-w" + i} x={x - 3} y={96 - h / 2} width="6" height={h} rx="3" fill={P.acc} stroke={P.frame} strokeWidth="1" />
        ))}
        {state === "think" && ([[178, 24], [196, 16], [214, 24]] as Pt[]).map(([x, y], i) => (
          <circle key={x} className={"ikf-dot ikf-d" + i} cx={x} cy={y} r="6" fill={P.frame} />
        ))}
        {state === "answer" && <>
          <g className="ikf-pop">
            <rect x="150" y="-2" width="58" height="50" rx="11" fill="#fff" stroke={P.frame} strokeWidth="3" />
            <rect x="160" y="26" width="9" height="13" rx="2.5" fill={P.h3} /><rect x="174" y="18" width="9" height="21" rx="2.5" fill={P.frame} /><rect x="188" y="8" width="9" height="31" rx="2.5" fill={P.sig} />
          </g>
          <path className="ikf-pulse" d="M70 6 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill={P.sig} />
        </>}
      </g>
    </svg>
  );
}
