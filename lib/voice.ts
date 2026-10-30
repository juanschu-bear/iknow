/**
 * Stimme über die eigene Route /api/iknow/tts (ElevenLabs auf dem Server).
 * Jeder Satz wird sofort beim Eintreffen vorgeladen und dann der Reihe nach abgespielt,
 * damit zwischen den Sätzen keine Pause entsteht.
 */
let current: HTMLAudioElement | null = null;
let disabledReason: string | null = null;

function code(): string {
  try { return sessionStorage.getItem("iknow-code") ?? ""; } catch { return ""; }
}

export function voiceProblem(): string | null { return disabledReason; }

/** Lädt die Audiodatei für einen Satz. Gibt null zurück, wenn keine Stimme verfügbar ist. */
export async function prepare(text: string, enabled: boolean): Promise<string | null> {
  if (!enabled || !text.trim() || disabledReason) return null;
  try {
    const r = await fetch("/api/iknow/tts", { method: "POST", headers: { "Content-Type": "application/json", "x-iknow-code": code() }, body: JSON.stringify({ text }) });
    if (r.status === 501) { disabledReason = "Stimme ist noch nicht eingerichtet."; return null; }
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  } catch {
    return null;
  }
}

/** Spielt einen vorbereiteten Satz. Ohne Audio wird die Lesezeit abgewartet, damit der Rhythmus bleibt. */
export function play(audio: Promise<string | null>, text: string): Promise<void> {
  return audio.then((src) => new Promise<void>((resolve) => {
    if (!src) { setTimeout(resolve, Math.min(2600, 500 + text.length * 28)); return; }
    const a = new Audio(src);
    current = a;
    let done = false;
    const finish = () => { if (done) return; done = true; URL.revokeObjectURL(src); if (current === a) current = null; resolve(); };
    a.onended = finish;
    a.onerror = finish;
    a.play().catch(finish);
  }));
}

export function stopSpeaking(): void {
  if (current) { current.pause(); current = null; }
}
