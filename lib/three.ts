/**
 * three.js für den abgeschotteten 3D-Rahmen.
 * Der Rahmen hat keinen Netzzugang und einen undurchsichtigen Ursprung (auch der Vercel-Schutz greift dort nicht).
 * Darum lädt die Seite die selbst gehosteten Moduldateien einmal und gibt sie als data:-URLs
 * über die Import-Map hinein (offizielles Import-Map-Muster von three.js, nur mit lokalen Quellen).
 */
const BASE = "/vendor/three@0.186.1/";
let cache: Promise<string> | null = null;

const asData = (src: string) => "data:text/javascript;charset=utf-8," + encodeURIComponent(src);

export function threeImportMap(): Promise<string> {
  if (cache) return cache;
  cache = (async () => {
    const [core, mod, orbit] = await Promise.all(
      ["three.core.min.js", "three.module.min.js", "addons/controls/OrbitControls.min.js"].map(async (f) => {
        const r = await fetch(BASE + f);
        if (!r.ok) throw new Error("three.js nicht geladen: " + f);
        return r.text();
      }),
    );
    const module = mod.replace(/from\s*"\.\/three\.core\.js"/g, 'from"three/core"').replace(/from\s*'\.\/three\.core\.js'/g, 'from"three/core"');
    return JSON.stringify({
      imports: {
        three: asData(module),
        "three/core": asData(core),
        "three/addons/controls/OrbitControls.js": asData(orbit),
      },
    });
  })();
  cache.catch(() => { cache = null; });
  return cache;
}
