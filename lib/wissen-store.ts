import { timingSafeEqual } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import type OpenAI from "openai";
import { chunksFor, type Chunk } from "./retrieval";

/**
 * Hochgeladenes Praxiswissen (Zahnrad in IKnow). Liegt als private JSON-Dateien in einem eigenen
 * Vercel-Blob-Speicher (BLOB_READ_WRITE_TOKEN), getrennt von allen Praxisdaten.
 * Bearbeiten nur mit IKNOW_EDIT_PASSWORD. Beim Hochladen werden Abschnitte für die Wissenssuche beschrieben;
 * pro Frage gehen nur die passendsten Abschnitte mit.
 */
export const PREFIX = "iknow-wissen/";
export const MAX_DOC_CHARS = 120_000;
export const MAX_TOTAL_CHARS = 2_000_000;

export interface Upload { pathname: string; titel: string; chars: number; hochgeladen: string; chunks: Chunk[] }

export const storeReady = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const editReady = () => !!process.env.IKNOW_EDIT_PASSWORD;

export function passwordOk(given: string | null): boolean {
  const want = process.env.IKNOW_EDIT_PASSWORD;
  if (!want || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

let cache: { at: number; docs: Upload[] } | null = null;

/** Alle Dokumente, älteste zuerst (feste Reihenfolge, damit der Prompt-Anfang gleich bleibt und zwischengespeichert wird). */
export async function uploads(fresh = false): Promise<Upload[]> {
  if (!storeReady()) return [];
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.docs;
  const found: { pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    found.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const docs: Upload[] = [];
  for (const b of found) {
    const r = await get(b.pathname, { access: "private", useCache: false });
    if (!r) continue;
    try {
      const j = JSON.parse(await new Response(r.stream).text()) as { titel?: unknown; text?: unknown; hochgeladen?: unknown; chunks?: unknown };
      if (typeof j.text !== "string" || typeof j.titel !== "string") continue;
      const chunks = Array.isArray(j.chunks) ? (j.chunks as Chunk[]).filter((c) => c && typeof c.t === "string" && Array.isArray(c.v)) : [];
      docs.push({ pathname: b.pathname, titel: j.titel, chars: j.text.length, hochgeladen: String(j.hochgeladen ?? ""), chunks });
    } catch { /* unlesbar überspringen */ }
  }
  docs.sort((x, y) => x.hochgeladen.localeCompare(y.hochgeladen) || x.pathname.localeCompare(y.pathname));
  cache = { at: Date.now(), docs };
  return docs;
}

export async function addUpload(client: OpenAI, titel: string, text: string): Promise<string | null> {
  const docs = await uploads(true);
  const total = docs.reduce((s, d) => s + d.chars, 0);
  if (total + text.length > MAX_TOTAL_CHARS) return `Zu viel Wissen insgesamt: ${total + text.length} von höchstens ${MAX_TOTAL_CHARS} Zeichen. Bitte ein älteres Dokument löschen oder kürzen.`;
  const slug = titel.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "dokument";
  const hochgeladen = new Date().toISOString();
  const chunks = await chunksFor(client, titel, text);
  await put(`${PREFIX}${hochgeladen.slice(0, 10)}-${slug}.json`, JSON.stringify({ titel, text, hochgeladen, chunks }), {
    access: "private", addRandomSuffix: true, contentType: "application/json",
  });
  cache = null;
  return null;
}

export async function removeUpload(pathname: string): Promise<void> {
  await del(pathname);
  cache = null;
}

/** Alle Abschnitte des hochgeladenen Wissens für die Suche. */
export const uploadChunks = (docs: Upload[]): Chunk[] => docs.flatMap((d) => d.chunks);
