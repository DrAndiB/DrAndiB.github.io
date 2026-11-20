/* Exploded-view viewer shared by all machine pages. Each page imports this file and one machine definition. */
const ROOT = document.documentElement.dataset;   // optional page settings: data-three (self-hosted three.js), data-home (back link), data-plate (this page's id in SERIES)
/* The plates of the series, for the switcher shown when the page sets data-plate. Each plate lives in a sibling folder named by its id. */
const SERIES = [['turbofan', 'Turbofan', 'Jet'], ['beam-engine', 'Beam engine', 'Steam'], ['radial-engine', 'Radial engine', 'Radial']];
const CARRY = 'exploded-carry';   // sessionStorage key: the look carried from one plate to the next
const THREE_URL = ROOT.three ? new URL(ROOT.three, document.baseURI).href : 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const $ = s => document.querySelector(s);

document.body.insertAdjacentHTML('afterbegin', `
<div id="stage">
  <canvas id="gl" tabindex="0"></canvas>
  <svg id="leaders" aria-hidden="true"></svg>
  <div id="callouts"></div>
</div>
<header id="plate">
  <div class="eyebrow" id="eyebrow"></div>
  <nav id="plates" aria-label="Plates" hidden></nav>
  <h1 id="title"></h1>
  <p class="sub" id="sub"></p>
  <dl id="facts"></dl>
</header>
<p id="hint">Drag to orbit · Scroll to zoom · Click a part</p>
<aside id="panel" aria-label="Parts">
  <div id="panelHead">
    <h2>Parts index</h2>
    <div class="legend" id="legend"></div>
    <button id="sheetClose" class="chip plain" type="button">Close</button>
  </div>
  <div id="scroll">
    <section id="detail" hidden aria-live="polite">
      <div class="dTop"><div id="dNo">01</div><div><h3 id="dName"></h3><div class="tags" id="dTags"></div></div></div>
      <div id="dText"></div>
      <dl id="dSpecs"></dl>
      <div class="dBtns">
        <button id="bIso" class="chip" type="button" aria-pressed="false">Isolate</button>
        <button id="bDesel" class="chip plain" type="button">Back to full engine</button>
      </div>
    </section>
    <nav id="index" aria-label="Parts index"></nav>
    <p id="note"></p>
  </div>
</aside>
<footer id="dock">
  <div id="gauges" aria-label="Engine readouts"><div id="gaugeRow" style="display:contents"></div></div>
  <div class="bar">
    <div class="row">
      <button id="bExplode" class="primary" type="button">Explode</button>
      <label class="slider"><span class="cap">Explode</span><span class="ticks"><input id="rExplode" type="range" min="0" max="1000" value="0" aria-label="Explode amount"></span><output id="oExplode" for="rExplode">0%</output></label>
    </div>
    <div class="row opts">
      <button id="bRun" class="chip" type="button" aria-pressed="true"></button>
      <label class="thr"><span class="cap" id="capPower"></span><input id="rPower" type="range" min="0" max="100" value="35"></label>
      <button id="bFlow" class="chip" type="button" aria-pressed="true"></button>
      <button id="bCut" class="chip" type="button" aria-pressed="false">Cutaway</button>
      <button id="bCall" class="chip" type="button" aria-pressed="true">Callouts</button>
      <button id="bTurn" class="chip" type="button" aria-pressed="false">Turntable</button>
      <button id="bParts" class="chip plain only-m" type="button">Parts</button>
      <button id="bReset" class="chip plain" type="button">Reset view</button>
      <div class="seg" role="group" aria-label="Rendering style">
        <button id="mStudio" type="button" aria-pressed="true">Studio</button>
        <button id="mBlue" type="button" aria-pressed="false">Blueprint</button>
      </div>
    </div>
  </div>
</footer>
<div id="fail" hidden><p id="failMsg"></p></div>`);
function fail(msg) { $('#failMsg').textContent = msg; $('#fail').hidden = false; }

export let THREE;
try { THREE = await import(THREE_URL); }
catch (e) { fail('The 3D library could not be loaded. Check your connection and reload the page.'); throw e; }

