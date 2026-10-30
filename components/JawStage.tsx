"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ease, emptyState, plan, toModelData, zero, type Cmd, type JawState, type Pose } from "@/lib/jawLesson";

/**
 * Bühne für Kiefer-Erklärungen: das Leitstand-Kiefermodell (eigene IKnow-Kopie unter /jaw/jaw.js)
 * plus eine Zeichenebene für Pfeile, Schilder und Gummizüge. Befehle kommen geprüft aus lib/jawLesson.
 */
type View = {
  setFacts: (d: unknown) => void; setCamera: (c: { yaw?: number; pitch?: number; zoom?: number; focus?: number[] }) => void;
  anchor3d: (k: string) => number[] | null; gap: () => number; redraw: () => void; destroy: () => void;
};
type Proj = { x: number; y: number } | null;
type Helpers = { anchor: (k: string) => Proj; W: number; H: number; now: number };
declare global { interface Window { IKnowJaw?: { mountModel: (c: HTMLCanvasElement, d: unknown, o: unknown) => View } } }

export type JawHandle = { run: (c: Cmd) => Promise<void> };

let loader: Promise<void> | null = null;
function loadEngine(): Promise<void> {
  if (window.IKnowJaw) return Promise.resolve();
  if (!loader) {
    loader = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "/jaw/jaw.js"; s.async = true;
      s.onload = () => (window.IKnowJaw ? res() : rej(new Error("Kiefermodell fehlt")));
      s.onerror = () => rej(new Error("Kiefermodell konnte nicht geladen werden"));
      document.head.appendChild(s);
    });
    loader.catch(() => { loader = null; });
  }
  return loader;
}

const ORANGE = "#EA7A3C", INK = "#10242A";
const pill = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, a: number) => {
  ctx.save(); ctx.globalAlpha = a; ctx.font = "700 11.5px system-ui, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 20, h = 22;
  ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 11); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke(); ctx.fillStyle = color; ctx.fillText(text, x, y + 0.5); ctx.restore();
};

