"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import PracticeScreen, { PAGE_CONTEXT } from "./PracticeScreen";
import Baustein from "./Bausteine";
import FreeCanvas from "./FreeCanvas";
import type { AskRequest, ContextItem, IKnowAnswer, RenderPref, Source, StreamEvent, Tier, Usage } from "@/lib/types";

type Rect = { x: number; y: number; w: number; h: number };
type Phase = "idle" | "draw" | "ask" | "thinking" | "answer";
type Viewer = { highlight: (keys: string[] | null) => void };
type Run = {
  id: number; source: Source; tier: Tier; render: RenderPref; kind: string; title: string;
  first: number | null; total: number; usage: Usage | null; servedTier: string | null; cost: number | null; mock: boolean;
};

const LABELS: Record<string, string> = {};

function overlap(r: DOMRect, s: Rect) {
  const w = Math.max(0, Math.min(r.right, s.x + s.w) - Math.max(r.left, s.x));
  const h = Math.max(0, Math.min(r.bottom, s.y + s.h) - Math.max(r.top, s.y));
  return w * h;
}

/** Daten-Modus: liest alle Einträge, die zu mindestens 20 Prozent im Rahmen liegen. Kein Screenshot. */
function collectItems(sel: Rect): ContextItem[] {
  const out: ContextItem[] = [];
  document.querySelectorAll<HTMLElement>("[data-iknow-key]").forEach((el) => {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (!area || overlap(r, sel) < area * 0.2) return;
    if (el.tagName === "CANVAS" && overlap(r, sel) < 1) return;
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(el.dataset.iknow ?? "{}"); } catch { /* leer lassen */ }
    const key = el.dataset.iknowKey ?? "";
    out.push({ key, label: String(data.label ?? key), data });
    LABELS[key] = String(data.label ?? key);
  });
  // Rahmen nur im Modell: Ober- oder Unterkiefer nach Lage im Bild
  const cv = document.getElementById("cv");
  if (cv && !out.some((i) => /^[BWN]-/.test(i.key))) {
    const r = cv.getBoundingClientRect();
    if (overlap(r, sel) > 0) {
      const upper = sel.y + sel.h / 2 < r.top + r.height / 2;
      out.push({ key: upper ? "bereich-ok" : "bereich-uk", label: upper ? "Bereich Oberkiefer im Modell" : "Bereich Unterkiefer im Modell", data: { hinweis: "im 3D-Modell umrahmt", kiefer: upper ? "Oberkiefer" : "Unterkiefer" } });
    }
  }
  return out;
}

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
  const [items, setItems] = useState<ContextItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<IKnowAnswer | null>(null);
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
  const start = useRef<{ x: number; y: number } | null>(null);
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

  const onViewer = useCallback((v: Viewer | null) => { viewer.current = v; }, []);

  const clearFocus = () => {
    viewer.current?.highlight(null);
    document.querySelectorAll(".ik-focus").forEach((e) => e.classList.remove("ik-focus"));
  };

  const reset = useCallback(() => {
    setPhase("idle"); setRect(null); setItems([]); setAnswer(null); setError(null); setStill(null); setCrop(null); setFull(null);
    setAskPos(null); setAnsPos(null); start.current = null; clearFocus();
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") reset(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [reset]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

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

  function cropFromStill(sel: Rect) {
    const img = stillImg.current, frame = frameRef.current;
    if (!img || !frame) return;
    const b = img.getBoundingClientRect();
    const scale = Math.min(b.width / frame.width, b.height / frame.height);
    const dw = frame.width * scale, dh = frame.height * scale;
    const ox = b.left + (b.width - dw) / 2, oy = b.top + (b.height - dh) / 2;
    let sx = Math.round((sel.x - ox) / scale), sy = Math.round((sel.y - oy) / scale);
    let sw = Math.round(sel.w / scale), sh = Math.round(sel.h / scale);
    sx = Math.max(0, Math.min(frame.width - 1, sx)); sy = Math.max(0, Math.min(frame.height - 1, sy));
    sw = Math.max(1, Math.min(frame.width - sx, sw)); sh = Math.max(1, Math.min(frame.height - sy, sh));
    const k = Math.min(1, 2048 / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext("2d")?.drawImage(frame, sx, sy, sw, sh, 0, 0, c.width, c.height);
    setCrop(c.toDataURL("image/jpeg", 0.92));
    const kf = Math.min(1, 1280 / frame.width);
    const f = document.createElement("canvas");
    f.width = Math.round(frame.width * kf); f.height = Math.round(frame.height * kf);
    f.getContext("2d")?.drawImage(frame, 0, 0, f.width, f.height);
    setFull(f.toDataURL("image/jpeg", 0.75));
  }

  /* ---------- Rahmen ziehen ---------- */
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const s = start.current;
    setRect({ x: Math.min(s.x, e.clientX), y: Math.min(s.y, e.clientY), w: Math.abs(e.clientX - s.x), h: Math.abs(e.clientY - s.y) });
  };
  const onUp = () => {
    if (!start.current || !rect) return;
    start.current = null;
    if (rect.w < 14 || rect.h < 14) { setRect(null); return; }
    if (source === "daten") {
      const found = collectItems(rect);
      setItems(found);
      const hl = found.map((i) => i.key).filter((k) => /^[BWN]-/.test(k));
      if (hl.length) viewer.current?.highlight(hl);
      setQuestion(found.some((i) => i.key === "abschlag") ? "Warum ist der Abschlag offen?" : "Was bedeutet das hier, und wie wird das bei Hoffmann, Lea abgerechnet?");
    } else {
      cropFromStill(rect);
      setQuestion("Was bedeutet das hier, und wie hängt es mit der Abrechnung zusammen?");
    }
    setPhase("ask");
  };

  /* ---------- Fenster neben dem Rahmen platzieren ---------- */
  const place = (el: HTMLElement | null, below: boolean) => {
    if (!el || !rect) return null;
    const vw = innerWidth, vh = innerHeight, w = el.offsetWidth, h = el.offsetHeight;
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
  useLayoutEffect(() => { if (phase === "answer" && (answer || error)) setAnsPos(place(ansRef.current, false)); }, [phase, answer, error]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Fragen ---------- */
  async function send(code?: string) {
    if (!question.trim()) return;
    setPhase("thinking"); setProgress(0); setError(null); setStill(null);
    const body: AskRequest = source === "daten"
      ? { source, tier, render, question, items, page: PAGE_CONTEXT }
      : { source, tier, render, question, crop: crop ?? undefined, full: full ?? undefined };
    try {
      const res = await fetch("/api/iknow", { method: "POST", headers: { "Content-Type": "application/json", "x-iknow-code": code ?? readCode() }, body: JSON.stringify(body) });
      if (res.status === 401) { setNeedCode(true); setPhase("ask"); return; }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Anfrage fehlgeschlagen.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.t === "start") setMockMode(ev.mock);
          else if (ev.t === "delta") setProgress(ev.n);
          else if (ev.t === "error") throw new Error(ev.message);
          else if (ev.t === "done") {
            setAnswer(ev.answer);
            const focus = (ev.answer.focus ?? []).filter((k) => typeof k === "string");
            clearFocus();
            const hl = focus.filter((k) => /^[BWNR]-/.test(k));
            if (hl.length) viewer.current?.highlight(hl);
            focus.forEach((k) => document.querySelectorAll(`[data-iknow-key="${CSS.escape(k)}"]`).forEach((e) => e.classList.add("ik-focus")));
            runId.current += 1;
            setRuns((r) => [{ id: runId.current, source, tier, render, kind: ev.answer.kind, title: ev.answer.title, first: ev.ms.first, total: ev.ms.total, usage: ev.usage, servedTier: ev.servedTier, cost: ev.costUsd, mock: ev.mock }, ...r].slice(0, 30));
            setPhase("answer");
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
    const w = ansRef.current.offsetWidth, h = ansRef.current.offsetHeight;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    let ax = ansPos.x > cx ? ansPos.x : ansPos.x + w, ay = Math.max(ansPos.y + 24, Math.min(ansPos.y + h - 24, cy));
    let ex = cx < ax ? rect.x + rect.w : rect.x, ey = cy;
    if (ansPos.y > rect.y + rect.h) { ax = Math.max(ansPos.x + 30, Math.min(ansPos.x + w - 30, cx)); ay = ansPos.y; ex = cx; ey = rect.y + rect.h; }
    return <path d={`M${ax} ${ay} Q ${(ax + ex) / 2} ${Math.min(ay, ey) - 30} ${ex} ${ey}`} fill="none" stroke="#1A8C97" strokeWidth={2.5} strokeDasharray="5 5" />;
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
          <div className="ik-hint">Mit Maus oder Finger <b>einen Bereich umrahmen</b> · Esc bricht ab</div>
          <div className={"ik-layer" + (still ? " still" : "")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            {still && <img ref={stillImg} src={still} alt="Aufgenommener Bildschirm" draggable={false} />}
          </div>
        </>
      )}
      {rect && phase !== "idle" && <div className={"ik-sel" + (phase === "draw" ? " drawing" : "")} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}

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
          <i />IKnow {render === "frei" ? "zeichnet" : "denkt"} … {progress > 0 ? <small>{progress} Zeichen</small> : null}
        </div>
      )}

      {phase === "answer" && (answer || error) && (
        <>
          <svg className="ik-arrow" aria-hidden="true">{arrow}</svg>
          <div className="ik-ans" ref={ansRef} style={ansPos ? { left: ansPos.x, top: ansPos.y } : { visibility: "hidden", left: 0, top: 0 }} role="dialog" aria-live="polite">
            <div className="top"><span className="lbl">IKnow zeigt{answer ? (answer.kind === "frei" ? " · frei gezeichnet" : ` · Baustein ${answer.baustein}`) : ""}</span><button className="x" type="button" onClick={reset} aria-label="Schließen">✕</button></div>
            {error ? <p className="ik-warn">{error}</p> : answer && (
              <>
                <h4>{answer.title}</h4>
                {answer.kind === "frei" && answer.html ? <FreeCanvas html={answer.html} /> : <Baustein name={answer.baustein} raw={answer.baustein_data} />}
                <p>{answer.text}</p>
                {runs[0] && <div className="meta">{runs[0].mock ? "Probelauf" : `${runs[0].servedTier ?? tier}`} · erste Antwort {runs[0].first ?? "?"} ms · fertig {runs[0].total} ms{runs[0].usage ? ` · ${runs[0].usage.input}/${runs[0].usage.output} Tokens` : ""}{runs[0].cost !== null ? ` · ca. $${runs[0].cost.toFixed(3)}` : ""}</div>}
              </>
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
                <tr key={r.id}><td>{r.id}</td><td>{r.source === "daten" ? "Daten" : "Foto"}</td><td>{r.mock ? "Probe" : r.servedTier ?? r.tier}</td><td>{r.kind}</td><td>{r.first ?? "?"} ms</td><td>{r.total} ms</td><td>{r.usage ? `${r.usage.input}/${r.usage.output}` : "?"}</td><td>{r.cost !== null ? `$${r.cost.toFixed(3)}` : "?"}</td></tr>
              ))}</tbody>
            </table>
          )}
          <p className="foot">Kosten geschätzt nach Listenpreis, Summe ca. ${sum.toFixed(3)}. Nichts davon wird gespeichert.</p>
        </div>
      )}
    </div>
  );
}
