"use client";

import { useEffect, useRef, useState } from "react";
import Baustein from "./Bausteine";
import { sanitizeSvgLine } from "@/lib/sanitize";
import { speak, stopSpeaking } from "@/lib/voice";
import type { AnswerMeta, BausteinName } from "@/lib/types";

/** Zeilen-Zufuhr einer Antwort. Lab schiebt jede fertige Zeile hinein, LiveAnswer arbeitet sie der Reihe nach ab. */
export class SketchFeed {
  lines: string[] = [];
  ended = false;
  private wake: (() => void) | null = null;
  push(line: string) { this.lines.push(line); this.wake?.(); }
  end() { this.ended = true; this.wake?.(); }
  next(): Promise<string | null> {
    if (this.lines.length) return Promise.resolve(this.lines.shift() ?? null);
    if (this.ended) return Promise.resolve(null);
    return new Promise((r) => { this.wake = () => { this.wake = null; r(this.lines.shift() ?? null); }; });
  }
  get backlog() { return this.lines.length; }
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LiveAnswer(props: { meta: AnswerMeta; feed: SketchFeed; voice: boolean; footer: React.ReactNode; onFinished: () => void }) {
  const { meta, feed, voice, onFinished } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const penRef = useRef<SVGGElement>(null);
  const [says, setSays] = useState<string[]>([]);
  const [current, setCurrent] = useState(-1);
  const [baustein, setBaustein] = useState<{ name: BausteinName; raw: string } | null>(null);
  const [drawing, setDrawing] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let speech: Promise<void> = Promise.resolve();
    let sayCount = 0;

    const pen = (x: number, y: number, on = true) => {
      const p = penRef.current;
      if (!p) return;
      p.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      p.style.opacity = on ? "1" : "0";
    };

    async function drawEl(el: SVGElement) {
      const layer = layerRef.current;
      if (!layer) return;
      const speed = feed.backlog > 8 ? 2.4 : feed.backlog > 4 ? 1.6 : 1;
      layer.appendChild(el);
      if (el.localName === "text") {
        const full = el.textContent ?? "";
        el.textContent = "";
        const x = parseFloat(el.getAttribute("x") ?? "0"), y = parseFloat(el.getAttribute("y") ?? "0");
        const dur = Math.min(650, 24 * full.length) / speed, t0 = performance.now();
        for (;;) {
          const t = Math.min(1, (performance.now() - t0) / dur);
          el.textContent = full.slice(0, Math.ceil(full.length * t));
          let w = 0;
          try { w = (el as SVGTextElement).getComputedTextLength(); } catch { w = 0; }
          const anchor = el.getAttribute("text-anchor");
          pen(anchor === "middle" ? x + w / 2 : anchor === "end" ? x : x + w, y - 4);
          if (t >= 1 || !alive.current) break;
          await frame();
        }
        el.textContent = full;
        return;
      }
      const g = el as unknown as SVGGeometryElement;
      const stroke = el.getAttribute("stroke");
      const hasStroke = !!stroke && stroke !== "none";
      const dashed = !!el.getAttribute("stroke-dasharray");
      let len = 0;
      try { len = g.getTotalLength?.() ?? 0; } catch { len = 0; }
      if (hasStroke && len > 0 && !dashed) {
        const fillOp = el.getAttribute("fill-opacity");
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        el.style.fillOpacity = "0";
        const dur = Math.max(280, Math.min(900, len * 1.5)) / speed, t0 = performance.now();
        for (;;) {
          const t = Math.min(1, (performance.now() - t0) / dur), e = ease(t);
          el.style.strokeDashoffset = `${len * (1 - e)}`;
          try { const pt = g.getPointAtLength(len * e); pen(pt.x, pt.y); } catch { /* ohne Stift weiter */ }
          if (t >= 1 || !alive.current) break;
          await frame();
        }
        el.style.strokeDasharray = "";
        el.style.strokeDashoffset = "";
        el.style.transition = "fill-opacity 220ms ease";
        el.style.fillOpacity = fillOp ?? "1";
        await wait(60 / speed);
      } else {
        el.style.opacity = "0";
        el.style.transition = `opacity ${260 / speed}ms ease`;
        try { const b = (el as SVGGraphicsElement).getBBox(); pen(b.x + b.width / 2, b.y + b.height / 2); } catch { /* egal */ }
        await frame();
        el.style.opacity = "1";
        await wait(260 / speed);
      }
    }

    (async () => {
      for (;;) {
        const line = await feed.next();
        if (!alive.current) return;
        if (line === null) break;
        if (line.startsWith("@say ")) {
          const text = line.slice(5).trim();
          await speech; // nächster Satz erst, wenn der vorige gesprochen ist
          if (!alive.current) return;
          const idx = sayCount++;
          setSays((s) => [...s, text]);
          setCurrent(idx);
          speech = speak(text, voice);
        } else if (line.startsWith("@svg ")) {
          const el = sanitizeSvgLine(line.slice(5).trim());
          if (el) await drawEl(el);
        } else if (line.startsWith("@data ")) {
          try {
            const d = JSON.parse(line.slice(6)) as { baustein?: string; daten?: unknown };
            if (d.baustein) setBaustein({ name: d.baustein as BausteinName, raw: JSON.stringify(d.daten ?? {}) });
          } catch { /* unlesbar, weiter mit Text */ }
          await wait(500);
        }
      }
      await speech;
      if (!alive.current) return;
      pen(0, 0, false);
      setCurrent(-1);
      setDrawing(false);
      onFinished();
    })();

    return () => { alive.current = false; stopSpeaking(); };
  }, [feed, voice, onFinished]);

  return (
    <>
      <h4>{meta.title}</h4>
      {meta.kind === "frei" ? (
        <div className="ik-sheet">
          <svg ref={svgRef} viewBox="0 0 420 300" role="img" aria-label={meta.title}>
            <defs>
              <pattern id="ikgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(16,36,42,.05)" strokeWidth="1" /></pattern>
              <radialGradient id="ikpen"><stop offset="0" stopColor="#7FD3D9" stopOpacity=".9" /><stop offset="1" stopColor="#7FD3D9" stopOpacity="0" /></radialGradient>
            </defs>
            <rect width="420" height="300" fill="url(#ikgrid)" />
            <g ref={layerRef} />
            <g ref={penRef} className="ik-pen" style={{ opacity: 0 }}>
              <circle r="14" fill="url(#ikpen)" />
              <circle r="4.5" fill="#0B5761" stroke="#fff" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
      ) : baustein ? (
        <Baustein name={baustein.name} raw={baustein.raw} />
      ) : (
        <div className="ik-sheet wait"><span>IKnow zeichnet …</span></div>
      )}
      <div className="ik-say">
        {says.map((s, i) => <span key={i} className={i === current ? "now" : ""}>{s} </span>)}
        {drawing && says.length === 0 && <span className="muted">IKnow fängt an …</span>}
      </div>
      {!drawing && props.footer}
    </>
  );
}
