/**
 * Kiefer-Szene für IKnow: Das Modell schickt nur Befehle (@do {"cmd":...}), IKnow führt sie aus.
 * Alles ist ein Schema am Mustermodell, nie die Zahnstellung eines Patienten.
 * Kein vom Modell geschriebener Code läuft hier: jeder Befehl wird geprüft und auf feste Bewegungen abgebildet.
 */
export type JawKey = "OK" | "UK";
export type Pose = { dx: number; dz: number; dy: number; rot: number; tilt: number; hide: boolean };
export type Part = "br" | "band" | "attachment" | "ret";
export interface Arrow { fdi: string; dir: string; text: string; born: number }
export interface Label { at: string; text: string; born: number }
export interface Elastic { from: string; to: string; born: number }

export interface JawState {
  show: "OK" | "UK" | "both";
  pose: Record<string, Pose>;
  parts: Record<string, Partial<Record<Part, boolean>>>;
  wire: Record<JawKey, { on: boolean; radius: number; progress: number }>;
  aligner: Record<JawKey, boolean>;
  marks: Record<string, "teal" | "orange">;
  arrows: Arrow[];
  labels: Label[];
  elastics: Elastic[];
}

export const ARCH: Record<JawKey, string[]> = {
  OK: ["17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27"],
  UK: ["47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37"],
};
const FRONT = (j: JawKey) => ARCH[j].filter((t) => Number(t[1]) <= 3);
const SIDE = (j: JawKey) => ARCH[j].filter((t) => Number(t[1]) >= 4);
const jawOf = (t: string): JawKey => (Number(t[0]) <= 2 ? "OK" : "UK");
const isTooth = (t: unknown): t is string => typeof t === "string" && /^[1-4][1-7]$/.test(t);
const zero = (): Pose => ({ dx: 0, dz: 0, dy: 0, rot: 0, tilt: 0, hide: false });

export function emptyState(): JawState {
  return {
    show: "both", pose: {}, parts: {}, marks: {}, arrows: [], labels: [], elastics: [],
    wire: { OK: { on: false, radius: 0.011, progress: 0 }, UK: { on: false, radius: 0.011, progress: 0 } },
    aligner: { OK: false, UK: false },
  };
}

/** Daten für das Kiefermodell (IKnowJaw.mountModel / setFacts). */
export function toModelData(s: JawState) {
  const jaw = (j: JawKey) => {
    const teeth: Record<string, Record<string, { state: string; ev: string }>> = {};
    for (const [t, ps] of Object.entries(s.parts)) {
      if (jawOf(t) !== j) continue;
      for (const [p, on] of Object.entries(ps)) if (on) (teeth[t] ??= {})[p] = { state: "erfasst", ev: "iknow" };
    }
    const pose: Record<string, Pose> = {};
    for (const [t, p] of Object.entries(s.pose)) if (jawOf(t) === j) pose[t] = p;
    const marks: Record<string, string> = {};
    for (const [t, c] of Object.entries(s.marks)) if (jawOf(t) === j) marks[t] = c;
    const w = s.wire[j];
    return { teeth, pose, marks, aligner: s.aligner[j], wire: w.on ? { state: "erfasst", material: "Edelstahl", radius: w.radius, progress: w.progress, ev: "iknow" } : undefined };
  };
  return { show: s.show, jaws: { OK: jaw("OK"), UK: jaw("UK") } };
}

/* ---------- Befehle ---------- */
export type Cmd = Record<string, unknown> & { cmd: string };

