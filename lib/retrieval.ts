import OpenAI from "openai";
import { WISSEN } from "./wissen";

/**
 * Wissenssuche: Statt das ganze Wissen bei jeder Frage mitzuschicken, gehen nur die passendsten Abschnitte mit.
 * Abschnitte werden mit OpenAI-Embeddings (text-embedding-3-small, 512 Dimensionen) beschrieben und per
 * Kosinus-Ähnlichkeit gesucht. Embeddings von OpenAI sind normiert, das Skalarprodukt reicht.
 */
export const EMB_MODEL = "text-embedding-3-small";
export const EMB_DIM = 512;
const TOP_K = 5;
const MIN_SCORE = 0.22;

export interface Chunk { src: string; t: string; v: number[] }

/** Text in Abschnitte von etwa `size` Zeichen teilen, an Absätzen und Aufzählungen, mit etwas Überlappung. */
export function chunkText(text: string, size = 700, overlap = 120): string[] {
  const parts = text.replace(/\r/g, "").split(/\n(?=- )|\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if (p.length > size * 1.6) {
      if (cur) { out.push(cur); cur = ""; }
      for (let i = 0; i < p.length; i += size - overlap) out.push(p.slice(i, i + size));
      continue;
    }
    if (cur && cur.length + p.length + 1 > size) { out.push(cur); cur = cur.slice(-overlap).replace(/^\S*\s/, "") + "\n" + p; }
    else cur = cur ? cur + "\n" + p : p;
  }
  if (cur) out.push(cur);
  // Winzige Reste an den vorigen Abschnitt hängen
  return out.reduce<string[]>((acc, c) => { if (c.length < 80 && acc.length) acc[acc.length - 1] += "\n" + c; else acc.push(c); return acc; }, []);
}

export async function embed(client: OpenAI, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 96) {
    const r = await client.embeddings.create({ model: EMB_MODEL, dimensions: EMB_DIM, input: texts.slice(i, i + 96) });
    r.data.sort((a, b) => a.index - b.index).forEach((d) => out.push(d.embedding.map((x) => Math.round(x * 1e5) / 1e5)));
  }
  return out;
}

/** Abschnitte eines Dokuments mit Titel als Kopf, damit jeder Abschnitt für sich verständlich bleibt. */
export async function chunksFor(client: OpenAI, titel: string, text: string): Promise<Chunk[]> {
  const parts = chunkText(text);
  const vecs = await embed(client, parts.map((p) => `${titel}\n${p}`));
  return parts.map((t, i) => ({ src: titel, t, v: vecs[i] }));
}

let fixed: Promise<Chunk[]> | null = null;
/** Die feste Wissensbasis wird einmal pro Server-Instanz beschrieben und im Speicher gehalten. */
export function fixedChunks(client: OpenAI): Promise<Chunk[]> {
  if (!fixed) {
    fixed = (async () => (await Promise.all(WISSEN.map((w) => chunksFor(client, w.titel, w.text)))).flat())();
    fixed.catch(() => { fixed = null; });
  }
  return fixed;
}

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i]; return s; };

/** Die passendsten Abschnitte zur Frage, als Text für die Anfrage. */
export async function relevantText(client: OpenAI, query: string, extra: Chunk[]): Promise<{ text: string; hits: number }> {
  const [base, [q]] = await Promise.all([fixedChunks(client), embed(client, [query.slice(0, 4000)])]);
  const ranked = [...base, ...extra].map((c) => ({ c, s: dot(q, c.v) })).filter((x) => x.s >= MIN_SCORE).sort((a, b) => b.s - a.s).slice(0, TOP_K);
  return { text: ranked.map((x) => `[${x.c.src}]\n${x.c.t}`).join("\n\n"), hits: ranked.length };
}
