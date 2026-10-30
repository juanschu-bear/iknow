"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Freie Leinwand: vom Modell erzeugtes HTML läuft in einem abgeschotteten iframe.
 * sandbox="allow-scripts" ohne allow-same-origin: kein Zugriff auf die Seite, Cookies oder Speicher.
 * CSP default-src 'none': keine Verbindung nach außen, keine externen Dateien.
 */
export default function FreeCanvas({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(220);

  const doc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:">
<style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#10242A;overflow:hidden}svg,canvas{max-width:100%}</style>
</head><body>${html}
<script>(function(){function s(){parent.postMessage({iknowH:Math.ceil(document.documentElement.scrollHeight)},"*")}new ResizeObserver(s).observe(document.body);window.addEventListener("load",s);s();})();</script>
</body></html>`,
    [html],
  );

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const v = (e.data as { iknowH?: unknown })?.iknowH;
      if (typeof v === "number" && isFinite(v)) setH(Math.max(60, Math.min(360, v)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return <iframe ref={ref} className="ik-free" sandbox="allow-scripts" srcDoc={doc} style={{ height: h }} title="Frei gezeichnete Grafik" />;
}
