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
const _labels = [];
// Farbe als Zahl (C.teal) oder Text annehmen; zu helle Farben durch Dunkel ersetzen, damit Schrift auf Weiß lesbar bleibt.
const _css = (c) => typeof c === "number" ? "#" + (c >>> 0).toString(16).padStart(6, "0").slice(-6) : (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#10242A");
const _ink = (hex) => { const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255; if (l > 0.8) return "#10242A"; if (l <= 0.5) return hex; const d = (v) => Math.round(v * 0.62).toString(16).padStart(2, "0"); return "#" + d(r) + d(g) + d(b); };
const label = (text, x, y, z, color) => {
  const ink = _ink(_css(color)); const t = String(text).slice(0, 32);
  const c = document.createElement("canvas"); const g = c.getContext("2d"); const f = 40;
  g.font = "700 " + f + "px system-ui, Arial"; const w = Math.ceil(g.measureText(t).width) + 40;
  c.width = w; c.height = f + 30; g.font = "700 " + f + "px system-ui, Arial";
  g.fillStyle = "rgba(255,255,255,0.96)"; g.beginPath(); g.roundRect(2, 2, w - 4, c.height - 4, 16); g.fill();
  g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
  g.fillStyle = ink; g.textBaseline = "middle"; g.fillText(t, 20, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.position.set(x, y, z); s.renderOrder = 10; s.userData.aspect = w / c.height;
  scene.add(s); _labels.push(s); return s;
};
`;

const WRAPPER_TAIL = `
const box = new THREE.Box3();
scene.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
if (box.isEmpty()) _labels.forEach((s) => s.scale.set(0.3 * s.userData.aspect, 0.3, 1));
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.1;
if (!box.isEmpty()) {
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  controls.target.copy(center);
  camera.position.set(center.x, center.y + r * 0.55, center.z + r * 1.35);
  // Beschriftungen an die Szenengröße anpassen: klein und gleich groß, damit sie nichts zudecken.
  const lh = r * 0.055;
  _labels.forEach((s) => s.scale.set(lh * s.userData.aspect, lh, 1));
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
