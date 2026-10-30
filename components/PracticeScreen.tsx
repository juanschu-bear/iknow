"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

/**
 * Nachgestellter Praxis-Bildschirm (Patientenansicht Hoffmann, Lea) mit Beispieldaten.
 * Jedes Element, das IKnow im Daten-Modus lesen darf, trägt data-iknow-key und data-iknow (JSON).
 */

type Viewer = { highlight: (keys: string[] | null) => void; destroy?: () => void };
type E3Api = { mountModel: (c: HTMLCanvasElement, facts: unknown, opts: unknown) => Viewer };

export const PAGE_CONTEXT = {
  ansicht: "Patientenansicht im Leitstand, Behandlungskonto",
  patient: { name: "Hoffmann, Lea", geboren: "14.03.2013", versicherung: "Kasse, AOK Plus", kiefer: "beide Kiefer" },
  behandlung: { phase: "Feste Phase seit 12.02.2025", behandlungsquartal: "7 von 12", plan: "genehmigt", boegen: "6 von 10 verbraucht" },
  heute: [
    "08:52 angemeldet am Empfang, Anamnese aktuell",
    "09:05 Zimmer 2, Behandlung bei Dr. Schubert",
    "09:31 in Scribe dokumentiert und bestätigt",
    "jetzt im Behandlungskonto, wartet auf Sabine",
  ],
  scribe: [
    { datum: "heute 09:31", zimmer: "Zimmer 2", text: "Bogenwechsel OK auf NiTi 0.016. Bracket 24 neu geklebt. UK Kontrolle, Bogen bleibt.", status: "bestätigt" },
    { datum: "02.10.2026", zimmer: "Zimmer 1", text: "Kontrolle, Bögen nachgespannt OK und UK. Mundhygiene gut.", status: "bestätigt, abgerechnet" },
  ],
  apparatur: {
    oberkiefer: ["Bogen 128 NiTi, heute gewechselt, bestätigt", "126a 9 Brackets Zahn 15 bis 25 ohne 24, abgerechnet", "126a 1 Bracket Zahn 24, heute neu geklebt, zu prüfen", "126b 2 Bänder Zahn 16 und 26, abgerechnet"],
    unterkiefer: ["Bogen 128 Edelstahl, abgerechnet", "126a 10 Brackets Zahn 35 bis 45, abgerechnet", "126b 2 Bänder Zahn 36 und 46, abgerechnet"],
  },
  offen: { was: "Abschlag Q4 2026 fällig", wer: "Sabine", abschlaege: "Q1 bis Q3 abgerechnet" },
  rechnungen: ["Zusatzleistung Q3: im Portal, von der Familie geöffnet, heute gebucht", "Abschlag Q4: entsteht nach Sabines Bestätigung"],
  hinweis: "Beispieldaten. Abrechnungsentscheidungen trifft Sabine.",
};

function facts() {
  const teeth: Record<string, Record<string, { state: string; ev: string }>> = { OK: {}, UK: {} };
  ([["OK", 1, 2], ["UK", 4, 3]] as const).forEach(([j, a, b]) => {
    [a, b].forEach((q) => {
      for (let i = 1; i <= 7; i++) {
        const f = String(q * 10 + i);
        teeth[j][f] =
          i <= 5
            ? ({ br: { state: f === "24" ? "offen" : "abgerechnet", ev: f === "24" ? "B-24" : "B-" + j } } as never)
            : i === 6
              ? ({ band: { state: "abgerechnet", ev: "N-" + j } } as never)
              : ({ tube: { state: "abgerechnet", ev: "R-" + j } } as never);
      }
    });
  });
  return {
    jaws: {
      OK: { active: true, teeth: teeth.OK, unknown: false, wire: { state: "bestaetigt", material: "NiTi", ev: "W-OK" } },
      UK: { active: true, teeth: teeth.UK, unknown: false, wire: { state: "abgerechnet", material: "Edelstahl", ev: "W-UK" } },
    },
    unkLabel: "",
  };
}

function ctx(key: string, label: string, data: Record<string, unknown>) {
  return { "data-iknow-key": key, "data-iknow": JSON.stringify({ label, ...data }) };
}

