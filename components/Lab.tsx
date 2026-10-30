"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import PracticeScreen, { PAGE_CONTEXT } from "./PracticeScreen";
import LiveAnswer, { SketchFeed } from "./LiveAnswer";
import { stopSpeaking } from "@/lib/voice";
import type { AnswerMeta, AskRequest, ContextItem, RenderPref, Source, StreamEvent, Tier, Usage } from "@/lib/types";

type Rect = { x: number; y: number; w: number; h: number };
type Phase = "idle" | "draw" | "ask" | "thinking" | "answer";
type Viewer = { highlight: (keys: string[] | null) => void };
type Run = {
  id: number; source: Source; tier: Tier; render: RenderPref; kind: string; title: string;
  first: number | null; total: number; usage: Usage | null; servedTier: string | null; cost: number | null; mock: boolean;
};



type Pt = { x: number; y: number };

function inPoly(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x) c = !c;
  }
  return c;
}

/** Anteil eines Elements, der in der gezeichneten Form liegt (Raster aus 5 x 5 Punkten). */
function coverage(r: DOMRect, poly: Pt[]): number {
  let hit = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    if (inPoly({ x: r.left + (r.width * (i + 0.5)) / 5, y: r.top + (r.height * (j + 0.5)) / 5 }, poly)) hit++;
  }
  return hit / 25;
}

/**
 * Daten-Modus: liest genau die Einträge, die in der gezeichneten Form liegen. Kein Screenshot.
 * Ist ein feinerer Eintrag drin, zählt nur er, nicht der ganze Kasten drumherum.
 */
function collectItems(poly: Pt[]): ContextItem[] {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-iknow-key]")).filter((el) => {
    if (el.tagName === "CANVAS") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && coverage(r, poly) >= 0.35;
  });
  if (!els.length) {
    // Nichts deutlich getroffen: den Eintrag nehmen, der am stärksten in der Form liegt.
    let best: HTMLElement | null = null, bestC = 0.08;
    document.querySelectorAll<HTMLElement>("[data-iknow-key]").forEach((el) => {
      if (el.tagName === "CANVAS") return;
      const r = el.getBoundingClientRect();
      const c = r.width ? coverage(r, poly) : 0;
      if (c > bestC || (c === bestC && best && best.contains(el))) { best = el; bestC = c; }
    });
    if (best) els.push(best);
  }
  const inner = els.filter((el) => !els.some((o) => o !== el && el.contains(o)));
  const out: ContextItem[] = inner.map((el) => {
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(el.dataset.iknow ?? "{}"); } catch { /* leer lassen */ }
    const key = el.dataset.iknowKey ?? "";
    return { key, label: String(data.label ?? key), data };
  });
  // Form nur im 3D-Modell: Ober- oder Unterkiefer nach Lage
  const cv = document.getElementById("cv");
  if (cv && !out.some((i) => /^[BWN]-/.test(i.key))) {
    const r = cv.getBoundingClientRect();
    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
      const upper = cy < r.top + r.height / 2;
      out.push({ key: upper ? "bereich-ok" : "bereich-uk", label: upper ? "Bereich Oberkiefer im Modell" : "Bereich Unterkiefer im Modell", data: { hinweis: "im 3D-Modell umrandet", kiefer: upper ? "Oberkiefer" : "Unterkiefer" } });
    }
  }
  return out;
}

const pathOf = (pts: Pt[], close: boolean) => pts.length ? "M" + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L") + (close ? " Z" : "") : "";

function readCode(): string {
  try { return sessionStorage.getItem("iknow-code") ?? ""; } catch { return ""; }
}
function saveCode(c: string) {
  try { sessionStorage.setItem("iknow-code", c); } catch { /* ohne Speicher weiter */ }
}

