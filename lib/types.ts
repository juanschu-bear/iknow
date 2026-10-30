export type Source = "daten" | "screenshot";
export type Tier = "ultrafast" | "standard";
export type RenderPref = "auto" | "baustein" | "frei";

export type BausteinName =
  | "timeline"
  | "pool"
  | "teeth"
  | "bars"
  | "steps"
  | "cards"
  | "modell"
  | "none";

/** Ein Eintrag aus dem umrahmten Bereich (Daten-Modus). */
export interface ContextItem {
  key: string;
  label: string;
  data: Record<string, unknown>;
}

export interface AskRequest {
  source: Source;
  tier: Tier;
  render: RenderPref;
  question: string;
  /** Daten-Modus: Einträge im Rahmen und die Seite drumherum */
  items?: ContextItem[];
  page?: Record<string, unknown>;
  /** Daten-Modus: sichtbarer Text innerhalb der Umrandung (Leitstand) */
  text?: string;
  /** Screenshot-Modus: Ausschnitt und Gesamtbild als data:image/jpeg;base64,... */
  crop?: string;
  full?: string;
  /** Folgefragen: vorige Fragen und Antworten (Rohtext), höchstens 3 */
  history?: { question: string; answer: string }[];
}

/** Kopfzeile einer Antwort (@meta). */
export interface AnswerMeta {
  kind: "baustein" | "frei";
  title: string;
  focus: string[];
}

export interface Usage {
  input: number;
  output: number;
  cached: number;
}

export type StreamEvent =
  | { t: "start"; mock: boolean; tier: Tier }
  | { t: "delta"; d: string }
  | {
      t: "done";
      usage: Usage | null;
      servedTier: string | null;
      ms: { first: number | null; total: number };
      costUsd: number | null;
      mock: boolean;
    }
  | { t: "error"; message: string };
