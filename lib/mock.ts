import type { AskRequest, IKnowAnswer } from "./types";

/**
 * Probelauf ohne Modell: vorgefertigte Antworten, damit die Oberfläche ohne Schlüssel testbar ist.
 * Wird in der Oberfläche deutlich als Probelauf gekennzeichnet.
 */
export function mockAnswer(req: AskRequest): IKnowAnswer {
  const keys = (req.items ?? []).map((i) => i.key);
  const wantFree = req.render === "frei";
  if (wantFree) {
    return {
      kind: "frei",
      title: "Probelauf: frei gezeichnete Grafik",
      text: "Das ist eine vorgefertigte freie Grafik. Mit Schlüssel zeichnet das Modell sie aus deiner Frage.",
      baustein: "none",
      baustein_data: "",
      html:
        '<svg viewBox="0 0 400 160" width="100%"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#127380"/><stop offset="1" stop-color="#0B5761"/></linearGradient></defs>' +
        '<path d="M20 120 Q 200 10 380 120" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round"><animate attributeName="stroke-dasharray" from="0,600" to="600,0" dur="1.2s" fill="freeze"/></path>' +
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((i) => {
            const t = i / 9;
            const x = 20 + 360 * t;
            const y = 120 - 220 * t * (1 - t) * 2 * 0.5;
            const c = i === 8 ? "#EA7A3C" : "#10242A";
            return `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="5" fill="#fff" stroke="#C9D3D2"/><rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="2" fill="${c}"/>`;
          })
          .join("") +
        "</svg>",
      focus: keys.includes("B-24") ? ["B-24"] : [],
    };
  }
  if (keys.includes("abschlag")) {
    return {
      kind: "baustein",
      title: "Warum der Abschlag offen ist",
      text: "Die Abschläge Q1 bis Q3 sind abgerechnet. Für Q4 fehlt nur Sabines Bestätigung.",
      baustein: "timeline",
      baustein_data: JSON.stringify({
        steps: [
          { label: "Q1", state: "done" },
          { label: "Q2", state: "done" },
          { label: "Q3", state: "done" },
          { label: "Q4", state: "now" },
          { label: "Q1/27", state: "next" },
        ],
        badge: "wartet auf Sabine",
      }),
      html: "",
      focus: [],
    };
  }
  if (keys.some((k) => k.startsWith("W-"))) {
    return {
      kind: "baustein",
      title: "Bögen: 6 von 10 verbraucht",
      text: "Für Leas Plan sind 10 Bögen vorgesehen, 6 sind verbraucht. Der Wechsel von heute zählt nach Sabines Prüfung als 7.",
      baustein: "pool",
      baustein_data: JSON.stringify({ label: "Bögen dieses Plans", total: 10, used: 6, today: 1 }),
      html: "",
      focus: keys.filter((k) => k.startsWith("W-")),
    };
  }
  return {
    kind: "baustein",
    title: "Bracket an Zahn 24: warum zu prüfen",
    text: "9 Brackets oben sind mit der 126a abgerechnet. Zahn 24 wurde heute neu geklebt, ob dafür eine Position entsteht, entscheidet Sabine.",
    baustein: "teeth",
    baustein_data: JSON.stringify({
      label: "Oberkiefer",
      teeth: [15, 14, 13, 12, 11, 21, 22, 23, 24, 25].map((n) => ({ n, state: n === 24 ? "offen" : "abgerechnet" })),
      callout: { n: 24, text: "heute neu geklebt" },
    }),
    html: "",
    focus: ["B-24"],
  };
}
