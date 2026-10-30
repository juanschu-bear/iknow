import OpenAI, { type DataResidency } from "openai";
import { SYSTEM_PROMPT, buildUserContent } from "@/lib/prompt";
import { estimateCost } from "@/lib/pricing";
import { mockLines } from "@/lib/mock";
import { uploadChunks, uploads } from "@/lib/wissen-store";
import { relevantText } from "@/lib/retrieval";
import { wissenText } from "@/lib/wissen";
import type { AskRequest, StreamEvent, Tier, Usage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "gpt-6.1-sol";
const MAX_IMAGE_CHARS = 8_000_000; // ca. 6 MB je Bild als Base64

/* Bremse gegen versehentliche Dauerschleifen: 40 Anfragen je 10 Minuten und Instanz. */
const hits: number[] = [];
function rateLimited(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0] > 600_000) hits.shift();
  if (hits.length >= 40) return true;
  hits.push(now);
  return false;
}

function accessOk(req: Request): boolean {
  const code = process.env.IKNOW_ACCESS_CODE;
  if (!code) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-iknow-code") === code;
}

function validate(body: unknown): AskRequest | string {
  if (!body || typeof body !== "object") return "Ungültige Anfrage.";
  const b = body as Partial<AskRequest>;
  if (b.source !== "daten" && b.source !== "screenshot") return "Quelle fehlt.";
  if (b.tier !== "ultrafast" && b.tier !== "standard") return "Modus fehlt.";
  if (b.render !== "auto" && b.render !== "baustein" && b.render !== "frei") return "Darstellung fehlt.";
  if (typeof b.question !== "string" || !b.question.trim() || b.question.length > 2000) return "Frage fehlt oder ist zu lang.";
  if (b.source === "screenshot") {
    if (typeof b.crop !== "string" || !b.crop.startsWith("data:image/")) return "Bildausschnitt fehlt.";
    if (b.crop.length > MAX_IMAGE_CHARS || (b.full && b.full.length > MAX_IMAGE_CHARS)) return "Bild ist zu groß.";
  }
  if (b.history !== undefined) {
    if (!Array.isArray(b.history) || b.history.length > 3) return "Verlauf ungültig.";
    for (const h of b.history) {
      if (!h || typeof h.question !== "string" || typeof h.answer !== "string" || h.question.length > 2000 || h.answer.length > 16000) return "Verlauf ungültig.";
    }
  }
  return b as AskRequest;
}

function residency(): DataResidency | undefined {
  const r = process.env.IKNOW_DATA_RESIDENCY;
  return r === "eu" || r === "us" || r === "global" ? r : undefined;
}

export async function POST(req: Request): Promise<Response> {
  if (!accessOk(req)) return Response.json({ error: "Zugangscode fehlt oder ist falsch." }, { status: 401 });
  if (rateLimited()) return Response.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429 });

  let parsed: AskRequest | string;
  try {
    parsed = validate(await req.json());
  } catch {
    parsed = "Ungültige Anfrage.";
  }
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  const ask = parsed;

  const mock = process.env.IKNOW_MOCK === "1" || !process.env.OPENAI_API_KEY;
  const tier: Tier = ask.tier;
  const encoder = new TextEncoder();
  const t0 = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      send({ t: "start", mock, tier });
      try {
        if (mock) {
          // Zeichenweise wie ein echtes Modell, damit Live-Zeichnen sichtbar wird.
          const text = mockLines(ask).join("\n") + "\n";
          let first: number | null = null;
          for (let i = 0; i < text.length; i += 18) {
            await new Promise((r) => setTimeout(r, 35));
            if (first === null) first = Date.now() - t0;
            send({ t: "delta", d: text.slice(i, i + 18) });
          }
          send({ t: "done", usage: null, servedTier: null, ms: { first, total: Date.now() - t0 }, costUsd: null, mock: true });
          controller.close();
          return;
        }

        const client = new OpenAI({ dataResidency: residency(), maxRetries: 1, timeout: 55_000 });
        // Nur die passendsten Wissensstellen mitschicken. Fällt die Suche aus, geht die feste Wissensbasis komplett mit.
        let wissen = "";
        try {
          const query = [ask.history?.at(-1)?.question, ask.question, ...(ask.items ?? []).map((it) => it.label), (ask.text ?? "").slice(0, 600)].filter(Boolean).join("\n");
          let extra: Awaited<ReturnType<typeof uploads>> = [];
          try { extra = await uploads(); } catch (e) { console.error("[iknow] wissen:", e instanceof Error ? e.message : "unbekannt"); }
          wissen = (await relevantText(client, query, uploadChunks(extra))).text;
        } catch (e) {
          console.error("[iknow] wissenssuche:", e instanceof Error ? e.message : "unbekannt");
          wissen = wissenText();
        }
        const response = await client.responses.create({
          model: MODEL,
          service_tier: tier === "ultrafast" ? "ultrafast" : "default",
          store: false,
          stream: true,
          instructions: SYSTEM_PROMPT,
          prompt_cache_key: "iknow",
          input: [
            ...(ask.history ?? []).flatMap((h) => [
              { role: "user" as const, content: h.question },
              { role: "assistant" as const, content: h.answer },
            ]),
            { role: "user" as const, content: buildUserContent(ask, wissen) },
          ],
        });

        let first: number | null = null;
        let usage: Usage | null = null;
        let servedTier: string | null = null;
        for await (const event of response) {
          if (event.type === "response.output_text.delta") {
            if (first === null) first = Date.now() - t0;
            send({ t: "delta", d: event.delta });
          } else if (event.type === "response.completed") {
            const u = event.response.usage;
            if (u) usage = { input: u.input_tokens, output: u.output_tokens, cached: u.input_tokens_details?.cached_tokens ?? 0 };
            servedTier = event.response.service_tier ?? null;
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
        send({ t: "done", usage, servedTier, ms: { first, total: Date.now() - t0 }, costUsd: estimateCost(tier, usage), mock: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        // Nur die Fehlermeldung loggen, nie Frage, Bilder oder Praxisdaten.
        console.error("[iknow] request failed:", message);
        send({ t: "error", message: "IKnow konnte gerade nicht antworten: " + message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
