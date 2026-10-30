/**
 * Feste Wissensbasis von IKnow. Jede Datei ein Thema, gepflegt von Claude oder Codex im Repo.
 * Quellen stehen pro Thema dabei. Wird als fester Teil des System-Prompts geschickt (zwischengespeichert).
 */
export interface Wissen { id: string; titel: string; quelle: string; text: string }

export const WISSEN: Wissen[] = [
  {
    id: "zahnspange",
    titel: "So funktioniert eine feste Zahnspange",
    quelle: "Allgemeines KFO-Fachwissen",
    text: `- Brackets sind kleine Halter, die auf die Vorderseite der Zähne geklebt werden. Sie greifen den Draht und übertragen seine Kraft auf den Zahn.
- Der Bogen (Draht) läuft durch alle Brackets. Er möchte in seine ursprüngliche, ideale Form zurück und schiebt die Zähne dabei mit sanfter, gleichmäßiger Kraft Stück für Stück in die richtige Position.
- Der Knochen baut sich dabei um: Auf der Druckseite wird Knochen abgebaut, auf der Zugseite neu gebildet. Deshalb bewegen sich Zähne langsam, über Monate.
- Bänder sind Metallringe um die hinteren Backenzähne (meist die 6er). Sie sind die festen Anker, an denen der Bogen hinten hält. Röhrchen nehmen das Bogenende auf.
- Bogenwechsel: Man beginnt mit dünnen, elastischen Bögen (oft Nickel-Titan, NiTi), die auch schiefe Zähne schonend erreichen. Später kommen dickere, steifere Bögen (oft Edelstahl), die die Feinheiten und den Biss einstellen.
- Bei der Kontrolle (etwa alle 4 bis 8 Wochen) prüft die Praxis den Fortschritt, wechselt oder aktiviert Bögen und klebt gelöste Brackets neu.
- Löst sich ein Bracket, wird es neu geklebt, damit der Bogen an diesem Zahn wieder wirken kann.
- Gummizüge, Federn oder Ketten ergänzen den Bogen, um Lücken zu schließen oder den Biss zu korrigieren.
- Nach der aktiven Phase folgt die Retention: Retainer (dünner Draht innen) oder herausnehmbare Spangen halten das Ergebnis.
- Oberkiefer (OK) ist oben, Unterkiefer (UK) unten. Zahnnummern nach FDI: erste Ziffer Quadrant (1 oben rechts, 2 oben links, 3 unten links, 4 unten rechts aus Sicht des Patienten), zweite Ziffer Zahn von der Mitte aus (1 mittlerer Schneidezahn bis 7 zweiter Backenzahn). Zahn 24 ist also der erste kleine Backenzahn oben links.`,
  },
  {
    id: "bema-goz",
    titel: "Abrechnungsziffern BEMA und GOZ",
    quelle: "Katalog des Abrechnungsmoduls (KZBV BEMA 01.01.2026, GOZ Anlage 1), Antworten von Sabine vom 12.10. und 14.10.2026",
    text: `- Punkte je Ziffer (BEMA): 12 Separieren je Kieferhälfte oder Frontzahnbereich 10; 7a Abformung für Planungsmodelle 19 (bis 3× je Behandlung); 116 Foto mit Auswertung 15 (bis 4×); 117 Modellanalyse 35 (bis 3×); 118 Auswertung Fernröntgenseitenbild 29 (bis 2×); Ä934a Fernröntgenseitenbild (FRS) 19 (bis 2×); Ä935d Panoramaschichtaufnahme (OPG) 36; 126a Bracket oder Attachment eingegliedert 18; 126b Band eingegliedert 42; 126c Band wieder eingegliedert 30; 126d Bracket, Band oder Attachment entfernt 6; 127a Teilbogen eingegliedert 25; 127b Teilbogen ausgegliedert 7; 128a konfektionierter Vollbogen 32; 128b individualisierter Vollbogen 40; 128c Bogen ausgegliedert 9; 129 Bogen wieder eingegliedert 24; 130 ergänzende festsitzende Apparatur 72; 131a Gaumennahterweiterung (GNE) 50; 131b Herbstscharnier je Seite 50; 131c Gesichtsmaske 50.
- Privat (GOZ): 6150 Eingliederung eines ungeteilten Bogens, je Kiefer, 500 Punkte (früher 615, in IVORIS 6150). 2030 besondere Maßnahmen, 65 Punkte.
- 126a: Eingliedern eines Brackets oder Attachments einschließlich Kleben, Edelstahl oder nickelfreies Metall inklusive Material und Labor. Neukleben ist erneut 126a. Geklebte Röhrchen laufen als 126a, bis die KZV Sachsen etwas anderes bestätigt; Röhrchen auf einem Band sind 126b. Andere Bracketarten sind Mehrleistung.
- 126b: Band eingegliedert, angeschweißte Röhrchen inklusive. 126c: rezementiertes Band, laut Praxis höchstens 5× während der Behandlung, weil mehr bei den Kassen zum Regress führte.
- 128a: Laut Praxis genehmigt die Kasse höchstens 8 konfektionierte Bögen pro Behandlungsplan für beide Kiefer zusammen. Nach 4× 128a folgt meist ein 128b.
- 128b: individualisierter Vollbogen aus Edelstahl. Bei den Stichworten Reverse-Bogen oder T-Loop wird 128b abgerechnet, solange im Plan noch 128b frei ist.
- 128c: Bei jedem Bogenwechsel werden der neue Bogen und 128c für den alten abgerechnet ("14 Bögen rein, 14 raus").
- 129: wieder eingesetzter Voll- oder Teilbogen, höchstens 5× während der Behandlung (Regressgefahr darüber).
- 127a und 127b: Teilbogen aus Edelstahl ein- und ausgegliedert. Anderes Material ist Mehrleistung mit Vordruck 4d.
- Bdex (Ende der festen Phase, alles wird entfernt): 128c 2× und 126d je entferntem Teil. Danach steht das Journal in IVORIS auf Null.
- 12 Separieren: mit Zahnangabe. Zählt als KFO-Leistung, startet die Behandlung und löst den Abschlag aus. Möglich während der ganzen Behandlung, aber nur, solange Multiband im Mund ist; danach droht Regress.
- 130: Aufzählung abschließend, daneben bis 2× 126b für die Ankerbänder, beim Entfernen 2× 128c. 131a GNE: daneben bis 4× 126b, Material und Labor extra. 131b Herbstscharnier nur bei spätem Beginn, wenn konventionell nicht erreichbar, je Seite bis 4× 126b. 131c Gesichtsmaske: Material und Labor extra.
- 7a: Intraoralscan ist 7aD und damit Mehrleistung mit Vordruck 4d. 117 je 7a, auch digital. Röntgen (Ä934a, Ä935d) und Separieren sind vom Eigenanteil befreit.
- Privat 6150: höchstens 14 Bögen für beide Kiefer zusammen, was darüber beantragt wird, zahlt der Patient zu 100 %. Das Wiedereinsetzen ist damit abgegolten. GOÄ-Nummern nutzt die Praxis nicht.
- Privat und Aligner 2030: solange Schienen getragen werden. Die PKV erkennt 2030 neben Brackets oft nicht an.
- Herausnehmbare Geräte sind mit dem Abschlag (119/120) abgegolten, die Laborkosten laufen nach BEL II mit den sächsischen Preisen.
- Kontingente: Die Mengen je Ziffer im Behandlungsplan bilden einen Topf. Laut Praxis darf minimal überzogen werden, sonst wird ein Nachantrag gestellt. Bei 129 und 126c gilt die feste Obergrenze 5.`,
  },
  {
    id: "abschlaege",
    titel: "Abschläge und Behandlungsquartale",
    quelle: "Antworten von Sabine vom 12.10. und 14.10.2026, BEMA 119 und 120, Entscheidung der Praxis 10/2026",
    text: `- 119 (a bis d) ist der Abschlag für die Umformung je Kiefer, also OK-Abschlag und UK-Abschlag. 120 (a bis d) ist die Bisslage, sie wird seltener beantragt. Den Schwierigkeitsgrad legt Frau Dr. Schubert fest.
- Der Abschlag wird beim 1. Termin im Quartal angeklickt und gilt für das ganze Quartal. Kommt der Patient im Quartal nicht, gibt es weder Leistung noch Abschlag; die Behandlungszeit verlängert sich entsprechend.
- Höchstens 12 Abschläge, bei einer 6-Quartals-Behandlung (Frühbehandlung) 6. Eine Verlängerung bringt meist noch einmal 4. Die 12 Abschläge können bis zu 16 Behandlungsquartale abdecken.
- Die Behandlung beginnt mit der 1. KFO-Leistung, auch schon mit dem Separieren.
- Behandlungsquartale zählen in Anima Cura ab Behandlungsbeginn, nicht nach Kalenderquartal.
- Üblich sind 2 Bögen pro Behandlungsquartal, in Ausnahmen 4. Weniger kann ein fehlender Eintrag sein.
- Im 6. oder 7. Behandlungsquartal sind laut Praxis oft noch Leistungen offen; dann lohnt eine Quartalsprüfung.`,
  },
  {
    id: "mehrkosten",
    titel: "Mehrkosten, Punktwerte und Eigenanteil",
    quelle: "KZV Sachsen Punktwerte IV/2026 (Stand 28.09.2026), § 29 SGB V, Anlage B BMV-Z, Antworten von Sabine und Juan 10/2026",
    text: `- Mehrkostenvereinbarung (MKV, Vordruck 4d): Was über die Kassenleistung hinausgeht (zum Beispiel andere Bracketarten, andere Bogenmaterialien, Intraoralscan), zahlt die Familie selbst. Die Kasse übernimmt den Betrag der vergleichbaren Kassenleistung, der wird auf dem Formular abgezogen.
- Kassenabzug: Anima rechnet ihn mit dem aktuellen KFO-Punktwert der jeweiligen Kasse, nicht mehr mit dem alten Praxis-Punktwert 0,6550 € von 2004/05. Mit dem alten Wert zahlt der Patient zu viel. Anima zeigt den bisherigen Betrag zum Vergleich. Ob Paketpreise sinken, entscheidet Dr. Schubert.
- KFO-Punktwerte Sachsen je Kasse (ab Datum): AOK PLUS 1,1887 € (2025), 1,2481 € (ab 01.01.2026); BKK 1,1754 € (2025), 1,2250 € (2026); IKK classic 1,1535 € (2025), 1,2054 € (ab 01.01.2026), 1,2131 € (ab 01.04.2026); Knappschaft 1,1441 € (2025), 1,1855 € (ab 01.01.2026), 1,2033 € (ab 01.04.2026); SVLFG 1,1407 € (2025), 1,1997 € (2026). Ersatzkassen (DAK, KKH, hkk, HEK 1,1435 €; TK 1,1649 €; BARMER 1,1456 €) stehen auf dem Wert von 2025, für 2026 gibt es noch keine Einigung.
- GOZ-Punktwert: 0,0562421 €. Beispiel: GOZ 6150 mit 500 Punkten sind beim einfachen Satz rund 28,12 €.
- Begriffe in der MKV: Metall-Br. sind Metallbrackets, in der Praxis Minibrackets genannt (andere Sorten nutzt die Praxis nicht). Bd sind Bänder, zum erhöhten Preis Komfortbänder. Prophylaxe ist die Reinigung um die Brackets (PZR), 22,22 € je Sitzung.
- Beispiel aus der Praxis: Ein Paket mit Festpreis 1.627,62 € wird in 24 Raten gezahlt; IVORIS rundet dabei auf 1.627,44 €, weil die Summe sonst nicht durch 24 teilbar ist.
- Offene Frage an die KZV Sachsen: Wird bei Mehrleistungen der volle BEMA-Betrag der Vergleichsleistung abgezogen oder nur der Kassenanteil? Anima zieht bis zur Antwort den vollen Betrag ab.`,
  },
  {
    id: "kuerzel",
    titel: "Kürzel aus Kartei und Scribe",
    quelle: "Antwort von Sabine vom 14.10.2026, Kürzel-Wörterbuch des Scribe-Eingangs",
    text: `Br. Brackets, Bd Bänder, Bg Bogen, GZ Gummizüge, MB Multiband, nT nächster Termin, AA Angelaligner-Schienen, ASR approximale Schmelzreduktion, Abdr Abdruck, AD Anfangsdiagnose, ZD Zwischendiagnose, SD Schlussdiagnose, SD-Brief Schlussbrief, GKV gesetzlich versichert, PKV privat versichert, GA Gutachter, GNE Gaumennahterweiterung, VDP Vorschubdoppelplatte, HG Headgear, LB Lipbumper, QH Quadhelix, TPA Transpalatinalbogen, MKV Mehrkostenvereinbarung, Sep. Separieren, FKO funktionskieferorthopädisches Gerät, o. B. ohne Befund, Wv. Wiedervorstellung, Bdex Entfernen der festen Spange.`,
  },
  {
    id: "praxis",
    titel: "Abläufe und Regeln der Praxis",
    quelle: "Entscheidungen der Praxis 10/2026, Antworten von Sabine",
    text: `- Behandlungsquartale zählen ab Behandlungsbeginn, nicht nach Kalenderquartal.
- Abgerechnet wird nur, was dokumentiert ist. Dokumentiert wird in Scribe.
- Sabine prüft und entscheidet über jede Abrechnung. IKnow schlägt nichts verbindlich vor und ändert nichts.
- Kassenleistungen gehen über IVORIS, was die Familie selbst zahlt, wird eine Rechnung in Anima Cura.
- In IVORIS steht alles, was im Plan steht, im PC-Journal mit dem Verbrauch je Position. Am Ende der Behandlung steht das Journal auf Null.
- Die IVORIS-Schnittstelle liefert heute nur Patienten, Termine, Karteitexte und Dokumente, keine Abrechnungs-, Plan- oder Journaldaten. Bis das geklärt ist, bestätigt Sabine die Historie je Fall und überträgt Positionen aus dem Abrechnungsentwurf von Hand nach IVORIS.
- Das Ende der festen Phase ist das Bdex. Herausnehmbare Spangen danach laufen über Abschlag und Laborabrechnung.
- Termine plant die Praxis mit Doctolib. Wer wann da war, kommt in Anima Cura aus der Dokumentation in Scribe.
- In der Praxis sind alle per Du. Patientennamen schreibt die Praxis mit Nachname zuerst.`,
  },
];

export function wissenText(list: Wissen[] = WISSEN): string {
  return list.map((w, i) => `WISSEN ${i + 1}: ${w.titel.toUpperCase()} (Quelle: ${w.quelle})\n${w.text}`).join("\n\n");
}
