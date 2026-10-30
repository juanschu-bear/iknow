"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pdfText } from "@/lib/pdftext";

/**
 * "Was IKnow weiß": feste Wissensbasis aus dem Repo plus vom Praxisteam ergänztes Wissen.
 * Lesen darf jeder mit Zugang, Ergänzen und Löschen nur mit dem Bearbeitungs-Passwort.
 */
type Fest = { id: string; titel: string; quelle: string; chars: number };
type Doc = { pathname: string; titel: string; chars: number; hochgeladen: string };
type Data = { fest: Fest[]; uploads: Doc[]; limits: { doc: number; total: number }; storeReady: boolean; editReady: boolean };

const PW_KEY = "iknow-edit";
const readPw = () => { try { return sessionStorage.getItem(PW_KEY) ?? ""; } catch { return ""; } };
const savePw = (v: string) => { try { if (v) sessionStorage.setItem(PW_KEY, v); else sessionStorage.removeItem(PW_KEY); } catch { /* ohne Speicher */ } };
const fmt = (n: number) => n.toLocaleString("de-DE");
/** grob: 1 Token je 3,5 Zeichen, Eingabepreis je 1 Mio. Tokens in USD (Ultrafast 12, Standard 2) */
const cents = (chars: number, usdPerM: number) => (chars / 3.5) * usdPerM / 1e6 * 100;

