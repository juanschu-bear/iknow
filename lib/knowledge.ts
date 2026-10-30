/**
 * Wissensbasis für IKnow in der Kieferorthopädie.
 * Teil 1: allgemeines Fachwissen, das IKnow immer erklären darf.
 * Teil 2: Abrechnungsziffern und Regeln aus dem geprüften Katalog des Abrechnungsmoduls
 *         (anima-abrechnung/vendor/prototype/src/core.js und catalog.js, BEMA-Stand der Vorlage).
 * Teil 3: feste Regeln der Praxis.
 * Wird als fester Teil des System-Prompts mitgeschickt und dadurch vom Anbieter zwischengespeichert.
 */
export const KFO_KNOWLEDGE = `
WISSEN 1: SO FUNKTIONIERT EINE FESTE ZAHNSPANGE (allgemein, darfst du immer erklären)
- Brackets sind kleine Halter, die auf die Vorderseite der Zähne geklebt werden. Sie greifen den Draht und übertragen seine Kraft auf den Zahn.
- Der Bogen (Draht) läuft durch alle Brackets. Er möchte in seine ursprüngliche, ideale Form zurück und schiebt die Zähne dabei mit sanfter, gleichmäßiger Kraft Stück für Stück in die richtige Position.
- Der Knochen baut sich dabei um: Auf der Druckseite wird Knochen abgebaut, auf der Zugseite neu gebildet. Deshalb bewegen sich Zähne langsam, über Monate.
- Bänder sind Metallringe um die hinteren Backenzähne (meist die 6er). Sie sind die festen Anker, an denen der Bogen hinten hält. Röhrchen nehmen das Bogenende auf.
- Bogenwechsel: Man beginnt mit dünnen, elastischen Bögen (oft Nickel-Titan, NiTi), die auch schiefe Zähne schonend erreichen. Später kommen dickere, steifere Bögen (oft Edelstahl), die die Feinheiten und den Biss einstellen.
- Bei der Kontrolle (etwa alle 4 bis 8 Wochen) prüft die Praxis den Fortschritt, wechselt oder aktiviert Bögen und klebt gelöste Brackets neu.
- Löst sich ein Bracket, wird es neu geklebt, damit der Bogen an diesem Zahn wieder wirken kann.
- Gummizüge, Federn oder Ketten ergänzen den Bogen, um Lücken zu schließen oder den Biss zu korrigieren.
- Nach der aktiven Phase folgt die Retention: Retainer (dünner Draht innen) oder herausnehmbare Spangen halten das Ergebnis.
- Oberkiefer (OK) ist oben, Unterkiefer (UK) unten. Zahnnummern nach FDI: erste Ziffer Quadrant (1 oben rechts, 2 oben links, 3 unten links, 4 unten rechts aus Sicht des Patienten), zweite Ziffer Zahn von der Mitte aus (1 mittlerer Schneidezahn bis 7 zweiter Backenzahn). Zahn 24 ist also der erste kleine Backenzahn oben links.

WISSEN 2: ABRECHNUNGSZIFFERN (aus dem geprüften Katalog des Abrechnungsmoduls)
- 126a: Bracket oder Attachment eingegliedert, je Stück, Edelstahl oder nickelfreies Metall inklusive Material und Labor. Neukleben ist erneut 126a, als Ersatz "außerplanmäßig" gekennzeichnet. Andere Bracketarten sind Mehrleistung.
- 126b: Band eingegliedert, je Stück, inklusive Material und Labor; angeschweißte Röhrchen sind inklusive.
- 126c: Band wieder eingegliedert. 126d: Bracket, Band oder Attachment entfernt.
- 127a: Teilbogen eingegliedert. 127b: Teilbogen ausgegliedert.
- 128a: konfektionierter Vollbogen aus Edelstahl, je Bogen; anderes Material ist Mehrleistung. 128b: individualisierter Vollbogen aus Edelstahl. 128c: Bogen ausgegliedert. 129: Bogen wieder eingegliedert.
- 119a bis d: Umformung eines Kiefers inklusive Retention, je Kiefer; die Vergütung läuft über Abschläge je Behandlungsquartal (höchstens 12), Voraussetzung ist mindestens 1 KFO-Leistung im Kalenderquartal.
- AB: Abschlag je Behandlungsquartal.
- Die Mengen pro Behandlungsplan (zum Beispiel wie viele Bögen) bilden einen Topf, der mitgezählt wird.

WISSEN 3: REGELN DIESER PRAXIS
- Behandlungsquartale zählen ab Behandlungsbeginn, nicht nach Kalenderquartal.
- Abgerechnet wird nur, was dokumentiert ist. Dokumentiert wird in Scribe.
- Sabine prüft und entscheidet über jede Abrechnung. IKnow schlägt nichts verbindlich vor und ändert nichts.
- Kassenleistungen gehen über IVORIS, was die Familie selbst zahlt, wird eine Rechnung in Anima Cura.
`;
