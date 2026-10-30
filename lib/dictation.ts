/**
 * Diktat per Leertaste: Mikrofon über getUserMedia, Aufnahme mit MediaRecorder (Browser-Standard).
 * Die Aufnahme geht an /api/iknow/stt und kommt als Text zurück.
 */
export class Dictation {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  active = false;

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (!this.active) { this.stop(); return; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
  }

  /** Beendet die Aufnahme und gibt das Audio zurück (oder null, wenn zu kurz). */
  finish(): Promise<Blob | null> {
    const rec = this.rec;
    this.active = false;
    if (!rec) { this.stop(); return Promise.resolve(null); }
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
        this.stop();
        resolve(blob.size > 2500 ? blob : null);
      };
      rec.stop();
    });
  }

  stop(): void {
    this.active = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.rec = null;
  }
}

export async function transcribe(audio: Blob, code: string): Promise<string> {
  const r = await fetch("/api/iknow/stt", { method: "POST", headers: { "Content-Type": audio.type || "audio/webm", "x-iknow-code": code }, body: audio });
  const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!r.ok) throw new Error(j.error ?? "Diktat fehlgeschlagen.");
  return j.text ?? "";
}