/* Blickwinkel je Kiefer: den Oberkiefer sieht man leicht von unten (Zähne zeigen nach unten), den Unterkiefer von oben */
const VIEWS: Record<string, Record<"OK" | "UK" | "both", { yaw: number; pitch: number }>> = {
  front: { OK: { yaw: 0, pitch: -0.14 }, UK: { yaw: 0, pitch: 0.34 }, both: { yaw: 0, pitch: 0.12 } },
  schraeg: { OK: { yaw: 0.42, pitch: -0.02 }, UK: { yaw: 0.42, pitch: 0.48 }, both: { yaw: 0.36, pitch: 0.32 } },
  links: { OK: { yaw: -0.95, pitch: -0.06 }, UK: { yaw: -0.95, pitch: 0.36 }, both: { yaw: -0.95, pitch: 0.22 } },
  rechts: { OK: { yaw: 0.95, pitch: -0.06 }, UK: { yaw: 0.95, pitch: 0.36 }, both: { yaw: 0.95, pitch: 0.22 } },
  oben: { OK: { yaw: 0.05, pitch: -0.9 }, UK: { yaw: 0.05, pitch: 1.05 }, both: { yaw: 0.05, pitch: 1.0 } },
  unten: { OK: { yaw: 0.05, pitch: -0.9 }, UK: { yaw: 0.05, pitch: 0.2 }, both: { yaw: 0.05, pitch: 0.12 } },
};

function teethOf(c: Cmd, fallbackJaw: JawKey = "OK"): string[] {
  if (Array.isArray(c.zaehne)) return (c.zaehne as unknown[]).filter(isTooth);
  if (isTooth(c.zahn)) return [c.zahn];
  const jaws: JawKey[] = c.kiefer === "beide" ? ["OK", "UK"] : c.kiefer === "UK" ? ["UK"] : c.kiefer === "OK" ? ["OK"] : [fallbackJaw];
  if (isTooth(c.von) && isTooth(c.bis) && jawOf(c.von) === jawOf(c.bis)) {
    const a = ARCH[jawOf(c.von)], i = a.indexOf(c.von), k = a.indexOf(c.bis);
    return a.slice(Math.min(i, k), Math.max(i, k) + 1);
  }
  const area = c.bereich === "front" ? FRONT : c.bereich === "seite" ? SIDE : (j: JawKey) => ARCH[j];
  return jaws.flatMap(area);
}

/* fest vorgegebenes Muster für einen Engstand: verdreht, nach innen und außen versetzt, überlappend */
const CROWD: Record<string, Partial<Pose>> = {
  "1": { rot: 0.5, dz: 0.08, dx: 0.02, dy: 0.02 }, "2": { rot: -0.6, dz: -0.09, dx: -0.035, dy: -0.035 }, "3": { rot: 0.36, dz: 0.1, dx: -0.045, dy: 0.03 },
  "4": { rot: -0.18, dz: -0.03, dx: 0.0 }, "5": { rot: 0.15, dz: 0.02, dx: 0.0 }, "6": { rot: 0.06, dz: 0, dx: 0 }, "7": { rot: -0.05, dz: 0, dx: 0 },
};

