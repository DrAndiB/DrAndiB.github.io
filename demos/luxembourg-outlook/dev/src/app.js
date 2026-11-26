import { P, REF, values, run, makeDraws, fan, simulate, baselineInputs, YEARS, BASE, T } from './model.js';
import { SCENARIOS, FAMILIES, compose } from './scenarios.js';
import { NODES, LUX, LEVELS, streams, inside } from './flows.js';
import { setupCopy } from './copy-edit.js';

const LANG = document.documentElement.lang || 'en';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; };
const nf = d => new Intl.NumberFormat(LANG, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (x, d = 0) => nf(d).format(x);
const signed = (x, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), d);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- state ---------- */
const state = { year: 2025, flow: 'people', level: 'gr', horizon: 2046, active: new Map(), playing: false, metric: {} };
const V = values();
const draws = makeDraws(200);
const FAN_KEYS = ['gniPerHead', 'gdp', 'gniShare', 'comShare', 'pop', 'debtPct', 'balancePct', 'reserveYears', 'housing', 'shortfall', 'commuters', 'resJobs', 'wIdx', 'unempRate'];
const base = { det: run(V), fan: null };
base.fan = fan(draws, null, FAN_KEYS);
let scen = { det: base.det, fan: base.fan, on: false };
const CARDS = [
  { id: 'income', flow: 'money', metrics: [{ k: 'gniPerHead', unit: 'u.kEur', d: 1 }, { k: 'gdp', unit: 'u.bn', d: 1 }, { k: 'gniShare', unit: 'u.pct', d: 1, mul: 100 }, { k: 'wIdx', unit: 'u.index', d: 1, mul: 100 }] },
  { id: 'jobs', flow: 'people', metrics: [{ k: 'jobsSplit', two: ['commuters', 'resJobs'], unit: 'u.k', d: 0 }, { k: 'comShare', unit: 'u.pctJobs', d: 1, mul: 100 }, { k: 'pop', unit: 'u.k', d: 0 }, { k: 'unempRate', unit: 'u.pctLf', d: 1, mul: 100 }] },
  { id: 'public', flow: 'public', metrics: [{ k: 'debtPct', unit: 'u.pct', d: 1 }, { k: 'balancePct', unit: 'u.pct', d: 1 }, { k: 'reserveYears', unit: 'u.years', d: 1 }] },
  { id: 'housing', flow: null, metrics: [{ k: 'housing', unit: 'u.index', d: 0, mul: 100 }, { k: 'shortfall', unit: 'u.kDw', d: 1 }] },
];
let t = k => k; // replaced once the text is loaded

/* ---------- scaffolding that depends on the scenario list ---------- */
function buildScenarioList() {
  const host = $('#scenList');
  for (const fam of FAMILIES) {
    const d = el('details', { class: 'fam', open: '' }, `<summary><span data-copy="fam.${fam}"></span><i class="count" data-fam="${fam}"></i></summary>`);
    for (const s of SCENARIOS.filter(x => x.family === fam)) {
      const c = el('div', { class: 'sc', 'data-id': s.id });
      c.innerHTML = `<label class="sc-head" for="sc-${s.id}"><input type="checkbox" id="sc-${s.id}"><span class="sc-name" data-copy="scen.${s.id}.name"></span></label>
<p class="sc-desc"><span data-copy="scen.${s.id}.desc"></span> <span class="tag basis-${s.basis}" data-copy="basis.${s.basis}"></span></p>
<div class="sc-ctl" hidden>${s.twoSided ? `<div class="seg dir" role="group"><button type="button" data-dir="1" aria-pressed="true" data-copy="scen.${s.id}.plus"></button><button type="button" data-dir="-1" aria-pressed="false" data-copy="scen.${s.id}.minus"></button></div>` : ''}
<label for="k-${s.id}"><span data-copy="scen.size"></span><input type="range" id="k-${s.id}" min="25" max="200" step="25" value="100"><output>100%</output></label>
<label for="y-${s.id}"><span data-copy="scen.start"></span><input type="range" id="y-${s.id}" min="2027" max="2040" step="1" value="2028"><output>2028</output></label></div>`;
      d.appendChild(c);
    }
    host.appendChild(d);
  }
}
function buildCards() {
  const host = $('#cards');
  for (const c of CARDS) {
    state.metric[c.id] = 0;
    const s = el('section', { class: 'card', 'data-card': c.id });
    s.innerHTML = `<header><h3>${c.flow ? `<button type="button" class="cardflow" data-copy="out.${c.id}.title"></button><span class="maptag" data-copy="out.onMap"></span>` : `<span data-copy="out.${c.id}.title"></span>`}</h3><div class="chips" role="group">${c.metrics.map((m, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}" data-copy="m.${m.k}"></button>`).join('')}</div></header>
