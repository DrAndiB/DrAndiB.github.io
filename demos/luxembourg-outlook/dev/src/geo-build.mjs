// Builds a compact map dataset: three levels of detail, rings as flat [lon,lat,...] arrays.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
const load = f => JSON.parse(readFileSync(new URL('../node_modules/world-atlas/' + f, import.meta.url)));
const feats = f => { const t = load(f); return feature(t, t.objects.countries).features; };
const rings = g => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [[p => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [p => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]], [p => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
  let out = ring;
  for (const [inside, cut] of edges) { const src = out; out = []; if (!src.length) break;
    for (let i = 0; i < src.length; i++) { const a = src[i], b = src[(i + 1) % src.length], ia = inside(a), ib = inside(b);
      if (ia && ib) out.push(b); else if (ia && !ib) out.push(cut(a, b)); else if (!ia && ib) { out.push(cut(a, b)); out.push(b); } } }
  return out;
}
const pack = (fs, dec, box, keep) => fs.filter(f => !keep || keep(f)).map(f => {
  const m = 10 ** dec, rs = [];
  for (let r of rings(f.geometry)) {
    // a ring that crosses the date line (eastern Russia) is unrolled first, or clipping leaves a strip across the whole box
    if (box) { let lo = 999, hi = -999; for (const p of r) { if (p[0] < lo) lo = p[0]; if (p[0] > hi) hi = p[0]; } if (hi - lo > 180) r = r.map(p => p[0] < 0 ? [p[0] + 360, p[1]] : p); r = clipRing(r, box); }
    if (r.length < 3) continue;
    const flat = []; let px, py;
    for (const [x, y] of r) { const qx = Math.round(x * m) / m, qy = Math.round(Math.max(-85, Math.min(85, y)) * m) / m; if (qx !== px || qy !== py) { flat.push(qx, qy); px = qx; py = qy; } }
    if (flat.length >= 6) rs.push(flat); }
  return { n: f.properties.name, r: rs };
}).filter(c => c.r.length);
const near = new Set(['Luxembourg', 'France', 'Belgium', 'Germany', 'Netherlands', 'Switzerland']);
const geo = {
  world: pack(feats('countries-110m.json'), 1, null, f => f.properties.name !== 'Antarctica'),
  europe: pack(feats('countries-50m.json'), 2, [-75, 12, 80, 84], f => f.properties.name !== 'Canada'),
  region: pack(feats('countries-10m.json'), 3, [0.5, 45.5, 12.5, 54], f => near.has(f.properties.name)),
};
writeFileSync(new URL('./geo.json', import.meta.url), JSON.stringify(geo));
console.log(Object.entries(geo).map(([k, v]) => k + ': ' + v.length + ' countries, ' + v.reduce((a, c) => a + c.r.reduce((x, r) => x + r.length / 2, 0), 0) + ' points').join(' | '));