export default function Lab() {
  const [source, setSource] = useState<Source>("daten");
  const [render, setRender] = useState<RenderPref>("auto");
  const [tier, setTier] = useState<Tier>("ultrafast");
  const [phase, setPhase] = useState<Phase>("idle");
  const [rect, setRect] = useState<Rect | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const drawingRef = useRef(false);
  const [items, setItems] = useState<ContextItem[]>([]);
  const [question, setQuestion] = useState("");
  const [meta, setMeta] = useState<AnswerMeta | null>(null);
  const [feed, setFeed] = useState<SketchFeed | null>(null);
  const [voice, setVoice] = useState(true);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const anchorsRef = useRef<{ el: Element | null; top: number; left: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [showRuns, setShowRuns] = useState(false);
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [still, setStill] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [hideUi, setHideUi] = useState(false);

  const viewer = useRef<Viewer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLCanvasElement | null>(null);
  const stillImg = useRef<HTMLImageElement>(null);
  const qRef = useRef<HTMLTextAreaElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const ansRef = useRef<HTMLDivElement>(null);
  const [askPos, setAskPos] = useState<{ x: number; y: number } | null>(null);
  const [ansPos, setAnsPos] = useState<{ x: number; y: number } | null>(null);
  const runId = useRef(0);
  const feedRef = useRef<SketchFeed | null>(null);
  const onFinished = useCallback(() => setFinished(true), []);

  const onViewer = useCallback((v: Viewer | null) => { viewer.current = v; }, []);

  const clearFocus = () => {
    viewer.current?.highlight(null);
    document.querySelectorAll(".ik-focus").forEach((e) => e.classList.remove("ik-focus"));
  };

  const reset = useCallback(() => {
    stopSpeaking(); feedRef.current?.end(); setHistory([]); setFollowUp(""); setShift({ x: 0, y: 0 }); anchorsRef.current = [];
    setPhase("idle"); setRect(null); setPts([]); drawingRef.current = false; setItems([]); setMeta(null); setFeed(null); setFinished(false); setError(null); setStill(null); setCrop(null); setFull(null);
    setAskPos(null); setAnsPos(null); clearFocus();
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") reset(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [reset]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  /* Umrandung und Pfeil wandern mit, wenn darunter gescrollt wird */
  useEffect(() => {
    if (phase === "idle" || phase === "draw") return;
    const on = () => {
      let dx = 0, dy = 0;
      for (const a of anchorsRef.current) {
        if (!a.el) { dx += a.left - window.scrollX; dy += a.top - window.scrollY; }
        else { dx += a.left - a.el.scrollLeft; dy += a.top - a.el.scrollTop; }
      }
      setShift({ x: dx, y: dy });
    };
    window.addEventListener("scroll", on, true);
    return () => window.removeEventListener("scroll", on, true);
  }, [phase]);

  /* ---------- Screenshot-Modus: offizielle Screen Capture API ---------- */
  const stopSharing = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; setSharing(false);
  };

  async function ensureStream(): Promise<MediaStream> {
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    const opts = {
      video: { displaySurface: "browser" },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "include",
      monitorTypeSurfaces: "include",
    } as DisplayMediaStreamOptions;
    const s = await navigator.mediaDevices.getDisplayMedia(opts);
    s.getVideoTracks()[0]?.addEventListener("ended", () => { streamRef.current = null; setSharing(false); });
    streamRef.current = s; setSharing(true);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.srcObject = s;
    await v.play();
    videoRef.current = v;
    return s;
  }

  async function grabFrame(): Promise<string> {
    const v = videoRef.current;
    if (!v) throw new Error("Keine Bildschirmfreigabe.");
    // Eigene Bedienelemente ausblenden, dann 2 Bilder warten, damit sie nicht im Foto landen.
    setHideUi(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 120));
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setHideUi(false);
    frameRef.current = c;
    return c.toDataURL("image/jpeg", 0.9);
  }

  async function begin() {
    reset();
    if (source === "screenshot") {
      try {
        await ensureStream();
        const img = await grabFrame();
        setStill(img);
      } catch (e) {
        setHideUi(false);
        setError(e instanceof Error && e.name === "NotAllowedError" ? "Bildschirmfreigabe wurde nicht erlaubt." : "Bildschirm konnte nicht aufgenommen werden.");
        setPhase("answer");
        return;
      }
    }
    setPhase("draw");
  }

  function cropFromStill(sel: Rect, poly: Pt[]) {
    const img = stillImg.current, frame = frameRef.current;
    if (!img || !frame) return;
    const b = img.getBoundingClientRect();
    const scale = Math.min(b.width / frame.width, b.height / frame.height);
    const dw = frame.width * scale, dh = frame.height * scale;
    const ox = b.left + (b.width - dw) / 2, oy = b.top + (b.height - dh) / 2;
    const toF = (p: Pt) => ({ x: (p.x - ox) / scale, y: (p.y - oy) / scale });
    const pad = 16;
    let sx = Math.round((sel.x - ox) / scale) - pad, sy = Math.round((sel.y - oy) / scale) - pad;
    let sw = Math.round(sel.w / scale) + 2 * pad, sh = Math.round(sel.h / scale) + 2 * pad;
    sx = Math.max(0, Math.min(frame.width - 1, sx)); sy = Math.max(0, Math.min(frame.height - 1, sy));
    sw = Math.max(1, Math.min(frame.width - sx, sw)); sh = Math.max(1, Math.min(frame.height - sy, sh));
    const k = Math.min(1, 2048 / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const g = c.getContext("2d");
    if (g) {
      g.drawImage(frame, sx, sy, sw, sh, 0, 0, c.width, c.height);
      // Außerhalb der Form aufhellen und die Form nachzeichnen, damit das Modell sieht, was gemeint ist.
      const local = poly.map(toF).map((p) => ({ x: (p.x - sx) * k, y: (p.y - sy) * k }));
      g.beginPath(); g.rect(0, 0, c.width, c.height);
      local.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
      g.fillStyle = "rgba(255,255,255,0.72)"; g.fill("evenodd");
      g.beginPath(); local.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
      g.strokeStyle = "#1A8C97"; g.lineWidth = Math.max(2, 3 * k); g.stroke();
    }
    setCrop(c.toDataURL("image/jpeg", 0.92));
    const kf = Math.min(1, 1280 / frame.width);
    const f = document.createElement("canvas");
    f.width = Math.round(frame.width * kf); f.height = Math.round(frame.height * kf);
    const fg = f.getContext("2d");
    if (fg) {
      fg.drawImage(frame, 0, 0, f.width, f.height);
      fg.beginPath(); poly.map(toF).forEach((p, i) => (i ? fg.lineTo(p.x * kf, p.y * kf) : fg.moveTo(p.x * kf, p.y * kf))); fg.closePath();
      fg.strokeStyle = "#1A8C97"; fg.lineWidth = 3; fg.stroke();
    }
    setFull(f.toDataURL("image/jpeg", 0.75));
  }

  /* ---------- Rahmen ziehen ---------- */
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    setPts([{ x: e.clientX, y: e.clientY }]);
    setRect(null);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    setPts((p) => {
      const last = p[p.length - 1];
      if (last && Math.hypot(last.x - e.clientX, last.y - e.clientY) < 3) return p;
      return [...p, { x: e.clientX, y: e.clientY }];
    });
  };
  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const poly = pts;
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    if (poly.length < 3 || box.w < 12 || box.h < 12) { setPts([]); return; }
    setRect(box);
    // Umrandung an den Inhalt heften: Scrollpositionen merken, beim Scrollen mitwandern.
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const under = document.elementsFromPoint(cx, cy).find((e) => !e.closest(".ik-layer,.ik-lasso,.ik-ask,.ik-ans,.ik-fab"));
    const anchors: { el: Element | null; top: number; left: number }[] = [{ el: null, top: window.scrollY, left: window.scrollX }];
    for (let e = under?.parentElement ?? null; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (/(auto|scroll)/.test(st.overflowY + st.overflowX) && (e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth)) anchors.push({ el: e, top: e.scrollTop, left: e.scrollLeft });
    }
    anchorsRef.current = anchors;
    setShift({ x: 0, y: 0 });
    if (source === "daten") {
      const found = collectItems(poly);
      setItems(found);
      const hl = found.map((i) => i.key).filter((k) => /^[BWN]-/.test(k));
      if (hl.length) viewer.current?.highlight(hl);
      setQuestion("Was ist das hier, und was bedeutet es für Hoffmann, Lea?");
    } else {
      cropFromStill(box, poly);
      setQuestion("Was ist das hier, und was bedeutet es?");
    }
    setPhase("ask");
  };

  /* ---------- Fenster neben dem Rahmen platzieren ---------- */
  const place = (el: HTMLElement | null, below: boolean, estH?: number) => {
    if (!el || !rect) return null;
    const vw = innerWidth, vh = innerHeight, w = el.offsetWidth, h = Math.min(vh - 24, estH ?? el.offsetHeight);
    let x: number, y: number;
    if (below) {
      x = rect.x; y = rect.y + rect.h + 12;
      if (y + h > vh - 12) y = rect.y - h - 12;
      if (y < 12) y = Math.min(vh - h - 12, rect.y + 12);
    } else {
      x = rect.x + rect.w + 18; y = rect.y;
      if (x + w > vw - 12) x = rect.x - w - 18;
      if (x < 12) { x = Math.max(12, Math.min(vw - w - 12, rect.x)); y = rect.y + rect.h + 14; if (y + h > vh - 12) y = Math.max(12, rect.y - h - 14); }
      if (y + h > vh - 12) y = vh - h - 12;
      if (y < 12) y = 12;
    }
    return { x: Math.max(12, Math.min(vw - w - 12, x)), y };
  };
  useLayoutEffect(() => { if (phase === "ask") { setAskPos(place(askRef.current, true)); setTimeout(() => qRef.current?.select(), 30); } }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (phase === "answer" && (meta || error)) setAnsPos(place(ansRef.current, false, meta ? (meta.kind === "frei" ? 620 : 500) : undefined)); }, [phase, meta, error]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Fragen ---------- */
  async function send(code?: string, follow?: string) {
    const q = (follow ?? question).trim();
    if (!q) return;
    const hist = follow ? history.slice(-3) : [];
    if (!follow) setHistory([]);
    stopSpeaking(); feedRef.current?.end();
    setPhase("thinking"); setProgress(0); setError(null); setStill(null); setMeta(null); setFeed(null); setFinished(false);
    const body: AskRequest = source === "daten"
      ? { source, tier, render, question: q, items, page: PAGE_CONTEXT, history: hist.length ? hist : undefined }
      : { source, tier, render, question: q, crop: crop ?? undefined, full: full ?? undefined, history: hist.length ? hist : undefined };
    try {
      const res = await fetch("/api/iknow", { method: "POST", headers: { "Content-Type": "application/json", "x-iknow-code": code ?? readCode() }, body: JSON.stringify(body) });
      if (res.status === 401) { setNeedCode(true); setPhase("ask"); return; }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Anfrage fehlgeschlagen.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const f = new SketchFeed();
      feedRef.current = f;
      let buf = "", text = "", gotMeta = false, rawAll = "", html: string[] | null = null;
      const handleLine = (raw: string) => {
        rawAll += raw + "\n";
        // 3D-Block: Zeilen zwischen @html und @endhtml sammeln und als Ganzes weitergeben
        if (html) {
          if (raw.trim() === "@endhtml") { f.push("@htmlblock " + JSON.stringify(html.join("\n"))); html = null; }
          else if (html.join("\n").length < 20000) html.push(raw);
          return;
        }
        const line = raw.trim();
        if (!line) return;
        if (line === "@html") { html = []; return; }
        if (line.startsWith("@meta")) {
          if (gotMeta) return;
          let m: AnswerMeta = { kind: render === "baustein" ? "baustein" : "frei", title: "IKnow erklärt", focus: [] };
          try {
            const j = JSON.parse(line.slice(5)) as Partial<AnswerMeta>;
            m = { kind: j.kind === "baustein" ? "baustein" : "frei", title: String(j.title ?? m.title).slice(0, 90), focus: Array.isArray(j.focus) ? j.focus.filter((k): k is string => typeof k === "string") : [] };
          } catch { /* Standardkopf */ }
          gotMeta = true;
          clearFocus();
          const hl = m.focus.filter((k) => /^[BWNR]-/.test(k));
          if (hl.length) viewer.current?.highlight(hl);
          m.focus.forEach((k) => document.querySelectorAll(`[data-iknow-key="${CSS.escape(k)}"]`).forEach((e) => e.classList.add("ik-focus")));
          setMeta(m); setFeed(f); setPhase("answer");
        } else if (line.startsWith("@end")) {
          f.end();
        } else if (line.startsWith("@")) {
          f.push(line);
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const evLine = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!evLine) continue;
          const ev = JSON.parse(evLine) as StreamEvent;
          if (ev.t === "start") setMockMode(ev.mock);
          else if (ev.t === "delta") {
            setProgress((p) => p + ev.d.length);
            text += ev.d;
            let k: number;
            while ((k = text.indexOf("\n")) >= 0) { handleLine(text.slice(0, k)); text = text.slice(k + 1); }
          } else if (ev.t === "error") throw new Error(ev.message);
          else if (ev.t === "done") {
            if (text.trim()) handleLine(text);
            f.end();
            setHistory((h) => [...(follow ? hist : []), { question: q, answer: rawAll.slice(0, 16000) }].slice(-3));
            if (!gotMeta) throw new Error("Die Antwort kam ohne Kopfzeile an.");
            runId.current += 1;
            setRuns((r) => [{ id: runId.current, source, tier, render, kind: "", title: "", first: ev.ms.first, total: ev.ms.total, usage: ev.usage, servedTier: ev.servedTier, cost: ev.costUsd, mock: ev.mock }, ...r].slice(0, 30));
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setPhase("answer");
    }
  }

  const arrow = (() => {
    if (phase !== "answer" || !rect || !ansPos || !ansRef.current) return null;
    const rect0 = rect;
    { const rect = { ...rect0, x: rect0.x + shift.x, y: rect0.y + shift.y };
    const w = ansRef.current.offsetWidth, h = Math.min(ansRef.current.offsetHeight || 400, innerHeight - ansPos.y - 12);
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    let ax = ansPos.x > cx ? ansPos.x : ansPos.x + w, ay = Math.max(ansPos.y + 24, Math.min(ansPos.y + h - 24, cy));
    let ex = cx < ax ? rect.x + rect.w : rect.x, ey = cy;
    if (ansPos.y > rect.y + rect.h) { ax = Math.max(ansPos.x + 30, Math.min(ansPos.x + w - 30, cx)); ay = ansPos.y; ex = cx; ey = rect.y + rect.h; }
    return <path d={`M${ax} ${ay} Q ${(ax + ex) / 2} ${Math.min(ay, ey) - 30} ${ex} ${ey}`} fill="none" stroke="#1A8C97" strokeWidth={2.5} strokeDasharray="5 5" />;
    }
  })();

  const seg = <T extends string>(val: T, set: (v: T) => void, opts: [T, string][], label: string) => (
    <div className="lab-seg" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {opts.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={val === v} className={val === v ? "on" : ""} onClick={() => { set(v); reset(); }}>{l}</button>)}
    </div>
  );

  const sum = runs.reduce((s, r) => s + (r.cost ?? 0), 0);

  return (
    <div className={hideUi ? "lab hide-ui" : "lab"}>
      <div className="lab-bar">
        <div className="lab-brand"><i>i</i><div>IKnow<small>Testlabor</small></div></div>
        {seg(source, setSource, [["daten", "Daten aus der App"], ["screenshot", "Bildschirmfoto"]], "Quelle")}
        {seg(render, setRender, [["auto", "Automatisch"], ["baustein", "Baustein"], ["frei", "Frei zeichnen"]], "Darstellung")}
        {seg(tier, setTier, [["ultrafast", "Ultrafast"], ["standard", "Standard"]], "Modus")}
        <div className="lab-right">
          {sharing && <button type="button" className="lab-btn" onClick={stopSharing}>Freigabe beenden</button>}
          {<button type="button" className={"lab-btn" + (voice ? " on" : "")} onClick={() => { setVoice((v) => !v); stopSpeaking(); }} aria-pressed={voice}>{voice ? "Stimme an" : "Stimme aus"}</button>}
          <button type="button" className="lab-btn" onClick={() => setShowRuns((s) => !s)}>Messwerte {runs.length ? `(${runs.length})` : ""}</button>
          {mockMode !== null && <span className={"lab-pill " + (mockMode ? "mock" : "live")}>{mockMode ? "Probelauf ohne Modell" : "Live mit Modell"}</span>}
        </div>
      </div>

      <PracticeScreen onViewer={onViewer} />

      <button className={"ik-fab" + (phase !== "idle" ? " on" : "")} type="button" onClick={() => (phase === "idle" ? begin() : reset())} aria-label="IKnow fragen: Bereich umrahmen">
        <i><svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="2.5" /></svg></i>
        <span>{phase === "idle" ? "IKnow fragen" : "Abbrechen"}<small>{source === "daten" ? "Bereich umrahmen" : "Foto, dann umrahmen"}</small></span>
      </button>

      {phase === "draw" && (
        <>
          <div className="ik-hint">Mit Maus oder Finger <b>frei um das zeichnen</b>, was du wissen willst · Esc bricht ab</div>
          <div className={"ik-layer" + (still ? " still" : "")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            {still && <img ref={stillImg} src={still} alt="Aufgenommener Bildschirm" draggable={false} />}
          </div>
        </>
      )}
      {pts.length > 1 && phase !== "idle" && (
        <svg className={"ik-lasso" + (phase === "draw" ? " drawing" : "")} aria-hidden="true">
          {phase === "draw" && <path className="dim" d={`M0 0H${innerWidth}V${innerHeight}H0Z ${pathOf(pts, true)}`} fillRule="evenodd" />}
          <path className="shape" d={pathOf(pts, !drawingRef.current)} transform={`translate(${shift.x} ${shift.y})`} />
        </svg>
      )}

      {phase === "ask" && (
        <div className="ik-ask" ref={askRef} style={askPos ? { left: askPos.x, top: askPos.y } : { visibility: "hidden" }} role="dialog" aria-label="Frage an IKnow">
          <div className="ctx">
            {source === "daten"
              ? (items.length ? items.map((i) => <span key={i.key}>{i.label}</span>) : <span>nichts aus der App erkannt</span>)
              : crop && <img src={crop} alt="Umrahmter Ausschnitt" />}
          </div>
          {needCode ? (
            <div className="row">
              <input className="code" type="password" placeholder="Zugangscode" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { saveCode(codeInput); setNeedCode(false); send(codeInput); } }} autoFocus />
              <button className="go" type="button" onClick={() => { saveCode(codeInput); setNeedCode(false); send(codeInput); }}>OK</button>
            </div>
          ) : (
            <div className="row">
              <textarea ref={qRef} rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Deine Frage" />
              <button className="go" type="button" onClick={() => send()}>Fragen</button>
            </div>
          )}
          <div className="note">{source === "daten" ? "IKnow liest nur die Einträge im Rahmen und die Seite drumherum" : "IKnow sieht den Ausschnitt und den Bildschirm verkleinert zur Orientierung"}</div>
        </div>
      )}

      {phase === "thinking" && rect && (
        <div className="ik-think" style={{ left: Math.min(innerWidth - 220, rect.x), top: Math.min(innerHeight - 60, rect.y + rect.h + 12) }}>
          <i />IKnow überlegt … {progress > 0 ? <small>{progress} Zeichen</small> : null}
        </div>
      )}

      {phase === "answer" && (meta || error) && (
        <>
          <svg className="ik-arrow" aria-hidden="true">{arrow}</svg>
          <div className="ik-ans" ref={ansRef} style={ansPos ? { left: ansPos.x, top: ansPos.y, maxHeight: innerHeight - ansPos.y - 12 } : { visibility: "hidden", left: 0, top: 0 }} role="dialog" aria-live="polite">
            <div className="top"><span className="lbl">IKnow zeigt{meta ? (meta.kind === "frei" ? " · zeichnet frei" : " · Baustein") : ""}</span><button className="x" type="button" onClick={reset} aria-label="Schließen">✕</button></div>
            {error ? <p className="ik-warn">{error}</p> : meta && feed && (
              <LiveAnswer meta={meta} feed={feed} voice={voice} onFinished={onFinished} footer={
                finished ? <>
                <div className="ik-follow">
                  <input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="Weiter fragen, z. B. „Zeig das als 3D“" onKeyDown={(e) => { if (e.key === "Enter" && followUp.trim()) { const f2 = followUp; setFollowUp(""); send(undefined, f2); } }} aria-label="Folgefrage" />
                  <button type="button" disabled={!followUp.trim()} onClick={() => { const f2 = followUp; setFollowUp(""); send(undefined, f2); }}>Weiter</button>
                </div>
                <div className="ik-chips">{["Zeig das als 3D", "Einfacher erklären", "Genauer, mit Zahlen"].map((c) => <button key={c} type="button" onClick={() => send(undefined, c)}>{c}</button>)}</div>
                {runs[0] && <div className="meta">{runs[0].mock ? "Probelauf" : `${runs[0].servedTier ?? tier}`} · erste Antwort {runs[0].first ?? "?"} ms · Text fertig {runs[0].total} ms{runs[0].usage ? ` · ${runs[0].usage.input}/${runs[0].usage.output} Tokens` : ""}{runs[0].cost !== null ? ` · ca. $${runs[0].cost.toFixed(3)}` : ""}</div>}
                </> : null
              } />
            )}
          </div>
        </>
      )}

      {showRuns && (
        <div className="lab-runs" role="dialog" aria-label="Messwerte">
          <div className="h"><b>Messwerte dieser Sitzung</b><button type="button" className="x" onClick={() => setShowRuns(false)} aria-label="Schließen">✕</button></div>
          {runs.length === 0 ? <p className="empty">Noch keine Anfrage.</p> : (
            <table>
              <thead><tr><th>#</th><th>Quelle</th><th>Modus</th><th>Darstellung</th><th>erste</th><th>fertig</th><th>Tokens</th><th>Kosten</th></tr></thead>
              <tbody>{runs.map((r) => (
                <tr key={r.id}><td>{r.id}</td><td>{r.source === "daten" ? "Daten" : "Foto"}</td><td>{r.mock ? "Probe" : r.servedTier ?? r.tier}</td><td>{r.render}</td><td>{r.first ?? "?"} ms</td><td>{r.total} ms</td><td>{r.usage ? `${r.usage.input}/${r.usage.output}` : "?"}</td><td>{r.cost !== null ? `$${r.cost.toFixed(3)}` : "?"}</td></tr>
              ))}</tbody>
            </table>
          )}
          <p className="foot">Kosten geschätzt nach Listenpreis, Summe ca. ${sum.toFixed(3)}. Nichts davon wird gespeichert.</p>
        </div>
      )}
    </div>
  );
}
