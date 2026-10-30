import type { AskRequest } from "./types";

/**
 * Probelauf ohne Modell: vorgefertigte Antworten im selben Zeilenprotokoll wie das Modell,
 * damit Live-Zeichnen und Stimme ohne Schlüssel testbar sind. In der Oberfläche als Probelauf gekennzeichnet.
 */
export function mockLines(req: AskRequest): string[] {
  const keys = (req.items ?? []).map((i) => i.key);
  if (req.render === "baustein" || keys.includes("abschlag")) {
    return [
      '@meta {"kind":"baustein","title":"Warum der Abschlag offen ist","focus":[]}',
      "@say Die Abschläge laufen pro Behandlungsquartal.",
      '@data {"baustein":"timeline","daten":{"steps":[{"label":"Q1","state":"done"},{"label":"Q2","state":"done"},{"label":"Q3","state":"done"},{"label":"Q4","state":"now"},{"label":"Q1/27","state":"next"}],"badge":"wartet auf Sabine"}}',
      "@say Q1 bis Q3 sind bei Lea schon abgerechnet.",
      "@say Für Q4 fehlt nur noch Sabines Bestätigung, dann entsteht die Rechnung automatisch.",
      "@end",
    ];
  }
  return [
    '@meta {"kind":"frei","title":"Leas Oberkiefer auf einen Blick","focus":["B-24"]}',
    "@say Schau, das ist Leas Oberkiefer mit 10 Brackets.",
    '@svg <path d="M40 210 Q 210 40 380 210" fill="none" stroke="#C9D3D2" stroke-width="5" stroke-linecap="round"/>',
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
      const t = i / 9, x = 40 + 340 * t, y = 210 - 340 * t * (1 - t);
      return `@svg <rect x="${(x - 11).toFixed(0)}" y="${(y - 11).toFixed(0)}" width="22" height="22" rx="6" fill="#FFFFFF" stroke="${i === 8 ? "#EA7A3C" : "#10242A"}" stroke-width="${i === 8 ? 3 : 1.5}"/>`;
    }),
    "@say 9 davon sind mit der 126a abgerechnet, je Zahn 1 Position.",
    '@svg <rect x="40" y="240" width="200" height="34" rx="10" fill="#F4F7F6" stroke="#10242A" stroke-width="1.2"/>',
    '@svg <text x="56" y="262" font-size="13" font-weight="700" fill="#10242A">9 abgerechnet</text>',
    "@say Das Bracket an Zahn 24 wurde heute neu geklebt und steht deshalb auf zu prüfen.",
    '@svg <rect x="250" y="240" width="130" height="34" rx="10" fill="#FFF0E6" stroke="#EA7A3C" stroke-width="1.5"/>',
    '@svg <text x="264" y="262" font-size="13" font-weight="700" fill="#9A3412">Zahn 24 prüfen</text>',
    '@svg <path d="M318 238 L 336 118" fill="none" stroke="#EA7A3C" stroke-width="2" stroke-dasharray="5 4"/>',
    "@say Ob dafür eine neue Position entsteht, entscheidet Sabine.",
    "@end",
  ];
}
