"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { threeImportMap } from "@/lib/three";

/**
 * 3D-Szene oder Animation vom Modell: läuft abgeschottet in einem iframe.
 * sandbox="allow-scripts" ohne allow-same-origin: kein Zugriff auf die Seite, Cookies oder Speicher.
 * CSP default-src 'none': keine Verbindung nach außen. three.js kommt als data:-URL über die Import-Map.
 */
export default function SceneFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(300);
  const [map, setMap] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    threeImportMap().then((m) => on && setMap(m)).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  const doc = useMemo(() => {
    if (!map) return "";
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' data:; font-src data:">
<script type="importmap">${map.replace(/<\//g, "<\\/")}</script>
<style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#10242A;overflow:hidden}canvas{display:block;width:100%;max-width:100%;touch-action:none}</style>
</head><body>${html}
<script>(function(){function s(){parent.postMessage({iknowH:Math.ceil(document.documentElement.scrollHeight)},"*")}new ResizeObserver(s).observe(document.body);window.addEventListener("load",s);s();})();</script>
</body></html>`;
  }, [html, map]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const v = (e.data as { iknowH?: unknown })?.iknowH;
      if (typeof v === "number" && isFinite(v)) setH(Math.max(120, Math.min(380, v)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (failed) return <p className="ik-warn">Die 3D-Bibliothek konnte nicht geladen werden.</p>;
  if (!map) return <div className="ik-sheet wait"><span>3D wird vorbereitet …</span></div>;
  return <iframe ref={ref} className="ik-scene" sandbox="allow-scripts" srcDoc={doc} style={{ height: h }} title="3D-Szene" />;
}
