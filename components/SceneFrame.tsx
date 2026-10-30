"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { threeImportMap } from "@/lib/three";

/**
 * 3D-Szene vom Modell: läuft abgeschottet in einem iframe.
 * sandbox="allow-scripts" ohne allow-same-origin: kein Zugriff auf die Seite, Cookies oder Speicher.
 * CSP default-src 'none': keine Verbindung nach außen. three.js kommt als data:-URL über die Import-Map.
 * Das Modell liefert nur den Inhalt der Szene. Renderer, Kamera, Licht, Drehen und Einpassen stellt IKnow.
 */
const WRAPPER_HEAD = `
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const H = 320;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / H, 0.05, 500);
camera.position.set(0, 4, 9);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd7e1df, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(4, 7, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfe6ea, 0.8); rim.position.set(-5, 3, -4); scene.add(rim);
const C = { teal: 0x0B5761, ink: 0x10242A, orange: 0xEA7A3C, grey: 0xC9D3D2, tooth: 0xFBF9F5, steel: 0xB6C0C6, gum: 0xE8B4B0 };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08, ...o });
const label = (text, x, y, z, color = "#10242A") => {
  const c = document.createElement("canvas"); const g = c.getContext("2d"); const f = 44;
  g.font = "700 " + f + "px system-ui"; const w = Math.ceil(g.measureText(String(text)).width) + 36;
  c.width = w; c.height = f + 28; g.font = "700 " + f + "px system-ui";
  g.fillStyle = "rgba(255,255,255,0.94)"; g.beginPath(); g.roundRect(0, 0, w, c.height, 18); g.fill();
  g.fillStyle = color; g.textBaseline = "middle"; g.fillText(String(text), 18, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  const k = 0.012; s.scale.set(w * k, c.height * k, 1); s.position.set(x, y, z); s.renderOrder = 10;
  scene.add(s); return s;
};
`;

const WRAPPER_TAIL = `
const box = new THREE.Box3();
scene.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.1;
if (!box.isEmpty()) {
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  controls.target.copy(center);
  camera.position.set(center.x, center.y + r * 0.55, center.z + r * 1.35);
  camera.near = r / 100; camera.far = r * 20; camera.updateProjectionMatrix();
}
window.addEventListener("resize", () => { camera.aspect = window.innerWidth / H; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, H); });
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();
`;

export default function SceneFrame({ code, onError }: { code: string; onError?: (msg: string) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [map, setMap] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    threeImportMap().then((m) => on && setMap(m)).catch(() => on && setFailed("Die 3D-Bibliothek konnte nicht geladen werden."));
    return () => { on = false; };
  }, []);

  const doc = useMemo(() => {
    if (!map) return "";
    const safe = (s: string) => s.replace(/<\/script/gi, "<\\/script");
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' data:; font-src data:">
<script>window.addEventListener("error",function(e){parent.postMessage({iknowErr:String(e.message||e.error||"Fehler")},"*")});window.addEventListener("unhandledrejection",function(e){parent.postMessage({iknowErr:String(e.reason)},"*")});</script>
<script type="importmap">${map.replace(/<\//g, "<\\/")}</script>
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}canvas{display:block;width:100%;touch-action:none;cursor:grab}canvas:active{cursor:grabbing}</style>
</head><body>
<script type="module">${safe(WRAPPER_HEAD)}
try {
${safe(code)}
} catch (e) { parent.postMessage({ iknowErr: String(e && e.message || e) }, "*"); }
${safe(WRAPPER_TAIL)}</script>
</body></html>`;
  }, [code, map]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const err = (e.data as { iknowErr?: unknown })?.iknowErr;
      if (typeof err === "string") { setFailed("Die 3D-Szene hatte einen Fehler."); onError?.(err.slice(0, 300)); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onError]);

  if (failed) return <div className="ik-sheet wait"><span>{failed} IKnow baut sie neu …</span></div>;
  if (!map) return <div className="ik-sheet wait"><span>3D wird vorbereitet …</span></div>;
  return <iframe ref={ref} className="ik-scene" sandbox="allow-scripts" srcDoc={doc} style={{ height: 320 }} title="3D-Szene" />;
}