<div class="big"><span class="val"></span><span class="delta"></span></div><div class="unit"></div><div class="plot"></div>`;
    host.appendChild(s);
  }
}

/* ---------- model runs ---------- */
let pending = 0;
function recompute() {
  const active = [...state.active.entries()].map(([id, a]) => ({ id, ...a }));
  const fn = compose(active);
  scen = fn ? { det: run(V, fn), fan: scen.fan, on: true } : { det: base.det, fan: base.fan, on: false };
  renderCards(); renderCounts();
  clearTimeout(pending);
  if (fn) pending = setTimeout(() => { scen.fan = fan(draws, fn, FAN_KEYS); renderCards(); }, 140);
}
const tf = () => state.year - BASE;
const ti = () => Math.round(tf());
const at = (a, mul = 1) => { const x = tf(), i = Math.max(0, Math.min(T - 1, Math.floor(x))), u = x - i; return (a[i] + (a[i + 1] - a[i]) * u) * mul; };

/* ---------- outcome cards ---------- */
function fanSVG(m, w, h) {
  const mul = m.mul || 1, pad = { l: 34, r: 10, t: 8, b: 18 };
  const keys = m.two || [m.k];
  const series = keys.map(k => ({ k, s: scen.det[k].map(x => x * mul), b: base.det[k].map(x => x * mul) }));
  const f = !m.two && scen.fan[m.k] ? scen.fan[m.k].map(a => a.map(x => x * mul)) : null;
  let lo = Infinity, hi = -Infinity;
  for (const se of series) for (const a of [se.s, se.b]) for (const x of a) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  if (f) { lo = Math.min(lo, ...f[0]); hi = Math.max(hi, ...f[4]); }
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
  const X = i => pad.l + (w - pad.l - pad.r) * i / T, Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const band = (a, b) => path(a) + b.map((v, i) => 'L' + X(T - i).toFixed(1) + ' ' + Y(b[T - i]).toFixed(1)).join('') + 'Z';
  const step = (hi - lo) / 3, mag = Math.pow(10, Math.floor(Math.log10(step))), nice = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= step) || step;
  let ticks = ''; const dec = nice < 1 ? (nice < 0.1 ? 2 : 1) : 0;
  for (let v = Math.ceil(lo / nice) * nice; v <= hi; v += nice) ticks += `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${pad.l - 5}" y="${Y(v) + 3}" text-anchor="end">${fmt(v, dec)}</text>`;
  const xt = [2026, 2031, 2036, 2046].map(y => `<text class="tick" x="${X(y - BASE)}" y="${h - 4}" text-anchor="middle">${y}</text>`).join('');
  const cls = ['s1', 's2'];
  let marks = '';
  series.forEach((se, j) => {
    marks += `<path class="base ${m.two ? cls[j] : ''}" d="${path(se.b)}"/>`;
    marks += `<path class="line ${m.two ? cls[j] : 's0'}" d="${path(se.s)}"/><circle class="dot ${m.two ? cls[j] : 's0'}" cx="${X(tf())}" cy="${Y(at(se.s))}" r="3.5"/>`;
    if (m.two) { const other = series[1 - j].s[T], up = se.s[T] >= other; marks += `<text class="dl" x="${w - pad.r - 2}" y="${Y(se.s[T]) + (up ? -6 : 13)}" text-anchor="end">${t(j ? 'out.res' : 'out.com')}</text>`; }
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${t('m.' + m.k)}" data-lo="${lo}" data-hi="${hi}">${ticks}${xt}
${f ? `<path class="band b90" d="${band(f[0], f[4])}"/><path class="band b50" d="${band(f[1], f[3])}"/>` : ''}
<line class="now" x1="${X(tf())}" x2="${X(tf())}" y1="${pad.t}" y2="${h - pad.b}"/>${marks}<line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${h - pad.b}" hidden/></svg>`;
}
function renderCards() {
  for (const c of CARDS) {
    const node = $(`.card[data-card="${c.id}"]`), m = c.metrics[state.metric[c.id]], mul = m.mul || 1, i = ti();
    const val = $('.val', node), delta = $('.delta', node);
    if (m.two) {
      val.innerHTML = `<b class="sw s1"></b>${fmt(at(scen.det.commuters))} <small>${t('out.com')}</small> <b class="sw s2"></b>${fmt(at(scen.det.resJobs))} <small>${t('out.res')}</small>`;
      const d = at(scen.det.commuters) - at(base.det.commuters);
      delta.textContent = scen.on && Math.abs(d) >= 0.5 ? t('out.vsBase', { d: signed(d, 0) + ' ' + t('out.com').toLowerCase() }) : '';
    } else {
      const sv = at(scen.det[m.k], mul), bv = at(base.det[m.k], mul), d = sv - bv;
      val.textContent = fmt(sv, m.d);
      delta.textContent = scen.on && Math.abs(d) >= Math.pow(10, -m.d) / 2 ? t('out.vsBase', { d: signed(d, m.d) }) : '';
    }
    $('.unit', node).textContent = t(m.unit) + ' · ' + Math.round(state.year);
    $('.plot', node).innerHTML = fanSVG(m, 300, 132);
  }
  $('#noPolicy').hidden = !(scen.det.debtPct[T] > 60);
}
function chartHover(e) {
  const svg = e.target.closest('.plot svg'); const tip = $('#tip');
  if (!svg) { if (!hoverNode) tip.hidden = true; $$('.plot .cross').forEach(c => c.setAttribute('hidden', '')); return; }
  const card = svg.closest('.card'), c = CARDS.find(x => x.id === card.dataset.card), m = c.metrics[state.metric[c.id]], mul = m.mul || 1;
  const r = svg.getBoundingClientRect(), w = 300, x = (e.clientX - r.left) / r.width * w;
  const i = Math.max(0, Math.min(T, Math.round((x - 34) / (w - 44) * T)));
  const cross = $('.cross', svg); cross.removeAttribute('hidden'); const cx = 34 + (w - 44) * i / T; cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
  const rows = (m.two || [m.k]).map(k => `<div><span>${m.two ? t(k === 'commuters' ? 'out.com' : 'out.res') : t('m.' + m.k)}</span><b>${fmt(scen.det[k][i] * mul, m.d)}</b>${scen.on ? `<i>${t('out.legendBase')} ${fmt(base.det[k][i] * mul, m.d)}</i>` : ''}</div>`).join('');
  tip.innerHTML = `<strong>${YEARS[i]}</strong>${rows}`; placeTip(e.clientX, e.clientY);
}
function placeTip(x, y) { const tip = $('#tip'); tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + 'px'; tip.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 14)) + 'px'; }
function renderCounts() {
  for (const fam of FAMILIES) { const n = SCENARIOS.filter(s => s.family === fam && state.active.has(s.id)).length; $(`.count[data-fam="${fam}"]`).textContent = n ? n : ''; }
  const n = state.active.size; $('#scenState').textContent = n ? t('scen.active', { n }) : t('scen.none'); $('#btnReset').disabled = !n;
}