const JawStage = forwardRef<JawHandle, { height?: number }>(function JawStage({ height = 340 }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View | null>(null);
  const st = useRef<JawState>(emptyState());
  const anim = useRef<{ tweens: { fdi: string; from: Pose; to: Pose; t0: number; dur: number }[]; timed: { at: number; fn: (s: JawState, now: number) => void }[]; wire: { jaw: "OK" | "UK"; from: number; to: number; t0: number; dur: number } | null; raf: number }>({ tweens: [], timed: [], wire: null, raf: 0 });
  const ready = useRef<Promise<void> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    ready.current = loadEngine().then(() => {
      if (off || !canvas.current || !window.IKnowJaw) return;
      view.current = window.IKnowJaw.mountModel(canvas.current, toModelData(st.current), { overlay: drawOverlay });
    });
    ready.current.catch((e) => setFailed(e instanceof Error ? e.message : "Fehler"));
    return () => { off = true; cancelAnimationFrame(anim.current.raf); view.current?.destroy(); view.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function drawOverlay(ctx: CanvasRenderingContext2D, _cam: unknown, h: Helpers): boolean {
    const s = st.current, now = h.now; let busy = false;
    const grow = (born: number, d = 700) => { const t = Math.min(1, (now - born) / d); if (t < 1) busy = true; return ease(t); };
    // Gummizüge
    for (const e of s.elastics) {
      const a = h.anchor("t:" + e.from), b = h.anchor("t:" + e.to); if (!a || !b) continue;
      const k = grow(e.born);
      const bx = a.x + (b.x - a.x) * k, by = a.y + (b.y - a.y) * k;
      ctx.save(); ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + bx) / 2 + 8, (a.y + by) / 2, bx, by); ctx.stroke();
      [a, { x: bx, y: by }].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke(); });
      ctx.restore();
    }
    // Pfeile: vom Zahn weg in Bewegungsrichtung
    const c1 = h.anchor("t:16") ?? h.anchor("t:46"), c2 = h.anchor("t:26") ?? h.anchor("t:36"), c3 = h.anchor("t:11") ?? h.anchor("t:41");
    const inner = c1 && c2 && c3 ? { x: (c1.x + c2.x) / 2 * 0.6 + c3.x * 0.4, y: (c1.y + c2.y) / 2 * 0.6 + c3.y * 0.4 } : null;
    for (const ar of s.arrows) {
      const p = h.anchor("t:" + ar.fdi); if (!p) continue;
      let d = { x: 0, y: -1 };
      if (ar.dir === "runter") d = { x: 0, y: 1 }; else if (ar.dir === "links") d = { x: -1, y: 0 }; else if (ar.dir === "rechts") d = { x: 1, y: 0 };
      else if ((ar.dir === "aussen" || ar.dir === "innen") && inner) { const vx = p.x - inner.x, vy = p.y - inner.y, l = Math.hypot(vx, vy) || 1; d = ar.dir === "aussen" ? { x: vx / l, y: vy / l } : { x: -vx / l, y: -vy / l }; }
      const k = grow(ar.born, 800), len = 58 * k;
      const sx = p.x + d.x * 10, sy = p.y + d.y * 10, ex = sx + d.x * len, ey = sy + d.y * len;
      ctx.save(); ctx.strokeStyle = ORANGE; ctx.fillStyle = ORANGE; ctx.lineWidth = 3.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      if (k > 0.3) { const ang = Math.atan2(d.y, d.x); ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * 7, ey + Math.sin(ang) * 7); ctx.lineTo(ex + Math.cos(ang + 2.5) * 9, ey + Math.sin(ang + 2.5) * 9); ctx.lineTo(ex + Math.cos(ang - 2.5) * 9, ey + Math.sin(ang - 2.5) * 9); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      if (ar.text && k > 0.6) pill(ctx, ex + d.x * 18 + (Math.abs(d.x) > 0.5 ? Math.sign(d.x) * 30 : 0), ey + d.y * 18, ar.text, "#9A3412", (k - 0.6) / 0.4);
    }
    // Schilder mit Linie
    s.labels.forEach((lb, i) => {
      const p = /^[1-4][1-7]$/.test(lb.at) ? h.anchor("tip:" + lb.at) : h.anchor(lb.at === "UK" ? "t:41" : "t:11"); if (!p) return;
      const k = grow(lb.born, 500);
      // Oberkiefer: Zähne zeigen nach unten, Schild darunter; Unterkiefer: Schild darüber
      const down = /^[12]/.test(lb.at) || lb.at === "OK";
      const left = p.x > h.W / 2 ? -1 : 1, lx = p.x + left * (40 + i * 6), ly = down ? p.y + 46 + i * 30 : p.y - 46 - i * 30;
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = "rgba(16,36,42,.45)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lx, ly + (down ? -11 : 11)); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); ctx.restore();
      pill(ctx, lx, ly, lb.text, "#0B5761", k);
    });
    return busy;
  }

  function frame() {
    const a = anim.current, now = performance.now(), s = st.current;
    let active = false;
    a.timed = a.timed.filter((t) => { if (now >= t.at) { t.fn(s, now); return false; } active = true; return true; });
    a.tweens = a.tweens.filter((tw) => {
      const t = Math.min(1, Math.max(0, (now - tw.t0) / tw.dur));
      if (now < tw.t0) { active = true; return true; }
      const e = ease(t), cur = s.pose[tw.fdi] ?? zero();
      s.pose[tw.fdi] = { ...cur, dy: tw.from.dy + (tw.to.dy - tw.from.dy) * e, dx: tw.from.dx + (tw.to.dx - tw.from.dx) * e, dz: tw.from.dz + (tw.to.dz - tw.from.dz) * e, rot: tw.from.rot + (tw.to.rot - tw.from.rot) * e, tilt: tw.from.tilt + (tw.to.tilt - tw.from.tilt) * e };
      if (t < 1) { active = true; return true; }
      return false;
    });
    if (a.wire) {
      const t = Math.min(1, Math.max(0, (now - a.wire.t0) / a.wire.dur));
      const v = a.wire.from + (a.wire.to - a.wire.from) * ease(t);
      s.wire[a.wire.jaw].progress = v;
      for (const j of ["OK", "UK"] as const) if (j !== a.wire.jaw && s.wire[j].on && s.wire[j].progress > 0 && s.wire[j].progress < 1) s.wire[j].progress = v;
      if (t < 1) active = true; else a.wire = null;
    }
    view.current?.setFacts(toModelData(s));
    a.raf = active ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!anim.current.raf) anim.current.raf = requestAnimationFrame(frame); };

  useImperativeHandle(ref, () => ({
    async run(c: Cmd) {
      try { await ready.current; } catch { return; }
      const v = view.current, s = st.current; if (!v) return;
      const p = plan(c, s); if (!p) return;
      const now = performance.now(), a = anim.current;
      p.apply?.(s, now);
      for (const t of p.timed ?? []) a.timed.push({ at: now + t.at, fn: t.fn });
      for (const step of p.steps) {
        // Bewegungen desselben Zahns hintereinander: Startwert ist der Zielwert der vorigen
        const prev = [...a.tweens].reverse().find((t) => t.fdi === step.fdi);
        const from = prev ? prev.to : { ...(s.pose[step.fdi] ?? zero()) };
        a.tweens.push({ fdi: step.fdi, from, to: { ...from, ...step.to, hide: from.hide }, t0: now + step.delay, dur: step.dur });
      }
      if (p.wire) a.wire = { jaw: p.wire.jaw, from: s.wire[p.wire.jaw].progress, to: p.wire.to, t0: now + p.wire.delay, dur: p.wire.dur };
      if (p.camera) {
        const cam = p.camera, g = v.gap();
        let focus: number[] | undefined;
        if (cam.focusTooth) { v.setFacts(toModelData(s)); focus = v.anchor3d("t:" + cam.focusTooth) ?? undefined; }
        else if (cam.focusJaw === "OK") focus = [0, g - 0.08, 0.25];
        else if (cam.focusJaw === "UK") focus = [0, -g + 0.08, 0.25];
        else if (cam.focusJaw === "both") focus = [0, 0, 0];
        v.setCamera({ yaw: cam.yaw, pitch: cam.pitch, zoom: cam.zoom, focus });
      }
      kick();
      await new Promise((r) => setTimeout(r, Math.min(9000, p.total)));
    },
  }), []);

  return (
    <div className="ik-jaw" style={{ height }}>
      <canvas ref={canvas} aria-label="Schematisches Kiefermodell für die Erklärung" />
      <span className="ik-jaw-tag">Schema, kein Patientenmodell</span>
      {failed && <div className="ik-jaw-fail">{failed}</div>}
    </div>
  );
});

export default JawStage;
