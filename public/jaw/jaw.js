/* IKnow-Kopie des Leitstand-Kiefermodells (Quelle: anima-leitstand public/vendor/engine.js).
   Erweitert nur für schematische Erklär-Szenen: Zahnstellung (pose), Markierung, Schiene, Ankerpunkte,
   Kamera mit Zoom und Fokus, Zeichenebene. Zeigt nie Patientengeometrie. Global: window.IKnowJaw */
/* =====================================================================
   Mini 3D engine (no libraries): perspective camera, painter's sort,
   metallic shading, Apple-style springs. Shared by hero and arch views.
   ===================================================================== */
const IKnowJawEngine = (function(){
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/l,a[1]/l,a[2]/l]; };
const UP = [0,1,0];
const LIGHT = norm([-0.5, 0.8, -0.55]);
const HALF = norm(add(LIGHT, [0,0,-1]));
const LSCR = (function(){ const l = Math.hypot(0.5, 0.8); return [-0.5/l, -0.8/l]; })();

function camera(yaw, pitch, dist, f, cx, cy){
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  function rot(p){ const x1 = p[0]*cyw + p[2]*syw, z1 = -p[0]*syw + p[2]*cyw, y1 = p[1]; return [x1, y1*cp + z1*sp, -y1*sp + z1*cp]; }
  function proj(p){ const r = rot(p); const z = r[2] + dist; return {x: cx + f*r[0]/z, y: cy - f*r[1]/z, z: z}; }
  return {rot, proj, dist, f, cx, cy};
}
function shade(n, base, spec, amb){
  const lam = Math.max(0, dot(n, LIGHT));
  const sp = Math.pow(Math.max(0, dot(n, HALF)), 34) * spec;
  const k = amb + (1 - amb) * lam;
  return 'rgb(' + clamp(base[0]*k + 255*sp, 0, 255).toFixed(0) + ',' + clamp(base[1]*k + 255*sp, 0, 255).toFixed(0) + ',' + clamp(base[2]*k + 255*sp, 0, 255).toFixed(0) + ')';
}
function springStep(x, v, target, zeta, resp, dt){
  const w = 2 * Math.PI / resp;
  const a = -w*w*(x - target) - 2*zeta*w*v;
  v += a*dt; x += v*dt;
  return [x, v];
}
function rubber(o, d){ return (o * d * 0.55) / (d + 0.55 * Math.abs(o)); }