export default function WissenPanel({ headers, onClose }: { headers: Record<string, string>; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/iknow/wissen", { headers, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Wissen konnte nicht geladen werden.");
      setData(j as Data);
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
  }, [headers]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const saved = readPw();
    if (saved) unlock(saved, true);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function unlock(value: string, quiet = false) {
    setBusy("check");
    try {
      const r = await fetch("/api/iknow/wissen?check=1", { headers: { ...headers, "x-iknow-edit": value }, cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Passwort ist falsch.");
      setPw(value); setUnlocked(true); savePw(value); setPwInput("");
    } catch (e) { savePw(""); if (!quiet) setError(e instanceof Error ? e.message : "Fehler"); }
    setBusy(null);
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (!titel) setTitel(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        setBusy("PDF wird gelesen …");
        const t = await pdfText(f, (n, total) => setBusy(`PDF wird gelesen … Seite ${n} von ${total}`));
        if (!t.trim()) throw new Error("In dieser PDF ist kein lesbarer Text (vermutlich ein Scan).");
        setText(t);
      } else {
        setText((await f.text()).trim());
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden."); }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    setBusy("Wird gespeichert …"); setError(null);
    try {
      const r = await fetch("/api/iknow/wissen", { method: "POST", headers: { ...headers, "Content-Type": "application/json", "x-iknow-edit": pw }, body: JSON.stringify({ titel, text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Speichern hat nicht geklappt.");
      setAdding(false); setTitel(""); setText("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
    setBusy(null);
  }

  async function remove(d: Doc) {
    if (busy) return;
    setBusy("Wird gelöscht …"); setError(null);
    try {
      const r = await fetch(`/api/iknow/wissen?pathname=${encodeURIComponent(d.pathname)}`, { method: "DELETE", headers: { ...headers, "x-iknow-edit": pw } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Löschen hat nicht geklappt.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Fehler"); }
    setBusy(null);
  }

  const used = data ? data.uploads.reduce((s, d) => s + d.chars, 0) : 0;
  const tooLong = !!data && text.length > data.limits.doc;
  const overTotal = !!data && used + text.length > data.limits.total;

  return (
    <div className="ik-know-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ik-know" role="dialog" aria-label="Was IKnow weiß">
        <div className="kh">
          <div><b>Was IKnow weiß</b><small>Feste Wissensbasis plus Wissen, das die Praxis ergänzt hat</small></div>
          <button type="button" className="x" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        {error && <p className="ik-warn">{error}</p>}
        {!data ? <p className="muted">Wird geladen …</p> : (
          <div className="kbody">
            <section>
              <h5>Feste Wissensbasis <span>{data.fest.length} Themen · geprüft im Repo</span></h5>
              <ul className="klist">{data.fest.map((w) => <li key={w.id}><b>{w.titel}</b><small>{w.quelle}</small></li>)}</ul>
            </section>

            <section>
              <h5>Von der Praxis ergänzt <span>{data.uploads.length} Dokumente</span></h5>
              {!data.storeReady ? <p className="muted">Der Wissensspeicher ist noch nicht verbunden. Sobald Vercel Blob angeschlossen ist, kann hier Wissen ergänzt werden.</p>
                : data.uploads.length === 0 ? <p className="muted">Noch nichts ergänzt.</p>
                : <ul className="klist">{data.uploads.map((d) => (
                  <li key={d.pathname}><b>{d.titel}</b><small>{fmt(d.chars)} Zeichen · {d.hochgeladen ? new Date(d.hochgeladen).toLocaleDateString("de-DE") : ""}</small>
                    {unlocked && <button type="button" className="kdel" onClick={() => remove(d)} disabled={!!busy}>Löschen</button>}</li>
                ))}</ul>}
              {data.storeReady && (
                <div className="kmeter">
                  <div className="bar"><i style={{ width: `${Math.min(100, (used / data.limits.total) * 100)}%` }} /></div>
                  <small>{fmt(used)} von {fmt(data.limits.total)} Zeichen belegt. Pro Frage sucht IKnow nur die 5 passendsten Abschnitte heraus (höchstens ca. 3.500 Zeichen), egal wie viel hier steht: ca. {cents(3500, 12).toFixed(1)} Cent in Ultrafast, ca. {cents(3500, 2).toFixed(2)} Cent in Standard.</small>
                </div>
              )}
            </section>

            {data.storeReady && (!unlocked ? (
              <section className="klock">
                <h5>Wissen ergänzen</h5>
                {!data.editReady ? <p className="muted">Bearbeiten ist noch nicht eingerichtet (Passwort fehlt in Vercel).</p> : (
                  <div className="krow">
                    <input type="password" placeholder="Passwort zum Bearbeiten" value={pwInput} onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && pwInput) unlock(pwInput); }} aria-label="Passwort zum Bearbeiten" />
                    <button type="button" className="kgo" disabled={!pwInput || !!busy} onClick={() => unlock(pwInput)}>Entsperren</button>
                  </div>
                )}
              </section>
            ) : !adding ? (
              <section className="klock">
                <div className="krow"><button type="button" className="kgo" onClick={() => setAdding(true)}>+ Wissen hinzufügen</button>
                  <button type="button" className="kghost" onClick={() => { setUnlocked(false); setPw(""); savePw(""); }}>Sperren</button></div>
              </section>
            ) : (
              <section className="kadd">
                <h5>Wissen hinzufügen</h5>
                <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel, z. B. Preisliste Privatleistungen 2026" aria-label="Titel" />
                <div className="krow">
                  <button type="button" className="kghost" onClick={() => fileRef.current?.click()} disabled={!!busy}>PDF oder Textdatei wählen</button>
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" hidden onChange={(e) => pick(e.target.files?.[0])} />
                  <small className="muted">oder Text unten einfügen</small>
                </div>
                <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text, den IKnow kennen soll …" aria-label="Text" />
                <small className={tooLong || overTotal ? "ik-warn" : "muted"}>{fmt(text.length)} Zeichen{tooLong ? ` · zu lang, höchstens ${fmt(data.limits.doc)}` : overTotal ? " · überschreitet die Gesamtgrenze" : ""}</small>
                <div className="krow">
                  <button type="button" className="kgo" disabled={!titel.trim() || !text.trim() || tooLong || overTotal || !!busy} onClick={save}>Speichern</button>
                  <button type="button" className="kghost" onClick={() => { setAdding(false); setTitel(""); setText(""); }}>Abbrechen</button>
                </div>
              </section>
            ))}
            {busy && busy !== "check" && <p className="muted">{busy}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
