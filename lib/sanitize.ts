/**
 * Prüft eine vom Modell gelieferte @svg-Zeile und baut daraus ein sicheres SVG-Element.
 * Nur erlaubte Elemente und Attribute, keine Skripte, Ereignisse, Links oder externen Inhalte.
 */
const NS = "http://www.w3.org/2000/svg";
const TAGS = new Set(["rect", "circle", "ellipse", "line", "path", "polyline", "polygon", "text"]);
const ATTRS = new Set([
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "points",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
  "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-weight", "text-anchor",
  "dominant-baseline", "letter-spacing", "transform",
]);
const SAFE_VALUE = /^[#\w\s.,%()\-+]*$/;

export function sanitizeSvgLine(line: string): SVGElement | null {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${line}</svg>`, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const src = doc.documentElement.firstElementChild;
  if (!src || !TAGS.has(src.localName)) return null;
  const el = document.createElementNS(NS, src.localName);
  for (const a of Array.from(src.attributes)) {
    const name = a.name.toLowerCase();
    if (!ATTRS.has(name)) continue;
    const v = a.value.trim();
    if (name !== "d" && name !== "points" && !SAFE_VALUE.test(v)) continue;
    if (/url\s*\(|javascript:|expression/i.test(v)) continue;
    el.setAttribute(name, v.slice(0, 4000));
  }
  if (src.localName === "text") el.textContent = (src.textContent ?? "").slice(0, 80);
  return el;
}