const STEEL = {rim:[56,68,74], mid:[172,184,190], hi:[255,255,255]};
const OTHER = {rim:[92,80,62], mid:[190,170,136], hi:[255,246,226]};
const mixC = (a, b, t) => [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
const rgba = (c, a) => 'rgba(' + c[0].toFixed(0) + ',' + c[1].toFixed(0) + ',' + c[2].toFixed(0) + ',' + a + ')';

function wireItems(ctx, cam, pts, radius, opt){
  opt = opt || {};
  const P = pts.map(p => cam.proj(p));
  const parts = opt.parts || 2;
  const per = Math.ceil((P.length - 1) / parts);
  const items = [];
  for (let s = 0; s < P.length - 1; s += per) {
    const e = Math.min(P.length - 1, s + per);
    let z = 0; for (let k = s; k <= e; k++) z += P[k].z;
    items.push({depth: z / (e - s + 1), draw: () => strokeWire(ctx, cam, P, s, e, radius, opt)});
  }
  return items;
}
function strokeWire(ctx, cam, P, s, e, radius, opt){
  const mat = opt.mat || STEEL;
  const alpha = opt.alpha == null ? 1 : opt.alpha;
  const fogC = opt.fogColor || [6, 25, 30];
  const fogK = opt.fog == null ? 0.45 : opt.fog;
  const perp = [];
  for (let k = s; k <= e; k++) {
    const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    let px = -dy, py = dx; if (px*LSCR[0] + py*LSCR[1] < 0) { px = -px; py = -py; }
    perp.push([px, py]);
  }
  const chunks = [];
  for (let i = s; i < e; i += 6) {
    const j = Math.min(e, i + 6);
    let z = 0; for (let k = i; k <= j; k++) z += P[k].z; z /= (j - i + 1);
    chunks.push({i, j, w: Math.max(1.3, 2 * radius * cam.f / z), fog: clamp((z - cam.dist + 0.6) / 2.4, 0, 1) * fogK});
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash(opt.dash || []);
  for (let pass = 0; pass < 3; pass++) {
    if (opt.dash && pass === 2) continue;
    for (const ch of chunks) {
      const w = ch.w;
      const c = pass === 0 ? mixC(mat.rim, fogC, ch.fog) : pass === 1 ? mixC(mat.mid, fogC, ch.fog) : mat.hi;
      const lw = pass === 0 ? w : pass === 1 ? w * 0.6 : Math.max(0.7, w * 0.2);
      const off = pass === 0 ? 0 : pass === 1 ? w * 0.12 : w * 0.24;
      ctx.strokeStyle = rgba(c, pass === 2 ? alpha * (0.95 - ch.fog) : alpha);
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let k = ch.i; k <= ch.j; k++) {
        const pp = perp[k - s];
        const x = P[k].x + pp[0]*off, y = P[k].y + pp[1]*off;
        if (k === ch.i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}
function boxFaces(c, T, U, N, hw, hh, hd){
  const C = {};
  for (const sx of [-1,1]) for (const sy of [-1,1]) for (const sz of [-1,1]) C[sx+','+sy+','+sz] = add(add(add(c, mul(T, sx*hw)), mul(U, sy*hh)), mul(N, sz*hd));
  const g = (a,b,cc,d) => [C[a], C[b], C[cc], C[d]];
  return [
    {n: N, q: g('-1,-1,1','1,-1,1','1,1,1','-1,1,1'), front: true},
    {n: mul(N,-1), q: g('-1,-1,-1','-1,1,-1','1,1,-1','1,-1,-1')},
    {n: T, q: g('1,-1,-1','1,1,-1','1,1,1','1,-1,1')},
    {n: mul(T,-1), q: g('-1,-1,-1','-1,-1,1','-1,1,1','-1,1,-1')},
    {n: U, q: g('-1,1,-1','-1,1,1','1,1,1','1,1,-1')},
    {n: mul(U,-1), q: g('-1,-1,-1','1,-1,-1','1,-1,1','-1,-1,1')}
  ];
}
function drawQuad(ctx, cam, q, fill, stroke){
  const P = q.map(p => cam.proj(p));
  ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
  for (let k = 1; k < P.length; k++) ctx.lineTo(P[k].x, P[k].y);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
}
function faceVisible(cam, n, q){
  const nc = cam.rot(n);
  let cx = 0, cy = 0, cz = 0; for (const p of q) { const r = cam.rot(p); cx += r[0]; cy += r[1]; cz += r[2]; }
  cx /= q.length; cy /= q.length; cz = cz / q.length + cam.dist;
  return {vis: (nc[0]*-cx + nc[1]*-cy + nc[2]*-cz) > 0, nc: nc, depth: cz};
}

/* Arch geometry. b = amount of individual bends (0 = prefabricated arch) */
const smooth01 = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
function archP(u, b){
  let x = 1.4*u, y = 0.07*u*u, z = -0.75 + 1.5*u*u;
  if (b > 0) {
    y += b * 0.06 * smooth01((Math.abs(u) - 0.6) / 0.035 + 0.5);
    for (const c of [-0.33, 0.33]) {
      const s = (u - c) / 0.075;
      if (Math.abs(s) < 1) {
        const tau = (s + 1) / 2;
        const t0 = norm([1.4, 0, 3*u]);
        const h = b * 0.3 * Math.pow(Math.sin(Math.PI * tau), 0.7);
        const k = -b * 0.12 * Math.sin(2 * Math.PI * tau);
        x += t0[0]*k; z += t0[2]*k; y += h;
      }
    }
  }
  return [x, y, z];
}
function archFrame(u){
  const e = 0.002, p = archP(u, 0);
  const T = norm(sub(archP(u + e, 0), archP(u - e, 0)));
  const N = norm(cross(UP, T));
  const U = norm(cross(T, N));
  return {p, T, N, U};
}
function sampleArch(u0, u1, n, b){ const pts = []; for (let k = 0; k <= n; k++) pts.push(archP(lerp(u0, u1, k / n), b)); return pts; }
function floorShadow(ctx, cam, y, alpha){
  const c = cam.proj([0, y, 0.1]);
  const l = cam.proj([-1.6, y, 0.1]), r = cam.proj([1.6, y, 0.1]);
  const fr = cam.proj([0, y, -0.9]), bk = cam.proj([0, y, 1.0]);
  const rx = Math.max(10, (r.x - l.x) / 2), ry = Math.max(6, Math.abs(bk.y - fr.y) / 2);
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,' + alpha + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/* Viewer: sizing, drag with velocity handoff, springs, visibility, cleanup */
const VIEWERS = new Set();
function Viewer(canvas, o){
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, running = false, last = 0;
  const st = {yaw: o.restYaw || 0, pitch: o.restPitch, vy: 0, vp: 0, dragging: false, visible: false, t0: performance.now(), hist: [], moved: 0};
  function rest(t){ return (o.restYaw || 0) + (reduceMotion || !o.sway ? 0 : o.sway * Math.sin(t * 0.00052)); }
  function resize(){
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    draw(performance.now());
  }
  function draw(now){
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60); last = now;
    const target = rest(now - st.t0);
    if (!st.dragging) {
      [st.yaw, st.vy] = springStep(st.yaw, st.vy, target, o.zeta || 0.82, o.resp || 0.7, dt);
      [st.pitch, st.vp] = springStep(st.pitch, st.vp, o.restPitch, 1, 0.5, dt);
    }
    if (!W || !H) return true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cam = camera(st.yaw, st.pitch, o.dist, o.fit(W, H), W * (o.cx || 0.5), H * (o.cy || 0.5));
    const busy = o.draw(ctx, cam, W, H, now, st, dt);
    const settled = !st.dragging && Math.abs(st.vy) < 1e-3 && Math.abs(st.vp) < 1e-3 && Math.abs(st.yaw - target) < 1e-3 && Math.abs(st.pitch - o.restPitch) < 1e-3;
    return busy || !settled || (o.sway && !reduceMotion);
  }
  function loop(now){
    const more = draw(now);
    if (st.visible && more && canvas.isConnected) requestAnimationFrame(loop); else { running = false; last = 0; }
  }
  function kick(){ if (!running && st.visible) { running = true; last = 0; requestAnimationFrame(loop); } }
  const pMin = o.pitchMin == null ? 0.12 : o.pitchMin, pMax = o.pitchMax == null ? 1.15 : o.pitchMax;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    st.dragging = true; st.sx = e.clientX; st.sy = e.clientY; st.y0 = st.yaw; st.p0 = st.pitch; st.moved = 0;
    st.hist = [{t: e.timeStamp, y: st.yaw, p: st.pitch}];
    if (o.onGrab) o.onGrab();
    kick();
  });
  canvas.addEventListener('pointermove', e => {
    if (!st.dragging) return;
    const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    st.moved = Math.max(st.moved, Math.hypot(dx, dy));
    st.yaw = st.y0 + dx * 0.0085;
    const raw = st.p0 + dy * 0.006;
    st.pitch = raw < pMin ? pMin - rubber(pMin - raw, 0.6) : raw > pMax ? pMax + rubber(raw - pMax, 0.6) : raw;
    st.hist.push({t: e.timeStamp, y: st.yaw, p: st.pitch});
    while (st.hist.length > 2 && e.timeStamp - st.hist[0].t > 100) st.hist.shift();
  });
  function release(){
    if (!st.dragging) return;
    st.dragging = false;
    const h = st.hist, a = h[0], b = h[h.length - 1];
    const dtv = Math.max(0.016, (b.t - a.t) / 1000);
    st.vy = clamp((b.y - a.y) / dtv, -14, 14);
    st.vp = clamp((b.p - a.p) / dtv, -6, 6) * 0.5;
    kick();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver(es => es.forEach(en => { st.visible = en.isIntersecting; if (st.visible) kick(); }), {rootMargin: '80px'});
  io.observe(canvas);
  const api = {st, canvas, kick, redraw(){ if (!running) draw(performance.now()); kick(); }, destroy(){ ro.disconnect(); io.disconnect(); st.visible = false; VIEWERS.delete(api); }};
  VIEWERS.add(api);
  canvas._viewer = api;
  return api;
}
function sweep(){ VIEWERS.forEach(v => { if (!v.canvas.isConnected) v.destroy(); }); }

/* ---------- Hero arch with brackets (decorative brand moment) ---------- */
function mountHero(canvas){
  const NB = 14, LIT = [2, 5, 8, 11];
  const BR = [];
  for (let k = 0; k < NB; k++) {
    const u = -0.92 + k * (1.84 / (NB - 1));
    const fr = archFrame(u);
    const tube = (k === 0 || k === NB - 1);
    const hw = tube ? 0.12 : 0.074, hh = tube ? 0.046 : 0.064, hd = tube ? 0.045 : 0.04;
    const c = sub(add(fr.p, mul(fr.N, 0.012)), mul(fr.N, hd));
    const du = (hw + 0.03) / Math.hypot(1.4, 3 * u);
    BR.push({k, u, fr, lit: LIT.includes(k), tube, hw, hh, hd, c, over: sampleArch(u - du, u + du, 6, 0)});
  }
  let introStart = 0;
  return Viewer(canvas, {
    restPitch: 0.42, restYaw: 0, sway: 0.3, dist: 4.6, cx: 0.5, cy: 0.5,
    fit: (W, H) => Math.min(0.9 * W * 4.6 / 2.8, 1.35 * H * 4.6 / 2.8),
    draw(ctx, cam, W, H, now){
      if (!introStart) introStart = now;
      const g = reduceMotion ? 1 : 1 - Math.pow(1 - clamp((now - introStart) / 1600, 0, 1), 3);
      floorShadow(ctx, cam, -0.36, 0.5);
      const items = [];
      if (g > 0.01) items.push(...wireItems(ctx, cam, sampleArch(-Math.min(1, g * 1.04), Math.min(1, g * 1.04), 220, 0), 0.02));
      for (const B of BR) {
        const appear = clamp((g * 1.04 - Math.abs(B.u)) / 0.12, 0, 1);
        if (appear <= 0) continue;
        const s = 0.7 + 0.3 * (1 - Math.pow(1 - appear, 3));
        const pc = cam.proj(B.c);
        items.push({depth: pc.z, draw: () => {
          if (B.lit) {
            const r = 0.3 * cam.f / pc.z;
            const gr = ctx.createRadialGradient(pc.x, pc.y, 0, pc.x, pc.y, r);
            gr.addColorStop(0, 'rgba(142,219,207,' + 0.32 * appear + ')'); gr.addColorStop(1, 'rgba(142,219,207,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pc.x, pc.y, r, 0, Math.PI * 2); ctx.fill();
          }
          const faces = boxFaces(B.c, B.fr.T, B.fr.U, B.fr.N, B.hw * s, B.hh * s, B.hd * s)
            .map(F => Object.assign(F, faceVisible(cam, F.n, F.q))).filter(F => F.vis).sort((a, b) => b.depth - a.depth);
          const base = B.lit ? [128, 214, 199] : [196, 205, 210];
          ctx.globalAlpha = appear;
          let front = false;
          for (const F of faces) { drawQuad(ctx, cam, F.q, shade(F.nc, base, B.lit ? 0.5 : 1.0, B.lit ? 0.42 : 0.34), 'rgba(0,0,0,.16)'); if (F.front) front = true; }
          if (front && appear > 0.6) wireItems(ctx, cam, B.over, 0.02, {parts: 1}).forEach(it => it.draw());
          ctx.globalAlpha = 1;
        }});
      }
      items.sort((a, b) => b.depth - a.depth).forEach(it => it.draw());
      return g < 1;
    }
  });
}

/* ---------- Arch that shows what the documentation says ---------- */
function factsTargets(f){
  f = f || {};
  const b2 = f.bends2, b3 = f.bends3;
  const ok = (b2 != null && b2 >= 3) || (b3 != null && b3 >= 1);
  const some = (b2 != null && b2 > 0) || (b3 != null && b3 > 0);
  return {
    tb: ok ? 1 : some ? 0.45 : 0,
    tf: f.vollbogen === false ? 0.42 : 1,
    tg: f.status && f.status !== 'durchgefuehrt' ? 1 : 0,
    tm: f.material && f.material !== 'Edelstahl' ? 1 : 0
  };
}
function mountArch(canvas, facts, opts){
  opts = opts || {};
  const m = {b: 0, vb: 0, full: 1, vf: 0, ghost: 0, vg: 0, mat: 0, vm: 0, tb: 0, tf: 1, tg: 0, tm: 0, init: false};
  const light = opts.light !== false;
  const view = Viewer(canvas, {
    restPitch: 0.55, restYaw: 0.2, sway: 0.18, dist: 4.4, cy: 0.56,
    fit: (W, H) => Math.min(0.82 * W * 4.4 / 2.8, 1.45 * H * 4.4 / 2.8),
    draw(ctx, cam, W, H, now, st, dt){
      [m.b, m.vb] = springStep(m.b, m.vb, m.tb, 0.8, 0.55, dt);
      [m.full, m.vf] = springStep(m.full, m.vf, m.tf, 1, 0.5, dt);
      [m.ghost, m.vg] = springStep(m.ghost, m.vg, m.tg, 1, 0.35, dt);
      [m.mat, m.vm] = springStep(m.mat, m.vm, m.tm, 1, 0.35, dt);
      if (reduceMotion) { m.b = m.tb; m.full = m.tf; m.ghost = m.tg; m.mat = m.tm; }
      floorShadow(ctx, cam, -0.36, light ? 0.16 : 0.42);
      const ext = clamp(m.full, 0.2, 1);
      const pts = sampleArch(-ext, ext, 320, Math.max(0, m.b));
      const mat = {rim: mixC(STEEL.rim, OTHER.rim, m.mat), mid: mixC(STEEL.mid, OTHER.mid, m.mat), hi: mixC(STEEL.hi, OTHER.hi, m.mat)};
      const ghost = m.ghost > 0.5;
      wireItems(ctx, cam, pts, 0.026, {mat, fog: light ? 0.2 : 0.45, fogColor: light ? [228, 236, 234] : [6, 25, 30], alpha: 1 - 0.6 * clamp(m.ghost, 0, 1), dash: ghost ? [7, 7] : null})
        .sort((p, q) => q.depth - p.depth).forEach(it => it.draw());
      return Math.abs(m.b - m.tb) > 1e-3 || Math.abs(m.vb) > 1e-3 || Math.abs(m.full - m.tf) > 1e-3 || Math.abs(m.ghost - m.tg) > 1e-3 || Math.abs(m.mat - m.tm) > 1e-3;
    }
  });
  view.setFacts = f => {
    const t = factsTargets(f);
    Object.assign(m, t);
    if (!m.init) { m.b = m.tb; m.full = m.tf; m.ghost = m.tg; m.mat = m.tm; m.init = true; }
    view.redraw();
  };
  view.setFacts(facts);
  return view;
}

/* ---------- Plaster study model (Planungsmodell): OK above, UK below, exploded ----------
   Rule: the model only draws what the Behandlungskonto documents with a tooth number. Everything else
   lives in the jaw cards next to it. Hovering a card row lights up its parts, hovering a part lights up
   its row; a click on a part opens the Beleg. */
const MT = [ /* per side from the midline: width, depth, crown height, top scale [along arch, labial-lingual] */
  {w: .2, d: .13, h: .34, top: [.86, .28]}, {w: .16, d: .12, h: .3, top: [.82, .3]}, {w: .185, d: .165, h: .36, top: [.3, .36]},
  {w: .17, d: .185, h: .27, top: [.62, .6]}, {w: .165, d: .185, h: .26, top: [.62, .6]}, {w: .24, d: .235, h: .235, top: [.72, .72]}, {w: .225, d: .22, h: .22, top: [.72, .72]}
];
const MGAP = .016, BASE_H = .2, HMAX = .36, SEG = 18;
const curveM = s => [1.05 * s, 0, -0.7 + 1.35 * s * s];
const dCurveM = s => [1.05, 0, 2.7 * s];
const ARCM = (function(){ const n = 800, L = [0]; let prev = curveM(0); for (let k = 1; k <= n; k++) { const p = curveM(k / n); L.push(L[k - 1] + Math.hypot(p[0] - prev[0], p[2] - prev[2])); prev = p; } return {n, L}; })();
function sAtLen(len){
  const L = ARCM.L; let lo = 0, hi = ARCM.n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < len) lo = m; else hi = m; }
  return (lo + (len - L[lo]) / ((L[hi] - L[lo]) || 1)) / ARCM.n;
}
const SIGNAL = [229, 81, 43], TEAL = [18, 128, 134];
const PL_TOOTH = [251, 249, 245], PL_BASE = [244, 241, 235], PL_BASE_LOW = [233, 229, 221];
/* IKnow: Zahnfleisch und Zahnschmelz statt Gips */
const GUM = [224, 150, 144], GUM_DARK = [200, 122, 118], GUM_LIGHT = [238, 182, 176];
const ENAMEL = [[244, 233, 214], [250, 246, 236], [252, 251, 247], [250, 252, 253]]; /* Zahnhals bis Schneide */
const enamelAt = y => { const k = clamp(y, 0, 1) * (ENAMEL.length - 1), i = Math.floor(k), f = k - i; return i >= ENAMEL.length - 1 ? ENAMEL[ENAMEL.length - 1] : mixC(ENAMEL[i], ENAMEL[i + 1], f); };
/* Kronenprofile je Zahntyp: Höhe (Anteil), Breite entlang des Bogens, Tiefe, Verschiebung nach innen */
const PROFILES = {
  incisor: [[0, .8, .72, 0], [.12, .93, .9, 0], [.4, 1, .98, 0], [.7, 1.03, .82, .03], [.9, 1.02, .55, .06], [1, 1, .3, .08]],
  canine:  [[0, .82, .82, 0], [.12, .95, .96, 0], [.45, 1, 1, 0], [.75, .95, .9, .01], [.92, .72, .7, .02], [1, .38, .36, .03]],
  premolar:[[0, .84, .84, 0], [.12, .96, .97, 0], [.45, 1, 1, 0], [.8, .98, .98, 0], [.94, .86, .9, 0], [1, .7, .78, 0]],
  molar:   [[0, .86, .86, 0], [.12, .97, .97, 0], [.45, 1, 1, 0], [.8, .99, .99, 0], [.94, .9, .92, 0], [1, .78, .82, 0]],
};
const typeOf = i => i <= 1 ? 'incisor' : i === 2 ? 'canine' : i <= 4 ? 'premolar' : 'molar';
const STEEL_C = [182, 192, 198];
const AMBER = [176, 118, 14];
const STATE_TINT = {abgerechnet: null, bestaetigt: TEAL, reserviert: TEAL, offen: SIGNAL, erfasst: null, nachgetragen: null};
const DOT_RGB = {abgerechnet: [20, 24, 28], bestaetigt: TEAL, reserviert: TEAL, offen: SIGNAL, erfasst: [138, 144, 151], leer: [170, 174, 178], nachgetragen: AMBER, unbekannt: AMBER};
/* diagonal hatch for teeth whose state before the history start is unknown */
function hatchOf(ctx){
  if (ctx._hatch) return ctx._hatch;
  const c = document.createElement('canvas'); c.width = c.height = 7;
  const x = c.getContext('2d'); x.strokeStyle = 'rgba(176,118,14,.95)'; x.lineWidth = 1.25; x.lineCap = 'square';
  x.beginPath(); x.moveTo(-1, 8); x.lineTo(8, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(6, 8); x.lineTo(8, 6); x.stroke();
  ctx._hatch = ctx.createPattern(c, 'repeat'); return ctx._hatch;
}
const catmull = P => {
  const pts = [];
  for (let k = 0; k < P.length - 1; k++) {
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
    for (let m = 0; m < 8; m++) { const u = m / 8, u2 = u * u, u3 = u2 * u;
      pts.push([0, 1, 2].map(c => .5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3))); }
  }
  pts.push(P[P.length - 1]);
  return pts;
};

function buildModel(data){
  const V = [], F = [], anchors = {}, tips = [], wires = {};
  const vtx = (p, jaw, grp) => { V.push({p, jaw, grp}); return V.length - 1; };
  const face = (idx, n, base, o) => F.push(Object.assign({idx, n, base, spec: .03, amb: .78, jaw: V[idx[0]].jaw, grp: V[idx[0]].grp}, o || {}));
  const center = idx => { let c = [0, 0, 0]; idx.forEach(i => { c = add(c, V[i].p); }); return mul(c, 1 / idx.length); };
  const outward = (idx, n, ref) => dot(n, sub(center(idx), ref)) < 0 ? mul(n, -1) : n;
  const polyN = idx => { const a = V[idx[0]].p, b = V[idx[1]].p, c = V[idx[2]].p; return norm(cross(sub(b, a), sub(c, a))); };
  ['UK', 'OK'].forEach(jaw => {
    const J = (data.jaws && data.jaws[jaw]) || {};
    if (data.show && data.show !== 'both' && data.show !== jaw) return;
    const pose = J.pose || {}, marks = J.marks || {};
    const fade = J.active === false;
    const unk = !fade && J.unknown ? 'unk:' + jaw : null;
    const j = jaw === 'UK' ? 1 : -1;
    const sc = jaw === 'OK' ? 1.045 : 1, dz = jaw === 'OK' ? -0.035 : 0;
    const cv = s => { const p = curveM(s); return [p[0] * sc, 0, p[2] * sc + dz]; };
    const fr = s => { const p = cv(s), d = dCurveM(s); return {p, T: norm(d), N: norm(cross(UP, d))}; };
    const total = MT.reduce((n, t) => n + t.w + MGAP, 0);
    const sEnd = sAtLen(total + .06);
    /* plaster base: horseshoe, outer wall in 2 bands so the lower one can sit in its own shadow */
    const NB = 56, rows = [];
    for (let k = 0; k <= NB; k++) {
      const s = -sEnd + 2 * sEnd * k / NB, f = fr(s), a = Math.abs(s) / sEnd;
      const o = add(f.p, mul(f.N, .115 + .06 * a)), i = sub(f.p, mul(f.N, .13 + .07 * a));
      rows.push({ot: vtx([o[0], 0, o[2]], jaw, -1), om: vtx([o[0], -j * BASE_H * .55, o[2]], jaw, -1), ob: vtx([o[0], -j * BASE_H, o[2]], jaw, -1),
        it: vtx([i[0], 0, i[2]], jaw, -1), ib: vtx([i[0], -j * BASE_H, i[2]], jaw, -1)});
    }
    const bc = [0, -j * BASE_H / 2, 0.05];
    // Documentary annotation: tint the jaw base, never deform or invent teeth.
    const baseColor = J.annotation ? mixC(GUM, TEAL, .25) : GUM;
    const fb = {kind: 'base', fade};
    for (let k = 0; k < NB; k++) {
      const A = rows[k], B = rows[k + 1];
      const top = [A.ot, B.ot, B.it, A.it]; face(top, outward(top, [0, j, 0], [0, -j, 0]), baseColor, fb);
      const o1 = [A.ot, A.om, B.om, B.ot]; face(o1, outward(o1, polyN(o1), bc), GUM_DARK, Object.assign({spec: .12}, fb));
      const o2 = [A.om, A.ob, B.ob, B.om]; face(o2, outward(o2, polyN(o2), bc), PL_BASE_LOW, fb);
      const iw = [A.it, B.it, B.ib, A.ib]; face(iw, mul(outward(iw, polyN(iw), bc), -1), GUM_LIGHT, fb);
    }
    [rows[0], rows[NB]].forEach((R, e) => { const cap = [R.ot, R.it, R.ib, R.ob]; const d = norm(dCurveM(e ? sEnd : -sEnd)); face(cap, e ? d : mul(d, -1), PL_BASE, fb); });
    /* the upper model is closed over the palate; the lower one stays open for the tongue */
    if (jaw === 'OK') face(rows.map(R => R.ob), [0, -j, 0], GUM_LIGHT, fb);
    const cardS = sEnd * .62, cf = fr(cardS);
    anchors[jaw + ':card'] = {jaw, p: add([cf.p[0], -j * BASE_H * .45, cf.p[2]], mul(cf.N, .16))};
    if (J.annotation) { const f0 = fr(0); anchors[jaw + ':annotation'] = {jaw, annotation: J.annotation, p: add([f0.p[0], -j * BASE_H * .5, f0.p[2]], mul(f0.N, .14))}; }
    if (unk) { const f0 = fr(0); anchors[jaw + ':unk'] = {jaw, key: unk, p: add([f0.p[0], -j * BASE_H * .5, f0.p[2]], mul(f0.N, .14))}; }
    /* teeth and what sits on them */
    const slots = [], schematicSlots = [], rets = [];
    [-1, 1].forEach(side => {
      let len = 0;
      MT.forEach((t, i) => {
        const fdi = String((jaw === 'OK' ? (side < 0 ? 1 : 2) : (side < 0 ? 4 : 3)) * 10 + i + 1);
        const s = side * sAtLen(len + MGAP / 2 + t.w / 2); len += t.w + MGAP;
        const f = fr(s);
        const P0 = pose[fdi] || null;
        if (P0 && P0.hide) return;
        if (P0) {
          const a = P0.rot || 0, c = Math.cos(a), sn = Math.sin(a);
          const T2 = norm(add(mul(f.T, c), mul(f.N, sn))), N2 = norm(sub(mul(f.N, c), mul(f.T, sn)));
          f.p = add(add(f.p, mul(f.T, P0.dx || 0)), mul(f.N, P0.dz || 0)); f.T = T2; f.N = N2;
        }
        const tilt = P0 ? (P0.tilt || 0) : 0, dyP = P0 ? (P0.dy || 0) : 0;
        const TOOTH_C = marks[fdi] ? mixC(PL_TOOTH, marks[fdi] === 'orange' ? [234, 122, 60] : TEAL, .5) : PL_TOOTH;
        const grp = (jaw === 'OK' ? 100 : 200) + i * 2 + (side > 0 ? 1 : 0);
        const ring = (y, k1, k2, g2, o) => { o = o || {}; const out = []; for (let m = 0; m < SEG; m++) { const th = m / SEG * Math.PI * 2; const c = Math.cos(th), sn = Math.sin(th);
          const cx = Math.sign(c) * Math.pow(Math.abs(c), .72), cz = Math.sign(sn) * Math.pow(Math.abs(sn), .72);
          const yy = y + (o.yFn ? o.yFn(th) : 0), shift = (o.shift || 0) * t.d;
          const p = add(add(add(f.p, mul(f.T, cx * t.w / 2 * k1)), mul(f.N, cz * t.d / 2 * k2 - shift)), mul(f.N, tilt * yy)); out.push(vtx([p[0], j * yy + dyP, p[2]], jaw, g2 == null ? grp : g2)); } return out; };
        const type = typeOf(i), prof = PROFILES[type];
        const tc = [f.p[0], j * t.h * .5, f.p[2]];
        /* Kauflächen: Höcker als Höhenwelle auf dem obersten Ring, Schneidezähne flach, Eckzahn spitz */
        const cusp = type === 'molar' ? th => -.045 * t.h * (1 - Math.pow(Math.cos(2 * th), 2)) : type === 'premolar' ? th => -.05 * t.h * (1 - Math.pow(Math.sin(th), 2)) : null;
        const Rs = prof.map(([hy, k1, k2, sh], r) => ring(t.h * hy, k1, k2, undefined, {shift: sh, yFn: r === prof.length - 1 ? cusp : null}));
        const col = (y) => marks[fdi] ? mixC(enamelAt(y), marks[fdi] === 'orange' ? [234, 122, 60] : TEAL, .45) : enamelAt(y);
        /* Zahnfleischsaum: kleiner Kragen um den Zahnhals */
        const G0 = ring(-.004, 1.18, 1.2, grp + 1000), G1 = ring(t.h * .06, .9, .84, grp + 1000);
        for (let m = 0; m < SEG; m++) { const q = [G0[m], G0[(m + 1) % SEG], G1[(m + 1) % SEG], G1[m]]; face(q, outward(q, polyN(q), tc), GUM, {kind: 'gum', spec: .1, amb: .62, fade, fdi}); }
        for (let r = 0; r < Rs.length - 1; r++) { const A = Rs[r], B = Rs[r + 1], yMid = (prof[r][0] + prof[r + 1][0]) / 2;
          for (let m = 0; m < SEG; m++) { const q = [A[m], A[(m + 1) % SEG], B[(m + 1) % SEG], B[m]]; face(q, outward(q, polyN(q), tc), col(yMid), {kind: 'tooth', spec: .5, amb: .6, fade, fdi, unk}); } }
        /* Abschluss: Schneidekante flach, Eckzahn mit Spitze, Seitenzähne mit leichter Mulde */
        const topY = t.h * (type === 'canine' ? 1.06 : type === 'incisor' ? 1 : .955);
        const apex = vtx([f.p[0] + f.N[0] * (tilt * topY - (prof[prof.length - 1][3] || 0) * t.d), j * topY + dyP, f.p[2] + f.N[2] * (tilt * topY - (prof[prof.length - 1][3] || 0) * t.d)], jaw, grp);
        const Rt = Rs[Rs.length - 1];
        for (let m = 0; m < SEG; m++) { const q = [Rt[m], Rt[(m + 1) % SEG], apex]; face(q, outward(q, polyN(q), tc), col(1), {kind: 'tooth', spec: .5, amb: .62, fade, fdi, unk}); }
        if (J.aligner) { /* durchsichtige Schiene: etwas größere Hülle um die Krone */
          const Ss = [ring(t.h * .22, 1.1, 1.22), ring(t.h * .62, 1.1, 1.2), ring(t.h * .9, 1.05, 1.12), ring(t.h + .025, t.top[0] * 1.06 + .05, t.top[1] * 1.08 + .05)];
          for (let r = 0; r < Ss.length - 1; r++) { const A = Ss[r], B = Ss[r + 1];
            for (let m = 0; m < SEG; m++) { const q = [A[m], A[(m + 1) % SEG], B[(m + 1) % SEG], B[m]]; face(q, outward(q, polyN(q), tc), [196, 234, 240], {kind: 'shell', spec: .9, amb: .92, fade, fdi}); } }
          face(Ss[3].slice(), [0, j, 0], [196, 234, 240], {kind: 'shell', spec: .9, amb: .92, fade, fdi});
        }
        const T = (J.teeth && J.teeth[fdi]) || {};
        const evs = Object.values(T).map(x => x && x.ev).filter(Boolean);
        tips.push({jaw, fdi, p: [f.p[0], j * (t.h + .07), f.p[2]], evs, offen: Object.values(T).some(x => x && x.state === 'offen')});
        const yS = j * t.h * .52 + dyP;
        const lab = add(f.p, mul(f.N, t.d / 2 + .004 + tilt * t.h * .52));
        anchors['t:' + fdi] = {jaw, p: add([lab[0], yS, lab[2]], mul(f.N, .05))};
        anchors['tip:' + fdi] = {jaw, p: [f.p[0] + f.N[0] * tilt * t.h, j * (t.h + .06), f.p[2] + f.N[2] * tilt * t.h]};
        // Jaw-level documentary wire: geometry only, never fabricate bracket facts.
        schematicSlots.push({s, p: [lab[0] + f.N[0] * .03, yS, lab[2] + f.N[2] * .03]});
        const tint = st => st === 'ghost' ? [214, 216, 214] : STATE_TINT[st] ? mixC(STEEL_C, STATE_TINT[st], .62) : STEEL_C;
        const box = (centerP, hw, hh, hd, item, part) => {
          const C = {}, U = [0, 1, 0];
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) C[sx + ',' + sy + ',' + sz] = vtx(add(add(add(centerP, mul(f.T, sx * hw)), mul(U, sy * hh)), mul(f.N, sz * hd)), jaw, grp + 1000);
          const g = (a, b, c, d) => [C[a], C[b], C[c], C[d]];
          [[g('-1,-1,1', '1,-1,1', '1,1,1', '-1,1,1'), f.N], [g('-1,-1,-1', '-1,1,-1', '1,1,-1', '1,-1,-1'), mul(f.N, -1)], [g('1,-1,-1', '1,1,-1', '1,1,1', '1,-1,1'), f.T],
           [g('-1,-1,-1', '-1,-1,1', '-1,1,1', '-1,1,-1'), mul(f.T, -1)], [g('-1,1,-1', '-1,1,1', '1,1,1', '1,1,-1'), U], [g('-1,-1,-1', '1,-1,-1', '1,-1,1', '-1,-1,1'), mul(U, -1)]]
            .forEach(([q, n]) => face(q, n, part === 'attachment' ? PL_TOOTH : tint(item.state), {kind: part === 'attachment' ? 'tooth' : 'metal', spec: part === 'attachment' ? .16 : 1, amb: part === 'attachment' ? .7 : .36, part, state: item.state, ev: item.ev, fdi, fade}));
        };
        if (T.band) {
          const Bl = ring(t.h * .22, 1.07, 1.09, grp + 1000), Bh = ring(t.h * .66, 1.07, 1.09, grp + 1000);
          for (let m = 0; m < SEG; m++) { const q = [Bl[m], Bl[(m + 1) % SEG], Bh[(m + 1) % SEG], Bh[m]]; face(q, outward(q, polyN(q), tc), tint(T.band.state), {kind: 'metal', spec: 1, amb: .38, part: 'band', state: T.band.state, ev: T.band.ev, fdi, fade}); }
        }
        if (T.br) box(add([lab[0], yS, lab[2]], mul(f.N, .017)), .036, .036, .017, T.br, 'br');
        // Leitstand extension: schematic attachment, not a metal bracket or wire slot.
        if (T.attachment) box(add([lab[0], yS, lab[2]], mul(f.N, .024)), .028, .045, .024, T.attachment, 'attachment');
        if (T.tube) box(add([lab[0], yS, lab[2]], mul(f.N, T.band ? .035 : .018)), .06, .022, .016, T.tube, 'tube');
        if (T.br || T.band || T.tube) slots.push({s, p: [lab[0] + f.N[0] * .03, yS, lab[2] + f.N[2] * .03]});
        if (T.ret) {
          const lin = sub(f.p, mul(f.N, t.d / 2 + .004));
          const yR = j * t.h * .36;
          const N0 = f.N; f.N = mul(N0, -1);
          box(add([lin[0], yR, lin[2]], mul(f.N, .012)), .03, .022, .012, T.ret, 'ret');
          f.N = N0;
          rets.push({s, p: [lin[0] - N0[0] * .02, yR, lin[2] - N0[2] * .02], item: T.ret});
        }
      });
    });
    slots.sort((a, b) => a.s - b.s); rets.sort((a, b) => a.s - b.s);
    if (J.wire && J.wire.schematic) {
      schematicSlots.sort((a, b) => a.s - b.s);
      wires[jaw] = {pts: catmull(schematicSlots.map(x => x.p)), mat: OTHER, state: 'erfasst', ev: J.wire.ev, fade};
    }
    else if (J.wire && slots.length > 1) {
      const st = J.wire.state || 'abgerechnet', mat = J.wire.material && J.wire.material !== 'Edelstahl' ? OTHER : STEEL, tn = STATE_TINT[st];
      wires[jaw] = {pts: catmull(slots.map(x => x.p)), mat: tn ? {rim: mixC(mat.rim, tn, .5), mid: mixC(mat.mid, tn, .6), hi: mat.hi} : mat, state: st, ev: J.wire.ev, fade, radius: J.wire.radius, progress: J.wire.progress};
    }
    if (rets.length > 1) {
      const it = rets[0].item, tn = STATE_TINT[it.state];
      wires[jaw + ':ret'] = {jaw, pts: catmull(rets.map(x => x.p)), mat: tn ? {rim: mixC(STEEL.rim, tn, .5), mid: mixC(STEEL.mid, tn, .6), hi: STEEL.hi} : STEEL, state: it.state, ev: it.ev, fade, radius: .008, pads: rets.map(x => x.p)};
    }
  });
  return {V, F, anchors, tips, wires, unkLabel: data.unkLabel || ''};
}

function mountModel(canvas, data, opts){
  opts = opts || {};
  let D = data || {}, M = buildModel(clone2(D));
  const hero = !!opts.hero;
  const m = {gap: HMAX, vg: 0, tg: HMAX + .3, introStart: 0, stage: -1, hl: null, pick: [], hoverEv: null,
    z: 1, vz: 0, tz: 1, f: [0, 0, 0], vf: [0, 0, 0], tf: [0, 0, 0]};
  const hostEl = () => canvas.parentElement;
  const VO = {
    restPitch: hero ? .34 : .32, restYaw: hero ? .42 : .36, sway: hero ? .16 : 0, dist: 6.1, cy: .5,
    fit: (W, H) => Math.min((hasSide(W) ? .5 : hero ? .8 : .7) * W * 6.1 / 2.5, (hero ? .74 : .72) * H * 6.1 / 2.3),
    draw(ctx, cam0, W, H, now, st, dt){
      if (!m.introStart) m.introStart = now;
      const g = reduceMotion || opts.noIntro ? 1 : clamp((now - m.introStart) / (hero ? 2600 : 1500), 0, 1);
      const side = hasSide(W);
      let band = null;
      if (side) { const h = hostEl(), se = h.querySelector('.model-state'), le = h.querySelector('.model-legend');
        const top = se ? se.offsetTop + se.offsetHeight + 4 : 0, bot = le ? le.offsetTop - 10 : H, av = Math.max(160, bot - top);
        band = {cy: top + av * .5, f: Math.min(cam0.f, .8 * av * 6.1 / 2.3)}; }
      const camB = side ? camera(st.yaw, st.pitch, cam0.dist, band.f, W * .36, band.cy) : opts.cx ? camera(st.yaw, st.pitch, cam0.dist, cam0.f, W * opts.cx, H * (opts.cy || .5)) : cam0;
      /* IKnow: Zoom und Fokuspunkt weich nachführen */
      [m.z, m.vz] = springStep(m.z, m.vz, m.tz, 1, .9, dt);
      for (let k = 0; k < 3; k++) [m.f[k], m.vf[k]] = springStep(m.f[k], m.vf[k], m.tf[k], 1, .9, dt);
      if (reduceMotion) { m.z = m.tz; m.f = m.tf.slice(); }
      const camBusy = Math.abs(m.z - m.tz) > 1e-3 || m.f.some((v, k) => Math.abs(v - m.tf[k]) > 1e-3);
      const camZ = camera(st.yaw, st.pitch, camB.dist, camB.f * m.z, camB.cx, camB.cy), FOC = m.f.slice();
      const cam = {rot: p => camZ.rot(sub(p, FOC)), proj: p => camZ.proj(sub(p, FOC)), dist: camZ.dist, f: camZ.f, cx: camZ.cx, cy: camZ.cy};
      const gT = reduceMotion ? m.tg : lerp(HMAX, m.tg, smooth01((g - .5) / .5));
      if (g < 1) m.gap = gT; else [m.gap, m.vg] = springStep(m.gap, m.vg, m.tg, .9, .6, dt);
      const yOff = {OK: m.gap + .02, UK: -m.gap - .02};
      const floorY = yOff.UK - BASE_H - .02;
      /* floor: technical grid fading out, contact shadows */
      ctx.save(); ctx.lineWidth = 1;
      for (let k = -12; k <= 12; k++) {
        const a = .08 * (1 - Math.abs(k) / 12.5);
        const p1 = cam.proj([k * .22, floorY, -1.9]), p2 = cam.proj([k * .22, floorY, 1.9]);
        const q1 = cam.proj([-2.64, floorY, k * .16]), q2 = cam.proj([2.64, floorY, k * .16]);
        ctx.strokeStyle = 'rgba(20,24,28,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
      }
      ctx.restore();
      const fa = clamp(g * 4, 0, 1);
      floorShadow(ctx, cam, floorY, .22 * fa); floorShadow(ctx, cam, floorY, .06 * fa);
      const rise = grp => grp < 0 ? 1 : clamp((g - .12 - (grp % 100) * .012) / .22, 0, 1);
      const pop = grp => clamp((g - .42 - (grp % 100) * .01) / .14, 0, 1);
      const baseA = clamp(g / .18, 0, 1);
      const P = new Array(M.V.length), R = new Array(M.V.length);
      for (let i = 0; i < M.V.length; i++) {
        const v = M.V[i];
        let y = v.p[1];
        if (v.grp >= 0 && v.grp < 1000) y *= Math.max(.02, smooth01(rise(v.grp)));
        R[i] = cam.rot([v.p[0], y + yOff[v.jaw], v.p[2]]); R[i][2] += cam.dist;
        P[i] = {x: cam.cx + cam.f * R[i][0] / R[i][2], y: cam.cy - cam.f * R[i][1] / R[i][2]};
      }
      const hl = m.hl, items = [], pick = [];
      for (const fc of M.F) {
        let alpha = fc.kind === 'shell' ? (rise(fc.grp) > .01 ? .42 : 0) : fc.kind === 'base' ? baseA : fc.kind === 'gum' ? (rise(fc.grp - 1000) > .01 ? 1 : 0) : fc.kind === 'metal' ? pop(fc.grp - 1000) : rise(fc.grp) > .01 ? 1 : 0;
        if (alpha <= 0) continue;
        if (fc.fade) alpha *= .26;
        let cx = 0, cy = 0, cz = 0;
        for (const i of fc.idx) { cx += R[i][0]; cy += R[i][1]; cz += R[i][2]; }
        const n = fc.idx.length; cx /= n; cy /= n; cz /= n;
        const nc = cam.rot(fc.n);
        if (nc[0] * -cx + nc[1] * -cy + nc[2] * -cz <= 0) continue;
        const lit = hl && fc.ev && hl.has(fc.ev), litU = !!(hl && fc.unk && hl.has(fc.unk));
        if (hl && fc.kind === 'metal' && !lit) alpha *= .3;
        const it = {depth: cz + (fc.kind === 'metal' ? -.012 : fc.kind === 'shell' ? -.02 : 0), draw: () => {
          ctx.globalAlpha = alpha;
          const base = lit ? mixC(fc.base, DOT_RGB[fc.state] && fc.state !== 'abgerechnet' ? DOT_RGB[fc.state] : [70, 160, 168], .55) : fc.base;
          const col = shade(nc, base, fc.spec, lit ? .55 : fc.amb);
          ctx.beginPath(); ctx.moveTo(P[fc.idx[0]].x, P[fc.idx[0]].y);
          for (let k = 1; k < n; k++) ctx.lineTo(P[fc.idx[k]].x, P[fc.idx[k]].y);
          ctx.closePath(); ctx.fillStyle = col; ctx.fill();
          if (fc.unk) { ctx.globalAlpha = alpha * (litU ? .9 : hl ? .3 : .55); ctx.fillStyle = hatchOf(ctx); ctx.fill(); ctx.globalAlpha = alpha; }
          ctx.strokeStyle = fc.kind === 'metal' ? (lit ? rgba(DOT_RGB[fc.state] || TEAL, .9) : 'rgba(30,38,44,.35)') : fc.kind === 'shell' ? 'rgba(255,255,255,.6)' : col; ctx.lineWidth = fc.kind === 'metal' ? (lit ? 1.2 : .5) : .8; ctx.stroke();
          ctx.globalAlpha = 1;
        }};
        items.push(it);
        if (fc.kind === 'metal' && fc.ev && !fc.fade) it.pick = {ev: fc.ev, fdi: fc.fdi, poly: fc.idx.map(i => P[i])};
        else if (fc.unk && fc.kind === 'tooth') it.pick = {ev: fc.unk, fdi: fc.fdi, poly: fc.idx.map(i => P[i])};
      }
      /* wires: drawn segment by segment so they interleave with the teeth */
      const wf = clamp((g - .66) / .26, 0, 1);
      Object.keys(M.wires).forEach(key => {
        const wd = M.wires[key], jaw = wd.jaw || key; if (wf <= 0 || wd.progress === 0) return;
        const n = Math.max(2, Math.round(wd.pts.length * wf * (wd.progress == null ? 1 : wd.progress)));
        const pts = wd.pts.slice(0, n).map(p => [p[0], p[1] + yOff[jaw], p[2]]);
        const lit = hl && wd.ev && hl.has(wd.ev), dim = hl && !lit;
        const mat = lit ? {rim: mixC(wd.mat.rim, DOT_RGB[wd.state] || TEAL, .6), mid: mixC(wd.mat.mid, DOT_RGB[wd.state] || TEAL, .6), hi: wd.mat.hi} : wd.mat;
        wireItems(ctx, cam, pts, (wd.radius || .011) * (lit ? 1.5 : 1), {mat, fog: .12, fogColor: [232, 229, 222], alpha: (wd.fade ? .26 : 1) * (dim ? .35 : 1), parts: Math.max(2, Math.round(n / 8))})
          .forEach(it => { it.depth -= .03; items.push(it); });
      });
      items.sort((a, b) => b.depth - a.depth).forEach(it => { it.draw(); if (it.pick) pick.push(it.pick); });
      m.pick = pick;
      /* lingual retainer: hidden behind the teeth, so it is traced on top as a dashed x-ray line */
      if (g > .86) Object.keys(M.wires).forEach(key => {
        const wd = M.wires[key]; if (!wd.pads || wd.fade) return;
        const lit = hl && wd.ev && hl.has(wd.ev), dim = hl && !lit;
        const pr = p => cam.proj([p[0], p[1] + yOff[wd.jaw], p[2]]);
        const Q = wd.pts.map(pr), col = lit ? (DOT_RGB[wd.state] || TEAL) : [20, 24, 28];
        ctx.save(); ctx.globalAlpha = clamp((g - .86) / .14, 0, 1) * (dim ? .3 : 1);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); Q.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
        ctx.setLineDash([5, 4]); ctx.strokeStyle = rgba(col, .85); ctx.lineWidth = lit ? 2.2 : 1.6;
        ctx.beginPath(); Q.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.setLineDash([]);
        wd.pads.map(pr).forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, Math.PI * 2); ctx.fillStyle = rgba(col, .95); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke(); });
        const mid = Q[Math.floor(Q.length / 2)];
        ctx.font = '700 9px Archivo, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = 'RETAINER INNEN', tw = ctx.measureText(txt).width + 12;
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mid.x - tw / 2, mid.y + 9, tw, 15, 7.5) : ctx.rect(mid.x - tw / 2, mid.y + 9, tw, 15); ctx.fill();
        ctx.fillStyle = rgba(col, .9); ctx.fillText(txt, mid.x, mid.y + 17);
        ctx.restore();
      });
      /* unknown jaw: a printed label on the front of the plaster base */
      if (g > .8 && M.unkLabel) ['OK', 'UK'].forEach(jaw => {
        const an = M.anchors[jaw + ':unk']; if (!an || M.anchors[jaw + ':annotation']) return;
        const q = cam.proj([an.p[0], an.p[1] + yOff[jaw], an.p[2]]), lit = !!(hl && hl.has(an.key));
        ctx.save(); ctx.globalAlpha = clamp((g - .8) / .2, 0, 1) * (hl && !lit ? .45 : 1);
        ctx.font = '700 9.5px Archivo, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
        const txt = M.unkLabel.toUpperCase(), w = ctx.measureText(txt).width + 22, h = 20;
        ctx.fillStyle = lit ? 'rgba(176,118,14,.96)' : 'rgba(250,240,214,.96)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - w / 2, q.y - h / 2, w, h, 10) : ctx.rect(q.x - w / 2, q.y - h / 2, w, h); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(221,176,90,1)'; ctx.stroke();
        ctx.fillStyle = lit ? '#fff' : '#875500'; ctx.fillText(txt, q.x, q.y + .5);
        ctx.restore();
      });
      /* Documentary jaw label; no patient-specific tooth geometry is claimed. */
      if (g > .8) ['OK', 'UK'].forEach(jaw => {
        const an = M.anchors[jaw + ':annotation']; if (!an) return;
        const q = cam.proj([an.p[0], an.p[1] + yOff[jaw], an.p[2]]), a = an.annotation;
        const txt = jaw + (a.region === 'front' ? ' · FRONT' : '') + ' · ' + a.label.toUpperCase();
        ctx.save(); ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(txt).width + 24, h = 25;
        ctx.fillStyle = 'rgba(18,105,112,.97)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x-w/2,q.y-h/2,w,h,9) : ctx.rect(q.x-w/2,q.y-h/2,w,h); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt,q.x,q.y); ctx.restore();
      });
      /* tooth numbers for what is lit or still open */
      if (g > .8) {
        ctx.save(); ctx.font = '700 10px Archivo, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        M.tips.forEach(tp => {
          const on = (hl && tp.evs.some(e => hl.has(e))) || (!hl && tp.offen);
          if (!on) return;
          const q = cam.proj([tp.p[0], tp.p[1] + yOff[tp.jaw], tp.p[2]]);
          const w = 22, h = 15;
          ctx.globalAlpha = clamp((g - .8) / .2, 0, 1);
          ctx.fillStyle = tp.offen && !hl ? 'rgba(229,81,43,.95)' : 'rgba(20,24,28,.88)';
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - w / 2, q.y - h / 2, w, h, 5) : ctx.rect(q.x - w / 2, q.y - h / 2, w, h); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(tp.fdi, q.x, q.y + .5);
        });
        ctx.restore();
      }
      /* jaw cards with leader lines */
      const host = hostEl();
      if (host && host.classList.contains('model-stage')) host.classList.toggle('compact', !side);
      const cards = host ? Array.from(host.querySelectorAll('[data-lab]')) : [];
      if (cards.length) placeCards(ctx, cam, cards, M.anchors, yOff, W, H, side, clamp((g - .75) / .25, 0, 1));
      if (hero) {
        const stg = g < .42 ? 0 : g < .66 ? 1 : g < .92 ? 2 : 3;
        if (stg !== m.stage) { m.stage = stg; const box = canvas.closest('[data-seq]'); if (box) box.querySelectorAll('[data-st]').forEach(el => { const k = +el.dataset.st; el.classList.toggle('on', k <= stg); el.classList.toggle('now', k === stg); }); }
      }
      const ob = opts.overlay ? opts.overlay(ctx, cam, {anchor: k => { const a = M.anchors[k]; return a ? cam.proj([a.p[0], a.p[1] + yOff[a.jaw], a.p[2]]) : null; }, W, H, now}) : false;
      return g < 1 || Math.abs(m.gap - m.tg) > 1e-3 || Math.abs(m.vg) > 1e-3 || camBusy || !!ob;
    }
  };
  const view = Viewer(canvas, VO);
  function hasSide(W){ const h = hostEl(); return !!h && W >= 520 && h.querySelector('[data-lab]') != null; }
  function inPoly(x, y, poly){ let c = false; for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) { const a = poly[i], b = poly[k]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1e-9) + a.x) c = !c; } return c; }
  function pickAt(e){
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = m.pick.length - 1; i >= 0; i--) if (inPoly(x, y, m.pick[i].poly)) return m.pick[i];
    return null;
  }
  function markRows(ev){ const h = hostEl(); if (!h) return; h.querySelectorAll('[data-hl]').forEach(el => el.classList.toggle('is-hl', !!ev && el.dataset.hl.split(',').includes(ev))); }
  canvas.addEventListener('pointermove', e => {
    if (view.st.dragging || e.pointerType === 'touch') return;
    const p = pickAt(e), ev = p ? p.ev : null;
    if (ev === m.hoverEv) return;
    m.hoverEv = ev; canvas.style.cursor = ev ? 'pointer' : '';
    view.highlight(ev ? [ev] : null); markRows(ev);
  });
  canvas.addEventListener('pointerleave', () => { if (m.hoverEv) { m.hoverEv = null; canvas.style.cursor = ''; view.highlight(null); markRows(null); } });
  canvas.addEventListener('click', e => {
    if (view.st.moved > 4) return;
    const p = pickAt(e); if (!p) return;
    const h = hostEl(); const row = h && Array.from(h.querySelectorAll('[data-hl]')).find(el => el.dataset.hl.split(',').includes(p.ev) && el.dataset.act);
    if (row) row.click();
  });
  view.setFacts = d => { const s = JSON.stringify(d || {}); if (s !== view._last) { view._last = s; D = d || {}; M = buildModel(clone2(D)); } view.redraw(); };
  view._last = JSON.stringify(D);
  view.highlight = list => { m.hl = list && list.length ? new Set(list) : null; view.redraw(); };
  /* IKnow: Kamera setzen (Drehung federt über das Viewer-Ruhemaß, Zoom und Fokus über eigene Federn) */
  view.setCamera = c => { c = c || {}; if (c.yaw != null) VO.restYaw = c.yaw; if (c.pitch != null) VO.restPitch = c.pitch; if (c.zoom != null) m.tz = c.zoom; if (c.focus) m.tf = c.focus.slice(0, 3); view.redraw(); };
  view.gapTarget = v => { m.tg = v; view.redraw(); };
  view.anchor3d = k => { const a = M.anchors[k]; return a ? [a.p[0], a.p[1] + (a.jaw === 'OK' ? m.tg + .02 : -m.tg - .02), a.p[2]] : null; };
  view.gap = () => m.tg;
  return view;
}
function clone2(o){ return JSON.parse(JSON.stringify(o || {})); }
function placeCards(ctx, cam, cards, anchors, yOff, W, H, side, la){
  if (!side) { cards.forEach(el => { el.style.transform = ''; el.style.opacity = ''; }); return; }
  const list = cards.map(el => {
    const a = anchors[el.dataset.lab]; if (!a) return null;
    const p = cam.proj([a.p[0], a.p[1] + yOff[a.jaw], a.p[2]]);
    return {el, ax: p.x, ay: p.y, h: el.offsetHeight || 80, w: el.offsetWidth || 240};
  }).filter(Boolean);
  if (!list.length) return;
  const need = list.reduce((t, v) => t + v.h, 0) + 12 * (list.length - 1) + 16;
  if (need > H) { const st = list[0].el.closest('.model-stage'); if (st && parseFloat(st.style.minHeight || 0) < need) st.style.minHeight = Math.ceil(need) + 'px'; }
  const wMax = Math.max(...list.map(v => v.w));
  const xL = W - wMax - 6;
  list.sort((a, b) => a.ay - b.ay);
  list.forEach((v, i) => { v.y = v.ay - v.h / 2; if (i) v.y = Math.max(v.y, list[i - 1].y + list[i - 1].h + 12); });
  const over = list[list.length - 1].y + list[list.length - 1].h - (H - 8);
  if (over > 0) list.forEach(v => { v.y -= over; });
  for (let i = list.length - 2; i >= 0; i--) list[i].y = Math.min(list[i].y, list[i + 1].y - list[i].h - 12);
  list.forEach(v => { v.y = Math.max(8, v.y); });
  ctx.save(); ctx.globalAlpha = la; ctx.lineWidth = 1;
  list.forEach(v => {
    const yc = v.y + Math.min(26, v.h / 2);
    ctx.strokeStyle = 'rgba(20,24,28,.38)';
    ctx.beginPath(); ctx.moveTo(v.ax, v.ay); ctx.lineTo(xL - 28, yc); ctx.lineTo(xL - 6, yc); ctx.stroke();
    ctx.fillStyle = 'rgba(20,24,28,.12)'; ctx.beginPath(); ctx.arc(v.ax, v.ay, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(20,24,28,.9)'; ctx.beginPath(); ctx.arc(v.ax, v.ay, 3.6, 0, Math.PI * 2); ctx.fill();
    v.el.style.transform = 'translate(' + xL.toFixed(1) + 'px,' + v.y.toFixed(1) + 'px)';
    v.el.style.opacity = la;
  });
  ctx.restore();
}

return {mountHero, mountArch, mountModel, sweep};
})();

window.IKnowJaw = IKnowJawEngine;