function Row(props: { k: string; tone: string; title: string; tag: string; small: string; data: Record<string, unknown>; onHover: (k: string | null) => void }) {
  return (
    <div
      className="jrow"
      data-tone={props.tone}
      data-hl={props.k}
      {...ctx(props.k, props.title, { status: props.tag, details: props.small, ...props.data })}
      onMouseEnter={() => props.onHover(props.k)}
      onMouseLeave={() => props.onHover(null)}
    >
      <i />
      <span className="jrow__t">
        <span className="jrow__h">
          <b>{props.title}</b>
          <span className="jtag">{props.tag}</span>
        </span>
        <small>{props.small}</small>
      </span>
    </div>
  );
}

export default function PracticeScreen({ onViewer }: { onViewer: (v: Viewer | null) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);

  const mount = useCallback(() => {
    const E3 = (window as unknown as { E3?: E3Api }).E3;
    if (!E3 || !cv.current || viewer.current) return;
    viewer.current = E3.mountModel(cv.current, facts(), {});
    onViewer(viewer.current);
  }, [onViewer]);

  useEffect(() => {
    mount();
    return () => {
      viewer.current?.destroy?.();
      viewer.current = null;
      onViewer(null);
    };
  }, [mount, onViewer]);

  const hover = (k: string | null) => viewer.current?.highlight(k ? [k] : null);

  return (
    <>
      <Script src="/engine.js" strategy="afterInteractive" onReady={mount} />
      <main className="sheet" aria-label="Patientenansicht">
        <header className="head">
          <button className="back" type="button">← Leitstand</button>
          <div className="who">
            <h1>Hoffmann, Lea</h1>
            <div className="chips">
              <span className="chip room">heute Zimmer 2, 09:05</span>
              <span className="chip">geb. 14.03.2013</span>
              <span className="chip">Kasse, AOK Plus</span>
              <span className="chip">beide Kiefer</span>
              <span className="chip">Feste Phase seit 12.02.2025</span>
            </div>
          </div>
          <div className="prog" {...ctx("fortschritt", "Fortschritt heute", { stufe: "Im Behandlungskonto", naechster_schritt: "Prüfung bei Sabine" })}>
            <span className="lbl">Wo Lea heute steht</span>
            <div className="bars"><i className="d" /><i className="d" /><i className="c" /><i /><i /><i /></div>
            <div className="now">Im Behandlungskonto <span>· nächster Schritt: Prüfung bei Sabine</span></div>
          </div>
        </header>

        <div className="body">
          <section className="left" aria-label="Planungsmodell">
            <div className="model-stage">
              <div className="model-state"><span className="lbl">Zustand laut Behandlungskonto</span><b>Feste Phase</b><small>seit 12.02.2025, 7. Behandlungsquartal</small></div>
              <canvas ref={cv} id="cv" data-iknow-key="modell" data-iknow={JSON.stringify({ label: "Planungsmodell", hinweis: "3D-Modell, zeigt nur Belegtes mit Zahnnummer" })} role="img" aria-label="Planungsmodell" />
              <div className="mlabs">
                <div className="jcard" data-lab="OK:card">
                  <div className="jcard__head"><b>OK</b><span>Oberkiefer</span></div>
                  <Row k="W-OK" tone="bestaetigt" title="128 · Bogen" tag="bestätigt" small="NiTi · heute gewechselt" data={{ kiefer: "Oberkiefer", boegen_topf: "6 von 10 verbraucht" }} onHover={hover} />
                  <Row k="B-24" tone="offen" title="126a · 1 Bracket" tag="zu prüfen" small="Zahn 24 · neu geklebt, Position fehlt" data={{ kiefer: "Oberkiefer", zahn: "24", scribe: "heute 09:31 Bracket 24 neu geklebt" }} onHover={hover} />
                  <Row k="B-OK" tone="abgerechnet" title="126a · 9 Brackets" tag="abgerechnet" small="Zahn 15 bis 25" data={{ kiefer: "Oberkiefer", eingesetzt: "12.02.2025" }} onHover={hover} />
                  <Row k="N-OK" tone="abgerechnet" title="126b · 2 Bänder" tag="abgerechnet" small="Zahn 16, 26" data={{ kiefer: "Oberkiefer" }} onHover={hover} />
                </div>
                <div className="jcard" data-lab="UK:card">
                  <div className="jcard__head"><b>UK</b><span>Unterkiefer</span></div>
                  <Row k="W-UK" tone="abgerechnet" title="128 · Bogen" tag="abgerechnet" small="Edelstahl" data={{ kiefer: "Unterkiefer" }} onHover={hover} />
                  <Row k="B-UK" tone="abgerechnet" title="126a · 10 Brackets" tag="abgerechnet" small="Zahn 35 bis 45" data={{ kiefer: "Unterkiefer", eingesetzt: "12.02.2025" }} onHover={hover} />
                  <Row k="N-UK" tone="abgerechnet" title="126b · 2 Bänder" tag="abgerechnet" small="Zahn 36, 46" data={{ kiefer: "Unterkiefer" }} onHover={hover} />
                </div>
              </div>
              <div className="model-legend"><span data-tone="abgerechnet"><i />abgerechnet</span><span data-tone="bestaetigt"><i />bestätigt</span><span data-tone="offen"><i />zu prüfen</span><span className="mhint">Zeigen hebt hervor, ziehen dreht</span></div>
            </div>
          </section>

          <aside className="right" aria-label="Infos zu Lea">
            <div className="card miss" {...ctx("abschlag", "Es fehlt: Abschlag fällig", { quartal: "Q4 2026", abgerechnet: "Q1 bis Q3", wer: "Sabine", plus: "Bracket 24 noch keiner Position zugeordnet" })}>
              <span className="lbl" style={{ color: "#9A3412" }}>Es fehlt</span>
              <h3>Abschlag fällig</h3>
              <p>Für dieses Quartal ist der Abschlag fällig und wartet auf Bestätigung. Dazu ist ein Bracket an Zahn 24 neu geklebt und noch keiner Position zugeordnet.</p>
              <div className="whoBox"><i>S</i>Dran: Sabine</div>
            </div>

            <div className="card" {...ctx("heute", "Heute in der Praxis", { verlauf: PAGE_CONTEXT.heute })}>
              <span className="lbl">Heute in der Praxis</span>
              <ul className="tl">
                <li><time>08:52</time>Angemeldet am Empfang, Anamnese aktuell</li>
                <li><time>09:05</time>Zimmer 2, Behandlung bei Dr. Schubert</li>
                <li><time>09:31</time>In Scribe dokumentiert und bestätigt</li>
                <li className="open"><time>jetzt</time><b>Im Behandlungskonto, wartet auf Sabine</b></li>
                <li className="next"><time>danach</time>Rechnung ins Portal, Familie wird benachrichtigt</li>
              </ul>
            </div>

            <div className="card" {...ctx("scribe", "Scribe-Einträge", { eintraege: PAGE_CONTEXT.scribe })}>
              <span className="lbl">Scribe</span>
              <div className="scr"><div className="top"><span>heute, 09:31 · Zimmer 2</span><span>Dr. Schubert</span></div>
                <p>Bogenwechsel OK auf NiTi 0.016. Bracket 24 neu geklebt. UK Kontrolle, Bogen bleibt.</p>
                <div className="tags"><span className="ok">bestätigt</span><span>heute gemacht</span><span>Bogen OK</span><span>Bracket 24</span></div></div>
              <div className="scr"><div className="top"><span>02.10.2026 · Zimmer 1</span><span>Dr. Schubert</span></div>
                <p>Kontrolle, Bögen nachgespannt OK und UK. Mundhygiene gut.</p>
                <div className="tags"><span className="ok">bestätigt</span><span>abgerechnet</span></div></div>
            </div>

            <div className="card" {...ctx("konto", "Behandlungskonto", PAGE_CONTEXT.behandlung)}>
              <span className="lbl">Behandlungskonto</span>
              <div className="kv">
                <div><small>Behandlungsquartal</small><b>7 <span>von 12</span></b><div className="meter"><i style={{ width: "58%" }} /></div></div>
                <div><small>Bögen verbraucht</small><b>6 <span>von 10</span></b><div className="meter"><i style={{ width: "60%" }} /></div></div>
                <div className="warn"><small>Abschlag Q4 2026</small><b>wartet auf Sabine</b></div>
                <div><small>Plan</small><b style={{ fontSize: 16 }}>genehmigt</b></div>
              </div>
            </div>

            <div className="card" {...ctx("rechnungen", "Rechnungen und Zahlung", { eintraege: PAGE_CONTEXT.rechnungen })}>
              <span className="lbl">Rechnungen und Zahlung</span>
              <div className="pay"><span><b>Zusatzleistung Q3</b><small>im Portal, von der Familie geöffnet</small></span><span className="st ok">heute gebucht</span></div>
              <div className="pay"><span><b>Abschlag Q4</b><small>entsteht nach Sabines Bestätigung</small></span><span className="st wait">noch offen</span></div>
            </div>
            <p className="draft">Beispieldaten</p>
          </aside>
        </div>
      </main>
    </>
  );
}