/* ---------- map ---------- */
const cv = $('#map'), ctx = cv.getContext('2d');
const mx = lon => lon * Math.PI / 180, my = lat => -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const GEO = {};
for (const lvl of ['world', 'europe', 'region']) GEO[lvl] = window.__GEO__[lvl].map(c => ({ n: c.n, r: c.r.map(fl => { const a = new Float32Array(fl.length); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (let i = 0; i < fl.length; i += 2) { const x = mx(fl[i]), y = my(fl[i + 1]); a[i] = x; a[i + 1] = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 - x0 > 5.5) { x0 = 9; x1 = -9; for (let i = 0; i < a.length; i += 2) { if (a[i] < 0) a[i] += 2 * Math.PI; if (a[i] < x0) x0 = a[i]; if (a[i] > x1) x1 = a[i]; } } return { a, x0, x1, y0, y1 }; }) }));
let W = 0, H = 0, DPR = 1, view = null, anim = null, hoverNode = null, lastStreams = [];
const insets = () => { const wide = innerWidth >= 980; return { l: wide ? 344 : 0, r: wide ? 352 : 0, t: 64, b: wide ? 92 : 150 }; };
function targetView(level) {
  const L = LEVELS[level], ins = insets(), fw = Math.max(240, W - ins.l - ins.r), fh = Math.max(200, H - ins.t - ins.b);
  let k = fw / (L.span * Math.PI / 180);
  const spanY = { gr: 1.9, eu: 34, world: 120 }[level], latC = L.c[1];
  const kh = fh / (my(latC - spanY / 2) - my(latC + spanY / 2)); k = Math.min(k, kh);
  return { cx: mx(L.c[0]), cy: my(L.c[1]), k, ox: (ins.l - ins.r) / 2, oy: (ins.t - ins.b) / 2 };
}
const SX = x => (x - view.cx) * view.k + W / 2 + view.ox, SY = y => (y - view.cy) * view.k + H / 2 + view.oy;
const pt = ([lon, lat]) => [SX(mx(lon)), SY(my(lat))];
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; view = targetView(state.level); anim = null; }
function zoomTo(level) {
  state.level = level; const to = targetView(level), from = { ...view };
  if (reduced) { view = to; return; }
  anim = { from, to, t0: performance.now(), dur: 1100 };
}
function colors() {
  const cs = getComputedStyle(document.body), g = n => cs.getPropertyValue(n).trim();
  return { sea: g('--sea'), land: g('--land'), lu: g('--accent'), border: g('--border'), grat: g('--grat'), ink: g('--ink'), ink2: g('--ink2'), inn: g('--accent2'), out: g('--accent'), halo: g('--halo'), good: g('--good'), bad: g('--bad') };
}
let C = null;
/* ---------- 3D camera: a tilted map you can turn ---------- */
const cam = { yaw: -0.32, pitch: 0.86, D: 2600, user: -1e9 };
let K3 = { ca: 1, sa: 0, sp: 1, cp: 0, k: 1, ox: 0, oy: 0 };
function setCamera(now) {
  const ins = insets(), fw = W - ins.l - ins.r, fh = H - ins.t - ins.b, yaw = cam.yaw + (reduced || now - cam.user < 5000 ? 0 : 0.05 * Math.sin(now / 5200));
  K3 = { ca: Math.cos(yaw), sa: Math.sin(yaw), sp: Math.sin(cam.pitch), cp: Math.cos(cam.pitch), k: view.k * 1.25, ox: ins.l + fw / 2, oy: ins.t + fh * (W >= 980 ? 0.66 : 0.6) };
}
const P3 = (X, Y, Z) => { const x1 = X * K3.ca - Y * K3.sa, y1 = X * K3.sa + Y * K3.ca, dp = y1 * K3.cp - Z * K3.sp, f = cam.D / Math.max(300, cam.D + dp); return [K3.ox + x1 * f, K3.oy - (y1 * K3.sp + Z * K3.cp) * f, f, y1]; };
const ground = ([lon, lat]) => [(mx(lon) - view.cx) * K3.k, -(my(lat) - view.cy) * K3.k];
const hexA = (hex, a) => { const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
function drawGeo(set) {
  const { ca, sa, sp, cp, k, ox, oy } = K3, D = cam.D, cx = view.cx, cy = view.cy;
  ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
  for (const c of set) {
    const isLu = c.n === 'Luxembourg'; ctx.beginPath();
    for (const r of c.r) { const a = r.a;
      for (let i = 0; i < a.length; i += 2) { const X = (a[i] - cx) * k, Y = -(a[i + 1] - cy) * k, x1 = X * ca - Y * sa, y1 = X * sa + Y * ca, f = D / Math.max(300, D + y1 * cp), sx = ox + x1 * f, sy = oy - y1 * sp * f; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }
      ctx.closePath(); }
    ctx.fillStyle = isLu ? C.lu : C.land; ctx.globalAlpha = isLu ? 0.5 : 1; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = isLu ? C.lu : C.border; ctx.stroke();
  }
}
function graticule() {
  const step = view.k > 3000 ? 0.25 : view.k > 400 ? 2.5 : 15, c = [view.cx * 180 / Math.PI, 0], R = 1500 / K3.k * 180 / Math.PI;
  const latC = Math.atan(Math.sinh(-view.cy)) * 180 / Math.PI, lon0 = Math.floor((c[0] - R) / step) * step, lon1 = c[0] + R, lat0 = Math.max(-80, Math.floor((latC - R * 0.6) / step) * step), lat1 = Math.min(84, latC + R * 0.6);
  ctx.strokeStyle = C.grat; ctx.lineWidth = 1; ctx.beginPath();
  for (let l = lon0; l <= lon1; l += step) { const a = P3(...ground([l, lat0]), 0), b = P3(...ground([l, lat1]), 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  for (let la = lat0; la <= lat1; la += step) { const a = P3(...ground([lon0, la]), 0), b = P3(...ground([lon1, la]), 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke();
}
function maxRef(family, level) {
  const key = family + level; if (maxRef.c[key]) return maxRef.c[key];
  const m = { solid: 0, ghost: 0 };
  for (const i of [0, T]) for (const s of streams(family, level, base.det, i)) if (!s.halo) { const g = s.ghost ? 'ghost' : 'solid'; m[g] = Math.max(m[g], s.val); }
  return (maxRef.c[key] = m);
}
maxRef.c = {};
function curve(a, b, bend) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  return [(a[0] + b[0]) / 2 - dy / d * d * bend, (a[1] + b[1]) / 2 + dx / d * d * bend];
}
function mixInside(det) {
  const xf = tf(), i0 = Math.max(0, Math.min(T - 1, Math.floor(xf))), u = xf - i0, a = inside(state.flow, state.level, det, i0), b = inside(state.flow, state.level, det, i0 + 1);
  const mixList = (p, q) => p.map(it => { const o = q.find(z => z.key === it.key); return { ...it, val: it.val + ((o ? o.val : 0) - it.val) * u }; });
  return { ...a, sources: mixList(a.sources, b.sources), uses: mixList(a.uses, b.uses) };
}
function refTotal(family, level) {
  const key = 'in' + family + level; if (maxRef.c[key]) return maxRef.c[key];
  let m = 0; for (const i of [0, T]) m = Math.max(m, inside(family, level, base.det, i).sources.reduce((a, s) => a + s.val, 0));
  return (maxRef.c[key] = m);
}
let lastBars = [];
const TOWER_H = 190, BAR_H = 70;
/* Luxembourg as a tower: its height is the pool, its storeys are who fills it or where it goes. */
/* A small square column standing on the ground: the two faces turned to the viewer and the top. Returns its screen extent. */
function column(gx, gy, a, z1, col) {
  const cs = [[-a, -a], [a, -a], [a, a], [-a, a]], ns = [[0, -1], [1, 0], [0, 1], [-1, 0]], ext = { x0: 1e9, x1: -1e9, y0: 1e9 };
  const quad = (pts, alpha) => { ctx.beginPath(); pts.forEach((q, i) => { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); ext.x0 = Math.min(ext.x0, q[0]); ext.x1 = Math.max(ext.x1, q[0]); ext.y0 = Math.min(ext.y0, q[1]); }); ctx.closePath();
    ctx.globalAlpha = 1; ctx.fillStyle = C.sea; ctx.fill(); ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 0.6; ctx.strokeStyle = C.sea; ctx.stroke(); };
  ns.forEach((n, fi) => { const ny = n[0] * K3.sa + n[1] * K3.ca; if (ny >= 0) return; const c0 = cs[fi], c1 = cs[(fi + 1) % 4];
    quad([P3(gx + c0[0], gy + c0[1], 0), P3(gx + c1[0], gy + c1[1], 0), P3(gx + c1[0], gy + c1[1], z1), P3(gx + c0[0], gy + c0[1], z1)], ny < -0.72 ? 0.95 : 0.62); });
  quad(cs.map(c => P3(gx + c[0], gy + c[1], z1)), 0.8);
  return ext;
}
function drawTower(g, placed, late) {
  const cur = mixInside(scen.det), bas = scen.on ? mixInside(base.det) : null, which = state.flow === 'people' ? 'sources' : 'uses';
  const list = cur[which], blist = bas && bas[which], total = list.reduce((a, s) => a + s.val, 0), btotal = blist ? blist.reduce((a, s) => a + s.val, 0) : total;
  const zk = TOWER_H / refTotal(state.flow, state.level), a = W >= 980 ? 15 : 11, corners = [[-a, -a], [a, -a], [a, a], [-a, a]], normals = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const colOf = ty => ty === 'ext' ? C.inn : ty === 'leave' ? C.out : ty === 'stay' ? C.ink : C.ink2;
  const quad = (pts, fill, alpha) => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.globalAlpha = 1; ctx.fillStyle = C.sea; ctx.fill(); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.strokeStyle = C.sea; ctx.stroke(); };
  const num = v => fmt(v, cur.unit === 'bn' && v < 100 ? 1 : 0), unit = v => cur.unit === 'bn' ? t('unit.bn', { v }) : t('unit.k', { v });
  let z = 0, right = -1e9; const labels = [];
  list.forEach((it, j) => {
    const z1 = z + Math.max(0.5, it.val * zk), col = colOf(it.type);
    normals.forEach((n, fi) => { const ny = n[0] * K3.sa + n[1] * K3.ca; if (ny >= 0) return; const c0 = corners[fi], c1 = corners[(fi + 1) % 4];
      quad([P3(g[0] + c0[0], g[1] + c0[1], z), P3(g[0] + c1[0], g[1] + c1[1], z), P3(g[0] + c1[0], g[1] + c1[1], z1), P3(g[0] + c0[0], g[1] + c0[1], z1)], col, ny < -0.72 ? 0.92 : 0.62); });
    const mid = P3(g[0], g[1], (z + z1) / 2), top = P3(g[0], g[1], z1), bot = P3(g[0], g[1], z);
    corners.forEach(c => { right = Math.max(right, P3(g[0] + c[0], g[1] + c[1], z)[0]); });
    const b0 = blist && blist.find(q => q.key === it.key), d = b0 && b0.val ? it.val / b0.val - 1 : 0, dtx = bas && Math.abs(d) >= 0.005 ? '  ' + signed(d * 100, Math.abs(d) < 0.1 ? 1 : 0) + '%' : '';
    const name = t((which === 'sources' ? 'in.' : 'use.') + it.key);
    labels.push({ y: mid[1], name, val: num(it.val) + dtx, col });
    lastBars.push({ x: mid[0] - 22, y: top[1], w: 44, h: Math.max(6, bot[1] - top[1]), name, val: unit(num(it.val)), d: dtx, type: it.type });
    if (j === list.length - 1) quad(corners.map(c => P3(g[0] + c[0], g[1] + c[1], z1)), col, 1);
    z = z1;
  });
  const topC = P3(g[0], g[1], z);
  if (bas && Math.abs(btotal - total) * zk > 1.5) { ctx.setLineDash([3, 3]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); corners.forEach((c, i) => { const q = P3(g[0] + c[0], g[1] + c[1], btotal * zk); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); }
  late.push(() => { // storey labels on the right, kept apart; drawn last so arcs never cover them
  labels.sort((p, q) => p.y - q.y); for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 29) labels[i].y = labels[i - 1].y + 29;
  const over = labels.length ? labels[labels.length - 1].y - (P3(g[0], g[1], 0)[1] + 4) : 0; if (over > 0) labels.forEach(l => { l.y -= over; });
  const lx = right + 16;
  for (const l of labels) {
    ctx.strokeStyle = l.col; ctx.lineWidth = 1; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(right + 2, l.y); ctx.lineTo(lx - 4, l.y); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.halo;
    ctx.font = '600 11.5px Inter, system-ui, sans-serif'; ctx.strokeText(l.name, lx, l.y + 1); ctx.fillStyle = C.ink; ctx.fillText(l.name, lx, l.y + 1);
    const wn = ctx.measureText(l.name).width;
    ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'; ctx.strokeText(l.val, lx, l.y + 14); ctx.fillStyle = C.ink2; ctx.fillText(l.val, lx, l.y + 14);
    placed.push({ x0: lx - 4, x1: lx + Math.max(wn, ctx.measureText(l.val).width) + 4, y0: l.y - 11, y1: l.y + 18 });
  }
  const dT = bas ? total / btotal - 1 : 0, head = t('pool.' + cur.pool) + '  ' + unit(num(total)) + (bas && Math.abs(dT) >= 0.005 ? '  ' + signed(dT * 100, 1) + '%' : '');
  ctx.textAlign = 'center'; ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = C.halo; ctx.strokeText(head, topC[0], topC[1] - 20); ctx.fillStyle = C.ink; ctx.fillText(head, topC[0], topC[1] - 20);
  const hw = ctx.measureText(head).width / 2; placed.push({ x0: topC[0] - hw - 4, x1: topC[0] + hw + 4, y0: topC[1] - 34, y1: topC[1] - 12 }, { x0: topC[0] - 24, x1: topC[0] + 24, y0: topC[1] - 12, y1: P3(g[0], g[1], 0)[1] + 8 });
  });
  return z;
}
function drawScene(now) {
  const fam = state.flow, lvl = state.level, ref = maxRef(fam, lvl), ins = insets();
  const xf = tf(), i0 = Math.max(0, Math.min(T - 1, Math.floor(xf))), uf = xf - i0;
  const mix = det => { const a = streams(fam, lvl, det, i0), b = streams(fam, lvl, det, i0 + 1); a.forEach((s, j) => { s.val += (b[j].val - s.val) * uf; }); return a; };
  const cur = mix(scen.det), bas = mix(base.det), night = document.body.classList.contains('night');
  lastStreams = []; lastBars = [];
  const byNode = {}; cur.forEach((s, j) => { s.base = bas[j].val; if (!s.halo) (byNode[s.node] = byNode[s.node] || []).push(s); });
  const gl = ground(LUX), which = fam === 'people' ? 'sources' : 'uses', tin = mixInside(scen.det), towerZ = tin[which].reduce((a, s) => a + s.val, 0) * TOWER_H / refTotal(fam, lvl);
  const maxW = Math.min(13, Math.max(7, W / 110)), wOf = s => Math.max(1.2, maxW * s.val / (s.ghost ? ref.ghost : ref.solid)), zOf = v => Math.max(3, BAR_H * v / ref.solid);
  // each flow of a partner has its own column, side by side on the ground, so the row turns with the map
  const colA = W >= 980 ? 3.4 : 2.8, colGap = colA * 2 + 3;
  const colAt = (g, list, s) => { const solid = list.filter(q => !q.ghost), j = solid.indexOf(s); return j < 0 ? g : [g[0] + (j - (solid.length - 1) / 2) * colGap, g[1]]; };
  const arcPts = (g, s, slot, n) => { // partner column top -> tower top (or back), lifted in between
    const z0 = s.ghost ? 0 : zOf(s.val), dx = gl[0] - g[0], dy = gl[1] - g[1], d = Math.hypot(dx, dy) || 1, side = (s.ghost ? 0 : s.dir === 'in' ? 1 : -1) * 0.1 * d;
    const lift = Math.max(towerZ, z0) + Math.max(46, Math.min(250, d * (s.ghost ? 0.62 : 0.42)));
    const c = [(g[0] + gl[0]) / 2 - dy / d * side, (g[1] + gl[1]) / 2 + dx / d * side, lift * 1.25], pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u, X = v * v * g[0] + 2 * u * v * c[0] + u * u * gl[0], Y = v * v * g[1] + 2 * u * v * c[1] + u * u * gl[1], Z = v * v * z0 + 2 * u * v * c[2] + u * u * towerZ; pts.push([X, Y, Z]); }
    return s.dir === 'out' ? pts.reverse() : pts;
  };
  const path = pts => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); };
  // shadows on the ground first
  ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.globalAlpha = 0.22;
  for (const node in byNode) for (const s of byNode[node]) if (!s.ghost) { path(arcPts(colAt(ground(NODES[node]), byNode[node], s), s, 0, 16).map(q => P3(q[0], q[1], 0))); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // far to near: partners behind Luxembourg, the tower, partners in front
  const lu = P3(gl[0], gl[1], 0), items = Object.keys(byNode).map(node => { const g = ground(NODES[node]); return { node, g, p: P3(g[0], g[1], 0) }; }).sort((a, b) => b.p[3] - a.p[3]);
  const placed = [], late = []; let towerDone = false;
  const drawNode = it => {
    const list = byNode[it.node], solid = list.filter(s => !s.ghost);
    for (const s of list.slice().sort((a, b) => (b.ghost ? 1 : 0) - (a.ghost ? 1 : 0))) {
      const pts = arcPts(colAt(it.g, list, s), s, 0, 30).map(q => P3(q[0], q[1], q[2])), col = s.dir === 'in' ? C.inn : C.out, w = wOf(s);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.ghost) { path(pts); ctx.lineWidth = Math.max(5, w * 1.5); ctx.strokeStyle = C.ink2; ctx.globalAlpha = 0.16; ctx.stroke(); ctx.globalAlpha = 0.7; ctx.lineWidth = 1.1; ctx.setLineDash([2, 7]); ctx.lineDashOffset = reduced ? 0 : -now / 50; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; continue; }
      if (scen.on && Math.abs(wOf({ ...s, val: s.base }) - w) > 0.5) { path(pts); ctx.lineWidth = wOf({ ...s, val: s.base }); ctx.strokeStyle = C.ink2; ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1; }
      path(pts); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = 0.34; ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(1.2, w * 0.5); ctx.setLineDash([Math.max(6, w), Math.max(7, w)]); ctx.lineDashOffset = reduced ? 0 : -now / 26;
      if (night) { ctx.shadowColor = col; ctx.shadowBlur = 9; } ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
    }
    // the partner's place on the ground, then one column per flow, the farthest first
    const rx = Math.max(6.5, solid.length * colGap / 2 + 1.5) + (hoverNode === it.node ? 2 : 0);
    ctx.fillStyle = C.sea; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(it.p[0], it.p[1], rx, rx * K3.sp * 0.72, 0, 0, 7); ctx.fill(); ctx.stroke();
    let x0 = it.p[0] - rx, x1 = it.p[0] + rx, y0 = it.p[1];
    for (const s of solid.map(q => ({ q, g: colAt(it.g, list, q) })).sort((a, b) => P3(b.g[0], b.g[1], 0)[3] - P3(a.g[0], a.g[1], 0)[3])) {
      const e = column(s.g[0], s.g[1], colA, zOf(s.q.val), s.q.dir === 'in' ? C.inn : C.out); x0 = Math.min(x0, e.x0); x1 = Math.max(x1, e.x1); y0 = Math.min(y0, e.y0);
      const zb = zOf(s.q.base); if (scen.on && Math.abs(zb - zOf(s.q.val)) * K3.cp > 2) { const a = colA + 1.2; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); [[-a, -a], [a, -a], [a, a], [-a, a]].forEach((c, i) => { const q = P3(s.g[0] + c[0], s.g[1] + c[1], zb); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke(); }   // where the baseline stood
    }
    lastStreams.push({ node: it.node, x: it.p[0], y: it.p[1] - 14, list });
    // the place and its columns are in the way of other partners' labels
    it.hw = Math.max(it.p[0] - x0, x1 - it.p[0]) + 1;
    placed.push({ x0: x0 - 2, x1: x1 + 2, y0: y0 - 3, y1: it.p[1] + rx * K3.sp * 0.72 + 2, node: it.node });
  };
  for (const it of items) { if (!towerDone && it.p[3] < lu[3]) { drawTower(gl, placed, late); towerDone = true; } drawNode(it); }
  if (!towerDone) drawTower(gl, placed, late);
  for (const s of cur) if (s.halo) { ctx.setLineDash([3, 5]); ctx.strokeStyle = C.inn; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(lu[0], lu[1], 58, 58 * K3.sp * 0.62, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); label(lu[0], lu[1] + 58 * K3.sp * 0.62 + 16, t('node.europe'), valText(s), s, 'center'); placed.push({ x0: lu[0] - 50, x1: lu[0] + 50, y0: lu[1] + 28, y1: lu[1] + 62 }); }
  late.forEach(f => f());
  // partner labels, biggest first
  const hit = (b, own, labelsOnly) => placed.some(q => q.node !== own && !(labelsOnly && q.node) && b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
  const tot = n => byNode[n].reduce((x, q) => x + (q.ghost ? 0 : q.val), 0);
  for (const it of items.slice().sort((a, b) => tot(b.node) - tot(a.node))) {
    const list = byNode[it.node].filter(s => !s.ghost), p = it.p, right = p[0] >= lu[0], name = t('node.' + it.node), vals = list.map(valText).join('  ');
    ctx.font = '600 12px Inter, system-ui, sans-serif'; const wn = ctx.measureText(name).width;
    ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'; const wl = Math.max(wn, ctx.measureText(vals).width + (scen.on ? 36 : 0));
    const tries = [[right ? 'left' : 'right', 0], [right ? 'right' : 'left', 0], ['center', 18], [right ? 'left' : 'right', 22], [right ? 'right' : 'left', 22], ['center', 40]];
    // where a label would sit; null if it leaves the map area or runs into another label by more than `slack` pixels
    const fit = (al, yy, full, slack, labelsOnly) => { const ww = full ? wl : wn, gap = it.hw + 8, lx = p[0] + (al === 'left' ? gap : al === 'right' ? -gap : 0), ly = p[1] + yy + (al === 'center' ? 2 : -4);
      const box = { x0: al === 'left' ? lx - 2 : al === 'right' ? lx - ww - 2 : lx - ww / 2 - 2, y0: ly - 12, y1: ly + (full ? 18 : 4) }; box.x1 = box.x0 + ww + 4;
      if (box.x0 < ins.l + 4 - slack || box.x1 > W - ins.r - 4 + slack || box.y1 > H - ins.b - 2 + slack) return null;
      const sx = slack < 0 ? -8 : slack, sy = slack < 0 ? -1 : slack;                       // a new place needs clear space to its sides, so that two labels do not read as one line
      if (hoverNode !== it.node && hit({ x0: box.x0 + sx, x1: box.x1 - sx, y0: box.y0 + sy, y1: box.y1 - sy }, it.node, labelsOnly)) return null;
      return { box, lx, ly, al, yy, full, loose: !!labelsOnly }; };
    // a label keeps its place while the map sways: it moves only when its place is clearly taken or the view changes
    const key = state.flow + '|' + state.level + '|' + it.node; let got = null; const was = labelMemo[key];
    if (was) got = fit(was.al, was.yy, was.full, 9, was.loose);
    if (!got) { for (const full of [true, false]) { if (got) break; for (const [al, yy] of tries) { got = fit(al, yy, full, -1); if (got) break; } }
      if (!got) for (const [al, yy] of tries) { got = fit(al, yy, false, 0, true); if (got) break; }   // last resort: the name alone, allowed to cross another partner's bars but never another label
      if (got) { if (was) labelMemo.flips++; labelMemo[key] = { al: got.al, yy: got.yy, full: got.full, loose: got.loose }; } }
    if (got) { placed.push(got.box); label(got.lx, got.ly, name, got.full ? vals : '', list[0], got.al, list); }
  }
}
const labelMemo = { flips: 0 };
const valText = s => (s.dir === 'out' ? '→ ' : s.dir === 'in' ? '← ' : '') + fmt(s.val, s.val < 10 ? 1 : 0);
function label(x, y, name, val, s, align, list) {
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = C.halo; ctx.strokeText(name, x, y); ctx.fillStyle = C.ink; ctx.fillText(name, x, y);
  if (!val) return;
  ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
  let dtxt = '';
  if (scen.on && s) { const src = list || [s], d = src.reduce((a, q) => a + q.val - q.base, 0), b = src.reduce((a, q) => a + q.base, 0); if (b && Math.abs(d / b) >= 0.01) dtxt = '  ' + signed(d / b * 100, 0) + '%'; }
  const wv = ctx.measureText(val).width, wd = dtxt ? ctx.measureText(dtxt).width : 0;
  const x0 = align === 'left' ? x : align === 'right' ? x - wv - wd : x - (wv + wd) / 2;
  ctx.textAlign = 'left'; ctx.strokeText(val + dtxt, x0, y + 14);
  ctx.fillStyle = C.ink2; ctx.fillText(val, x0, y + 14);
  if (dtxt) { ctx.fillStyle = C.ink; ctx.fillText(dtxt, x0 + wv, y + 14); }
}
function frame(now) {
  if (state.playing && !reduced) { const dt = Math.min(0.1, (now - (frame.prev || now)) / 1000), y = Math.min(2046, state.year + dt * 2.2); setYear(y, true); if (y >= 2046) play(false); }
  frame.prev = now;
  if (anim) { const u = Math.min(1, (now - anim.t0) / anim.dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, f = anim.from, to = anim.to;
    view = { cx: f.cx + (to.cx - f.cx) * e, cy: f.cy + (to.cy - f.cy) * e, k: Math.exp(Math.log(f.k) + (Math.log(to.k) - Math.log(f.k)) * e), ox: f.ox + (to.ox - f.ox) * e, oy: f.oy + (to.oy - f.oy) * e }; if (u >= 1) anim = null; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = C.sea; ctx.fillRect(0, 0, W, H);
  setCamera(now); graticule();
  const kEU = targetView('eu').k, kW = targetView('world').k;
  drawGeo(view.k > kEU * 5 ? GEO.region : view.k > kW * 2.2 ? GEO.europe : GEO.world);
  const fade = ctx.createLinearGradient(0, 0, 0, H * 0.34); fade.addColorStop(0, hexA(C.sea, 1)); fade.addColorStop(0.35, hexA(C.sea, 0.85)); fade.addColorStop(1, hexA(C.sea, 0));
  ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H * 0.34);
  if (!anim) drawScene(now);
  requestAnimationFrame(frame);
}
function mapHover(e) {
  if (e.target !== cv) { if (hoverNode) { hoverNode = null; } return; }
  let best = null, bd = 26;
  for (const n of lastStreams) { const d = Math.hypot(e.clientX - n.x, e.clientY - n.y); if (d < bd) { bd = d; best = n; } }
  hoverNode = best ? best.node : null; cv.style.cursor = best ? 'pointer' : 'grab';
  const tip = $('#tip');
  if (!best) { const bar = lastBars.find(q => e.clientX >= q.x && e.clientX <= q.x + q.w && e.clientY >= q.y - 2 && e.clientY <= q.y + q.h + 2);
    if (!bar) { tip.hidden = true; return; }
    tip.innerHTML = `<strong>${bar.name} · ${Math.round(state.year)}</strong><div><span>${t('legend.' + (bar.type === 'ext' ? 'in' : bar.type === 'leave' ? 'out' : bar.type === 'stay' ? 'stays' : 'domestic'))}</span><b>${bar.val}</b>${bar.d ? `<i>${bar.d.trim()} ${t('legend.vsBase')}</i>` : ''}</div>`; placeTip(e.clientX, e.clientY); return; }
  tip.innerHTML = `<strong>${t('node.' + best.node)} · ${Math.round(state.year)}</strong>` + best.list.map(s => `<div><span>${t('kind.' + s.kind)}</span><b>${t('unit.' + s.unit, { v: fmt(s.val, s.val < 10 ? 1 : 0) })}</b>${scen.on && s.base && Math.abs(s.val / s.base - 1) >= 0.005 ? `<i>${signed((s.val / s.base - 1) * 100, 1)}% ${t('legend.vsBase')}</i>` : ''}</div>`).join('');
  placeTip(e.clientX, e.clientY);
}

/* ---------- controls ---------- */
function setYear(y, light) { state.year = y; $('#year').value = y; $('#yearOut').textContent = Math.round(y); $$('#horizon button').forEach(b => b.setAttribute('aria-pressed', Math.abs(+b.dataset.y - y) < 0.01));
  const now = performance.now(); if (!light || now - setYear.last > 60) { setYear.last = now; renderCards(); } }
setYear.last = 0;
function setFlow(f) { state.flow = f; $$('#flowSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.flow === f)); $$('#cards .card').forEach(n => n.classList.toggle('onmap', CARDS.find(c => c.id === n.dataset.card).flow === f)); syncPeople(); renderLegend(); }
function setLevel(l) { zoomTo(l); $$('#levelSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.level === l)); syncPeople(); renderLegend(); }
/* The People map shows jobs and commuters in the Greater Region, residents and migration in Europe and the World.
   The "Jobs and people" chart follows it, so that chart and map always show the same subject. */
function syncPeople() {
  if (state.flow !== 'people') return;
  const card = CARDS.find(c => c.id === 'jobs'), iPop = card.metrics.findIndex(m => m.k === 'pop'), now = state.metric.jobs, want = state.level === 'gr' ? (now === iPop ? 0 : now) : iPop;
  if (want === now) return;
  state.metric.jobs = want; $$('.card[data-card="jobs"] .chips button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === want)); if (scen) renderCards();
}
function renderLegend() {
  const st = streams(state.flow, state.level, base.det, 0), has = k => st.some(s => (k === 'ghost' ? s.ghost : !s.ghost && !s.halo && s.dir === k));
  $('#flowHint').textContent = t(`flowhint.${state.flow}.${state.level}`);
  const unit = st.find(s => !s.ghost)?.unit;
  $('#legendUnit').textContent = unit === 'k' ? t('u.k') + (st[0].kind === 'migration' ? ', ' + t('unit.perYear') : '') : t('u.bn') + ', ' + t('unit.perYear');
  $('#lgIn').hidden = !has('in'); $('#lgOut').hidden = !has('out'); $('#lgGhost').hidden = !has('ghost'); $('#lgBase').hidden = !scen.on;
}
let playTimer = 0;
function play(on) {
  state.playing = on; $('#btnPlay').setAttribute('aria-pressed', on); $('#btnPlay').setAttribute('aria-label', t(on ? 'dock.pause' : 'dock.play')); $('#btnPlay').textContent = on ? '❚❚' : '▶';
  clearInterval(playTimer);
  if (on) { if (state.year >= 2046) setYear(2025); if (reduced) playTimer = setInterval(() => { if (state.year >= 2046) return play(false); setYear(state.year + 1); }, 450); }
  else if (state.year !== Math.round(state.year)) setYear(Math.round(state.year));
}
function setScenario(id, on, patch) {
  const card = $(`.sc[data-id="${id}"]`), cur = state.active.get(id) || { k: 1, year: 2028, dir: 1 };
  if (on === false) state.active.delete(id); else state.active.set(id, { ...cur, ...patch });
  const a = state.active.get(id);
  $('input[type=checkbox]', card).checked = !!a; $('.sc-ctl', card).hidden = !a; card.classList.toggle('on', !!a);
  if (a) { $(`#k-${id}`).value = a.k * 100; $(`#k-${id}`).nextElementSibling.textContent = Math.round(a.k * 100) + '%'; $(`#y-${id}`).value = a.year; $(`#y-${id}`).nextElementSibling.textContent = a.year; $$('.dir button', card).forEach(b => b.setAttribute('aria-pressed', +b.dataset.dir === a.dir)); }
  recompute(); renderLegend();
}
function clearScenarios() { for (const id of [...state.active.keys()]) setScenario(id, false); }
function setLook(night) { document.body.classList.toggle('night', night); C = colors(); $('#btnLook').textContent = t(night ? 'hud.lookDay' : 'hud.lookNight'); $('#btnLook').setAttribute('aria-pressed', night); }

/* ---------- guided tour ---------- */
const TOUR = [
  { level: 'gr', flow: 'people', year: 2025, vars: () => ({ commuters: fmt(base.det.commuters[0]), share: fmt(base.det.comShare[0] * 100) }) },
  { level: 'world', flow: 'money', year: 2025, vars: () => ({ aum: fmt(base.det.aum[0]), times: fmt(base.det.aum[0] / base.det.gdp[0]) }) },
  { level: 'gr', flow: 'money', year: 2025, vars: () => ({ wx: fmt(base.det.wX[0], 1), gni: fmt(base.det.gniShare[0] * 100) }) },
  { level: 'gr', flow: 'people', year: 2046, vars: () => ({ g: fmt((Math.pow(base.det.gdp[T] / base.det.gdp[0], 1 / T) - 1) * 100, 1), jobs: fmt(base.det.jobs[T]), share: fmt(base.det.comShare[T] * 100) }) },
  { level: 'gr', flow: 'people', year: 2046, scen: [['saturation', {}]], vars: () => ({ gdp: fmt(Math.abs(scen.det.gdp[T] / base.det.gdp[T] - 1) * 100, 1), bal: fmt(Math.abs(scen.det.balancePct[T] - base.det.balancePct[T]), 1) }) },
  { level: 'eu', flow: 'public', year: 2046, scen: [['automation', {}]], vars: () => ({ fin: fmt(Math.abs(scen.det.jobsF[T] - base.det.jobsF[T]), 1), dip: fmt(Math.abs(Math.min(...scen.det.jobs.map((x, i) => x - base.det.jobs[i]))), 1), gdp: fmt(Math.abs(scen.det.gdp[T] / base.det.gdp[T] - 1) * 100, 1), bal: fmt(Math.abs(scen.det.balancePct[T] - base.det.balancePct[T]), 1) }) },
  { level: 'eu', flow: 'people', year: 2036, vars: () => ({}) },
];
let tourAt = -1;
function tour(i) {
  const box = $('#story'); tourAt = i;
  if (i < 0 || i >= TOUR.length) { box.hidden = true; document.body.classList.remove('touring'); return; }
  const s = TOUR[i]; play(false); clearScenarios(); (s.scen || []).forEach(([id, p]) => setScenario(id, true, p));
  setFlow(s.flow); setLevel(s.level); setYear(s.year);
  $('#storyTitle').textContent = t(`story.${i + 1}.title`);
  $('#storyBody').innerHTML = t(`story.${i + 1}.body`, s.vars()).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  $('#storyStep').textContent = `${i + 1} / ${TOUR.length}`; $('#storyBack').disabled = i === 0; $('#storyNext').textContent = t(i === TOUR.length - 1 ? 'story.done' : 'story.next');
  box.hidden = false; document.body.classList.add('touring');
}

/* ---------- method dialog ---------- */
function buildMethod() {
  const b = base.det, g = (a, i) => (a[i] / a[i - 1] - 1) * 100, first = (arr, test) => { const i = arr.findIndex(test); return i < 0 ? t('chk.after') : YEARS[i]; };
  const inp = baselineInputs(V); inp.reform = false; const pre = simulate(V, inp);
  const rows = [
    ['chk.gdp', [1, 2, 3, 4].map(i => fmt(g(b.gdp, i), 1)).join(', ') + ' %', '1.7, 2.1, 2.2, 2.3 %', 'chk.srcStatec'],
    ['chk.jobs', [1, 2, 3, 4].map(i => fmt(g(b.jobs, i), 1)).join(', ') + ' %', '1.6, 1.8, 1.9, 1.9 %', 'chk.srcStatec'],
    ['chk.gni', fmt(b.gniShare[0] * 100, 1) + ' % (2025)', '65.4 %', 'chk.srcCnfp'],
    ['chk.long', fmt((Math.pow(b.gdp[T] / b.gdp[0], 1 / T) - 1) * 100, 1) + ' %', '1.8 %', 'chk.srcIgssLong'],
    ['chk.pop', fmt(b.pop[T]) + ' ' + t('u.k'), REF.pop2046 ? fmt(REF.pop2046) + ' ' + t('u.k') : '', 'chk.srcEurostat'],
    ['chk.com', fmt(b.comShare[T] * 100, 1) + ' %', '38 – 52 %', 'chk.srcBcl'],
    ['chk.prem', first(pre.premium, (x, i) => i > 0 && x > 24), '2028', 'chk.srcIgss'],
    ['chk.min', first(pre.reserveYears, (x, i) => i > 0 && x < 1.5), '2041', 'chk.srcIgss'],
    ['chk.out', first(pre.reserve, (x, i) => i > 0 && x <= 0), '2047', 'chk.srcIgss'],
    ['chk.min2', first(b.reserveYears, (x, i) => i > 0 && x < 1.5), '2042', 'chk.srcGov'],
  ];
  $('#chkBody').innerHTML = rows.map(r => `<tr><th scope="row">${t(r[0])}</th><td>${r[1]}</td><td>${r[2]}</td><td>${t(r[3])}</td></tr>`).join('');
  // how the model behaves in four textbook experiments, each starting in 2028
  const ex = f => run(V, f), pc = (s, k, i) => signed((s[k][i] / b[k][i] - 1) * 100, 1) + ' %', each = f => inp => { for (let i = 3; i <= T; i++) f(inp, i); };
  const slump = ex(inp => { inp.gEA[3] -= 0.04; inp.gEA[5] += 0.04; }), loss = ex(inp => { inp.gEA[3] -= 0.04; });
  const prod = ex(each((inp, i) => { if (i < 13) for (const s of 'FTID') inp.tfpAdd[s][i] += 0.01; })), work = ex(each((inp, i) => { inp.partAdd[i] += 0.15 * Math.min(1, (i - 2) / 10); }));
  const props = [
    ['prop.slump', `${pc(slump, 'gdp', 4)}, ${pc(slump, 'gdp', 13)}`, fmt(Math.max(...slump.unempRate) * 100, 1) + ' %'],
    ['prop.loss', `${pc(loss, 'gdp', 4)}, ${pc(loss, 'gdp', 13)}`, fmt(Math.max(...loss.unempRate) * 100, 1) + ' %'],
    ['prop.prod', `${pc(prod, 'gdp', 13)}, ${pc(prod, 'gdp', T)}`, pc(prod, 'wIdx', T) + ' / ' + pc(prod, 'jobs', T)],
    ['prop.work', `${pc(work, 'gdp', 13)}, ${pc(work, 'gdp', T)}`, signed(work.commuters[T] - b.commuters[T], 1) + ' ' + t('u.k')],
  ];
  $('#propBody').innerHTML = props.map(r => `<tr><th scope="row">${t(r[0])}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
  const keys = Object.keys(P), cnt = l => keys.filter(k => P[k].label === l).length;
  $('#parCount').textContent = t('method.params.count', { n: keys.length, d: cnt('data'), l: cnt('literature'), a: cnt('assumption'), e: cnt('estimated') });
  const show = x => Math.abs(x) < 1 && x !== 0 ? String(+x.toPrecision(3)) : fmt(x, Number.isInteger(x) ? 0 : 1);
  $('#parBody').innerHTML = keys.map(k => { const e = P[k]; return `<tr><th scope="row">${t('param.' + k)}</th><td>${show(e.v)}</td><td>${e.lo !== undefined ? show(e.lo) + ' – ' + show(e.hi) : ''}</td><td><span class="tag basis-${e.label}">${t('label.' + e.label)}</span></td></tr>`; }).join('');
}

/* ---------- start ---------- */
async function start() {
  buildScenarioList(); buildCards();
  window.__COPY__ = window.__COPY_ALL__[LANG] || window.__COPY_ALL__.en;
  const copy = await setupCopy({ url: '', demo: 'luxembourg-outlook' });
  t = copy.t; copy.onChange(() => { renderCards(); renderLegend(); renderCounts(); });
  const viewerTheme = document.documentElement.dataset.theme;
  setLook(viewerTheme ? viewerTheme === 'dark' : true);
  resize(); addEventListener('resize', resize);
  // events
  $('#scenList').addEventListener('change', e => { const card = e.target.closest('.sc'); if (card && e.target.type === 'checkbox') setScenario(card.dataset.id, e.target.checked, {}); });
  $('#scenList').addEventListener('input', e => { const card = e.target.closest('.sc'); if (!card || e.target.type !== 'range') return; const id = card.dataset.id; setScenario(id, true, e.target.id.startsWith('k-') ? { k: e.target.value / 100 } : { year: +e.target.value }); });
  $('#scenList').addEventListener('click', e => { const b = e.target.closest('.dir button'); if (b) setScenario(b.closest('.sc').dataset.id, true, { dir: +b.dataset.dir }); });
  $('#btnReset').onclick = clearScenarios;
  $('#cards').addEventListener('click', e => { const chip = e.target.closest('.chips button'), cf = e.target.closest('.cardflow'); const card = e.target.closest('.card'); if (!card) return;
    if (chip) { state.metric[card.dataset.card] = +chip.dataset.i; $$('.chips button', card).forEach(b => b.setAttribute('aria-pressed', b === chip)); renderCards(); }
    // choosing a chart turns the map to its flow; in People also to the zoom level where that subject lives
    const c = CARDS.find(q => q.id === card.dataset.card); if (!(chip || cf) || !c.flow) return;
    if (c.id === 'jobs' && chip) { const pop = c.metrics[state.metric.jobs].k === 'pop', lvl = pop ? (state.level === 'gr' ? 'eu' : state.level) : 'gr'; if (lvl !== state.level) setLevel(lvl); }
    setFlow(c.flow); });
  $('#flowSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFlow(b.dataset.flow); });
  $('#levelSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(b.dataset.level); });
  $('#horizon').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { play(false); setYear(+b.dataset.y); } });
  $('#year').addEventListener('input', e => { play(false); setYear(+e.target.value, true); });
  $('#year').addEventListener('change', e => setYear(Math.round(+e.target.value)));
  $('#btnPlay').onclick = () => play(!state.playing);
  $('#btnLook').onclick = () => setLook(!document.body.classList.contains('night'));
  $('#btnStory').onclick = () => tour(0); $('#storyNext').onclick = () => tour(tourAt + 1 >= TOUR.length ? -1 : tourAt + 1); $('#storyBack').onclick = () => tour(tourAt - 1); $('#storyClose').onclick = () => tour(-1);
  const dlg = $('#method');
  $('#btnMethod').onclick = () => { buildMethod(); dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); };
  $('#methodClose').onclick = () => dlg.close ? dlg.close() : dlg.removeAttribute('open');
  $('#methodTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#methodTabs button').forEach(x => x.setAttribute('aria-selected', x === b)); $$('.mtab', dlg).forEach(p => p.hidden = p.id !== b.dataset.tab); });
  $('#btnScen').onclick = () => { document.body.classList.toggle('show-scen'); document.body.classList.remove('show-out'); };
  $('#btnOut').onclick = () => { document.body.classList.toggle('show-out'); document.body.classList.remove('show-scen'); };
  addEventListener('mousemove', e => { if (e.target.closest && e.target.closest('.plot')) chartHover(e); else { $$('.plot .cross').forEach(c => c.setAttribute('hidden', '')); mapHover(e); } });
  cv.addEventListener('click', e => { mapHover(e); });
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; cam.yaw = drag.yaw - (e.clientX - drag.x) * 0.006; cam.pitch = Math.max(0.5, Math.min(1.3, drag.pitch + (e.clientY - drag.y) * 0.004)); cam.user = performance.now(); });
  const endDrag = () => { drag = null; }; cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  addEventListener('keydown', e => { if (e.target.matches('input, textarea, [contenteditable]')) return; if (e.key === 'ArrowRight' && tourAt >= 0) $('#storyNext').click(); if (e.key === 'ArrowLeft' && tourAt > 0) $('#storyBack').click(); if (e.key === 'Escape' && tourAt >= 0) tour(-1); });
  setFlow('people'); setLevel('gr'); view = targetView('gr'); anim = null; setYear(2025); renderCounts(); play(false);
  document.fonts && document.fonts.ready.then(() => {});
  requestAnimationFrame(frame);
  window.__lux = { labelMemo, state, setScenario, setFlow, setLevel, setYear, tour, setLook, base, get scen() { return scen; } };
}
start();
