import OpenAI, { type DataResidency } from "openai";
import { WISSEN } from "@/lib/wissen";
import { MAX_DOC_CHARS, MAX_TOTAL_CHARS, PREFIX, addUpload, editReady, passwordOk, removeUpload, storeReady, uploads } from "@/lib/wissen-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Wissen hinter dem Zahnrad: lesen darf jeder mit Zugang zu IKnow,
 * hinzufügen und löschen nur mit dem Bearbeitungs-Passwort (Header x-iknow-edit).
 */
const noStore = { "Cache-Control": "no-store" };

function accessOk(req: Request): boolean {
  const code = process.env.IKNOW_ACCESS_CODE;
  if (!code) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-iknow-code") === code;
}

/* Bremse für falsche Passwörter: 8 Versuche je 10 Minuten und Instanz. */
const wrong: number[] = [];
function lockedOut(): boolean {
  const now = Date.now();
  while (wrong.length && now - wrong[0] > 600_000) wrong.shift();
  return wrong.length >= 8;
}
function checkEdit(req: Request): Response | null {
  if (!editReady()) return Response.json({ error: "Bearbeiten ist noch nicht eingerichtet (IKNOW_EDIT_PASSWORD fehlt)." }, { status: 501, headers: noStore });
  if (!storeReady()) return Response.json({ error: "Der Wissensspeicher ist noch nicht verbunden (Vercel Blob)." }, { status: 501, headers: noStore });
  if (lockedOut()) return Response.json({ error: "Zu viele falsche Passwörter. Bitte 10 Minuten warten." }, { status: 429, headers: noStore });
  if (!passwordOk(req.headers.get("x-iknow-edit"))) { wrong.push(Date.now()); return Response.json({ error: "Passwort ist falsch." }, { status: 403, headers: noStore }); }
  return null;
}

export async function GET(req: Request): Promise<Response> {
  if (!accessOk(req)) return Response.json({ error: "Zugangscode fehlt oder ist falsch." }, { status: 401, headers: noStore });
  const url = new URL(req.url);
  if (url.searchParams.get("check") === "1") {
    const bad = checkEdit(req);
    return bad ?? Response.json({ ok: true }, { headers: noStore });
  }
  try {
    const docs = await uploads();
    return Response.json({
      fest: WISSEN.map((w) => ({ id: w.id, titel: w.titel, quelle: w.quelle, chars: w.text.length })),
      uploads: docs.map((d) => ({ pathname: d.pathname, titel: d.titel, chars: d.chars, hochgeladen: d.hochgeladen })),
      limits: { doc: MAX_DOC_CHARS, total: MAX_TOTAL_CHARS },
      storeReady: storeReady(), editReady: editReady(),
    }, { headers: noStore });
  } catch (err) {
    console.error("[iknow-wissen] list failed:", err instanceof Error ? err.message : "unbekannt");
    return Response.json({ error: "Wissensspeicher gerade nicht erreichbar." }, { status: 503, headers: noStore });
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!accessOk(req)) return Response.json({ error: "Zugangscode fehlt oder ist falsch." }, { status: 401, headers: noStore });
  const bad = checkEdit(req);
  if (bad) return bad;
  let titel = "", text = "";
  try {
    const b = (await req.json()) as { titel?: unknown; text?: unknown };
    titel = typeof b.titel === "string" ? b.titel.trim().slice(0, 120) : "";
    text = typeof b.text === "string" ? b.text.replace(/\u0000/g, "").trim() : "";
  } catch { /* unten abgefangen */ }
  if (!titel || !text) return Response.json({ error: "Titel und Text werden gebraucht." }, { status: 400, headers: noStore });
  if (text.length > MAX_DOC_CHARS) return Response.json({ error: `Dokument ist zu lang (${text.length} Zeichen, höchstens ${MAX_DOC_CHARS}).` }, { status: 400, headers: noStore });
  try {
    const r = process.env.IKNOW_DATA_RESIDENCY;
    const client = new OpenAI({ dataResidency: (r === "eu" || r === "us" || r === "global" ? r : undefined) as DataResidency | undefined, maxRetries: 1, timeout: 25_000 });
    const err = await addUpload(client, titel, text);
    if (err) return Response.json({ error: err }, { status: 400, headers: noStore });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("[iknow-wissen] upload failed:", e instanceof Error ? e.message : "unbekannt");
    return Response.json({ error: "Speichern hat nicht geklappt." }, { status: 502, headers: noStore });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  if (!accessOk(req)) return Response.json({ error: "Zugangscode fehlt oder ist falsch." }, { status: 401, headers: noStore });
  const bad = checkEdit(req);
  if (bad) return bad;
  const pathname = new URL(req.url).searchParams.get("pathname") ?? "";
  if (!pathname.startsWith(PREFIX) || pathname.includes("..") || pathname.length > 300) return Response.json({ error: "Ungültiges Dokument." }, { status: 400, headers: noStore });
  try {
    await removeUpload(pathname);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("[iknow-wissen] delete failed:", e instanceof Error ? e.message : "unbekannt");
    return Response.json({ error: "Löschen hat nicht geklappt." }, { status: 502, headers: noStore });
  }
}