/* ------------------------------------------------------------------ helpers */
export const TAU = Math.PI * 2, PI = Math.PI, DEG = PI / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const table = tb => x => {
  if (x <= tb[0][0]) return tb[0][1];
  for (let i = 1; i < tb.length; i++) if (x <= tb[i][0]) { const a = tb[i - 1], b = tb[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
  return tb[tb.length - 1][1];
};
export const polar = (x, th, r) => new THREE.Vector3(x, r * Math.cos(th), r * Math.sin(th));

/* Surface of revolution around the engine axis (X). Profile points are [x, r].
   Angle convention: y = r cos(a), z = r sin(a), so a = 0 is straight up. */
export function revolve(pts, o = {}) {
  const seg = o.seg ?? 96, a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, closed = o.closed ?? true, cc = Math.cos(o.crease ?? 0.6);
  const n = pts.length, m = closed ? n : n - 1, S = [];
  for (let i = 0; i < m; i++) {
    const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dr = q[1] - p[1], L = Math.hypot(dx, dr);
    S.push(L < 1e-7 || (p[1] < 1e-7 && q[1] < 1e-7) ? null : { p, q, nx: -dr / L, nr: dx / L, L });
  }
  const nb = (i, d) => { let j = i + d; if (closed) j = (j + m) % m; else if (j < 0 || j >= m) return null; return S[j]; };
  const full = Math.abs(a1 - a0 - TAU) < 1e-6, ns = Math.max(3, Math.round(seg * (a1 - a0) / TAU));
  const pos = [], nor = [], uv = [], idx = [];
  let total = 0, acc = 0; for (const s of S) if (s) total += s.L;
  for (let i = 0; i < m; i++) {
    const s = S[i]; if (!s) continue;
    const N = [[s.nx, s.nr], [s.nx, s.nr]], ends = [nb(i, -1), nb(i, 1)];
    for (let e = 0; e < 2; e++) { const t = ends[e]; if (t && t.nx * s.nx + t.nr * s.nr > cc) { const ax = t.nx + s.nx, ar = t.nr + s.nr, l = Math.hypot(ax, ar) || 1; N[e] = [ax / l, ar / l]; } }
    const base = pos.length / 3;
    for (let e = 0; e < 2; e++) {
      const P = e ? s.q : s.p, v = (acc + (e ? s.L : 0)) / total;
      for (let k = 0; k <= ns; k++) { const a = a0 + (a1 - a0) * k / ns, c = Math.cos(a), sn = Math.sin(a);
        pos.push(P[0], P[1] * c, P[1] * sn); nor.push(N[e][0], N[e][1] * c, N[e][1] * sn); uv.push((a - a0) / TAU, v); }
    }
    for (let k = 0; k < ns; k++) { const a = base + k, d = a + 1, b = base + ns + 1 + k, c = b + 1; idx.push(a, d, b, b, d, c); }
    acc += s.L;
  }
  if (closed && !full && (o.caps ?? true)) {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const [a, sg] of [[a0, -1], [a1, 1]]) {
      const c = Math.cos(a), sn = Math.sin(a), base = pos.length / 3;
      for (const p of pts) { pos.push(p[0], p[1] * c, p[1] * sn); nor.push(0, -sn * sg, c * sg); uv.push(0, 0); }
      for (const [i0, i1, i2] of tris) {
        const cz = (pts[i1][0] - pts[i0][0]) * (pts[i2][1] - pts[i0][1]) - (pts[i2][0] - pts[i0][0]) * (pts[i1][1] - pts[i0][1]);
        if (cz * sg > 0) idx.push(base + i0, base + i1, base + i2); else idx.push(base + i0, base + i2, base + i1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
export const rect = (x0, x1, r0, r1, o) => revolve([[x0, r0], [x1, r0], [x1, r1], [x0, r1]], o);
export function ringTube(x, r, tr, o = {}) {
  const p = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; p.push([x + tr * Math.cos(a), r + tr * Math.sin(a)]); }
  return revolve(p, { crease: 1.0, seg: 72, caps: false, ...o });
}

/* Lofted airfoil. Built standing on the top of the engine (radial = +Y, axial = X, tangential = Z). */
export function blade(o) {
  const nS = o.nS ?? 4, nP = o.nP ?? 6, N = 2 * nP - 2, pos = [], idx = [];
  for (let i = 0; i < nS; i++) {
    const f = i / (nS - 1), r = lerp(o.r0, o.r1, f), c = lerp(o.c0, o.c1 ?? o.c0, f);
    const b = o.stag ? o.stag(f) : lerp(o.s0 ?? 0, o.s1 ?? o.s0 ?? 0, f);
    const th = lerp(o.th0 ?? .1, o.th1 ?? o.th0 ?? .1, f), cam = lerp(o.cam0 ?? 0, o.cam1 ?? o.cam0 ?? 0, f);
    const sw = o.sweep ? o.sweep(f) : 0, cb = Math.cos(b), sb = Math.sin(b);
    for (let k = 0; k < N; k++) {
      const up = k < nP, kk = up ? k : N - k, xi = .5 * (1 - Math.cos(PI * kk / (nP - 1)));
      const u = (xi - .5) * c, yt = th * c * 1.3 * Math.sqrt(xi) * (1 - xi), v = cam * c * 4 * xi * (1 - xi) + (up ? yt : -yt);
      pos.push((o.x ?? 0) + sw + u * cb + v * sb, r, -u * sb + v * cb);
    }
  }
  for (let i = 0; i < nS - 1; i++) for (let k = 0; k < N; k++) { const a = i * N + k, b = i * N + (k + 1) % N, c = (i + 1) * N + (k + 1) % N, d = (i + 1) * N + k; idx.push(a, b, c, a, c, d); }
  for (const i of [0, nS - 1]) {
    const base = pos.length / 3; let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < N; k++) { const j = (i * N + k) * 3; pos.push(pos[j], pos[j + 1], pos[j + 2]); cx += pos[j]; cy += pos[j + 1]; cz += pos[j + 2]; }
    pos.push(cx / N, cy / N, cz / N);
    for (let k = 0; k < N; k++) i ? idx.push(base + k, base + (k + 1) % N, base + N) : idx.push(base + (k + 1) % N, base + k, base + N);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function merge(gs) {
  const pos = [], nor = [], uv = [], idx = [], hasUv = gs.every(g => g.attributes.uv); let off = 0;
  for (const g of gs) {
    const p = g.attributes.position, nn = g.attributes.normal, uu = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)); if (hasUv) uv.push(uu.getX(i), uu.getY(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (hasUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}
export const cylX = (rad, len, x0, y = 0, s = 20) => new THREE.CylinderGeometry(rad, rad, len, s).rotateZ(-PI / 2).translate(x0 + len / 2, y, 0);
export const cylY = (rad, y0, y1, x, s = 12) => new THREE.CylinderGeometry(rad, rad, y1 - y0, s).translate(x, (y0 + y1) / 2, 0);
export const boxAt = (sx, sy, sz, x, y, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
export const pipe = (cyl, rad) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cyl.map(([x, t, r]) => polar(x, t, r))), Math.max(16, cyl.length * 10), rad, 8, false);

export const mx = (d, a = .3, b = .85) => ({ ax: 'x', d, t: [a, b] }), my = (d, a = .3, b = .85) => ({ ax: 'y', d, t: [a, b] }), mz = (d, a = .3, b = .85) => ({ ax: 'z', d, t: [a, b] }), mv = (ax, d, a = .3, b = .85) => ({ ax, d, t: [a, b] });

/* ------------------------------------------------------------------ viewer
   start(machine) builds the scene from a machine definition:
   { docTitle, eyebrow, title, sub, facts:[{k,v,tip}], note, kinds:{a,b,s:{short,label}}, groups:[..],
     parts:[{id,name,group,kind,ext,label:{at,dir,len},text,specs,view}], controls:{run,power,flow,powerDefault},
     gauges:[{label,color,arc}], gaugeNote, camera:{az,el,paz,pel,focus}, materials(std,phy), glow:{},
     build(ctx) -> { step(dt,s), readouts(), heat(), active() } } */
export function start(machine) {
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('#eyebrow').textContent = machine.eyebrow;
const plateIx = SERIES.findIndex(p => p[0] === ROOT.plate);
if (plateIx >= 0) {
  $('#eyebrow').textContent = 'Exploded views';
  const nav = $('#plates'); nav.hidden = false;
  nav.innerHTML = SERIES.map(([id, name, short], i) => `<a href="../${id}/"${i === plateIx ? ' aria-current="page"' : ''}><b>${String(i + 1).padStart(2, '0')}</b><span class="full">${name}</span><span class="short">${short}</span></a>`).join('');
  nav.addEventListener('click', e => { if (e.target.closest('a')) try { sessionStorage.setItem(CARRY, JSON.stringify({ mode: st.mode })); } catch (_) {} });
}
if (ROOT.home) { const h = document.createElement('a'); h.href = ROOT.home; h.textContent = '← Demos'; $('#eyebrow').prepend(h); } $('#title').textContent = machine.title; $('#title').classList.toggle('long', machine.title.length > 9); $('#sub').textContent = machine.sub;
$('#facts').innerHTML = machine.facts.map(f => `<div${f.tip ? ` title="${esc(f.tip)}"` : ''}><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('');
$('#note').textContent = machine.note;
const KCLS = { a: 'n1', b: 'n2', s: '' }, kinds = machine.kinds;
$('#legend').innerHTML = ['a', 'b', 's'].map(k => `<span><span class="dot ${KCLS[k]}"></span>${esc(kinds[k].short)}</span>`).join('');
$('#gaugeRow').innerHTML = machine.gauges.map((g, i) => `<div class="g" style="--c:${g.color || 'var(--ink)'}">` +
  (g.arc ? `<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="tr" cx="32" cy="32" r="26" stroke-dasharray="122.5 200" transform="rotate(135 32 32)"/><circle class="va" id="ga${i}" cx="32" cy="32" r="26" stroke-dasharray="0 200" transform="rotate(135 32 32)"/></svg>` : '') +
  `<div class="gv"><b id="gt${i}">0</b><span>${esc(g.label)}</span><i id="gs${i}"></i></div></div>`).join('') + `<p class="slow">${esc(machine.gaugeNote || '')}</p>`;
const C = machine.controls;
$('#bRun').textContent = C.run; $('#capPower').textContent = C.power; $('#rPower').setAttribute('aria-label', C.power); $('#bFlow').textContent = C.flow;
$('#gl').setAttribute('aria-label', `Interactive 3D exploded view: ${machine.title}. Drag to orbit, scroll to zoom, select a part for details.`);

/* renderer + scene */
const canvas = $('#gl'), stage = $('#stage');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { fail('This browser could not start WebGL, which the 3D view needs.'); throw e; }
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, .2, 300);
const engine = new THREE.Group(); scene.add(engine);
{ // studio environment for reflections
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(44, 22, 44), new THREE.MeshBasicMaterial({ color: 0x0c0e13, side: THREE.BackSide })));
  const panel = (w, h, p, r, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(c[0], c[1], c[2]), side: THREE.DoubleSide })); m.position.set(...p); m.rotation.set(...r); s.add(m); };
  panel(18, 9, [0, 10.4, 0], [PI / 2, 0, 0], [8, 8, 8.6]);
  panel(5, 13, [-13, 2, 8], [0, PI / 2.7, 0], [7.5, 6.6, 5.6]);
  panel(4, 13, [15, 1, -7], [0, -PI / 2.5, 0], [2.6, 3.8, 5.6]);
  panel(24, 1.4, [0, -3.5, 14], [0, 0, 0], [1.5, 1.5, 1.8]);
  panel(8, 3, [-4, 5, -16], [0, 0, 0], [2.2, 2.4, 2.8]);
  panel(34, 34, [0, -10.4, 0], [-PI / 2, 0, 0], [.22, .22, .26]);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(s, 0.035).texture;
  pm.dispose();
}
const key = new THREE.DirectionalLight(0xfff0de, 2.4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
const rim = new THREE.DirectionalLight(0x9cc2ff, 1.3); rim.position.set(7, 3, -8);
scene.add(key, key.target, rim, new THREE.HemisphereLight(0xbcd2ff, 0x18120e, .3));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: .34 }));
floor.rotation.x = -PI / 2; floor.receiveShadow = true; scene.add(floor);

/* materials */
const std = (color, metalness, roughness, x = {}) => () => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...x });
const phy = (color, metalness, roughness, x = {}) => () => new THREE.MeshPhysicalMaterial({ color, metalness, roughness, ...x });
const MATS = {
  paint: phy(0xa3aab3, 0, .5, { clearcoat: .6, clearcoatRoughness: .22 }),
  lip: std(0xe3e7eb, 1, .13),
  carbon: phy(0x1d2025, .25, .5, { clearcoat: .35, clearcoatRoughness: .4 }),
  titanium: std(0xa4a9b0, 1, .38),
  tiDark: std(0x7a8089, 1, .46),
  steel: std(0x8b9199, 1, .4),
  alu: std(0xb8bdc3, 1, .45),
  castAl: std(0x8d9896, .85, .62),
  castDark: std(0x565d62, .8, .6),
  nickel: std(0x8f7f6a, 1, .4),
  nickelDark: std(0x6f6258, 1, .5),
  copper: std(0xc17a46, 1, .3),
  gold: std(0xc8a24c, 1, .34),
  blueAnod: std(0x2d5f9f, .9, .38),
  black: std(0x15171a, .6, .5),
  ...(machine.materials ? machine.materials(std, phy) : {}),
};
const GLOW = machine.glow || {};

/* pieces */
const parts = machine.parts.map((d, i) => ({ ...d, num: i + 1, pieces: [], hi: 0 }));
const byId = Object.fromEntries(parts.map(p => [p.id, p]));
const pieces = [], pickables = [];
function piece(id, o = {}) {
  const part = byId[id], g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); engine.add(g);
  const defs = o.clip ? o.clip.map(c => ({ n: new THREE.Vector3(c[0], c[1], c[2]), p: new THREE.Vector3(c[3], c[4], c[5]) })) : null;
  const pc = { part, g, inner, moves: o.moves || [], shell: !!o.shell, meshes: [], mats: {}, clipMats: [], chan: {}, onChan: null, hideInBlue: [], blue: null, defs,
    planes: defs ? defs.map(d => new THREE.Plane(d.n.clone(), -d.n.dot(d.p))) : null, box: new THREE.Box3() };
  part.pieces.push(pc); pieces.push(pc); return pc;
}
function M(pc, k) {
  if (!pc.mats[k]) {
    const m = MATS[k](); m.side = THREE.DoubleSide; m.userData.glow = GLOW[k] || 0; m.userData.baseE = m.emissive.clone();
    if (pc.planes) { m.clipIntersection = true; m.clipShadows = true; pc.clipMats.push(m); }
    pc.mats[k] = m;
  }
  return pc.mats[k];
}
function reg(pc, mesh) { mesh.castShadow = mesh.receiveShadow = true; mesh.userData.pc = pc; mesh.userData.real = mesh.material; pc.inner.add(mesh); pc.meshes.push(mesh); pickables.push(mesh); return mesh; }
const add = (pc, geom, k) => reg(pc, new THREE.Mesh(geom, M(pc, k)));

/* state */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width:760px)').matches;
const st = { E: 0, mode: 'studio', cut: false, flow: true, call: !isMobile(), turn: false, iso: false, sel: null, hov: null, run: !reduced, power: C.powerDefault ?? .35 };
const view = { scale: 1000 };
const ctx = { scene, engine, parts, byId, pieces, piece, M, reg, add, st, view, reduced, isMobile };
const rt = machine.build(ctx) || {};

engine.updateMatrixWorld(true);
for (const pc of pieces) pc.box.setFromObject(pc.g);
for (const p of parts) { p.anchor = new THREE.Vector3(...p.label.at); p.dir = new THREE.Vector3(...p.label.dir).normalize(); }

let anim = null, dirty = true, activeUntil = 0, flowVis = 0, W = 1, H = 1, inset = { r: 0, b: 0, t: 0 }, size = 6;
const poke = (ms = 1200) => { dirty = true; activeUntil = Math.max(activeUntil, performance.now() + ms); };
const tb = new THREE.Box3(), box = new THREE.Box3();
function currentBox(out, part) {
  out.makeEmpty();
  for (const pc of (part ? part.pieces : pieces)) { if (!pc.g.visible) continue; tb.copy(pc.box).translate(pc.g.position); out.union(tb); }
  return out;
}
function applyExplode() {
  const E = st.E; let minY = Infinity;
  for (const pc of pieces) {
    let x = 0, y = 0, z = 0, ch = null;
    for (const m of pc.moves) { const d = m.d * smooth((E - m.t[0]) / (m.t[1] - m.t[0])); if (m.ax === 'x') x += d; else if (m.ax === 'y') y += d; else if (m.ax === 'z') z += d; else { ch = ch || {}; ch[m.ax] = (ch[m.ax] || 0) + d; } }
    pc.g.position.set(x, y, z); minY = Math.min(minY, pc.box.min.y + y);
    if (pc.planes) pc.defs.forEach((d, i) => { pc.planes[i].constant = -(d.n.x * (d.p.x + x) + d.n.y * (d.p.y + y) + d.n.z * (d.p.z + z)); });
    if (ch && pc.onChan) pc.onChan(ch);
  }
  floor.position.y = minY - .4;
}
{ // fit light, shadow and clip range to the fully exploded layout
  st.E = 1; applyExplode(); currentBox(box, null); st.E = 0; applyExplode();
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2; size = r;
  key.target.position.copy(c); key.position.copy(c).add(new THREE.Vector3(-.38, 1, .62).multiplyScalar(r * 1.9));
  Object.assign(key.shadow.camera, { left: -r * 1.05, right: r * 1.05, top: r * 1.05, bottom: -r * 1.05, near: r * .2, far: r * 5 });
  key.shadow.camera.updateProjectionMatrix();
  camera.near = Math.max(.05, r / 60); camera.far = r * 40;
}
function setE(v) {
  st.E = clamp(v, 0, 1); applyExplode();
  $('#rExplode').value = Math.round(st.E * 1000); $('#oExplode').textContent = Math.round(st.E * 100) + '%';
  $('#bExplode').textContent = (anim ? anim.to : st.E) > .5 ? 'Assemble' : 'Explode';
  poke();
}
function runTo(to) { anim = { from: st.E, to, t: 0, dur: reduced ? .01 : Math.max(.8, Math.abs(to - st.E) * 5.2) }; poke(); }

/* blueprint look */
const BP = { ink: new THREE.Color(0xeaf5ff), fill: new THREE.Color(0x0f3f80), hot: new THREE.Color(0xffd84a) };
const bpVert = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 p = position; vec3 n = normal;
  #ifdef USE_INSTANCING
    p = (instanceMatrix * vec4(p, 1.0)).xyz; n = mat3(instanceMatrix) * n;
  #endif
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * n); vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const bpFrag = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uInk; uniform vec3 uFill; uniform vec3 uHot; uniform float uHi; uniform float uShell;
varying vec3 vN; varying vec3 vV;
void main(){
  #include <clipping_planes_fragment>
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float rimv = pow(1.0 - ndv, 2.4);
  vec3 ink = mix(uInk, uHot, uHi);
  if (uShell > 0.5) {
    gl_FragColor = vec4(ink, clamp(0.03 + rimv * 0.8 + uHi * 0.1, 0.0, 1.0));
  } else {
    vec3 fill = mix(uFill, uHot, uHi * 0.3);
    gl_FragColor = vec4(mix(fill * (0.8 + 0.35 * ndv), ink, clamp(rimv * 1.25, 0.0, 1.0)), 1.0);
  }
  #include <colorspace_fragment>
}`;
let blueReady = false;
function ensureBlue() {
  if (blueReady) return; blueReady = true;
  for (const pc of pieces) {
    pc.blue = new THREE.ShaderMaterial({ vertexShader: bpVert, fragmentShader: bpFrag, side: THREE.DoubleSide, clipping: true, clipIntersection: true, transparent: pc.shell, depthWrite: !pc.shell,
      uniforms: { uInk: { value: BP.ink }, uFill: { value: BP.fill }, uHot: { value: BP.hot }, uHi: { value: 0 }, uShell: { value: pc.shell ? 1 : 0 } } });
    pc.edge = new THREE.LineBasicMaterial({ color: 0xeaf5ff, transparent: true, opacity: pc.shell ? .5 : .8, clipIntersection: true });
    if (pc.planes) { pc.clipMats.push(pc.blue, pc.edge); if (st.cut) pc.blue.clippingPlanes = pc.edge.clippingPlanes = pc.planes; }
    for (const m of pc.meshes) {
      if (m.userData.inst || m.userData.noEdge || m.geometry.type === 'TubeGeometry' || m.geometry.type === 'TorusGeometry' || m.geometry.type === 'SphereGeometry') continue;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 32), pc.edge); e.visible = false; e.raycast = () => {}; m.add(e); m.userData.edges = e;
    }
  }
}

/* camera */
const CAM = machine.camera || {};
const cam = { az: -.62, el: .3, zoom: 1, pan: new THREE.Vector3(), cAz: -.62, cEl: .3, cDist: 12, cT: new THREE.Vector3(), init: false, saved: null, slow: 0 };
function defaultView() { const p = H > W * 1.05; cam.az = p ? (CAM.paz ?? -1.16) : (CAM.az ?? -.62); cam.el = p ? (CAM.pel ?? .42) : (CAM.el ?? .3); cam.zoom = 1; cam.pan.set(0, 0, 0); }
const vc = new THREE.Vector3(), vd = new THREE.Vector3(), vr = new THREE.Vector3(), vu = new THREE.Vector3(), vp = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
function fitDist(b, az, el, part) {
  b.getCenter(vc); vd.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const fw = vd.clone().negate(); vr.crossVectors(fw, Y).normalize(); vu.crossVectors(vr, fw);
  const fwPx = Math.max(120, W - inset.r), fhPx = Math.max(120, H - inset.b - inset.t), tv = Math.tan(camera.fov * DEG / 2);
  const tanV = tv * fhPx / H, tanH = tv * fwPx / H; let d = 0;
  for (const pc of (part ? part.pieces : pieces)) {
    if (!pc.g.visible) continue; const q = pc.box, o = pc.g.position;
    for (let i = 0; i < 8; i++) {
      vp.set(i & 1 ? q.max.x : q.min.x, i & 2 ? q.max.y : q.min.y, i & 4 ? q.max.z : q.min.z).add(o).sub(vc);
      const pz = vp.dot(fw); d = Math.max(d, Math.abs(vp.dot(vr)) / tanH - pz, Math.abs(vp.dot(vu)) / tanV - pz);
    }
  }
  return d;
}
const nearAz = (a, ref) => a + TAU * Math.round((ref - a) / TAU);
function focusView(p) {
  if (!p) { if (cam.saved) { cam.az = nearAz(cam.saved.az, cam.cAz); cam.el = cam.saved.el; cam.saved = null; cam.slow = performance.now() + 1400; } return; }
  if (st.E < .5) return;
  if (!cam.saved) cam.saved = { az: cam.az, el: cam.el };
  const t = p.view || CAM.focus || [-.24, .2];
  cam.az = nearAz(t[0], cam.cAz); cam.el = t[1]; cam.slow = performance.now() + 1400;
}
function stepCamera(dt) {
  if (st.turn && !drag.on) { cam.az += dt * .16; dirty = true; }
  currentBox(box, st.sel);
  let d = fitDist(box, cam.cAz, cam.cEl, st.sel) * (st.sel ? 1.75 : 1.05); if (st.sel) d = Math.max(d, size * .36);
  box.getCenter(vc).add(cam.pan); d *= cam.zoom;
  const k = cam.init ? 1 - Math.exp(-dt * 5.5) : 1, k2 = cam.init ? 1 - Math.exp(-dt * (performance.now() < cam.slow ? 4.5 : 14)) : 1; cam.init = true;
  const moved = Math.abs(d - cam.cDist) > .002 || cam.cT.distanceToSquared(vc) > 1e-6 || Math.abs(cam.az - cam.cAz) > 1e-4 || Math.abs(cam.el - cam.cEl) > 1e-4;
  cam.cT.lerp(vc, k); cam.cDist += (d - cam.cDist) * k; cam.cAz += (cam.az - cam.cAz) * k2; cam.cEl += (cam.el - cam.cEl) * k2;
  camera.position.set(Math.cos(cam.cEl) * Math.sin(cam.cAz), Math.sin(cam.cEl), Math.cos(cam.cEl) * Math.cos(cam.cAz)).multiplyScalar(cam.cDist).add(cam.cT);
  camera.lookAt(cam.cT); camera.updateMatrixWorld();
  return moved;
}
function measure() {
  W = stage.clientWidth || 1; H = stage.clientHeight || 1;
  const bar = $('.bar').getBoundingClientRect(), pn = $('#panel').getBoundingClientRect();
  if (isMobile()) { inset = { r: 0, t: $('#plate').getBoundingClientRect().bottom, b: H - bar.top + 46 }; if (document.documentElement.dataset.sheet === 'open') inset.b = Math.max(inset.b, Math.min(H * .56, pn.height)); }
  else inset = { r: W - pn.left + 8, t: 56, b: H - bar.top + 24 };
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.setViewOffset(W, H, inset.r / 2, (inset.b - inset.t) / 2, W, H); camera.updateProjectionMatrix();
  view.scale = H * pixelRatio / (2 * Math.tan(camera.fov * DEG / 2));
  poke();
}

/* interaction */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(px, py) {
  const r = canvas.getBoundingClientRect(); ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(pickables, false)) {
    const pc = h.object.userData.pc; if (!pc.g.visible) continue;
    if (st.cut && pc.planes && pc.planes.every(pl => pl.distanceToPoint(h.point) < 0)) continue;
    return pc.part;
  }
  return null;
}
const drag = { on: false, id: null, t: 0, moved: 0, pan: false }, touches = new Map(); let pinch = 0, hoverXY = null;
function panBy(dx, dy) {
  const s = cam.cDist * 2 * Math.tan(camera.fov * DEG / 2) / H;
  vd.set(Math.cos(cam.cEl) * Math.sin(cam.cAz), Math.sin(cam.cEl), Math.cos(cam.cEl) * Math.cos(cam.cAz)).negate();
  vr.crossVectors(vd, Y).normalize(); vu.crossVectors(vr, vd);
  cam.pan.addScaledVector(vr, -dx * s).addScaledVector(vu, dy * s);
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); $('#hint').classList.add('gone');
  if (touches.size === 1) Object.assign(drag, { on: true, id: e.pointerId, t: performance.now(), moved: 0, pan: e.button === 2 || e.shiftKey });
  else { drag.moved = 99; pinch = 0; }
  canvas.classList.add('drag'); poke();
});
canvas.addEventListener('pointermove', e => {
  if (!touches.has(e.pointerId)) { if (e.pointerType === 'mouse') { hoverXY = [e.clientX, e.clientY]; poke(300); } return; }
  const p = touches.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (touches.size === 1) {
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.pan) panBy(dx, dy); else { cam.saved = null; cam.slow = 0; cam.az -= dx * .0055; cam.el = clamp(cam.el + dy * .0055, -1.25, 1.4); }
  } else if (touches.size === 2) {
    const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) cam.zoom = clamp(cam.zoom * pinch / d, .12, 3);
    pinch = d; panBy(dx / 2, dy / 2);
  }
  poke();
});
const endPtr = e => {
  if (!touches.has(e.pointerId)) return; touches.delete(e.pointerId); pinch = 0;
  if (e.type === 'pointerup' && drag.id === e.pointerId && drag.moved < 7 && performance.now() - drag.t < 600) select(pick(e.clientX, e.clientY));
  if (!touches.size) { drag.on = false; canvas.classList.remove('drag'); }
  poke();
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', () => { hoverXY = null; setHover(null); });
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * .0013), .12, 3); $('#hint').classList.add('gone'); poke(); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('keydown', e => {
  const k = e.key; let used = true;
  if (k === 'ArrowLeft') cam.az -= .12; else if (k === 'ArrowRight') cam.az += .12; else if (k === 'ArrowUp') cam.el = clamp(cam.el + .1, -1.25, 1.4); else if (k === 'ArrowDown') cam.el = clamp(cam.el - .1, -1.25, 1.4);
  else if (k === '+' || k === '=') cam.zoom = clamp(cam.zoom * .88, .12, 3); else if (k === '-') cam.zoom = clamp(cam.zoom / .88, .12, 3);
  else if (k === ' ') runTo(st.E > .5 ? 0 : 1); else if (k === 'Escape') select(null); else used = false;
  if (used) { e.preventDefault(); poke(); }
});

function setHover(p) {
  if (st.hov === p) return; st.hov = p; canvas.classList.toggle('hit', !!p);
  for (const q of parts) { q.ui.btn.classList.toggle('hov', q === p); q.ui.co.classList.toggle('hov', q === p); }
  poke(500);
}
function select(p) {
  if (!p && !st.sel) return;
  st.sel = p || null;
  if (!st.sel && st.iso) setIso(false);
  for (const q of parts) { const on = q === st.sel; q.ui.btn.classList.toggle('sel', on); q.ui.co.classList.toggle('sel', on); q.ui.line.classList.toggle('sel', on); q.ui.dot.classList.toggle('sel', on); q.ui.btn.setAttribute('aria-current', on ? 'true' : 'false'); }
  const d = $('#detail'); document.documentElement.toggleAttribute('data-sel', !!st.sel);
  if (st.sel) {
    const q = st.sel; d.hidden = false;
    $('#dNo').textContent = String(q.num).padStart(2, '0'); $('#dName').textContent = q.name;
    $('#dTags').innerHTML = `<span class="tag">${esc(q.group)}</span><span class="tag"><span class="dot ${KCLS[q.kind]}"></span>${esc(kinds[q.kind].label)}</span>`;
    $('#dText').innerHTML = q.text.map(t => `<p>${t}</p>`).join('');
    $('#dSpecs').innerHTML = q.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#scroll').scrollTop = 0;
    if (st.iso) setIso(true);
    if (isMobile()) sheet(true);
  } else { d.hidden = true; if (isMobile()) sheet(false); }
  cam.pan.set(0, 0, 0); if (!st.sel) cam.zoom = Math.max(cam.zoom, .5);
  focusView(st.sel);
  poke(1500);
}
function setIso(on) {
  st.iso = on && !!st.sel; $('#bIso').setAttribute('aria-pressed', st.iso);
  for (const pc of pieces) pc.g.visible = !st.iso || pc.part === st.sel;
  poke();
}
function sheet(open) { document.documentElement.dataset.sheet = open ? 'open' : 'closed'; setTimeout(measure, 300); measure(); }
function setCut(on) {
  st.cut = on; $('#bCut').setAttribute('aria-pressed', on);
  for (const pc of pieces) if (pc.planes) for (const m of pc.clipMats) m.clippingPlanes = on ? pc.planes : null;
  poke();
}
function setMode(m) {
  st.mode = m; const blue = m === 'blueprint'; document.documentElement.dataset.mode = m;
  $('#mStudio').setAttribute('aria-pressed', !blue); $('#mBlue').setAttribute('aria-pressed', blue);
  if (blue) ensureBlue();
  for (const pc of pieces) { for (const me of pc.meshes) { me.material = blue ? pc.blue : me.userData.real; if (me.userData.edges) me.userData.edges.visible = blue; } for (const h of pc.hideInBlue) h.visible = !blue; }
  floor.visible = !blue && shadowsOn; key.castShadow = !blue && shadowsOn;
  poke();
}
const toggle = (id, k) => $(id).addEventListener('click', () => { st[k] = !st[k]; $(id).setAttribute('aria-pressed', st[k]); poke(); });

/* index, callouts */
{ const nav = $('#index'), cos = $('#callouts'), svg = $('#leaders'), NS = 'http://www.w3.org/2000/svg';
  for (const gname of machine.groups) {
    const h = document.createElement('h3'); h.textContent = gname; const ol = document.createElement('ol'); nav.append(h, ol);
    for (const p of parts.filter(q => q.group === gname)) {
      const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `<span class="no">${String(p.num).padStart(2, '0')}</span><span class="nm">${esc(p.name)}</span><span class="dot ${KCLS[p.kind]}" title="${esc(kinds[p.kind].label)}"></span>`;
      b.addEventListener('click', () => select(p === st.sel ? null : p)); b.addEventListener('pointerenter', () => setHover(p)); b.addEventListener('pointerleave', () => setHover(null));
      li.append(b); ol.append(li);
      const co = document.createElement('button'); co.type = 'button'; co.className = 'co'; co.tabIndex = -1; co.innerHTML = `<b>${p.num}</b><i>${esc(p.name)}</i>`;
      co.addEventListener('click', () => select(p)); co.addEventListener('pointerenter', () => setHover(p)); co.addEventListener('pointerleave', () => setHover(null)); cos.append(co);
      const line = document.createElementNS(NS, 'line'), dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', 2.2); svg.append(line, dot);
      p.ui = { btn: b, co, line, dot };
    }
  }
}
const va = new THREE.Vector3(), vl = new THREE.Vector3();
function updateCallouts() {
  const k = smooth(st.E / .6), open = st.E > .12 || st.cut || st.mode === 'blueprint';
  for (const p of parts) {
    const u = p.ui, pc = p.pieces[0], show = st.call && pc.g.visible && (p.ext || open);
    if (show) {
      va.copy(p.anchor).add(pc.g.position); vl.copy(va).addScaledVector(p.dir, lerp(p.label.len[0], p.label.len[1], k));
      va.project(camera); vl.project(camera);
      if (va.z < 1 && vl.z < 1) {
        const ax = (va.x * .5 + .5) * W, ay = (-va.y * .5 + .5) * H, lx = (vl.x * .5 + .5) * W, ly = (-vl.y * .5 + .5) * H;
        u.co.style.display = ''; u.co.style.transform = `translate(${lx - 11}px,${ly - 11}px)`;
        const dx = ax - lx, dy = ay - ly, L = Math.hypot(dx, dy) || 1, o = Math.min(11, L);
        u.line.setAttribute('x1', lx + dx / L * o); u.line.setAttribute('y1', ly + dy / L * o); u.line.setAttribute('x2', ax); u.line.setAttribute('y2', ay);
        u.dot.setAttribute('cx', ax); u.dot.setAttribute('cy', ay); u.line.style.display = u.dot.style.display = ''; continue;
      }
    }
    u.co.style.display = u.line.style.display = u.dot.style.display = 'none';
  }
}

/* controls */
$('#bExplode').addEventListener('click', () => runTo((anim ? anim.to : st.E) > .5 ? 0 : 1));
$('#rExplode').addEventListener('input', e => { anim = null; setE(e.target.value / 1000); });
$('#rPower').value = Math.round(st.power * 100);
$('#rPower').addEventListener('input', e => { st.power = e.target.value / 100; poke(); });
toggle('#bRun', 'run'); toggle('#bFlow', 'flow'); toggle('#bCall', 'call'); toggle('#bTurn', 'turn');
$('#bCut').addEventListener('click', () => setCut(!st.cut));
$('#mStudio').addEventListener('click', () => setMode('studio')); $('#mBlue').addEventListener('click', () => setMode('blueprint'));
$('#bReset').addEventListener('click', () => { select(null); cam.saved = null; defaultView(); poke(); });
$('#bIso').addEventListener('click', () => setIso(!st.iso));
$('#bDesel').addEventListener('click', () => select(null));
$('#bParts').addEventListener('click', () => sheet(document.documentElement.dataset.sheet !== 'open'));
$('#sheetClose').addEventListener('click', () => { if (st.sel) select(null); else sheet(false); });
const syncChips = () => { for (const [id, k] of [['#bRun', 'run'], ['#bFlow', 'flow'], ['#bCall', 'call'], ['#bTurn', 'turn']]) $(id).setAttribute('aria-pressed', st[k]); };
syncChips();

/* frame loop */
let gaugeT = 0;
function updateGauges() {
  const r = rt.readouts ? rt.readouts() : [];
  r.forEach((g, i) => { $('#gt' + i).textContent = g.v; if (g.sub !== undefined) $('#gs' + i).textContent = g.sub; const a = $('#ga' + i); if (a) a.setAttribute('stroke-dasharray', `${(122.5 * clamp(g.f || 0, 0, 1.02)).toFixed(1)} 200`); });
}
const accent = new THREE.Color(0xffa51f);
function updateMaterials(dt) {
  const heat = rt.heat ? rt.heat() : 0, h2 = heat * heat; let busy = false;
  for (const p of parts) {
    const t = p === st.sel ? .8 : p === st.hov ? .38 : 0; if (Math.abs(t - p.hi) > .003) { p.hi += (t - p.hi) * (1 - Math.exp(-dt * 10)); busy = true; } else p.hi = t;
    for (const pc of p.pieces) {
      for (const k in pc.mats) { const m = pc.mats[k], g = m.userData.glow; m.emissive.copy(m.userData.baseE).lerp(accent, p.hi); m.emissiveIntensity = lerp(g ? g * h2 : 0, .3, p.hi); }
      if (pc.blue) pc.blue.uniforms.uHi.value = p.hi;
    }
  }
  return busy;
}
let shadowsOn = true, adapt = true, frames = 0, slowAcc = 0, last = performance.now();
function quality(ms) {
  frames++; if (!adapt || frames < 20 || frames > 400) return; slowAcc = slowAcc * .9 + ms * .1; if (frames < 60 || slowAcc < 42) return;
  if (pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); measure(); frames = 20; slowAcc = 0; }
  else if (shadowsOn) { shadowsOn = false; key.castShadow = false; floor.visible = false; frames = 401; }
}
const info = { E: 0, run: true, power: 0, flowVis: 0, mode: 'studio', cut: false };
function tick(now) {
  requestAnimationFrame(tick);
  const ms = now - last, dt = Math.min(.05, ms / 1000); last = now;
  if (anim) { anim.t += dt; const k = Math.min(1, anim.t / anim.dur), a = anim; if (k >= 1) anim = null; setE(lerp(a.from, a.to, ease(k))); }
  const fT = st.flow && st.E < .02 ? 1 : 0; flowVis += (fT - flowVis) * (1 - Math.exp(-dt * 4));
  info.E = st.E; info.run = st.run; info.power = st.power; info.flowVis = flowVis; info.mode = st.mode; info.cut = st.cut;
  if (rt.step) rt.step(dt, info);
  const camMoved = stepCamera(dt);
  if (hoverXY && !drag.on) { setHover(pick(hoverXY[0], hoverXY[1])); hoverXY = null; }
  const hiBusy = updateMaterials(dt);
  if (!(dirty || anim || camMoved || hiBusy || (rt.active && rt.active()) || flowVis > .01 || now < activeUntil)) return;
  dirty = false;
  renderer.render(scene, camera);
  updateCallouts();
  if (now - gaugeT > 90) { gaugeT = now; updateGauges(); }
  quality(ms);
}

