export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Stimme über ElevenLabs (offizielle REST-Schnittstelle: POST /v1/text-to-speech/{voice_id}/stream,
 * Header xi-api-key, Body { text, model_id }). Der Schlüssel bleibt auf dem Server.
 * Gesprochen wird nur der Erklärsatz, keine Bilder, keine Rohdaten.
 */
function accessOk(req: Request): boolean {
  const code = process.env.IKNOW_ACCESS_CODE;
  if (!code) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-iknow-code") === code;
}

const num = (v: string | undefined, d: number) => { const n = v === undefined ? NaN : Number(v); return Number.isFinite(n) ? n : d; };

export async function POST(req: Request): Promise<Response> {
  if (!accessOk(req)) return Response.json({ error: "Zugangscode fehlt oder ist falsch." }, { status: 401 });
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return Response.json({ error: "Stimme ist noch nicht eingerichtet." }, { status: 501 });

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    text = "";
  }
  if (!text || text.length > 600) return Response.json({ error: "Text fehlt oder ist zu lang." }, { status: 400 });

  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key, Accept: "audio/mpeg" },
    // language_code nur bei Modellen, die Sprachvorgabe unterstützen (Flash v2.5, Turbo v2.5)
    body: JSON.stringify({
      text,
      model_id: model,
      ...(/_v2_5$/.test(model) ? { language_code: "de" } : {}),
      // Lebendiger sprechen: weniger Stabilität, mehr Stil (offizielle voice_settings von ElevenLabs).
      voice_settings: {
        stability: num(process.env.ELEVENLABS_STABILITY, 0.3),
        similarity_boost: num(process.env.ELEVENLABS_SIMILARITY, 0.8),
        style: num(process.env.ELEVENLABS_STYLE, 0.55),
        use_speaker_boost: true,
        speed: num(process.env.ELEVENLABS_SPEED, 1.05),
      },
    }),
  });
  if (!r.ok || !r.body) {
    console.error("[iknow-tts] ElevenLabs status", r.status);
    return Response.json({ error: "Stimme konnte nicht erzeugt werden." }, { status: 502 });
  }
  return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
