# IKnow Testlabor

Bereich umrahmen, fragen, IKnow zeigt die Antwort als Grafik. Testlabor mit nachgestellter Patientin (Beispieldaten).

## Was es kann
- **Quelle Daten aus der App:** IKnow liest die Einträge im Rahmen direkt aus der Seite (`data-iknow-key`, `data-iknow`). Kein Bildschirmfoto.
- **Quelle Bildschirmfoto:** wie Clicky. Bildschirmfreigabe über die Screen Capture API des Browsers (`getDisplayMedia`), Standbild, umrahmen. Funktioniert auch mit anderen Fenstern.
- **Darstellung:** Automatisch, Baustein (feste Grafiken: timeline, pool, teeth, bars, steps, cards) oder Frei gezeichnet (Modell schreibt HTML/SVG/Canvas, läuft im abgeschotteten iframe ohne Netz).
- **Modus:** GPT-6.1 Sol mit `service_tier: "ultrafast"` oder Standard. Messwerte je Anfrage: Zeit bis zur ersten Antwort, Gesamtzeit, Tokens, geschätzte Kosten.
- Nur lesen und zeigen. Nichts wird gespeichert (`store: false`, keine Datenbank, kein Logging von Inhalten).

## Bedienung
- Unten rechts „IKnow fragen“ oder **Leertaste halten und sprechen**, dann frei um den Bereich zeichnen. Die gesprochene Frage wird nach dem Umranden automatisch gestellt.
- In der Antwort: Leertaste halten für eine Folgefrage, oder tippen, oder die Schnellknöpfe.

## Umgebungsvariablen (Vercel, Production)
| Name | Inhalt |
|---|---|
| `OPENAI_API_KEY` | Schlüssel aus dem OpenAI-Projekt IKnow (als Sensitive) |
| `IKNOW_ACCESS_CODE` | Zugangscode für das Testlabor. Ohne ihn antwortet die API in Production nicht. |
| `IKNOW_DATA_RESIDENCY` | `eu` erst, wenn das OpenAI-Projekt in der Region Europa liegt. Bis dahin leer lassen. |
| `IKNOW_MOCK` | `1` = Probelauf ohne Modell |
| `ELEVENLABS_API_KEY` | Schlüssel von ElevenLabs für die Stimme (Sensitive) |
| `ELEVENLABS_VOICE_ID` | Voice-ID der gewünschten Stimme |
| `IKNOW_STT_MODEL` | optional, Diktat-Modell, Standard `gpt-4o-transcribe` |
| `ELEVENLABS_MODEL` | optional, Standard `eleven_multilingual_v2`, schneller: `eleven_flash_v2_5` |

Ohne `OPENAI_API_KEY` läuft automatisch der Probelauf mit vorgefertigten Antworten.

## Wichtig bis zur EU-Freischaltung
Das aktuelle OpenAI-Projekt ist global. Nur Beispieldaten verwenden, im Bildschirmfoto-Modus keine echten Patientendaten aufnehmen.

## Entwicklung
```bash
npm ci
npm run dev
```

## Quellen
- OpenAI Ultrafast: https://developers.openai.com/api/docs/guides/ultrafast-mode
- OpenAI Bilder und Vision: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Streaming: https://developers.openai.com/api/docs/guides/streaming-responses
- MDN getDisplayMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- Next.js Streaming in Route Handlers: https://nextjs.org/docs/app/guides/streaming
- three.js 0.186.1 (MIT, Lizenz unter public/vendor/three@0.186.1/LICENSE), selbst gehostet, mit esbuild verkleinert, per Import-Map im abgeschotteten 3D-Rahmen: https://threejs.org/manual/en/installation
- Planungsmodell-Engine: Kopie aus anima-abrechnung/vendor/prototype/src/engine.js (plus `window.E3 = E3`)
