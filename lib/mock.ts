import type { AskRequest } from "./types";

/**
 * Probelauf ohne Modell: vorgefertigte Antworten im selben Zeilenprotokoll wie das Modell,
 * damit Live-Zeichnen und Stimme ohne Schlüssel testbar sind. In der Oberfläche als Probelauf gekennzeichnet.
 */
export function mockLines(req: AskRequest): string[] {
  const keys = (req.items ?? []).map((i) => i.key);
  if (/aligner|schiene/i.test(req.question)) {
    const d = (o: object) => "@do " + JSON.stringify(o);
    return [
      '@meta {"kind":"kiefer","title":"So bewegen Aligner die Zähne","focus":[]}',
      "@say Schau mal, hier siehst du einen Oberkiefer, bei dem die Frontzähne zu eng stehen und sich gegenseitig verdrehen.",
      "@point Ausgangslage: Front steht eng",
      d({ cmd: "kiefer", kiefer: "OK" }), d({ cmd: "engstand", kiefer: "OK", bereich: "front", staerke: "stark" }), d({ cmd: "kamera", ansicht: "front" }),
      "@say Bei Alignern klebt man zuerst kleine Halter auf einige Zähne, die heißen Attachments und geben der Schiene Griff.",
      "@point Attachments geben der Schiene Halt",
      d({ cmd: "attachments", kiefer: "OK", von: "13", bis: "23" }),
      "@say Dann kommt die durchsichtige Schiene drüber, und jede Schiene ist ein kleines bisschen anders geformt als die Zähne gerade stehen.",
      "@point Jede Schiene minimal versetzt",
      d({ cmd: "schiene", kiefer: "OK", an: true }), d({ cmd: "kamera", ansicht: "schraeg" }),
      "@say Das Spannende ist: Die Zähne folgen dieser Form Schritt für Schritt, alle 1 bis 2 Wochen gibt es die nächste Schiene.",
      "@point Schrittweise Bewegung, Schiene für Schiene",
      d({ cmd: "einreihen", kiefer: "OK", dauer: 5, schritte: 4 }),
      "@say Am Ende stehen die Zähne in einer schönen Reihe, die Schiene und die Attachments kommen wieder ab.",
      "@point Ziel erreicht, Schiene ab",
      d({ cmd: "entfernen", was: "schiene" }), d({ cmd: "entfernen", was: "attachments" }),
      "@say Damit nichts zurückwandert, hält danach ein dünner Retainer innen die Front fest.",
      "@point Retainer hält das Ergebnis",
      d({ cmd: "retainer", kiefer: "OK" }), d({ cmd: "schild", zahn: "21", text: "Retainer innen" }),
      "@end",
    ];
  }
  if (/3d|räumlich|engstand|bracket|draht|spange/i.test(req.question)) {
    const d = (o: object) => "@do " + JSON.stringify(o);
    return [
      '@meta {"kind":"kiefer","title":"So reihen Brackets und Draht die Zähne ein","focus":[]}',
      "@say Schau mal, das ist ein Mustermodell vom Oberkiefer, und vorne stehen die Zähne zu eng, sie drehen sich und schieben sich übereinander.",
      "@point Engstand in der Front",
      d({ cmd: "kiefer", kiefer: "OK" }), d({ cmd: "engstand", kiefer: "OK", bereich: "front", staerke: "stark" }), d({ cmd: "kamera", ansicht: "oben" }),
      "@say Zuerst kommen hinten Bänder um die großen Backenzähne, die sind sozusagen die Anker.",
      "@point Bänder als Anker an den 6ern",
      d({ cmd: "baender", kiefer: "OK" }), d({ cmd: "kamera", ansicht: "schraeg" }),
      "@say Dann setzt man auf jeden Zahn ein kleines Bracket, das ist der Halter für den Draht.",
      "@point Bracket auf jeden Zahn",
      d({ cmd: "brackets", kiefer: "OK" }),
      "@say Jetzt wird der Draht eingefädelt, und du siehst, wie er sich erst mal an die schiefen Zähne anpassen muss.",
      "@point Draht folgt erst den schiefen Zähnen",
      d({ cmd: "draht", kiefer: "OK", art: "duenn" }), d({ cmd: "markiere", zaehne: ["12", "22"], farbe: "orange" }),
      "@say Der Draht will aber in seine runde Form zurück, und genau diese Kraft schiebt die Zähne ganz sanft in Richtung Reihe.",
      "@point Draht will zurück in Form",
      d({ cmd: "pfeil", zahn: "12", richtung: "aussen", text: "sanfte Kraft" }), d({ cmd: "pfeil", zahn: "21", richtung: "innen" }),
      "@say Über Monate baut sich der Knochen um, und die Zähne gleiten Stück für Stück an ihren Platz.",
      "@point Knochen baut um, Zähne reihen sich ein",
      d({ cmd: "leeren" }), d({ cmd: "einreihen", kiefer: "OK", dauer: 4 }),
      "@say Am Ende ist der Draht schön gleichmäßig rund, und die Front steht ordentlich in einer Linie.",
      "@point Ergebnis: gerade Front",
      d({ cmd: "kamera", ansicht: "front" }), d({ cmd: "schild", zahn: "11", text: "Front ausgerichtet" }),
      "@end",
    ];
  }
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
