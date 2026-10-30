/**
 * Text aus einer PDF im Browser lesen (Mozilla PDF.js, offizielles Muster: GlobalWorkerOptions.workerSrc,
 * getDocument(...).promise, getPage, getTextContent). Die PDF verlässt den Browser nicht, nur der Text.
 * Der Worker liegt selbst gehostet in passender Version unter /vendor.
 */
export async function pdfText(file: File, onPage?: (n: number, total: number) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-dist@6.4.299/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let line = "";
      for (const it of tc.items) {
        if (!("str" in it)) continue;
        line += it.str + (it.hasEOL ? "\n" : " ");
      }
      pages.push(line.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
      onPage?.(i, doc.numPages);
    }
  } finally {
    await task.destroy();
  }
  return pages.filter(Boolean).join("\n\n");
}
