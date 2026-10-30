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
  /** Screenshot-Modus: Ausschnitt und Gesamtbild als data:image/jpeg;base64,... */
  crop?: string;
  full?: string;
}

/** Was das Modell zurückgibt (Structured Output). */
export interface IKnowAnswer {
  kind: "baustein" | "frei";
  title: string;
  text: string;
  baustein: BausteinName;
  baustein_data: string;
  html: string;
  focus: string[];
}

export interface Usage {
  input: number;
  output: number;
  cached: number;
}

export type StreamEvent =
  | { t: "start"; mock: boolean; tier: Tier }
  | { t: "delta"; n: number }
  | {
      t: "done";
      answer: IKnowAnswer;
      usage: Usage | null;
      servedTier: string | null;
      ms: { first: number | null; total: number };
      costUsd: number | null;
      mock: boolean;
    }
  | { t: "error"; message: string };
