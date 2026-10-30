import OpenAI, { toFile, type DataResidency } from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Diktat: Audio aus dem Browser (Leertaste halten) wird über die OpenAI-Transkription in Text umgewandelt.
 * Gleicher Schlüssel und gleiche Region wie IKnow. Nichts wird gespeichert.
 */
function accessOk(req: Request): boolean {
  const code = process.env.IKNOW_ACCESS_CODE;
  if (!code) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-iknow-code") === code;
}

function residency(): DataResidency | undefined {
  const r = process.env.IKNOW_DATA_RESIDENCY;
  return r === "eu" || r === "us" || r === "global" ? r : undefined;
}

export async function POST(req: Request): Promise<Response> {
  if (!accessOk(req)) return Response.json({ error: "Zugangscode fehlt oder ist falsch." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Diktat ist noch nicht eingerichtet." }, { status: 501 });
  const type = req.headers.get("content-type") ?? "audio/webm";
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return Response.json({ error: "Keine Aufnahme." }, { status: 400 });
  if (buf.length > 10 * 1024 * 1024) return Response.json({ error: "Aufnahme ist zu lang." }, { status: 400 });
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
  try {
    const client = new OpenAI({ dataResidency: residency(), maxRetries: 1, timeout: 25_000 });
    const r = await client.audio.transcriptions.create({
      model: process.env.IKNOW_STT_MODEL || "gpt-4o-transcribe",
      file: await toFile(buf, `diktat.${ext}`, { type }),
      language: "de",
    });
    return Response.json({ text: (r.text ?? "").trim() });
  } catch (err) {
    console.error("[iknow-stt] failed:", err instanceof Error ? err.message : "unbekannt");
    return Response.json({ error: "Diktat konnte nicht verstanden werden." }, { status: 502 });
  }
}