export interface Step { kind: "pose"; fdi: string; to: Partial<Pose>; delay: number; dur: number }
export interface Plan {
  steps: Step[];
  apply?: (s: JawState, now: number) => void;      // sofortige Änderungen
  timed?: { at: number; fn: (s: JawState, now: number) => void }[];
  wire?: { jaw: JawKey; to: number; dur: number; delay: number };
  camera?: { yaw?: number; pitch?: number; zoom?: number; focusTooth?: string; focusJaw?: JawKey | "both" };
  total: number;
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const txt = (v: unknown, n = 40) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Übersetzt einen Befehl in einen Ablauf. Unbekannte Befehle werden ignoriert. */
export function plan(c: Cmd, s: JawState): Plan | null {
  const strong = c.staerke === "leicht" ? 0.5 : 1;
  switch (c.cmd) {
    case "kiefer": {
      const show = c.kiefer === "OK" ? "OK" : c.kiefer === "UK" ? "UK" : "both";
      return { steps: [], apply: (st) => { st.show = show; }, camera: { ...VIEWS.schraeg[show], focusJaw: show, zoom: show === "both" ? 1 : 1.5 }, total: 700 };
    }
    case "kamera": {
      const v = (VIEWS[String(c.ansicht ?? "schraeg")] ?? VIEWS.schraeg)[s.show];
      const near = isTooth(c.nah) ? c.nah : undefined;
      return { steps: [], camera: { ...v, zoom: near ? 2.4 : num(c.zoom, s.show === "both" ? 1 : c.ansicht === "oben" || c.ansicht === "unten" ? 1.2 : 1.5), focusTooth: near, focusJaw: near ? undefined : s.show }, total: 1100 };
    }
    case "engstand": {
      const list = teethOf({ ...c, bereich: c.bereich ?? "front" }, s.show === "UK" ? "UK" : "OK");
      return {
        steps: list.map((t, i) => {
          const p = CROWD[t[1]] ?? {}, sign = Number(t[0]) % 2 === 0 ? -1 : 1;
          return { kind: "pose" as const, fdi: t, to: { rot: (p.rot ?? 0) * strong * sign, dz: (p.dz ?? 0) * strong, dx: (p.dx ?? 0) * strong * sign, dy: (p.dy ?? 0) * strong }, delay: i * 70, dur: 900 };
        }),
        total: list.length * 70 + 900,
      };
    }
    case "luecke": {
      const z = Array.isArray(c.zwischen) ? (c.zwischen as unknown[]).filter(isTooth) : [];
      if (z.length !== 2 || jawOf(z[0]) !== jawOf(z[1])) return null;
      const a = ARCH[jawOf(z[0])], i = Math.min(a.indexOf(z[0]), a.indexOf(z[1]));
      const g = c.groesse === "klein" ? 0.035 : 0.07;
      const steps: Step[] = a.map((t, k) => ({ kind: "pose" as const, fdi: t, to: { dx: k <= i ? -g * (1 - (i - k) * 0.12) : g * (1 - (k - i - 1) * 0.12) }, delay: 0, dur: 1100 }));
      return { steps, total: 1100 };
    }
    case "zahn": {
      if (!isTooth(c.zahn)) return null;
      const b = String(c.bewegung ?? ""), k = strong;
      const to: Partial<Pose> = b === "kippen" ? { tilt: 0.45 * k } : b === "drehen" ? { rot: 0.55 * k } : b === "vor" || b === "aussen" ? { dz: 0.08 * k } : b === "zurueck" || b === "innen" ? { dz: -0.08 * k } : b === "links" ? { dx: -0.06 * k } : b === "rechts" ? { dx: 0.06 * k } : {};
      return { steps: [{ kind: "pose", fdi: c.zahn, to, delay: 0, dur: 1000 }], total: 1000 };
    }
    case "fehlt": {
      const list = teethOf(c);
      return { steps: [], apply: (st) => list.forEach((t) => { st.pose[t] = { ...(st.pose[t] ?? zero()), hide: true }; }), total: 400 };
    }
    case "einreihen": {
      const jaws: JawKey[] = c.kiefer === "OK" ? ["OK"] : c.kiefer === "UK" ? ["UK"] : ["OK", "UK"];
      const list = Object.keys(s.pose).filter((t) => jaws.includes(jawOf(t)) && !s.pose[t].hide);
      const dur = Math.min(8000, Math.max(1200, num(c.dauer, 3) * 1000));
      const stages = Math.max(1, Math.min(5, Math.round(num(c.schritte, 1))));
      const steps: Step[] = [];
      for (const t of list) {
        const p = s.pose[t];
        for (let k = 1; k <= stages; k++) {
          const f = 1 - k / stages;
          steps.push({ kind: "pose", fdi: t, to: { dx: p.dx * f, dz: p.dz * f, dy: p.dy * f, rot: p.rot * f, tilt: p.tilt * f }, delay: (k - 1) * (dur / stages), dur: (dur / stages) * (stages > 1 ? 0.7 : 1) });
        }
      }
      return { steps, total: dur };
    }
    case "brackets":
    case "attachments":
    case "baender":
    case "retainer": {
      const part: Part = c.cmd === "brackets" ? "br" : c.cmd === "attachments" ? "attachment" : c.cmd === "baender" ? "band" : "ret";
      let list = teethOf(c, s.show === "UK" ? "UK" : "OK");
      if (part === "br" && !Array.isArray(c.zaehne) && !isTooth(c.von)) list = list.filter((t) => Number(t[1]) <= 5 || !s.parts[t]?.band);
      if (part === "band" && !Array.isArray(c.zaehne)) list = list.filter((t) => t[1] === "6");
      if (part === "ret" && !Array.isArray(c.zaehne) && !isTooth(c.von)) list = list.filter((t) => Number(t[1]) <= 3);
      return { steps: [], timed: list.map((t, i) => ({ at: i * 90, fn: (st: JawState) => { st.parts[t] = { ...(st.parts[t] ?? {}), [part]: true }; } })), total: list.length * 90 + 300 };
    }
    case "draht": {
      const jaws: JawKey[] = c.kiefer === "beide" ? ["OK", "UK"] : c.kiefer === "UK" ? ["UK"] : ["OK"];
      const radius = c.art === "dick" ? 0.016 : 0.009;
      return {
        steps: [], total: 1600,
        apply: (st) => jaws.forEach((j) => { st.wire[j] = { on: true, radius, progress: 0 }; }),
        timed: jaws.slice(1).map((j) => ({ at: 0, fn: (st: JawState) => { st.wire[j].progress = 0.001; } })),
        wire: { jaw: jaws[0], to: 1, dur: 1500, delay: 0 },
      };
    }
    case "gummizug": {
      if (!isTooth(c.von) || !isTooth(c.bis)) return null;
      const from = c.von, to = c.bis;
      return { steps: [], apply: (st, now) => { st.elastics.push({ from, to, born: now }); }, total: 700 };
    }
    case "schiene": {
      const jaws: JawKey[] = c.kiefer === "beide" ? ["OK", "UK"] : c.kiefer === "UK" ? ["UK"] : ["OK"];
      const on = c.an !== false;
      return { steps: [], apply: (st) => jaws.forEach((j) => { st.aligner[j] = on; }), total: 700 };
    }
    case "entfernen": {
      const w = String(c.was ?? "alles");
      return {
        steps: [], total: 900,
        apply: (st) => {
          for (const t of Object.keys(st.parts)) {
            const p = st.parts[t];
            if (w === "alles" || w === "brackets") { delete p.br; delete p.band; }
            if (w === "alles" || w === "attachments") delete p.attachment;
            if (w === "retainer") delete p.ret;
          }
          if (w === "alles" || w === "brackets" || w === "draht") { st.wire.OK.on = false; st.wire.UK.on = false; }
          if (w === "alles" || w === "schiene") { st.aligner.OK = false; st.aligner.UK = false; }
          if (w === "alles") st.elastics = [];
        },
      };
    }
    case "markiere": {
      const list = teethOf(c, s.show === "UK" ? "UK" : "OK");
      const col = c.farbe === "orange" ? "orange" : "teal";
      return { steps: [], timed: list.map((t, i) => ({ at: i * 50, fn: (st: JawState) => { st.marks[t] = col; } })), total: list.length * 50 + 300 };
    }
    case "pfeil": {
      if (!isTooth(c.zahn)) return null;
      const fdi = c.zahn, dir = ["innen", "aussen", "links", "rechts", "hoch", "runter"].includes(String(c.richtung)) ? String(c.richtung) : "innen";
      return { steps: [], apply: (st, now) => { st.arrows = [...st.arrows.slice(-3), { fdi, dir, text: txt(c.text), born: now }]; }, total: 800 };
    }
    case "schild": {
      const at = isTooth(c.zahn) ? c.zahn : c.kiefer === "UK" ? "UK" : "OK";
      const text = txt(c.text);
      if (!text) return null;
      return { steps: [], apply: (st, now) => { st.labels = [...st.labels.slice(-3), { at, text, born: now }]; }, total: 600 };
    }
    case "leeren":
      return { steps: [], apply: (st) => { st.arrows = []; st.labels = []; st.marks = {}; }, total: 300 };
    default:
      return null;
  }
}

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export { zero, jawOf, isTooth };