/* start */
function boot(saved) {
  measure(); defaultView();
  const has = saved && typeof saved.E === 'number';
  if (has) {
    for (const k of ['run', 'flow', 'call', 'power']) if (saved[k] !== undefined) st[k] = saved[k];
    $('#rPower').value = Math.round(st.power * 100); syncChips();
    if (saved.mode === 'blueprint') setMode('blueprint'); if (saved.cut) setCut(true);
    setE(saved.E); if (saved.sel && byId[saved.sel]) select(byId[saved.sel]);
    $('#hint').classList.add('gone');
  } else if (reduced) setE(1); else { setE(0); setTimeout(() => { if (!anim && st.E === 0) runTo(1); }, 900); }
  cam.cAz = cam.az; cam.cEl = cam.el;
  new ResizeObserver(measure).observe(stage);
  setTimeout(() => $('#hint').classList.add('gone'), 9000);
  let carry = null; try { carry = JSON.parse(sessionStorage.getItem(CARRY)); sessionStorage.removeItem(CARRY); } catch (_) {}
  if (carry?.mode === 'blueprint' && st.mode !== 'blueprint') setMode('blueprint');
  requestAnimationFrame(tick);
}
window.__viewer = { st, cam, setMode, setCut, setIso, runTo, select: id => select(byId[id] || null),
  set: v => { anim = null; setE(v); }, snap: () => { cam.init = false; poke(); }, adapt: v => { adapt = v; } };
const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ E: anim ? anim.to : st.E, mode: st.mode, cut: st.cut, flow: st.flow, call: st.call, run: st.run, power: st.power, sel: st.sel?.id || null }));
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? {});
}
