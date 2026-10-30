import type { AskRequest } from "./types";

/**
 * Probelauf ohne Modell: vorgefertigte Antworten im selben Zeilenprotokoll wie das Modell,
 * damit Live-Zeichnen und Stimme ohne Schlüssel testbar sind. In der Oberfläche als Probelauf gekennzeichnet.
 */
export function mockLines(req: AskRequest): string[] {
  const keys = (req.items ?? []).map((i) => i.key);
  if (/3d|räumlich/i.test(req.question)) {
    return [
      '@meta {"kind":"frei","title":"Leas Oberkiefer in 3D","focus":["B-24"]}',
      "@say Hier ist der Bogen räumlich, du kannst ihn mit der Maus drehen.",
      "@three",
      "const curve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => { const t = i / 11 * Math.PI; return new THREE.Vector3(-Math.cos(t) * 2.6, 0, -Math.sin(t) * 1.9); }));",
      "scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.04, 8, false), mat(C.teal, { metalness: 0.7, roughness: 0.25 })));",
      "for (let i = 0; i < 10; i++) { const p = curve.getPoint(0.05 + i * 0.1); const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.34), mat(C.tooth, { roughness: 0.6 })); t.position.set(p.x, -0.06, p.z); t.lookAt(0, -0.06, 0.6); scene.add(t);",
      "  const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.07), mat(i === 8 ? C.orange : C.ink, { metalness: 0.5 })); b.position.copy(t.position); b.lookAt(0, 0, 0.6); b.translateZ(-0.2); scene.add(b); }",
      "const p8 = curve.getPoint(0.85); label('Zahn 24', p8.x + 0.3, 0.8, p8.z, '#9A3412'); label('Draht zieht die Zähne in Form', 0, 1.3, -1.9, '#0B5761');",
      "@endthree",
      "@say Orange ist das Bracket an Zahn 24, das noch geprüft wird.",
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
