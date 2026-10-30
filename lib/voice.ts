/**
 * Stimme: vorerst die eingebaute Sprachausgabe des Browsers (Web Speech API, speechSynthesis).
 * Platzhalter, bis Juan den Stimmen-Anbieter festlegt. Läuft lokal im Browser, nichts geht raus.
 */
let cachedVoice: SpeechSynthesisVoice | null = null;

function germanVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const de = voices.filter((v) => v.lang.toLowerCase().startsWith("de"));
  cachedVoice = de.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name)) ?? de[0] ?? null;
  return cachedVoice;
}

export function voiceAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Spricht einen Satz. Löst auf, wenn er zu Ende gesprochen ist (oder sofort, wenn keine Stimme da ist). */
export function speak(text: string, enabled: boolean): Promise<void> {
  if (!enabled || !voiceAvailable() || !text.trim()) {
    // Ohne Stimme: Lesezeit simulieren, damit der Rhythmus von Satz und Zeichnung bleibt.
    return new Promise((r) => setTimeout(r, Math.min(2600, 500 + text.length * 28)));
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = germanVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "de-DE";
    u.rate = 1.04;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    // Sicherheitsnetz, falls ein Browser onend nicht feuert
    setTimeout(finish, 1500 + text.length * 120);
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking(): void {
  if (voiceAvailable()) window.speechSynthesis.cancel();
}
