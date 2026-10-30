import { timingSafeEqual } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

/**
 * Hochgeladenes Praxiswissen (Zahnrad in IKnow). Liegt als private JSON-Dateien in einem eigenen
 * Vercel-Blob-Speicher (BLOB_READ_WRITE_TOKEN), getrennt von allen Praxisdaten.
 * Bearbeiten nur mit IKNOW_EDIT_PASSWORD. Der Text geht bei jeder Frage komplett mit (Obergrenze unten).
 */
export const PREFIX = "iknow-wissen/";
export const MAX_DOC_CHARS = 120_000;
export const MAX_TOTAL_CHARS = 200_000;

export interface Upload { pathname: string; titel: string; text: string; chars: number; hochgeladen: string }

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
      const j = JSON.parse(await new Response(r.stream).text()) as Partial<Upload>;
      if (typeof j.text !== "string" || typeof j.titel !== "string") continue;
      docs.push({ pathname: b.pathname, titel: j.titel, text: j.text, chars: j.text.length, hochgeladen: String(j.hochgeladen ?? "") });
    } catch { /* unlesbar überspringen */ }
  }
  docs.sort((x, y) => x.hochgeladen.localeCompare(y.hochgeladen) || x.pathname.localeCompare(y.pathname));
  cache = { at: Date.now(), docs };
  return docs;
}

export async function addUpload(titel: string, text: string): Promise<string | null> {
  const docs = await uploads(true);
  const total = docs.reduce((s, d) => s + d.chars, 0);
  if (total + text.length > MAX_TOTAL_CHARS) return `Zu viel Wissen insgesamt: ${total + text.length} von höchstens ${MAX_TOTAL_CHARS} Zeichen. Bitte ein älteres Dokument löschen oder kürzen.`;
  const slug = titel.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "dokument";
  const hochgeladen = new Date().toISOString();
  await put(`${PREFIX}${hochgeladen.slice(0, 10)}-${slug}.json`, JSON.stringify({ titel, text, hochgeladen }), {
    access: "private", addRandomSuffix: true, contentType: "application/json",
  });
  cache = null;
  return null;
}

export async function removeUpload(pathname: string): Promise<void> {
  await del(pathname);
  cache = null;
}

/** Teil für den System-Prompt. */
export function uploadsText(docs: Upload[]): string {
  if (!docs.length) return "";
  return "\n\nHOCHGELADENES WISSEN DER PRAXIS (vom Praxisteam ergänzt, gilt wie die Wissensbasis)\n" +
    docs.map((d, i) => `DOKUMENT ${i + 1}: ${d.titel} (hochgeladen ${d.hochgeladen.slice(0, 10)})\n${d.text}`).join("\n\n");
}
