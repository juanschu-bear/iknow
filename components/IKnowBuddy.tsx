"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import IKnowFigure, { figureStateOf, type FigureColor, type FigureState } from "./IKnowFigure";

/** Die Figur als Knopf: steht frei, klappt den Knopf beim Draufzeigen auf, lässt sich verschieben. */
export type BuddyPos = { r: number; b: number };
export const BUDDY_HOME: BuddyPos = { r: 22, b: 22 };
const POS_KEY = "iknow-figur-platz";
const EDGE = 8;

/** Hält die Figur im sichtbaren Bereich. r und b sind die Abstände zum rechten und unteren Rand. */
export function clampBuddy(p: BuddyPos, vw: number, vh: number, w: number, h: number): BuddyPos {
  const fit = (v: number, max: number) => Math.round(Math.min(Math.max(v, EDGE), Math.max(EDGE, max)));
  return { r: fit(p.r, vw - w - EDGE), b: fit(p.b, vh - h - EDGE) };
}
export function isBuddyPos(v: unknown): v is BuddyPos {
  const p = v as BuddyPos | null;
  return !!p && typeof p === "object" && Number.isFinite(p.r) && Number.isFinite(p.b);
}
/** Im Ruhezustand klappt er beim Draufzeigen den Laptop auf; sonst folgt er dem Schritt von IKnow. */
export function buddyState(phase: Parameters<typeof figureStateOf>[0], listening: boolean, pointed: boolean): FigureState {
  const base = figureStateOf(phase, listening);
  return base === "idle" && pointed ? "laptop" : base;
}

const fixedPlace = () => typeof matchMedia !== "undefined" && matchMedia("(hover: none), (max-width: 640px)").matches;

export default function IKnowBuddy({ phase, listening, color, title, cancel, hint, label, onActivate }: {
  phase: Parameters<typeof figureStateOf>[0]; listening: boolean; color: FigureColor;
  title: string; cancel: string; hint: string; label: string; onActivate: () => void;
}) {
  const [pos, setPos] = useState<BuddyPos>(BUDDY_HOME);
  const [dragging, setDragging] = useState(false);
  const [walking, setWalking] = useState(false);
  const [pointed, setPointed] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const grab = useRef<{ x: number; y: number; r: number; b: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);

  const fit = useCallback((p: BuddyPos) => {
    const el = box.current;
    if (!el) return p;
    const size = el.getBoundingClientRect();
    return clampBuddy(p, window.innerWidth, window.innerHeight, size.width, size.height);
  }, []);
  const store = (p: BuddyPos) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ohne Speicher weiter */ } };

  useEffect(() => {
    if (fixedPlace()) return;
    try { const saved: unknown = JSON.parse(localStorage.getItem(POS_KEY) ?? "null"); if (isBuddyPos(saved)) setPos(fit(saved)); } catch { /* ohne Speicher weiter */ }
  }, [fit]);
  useEffect(() => {
    const onResize = () => setPos((p) => (fixedPlace() ? BUDDY_HOME : fit(p)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fit]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 5000);
    return () => clearTimeout(t);
  }, [open]);

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (fixedPlace() || e.button !== 0) return;
    grab.current = { x: e.clientX, y: e.clientY, r: pos.r, b: pos.b, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = grab.current;
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    setDragging(true);
    setPos(fit({ r: g.r - dx, b: g.b - dy }));
  };
  const up = () => {
    const g = grab.current;
    grab.current = null;
    if (!g?.moved) return;
    skipClick.current = true;
    setTimeout(() => { skipClick.current = false; }, 60);
    setDragging(false);
    setPos((p) => { store(p); return p; });
  };
  const act = () => {
    if (fixedPlace() && phase === "idle" && !open) { setOpen(true); return; }
    setOpen(false);
    onActivate();
  };
  // Ein Doppelklick schickt ihn nach Hause; deshalb wartet der einfache Klick kurz ab.
  const click = () => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (fixedPlace()) { act(); return; }
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { pending.current = null; act(); }, 240);
  };
  const goHome = () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    if (fixedPlace()) return;
    setWalking(true);
    setPos(BUDDY_HOME);
    store(BUDDY_HOME);
    setTimeout(() => setWalking(false), 750);
  };

  const shown = open || phase !== "idle";
  return (
    <div ref={box} className={"ik-buddy" + (shown ? " show" : "") + (dragging ? " drag" : "") + (walking ? " walk" : "")}
      style={{ right: pos.r, bottom: pos.b }} onMouseOver={() => setPointed(true)} onMouseOut={(e) => { if (!box.current?.contains(e.relatedTarget as Node | null)) setPointed(false); }}>
      <button type="button" className="ik-buddy-fig" aria-label={label} title={label}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} onDoubleClick={goHome}>
        <IKnowFigure state={buddyState(phase, listening, (pointed || open) && !dragging)} color={color} walking={dragging || walking} />
      </button>
      <button type="button" className={"ik-fab" + (phase !== "idle" ? " on" : "")} onClick={() => { setOpen(false); onActivate(); }}>
        <span>{phase === "idle" ? title : cancel}<small>{hint}</small></span>
      </button>
    </div>
  );
}
