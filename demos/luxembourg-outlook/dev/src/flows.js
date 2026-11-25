/* What the map draws: places, and for each flow family and zoom level the streams
   between those places and Luxembourg. Splits by partner are fixed shares (assumptions
   until partner data is loaded); the totals come from the model. */

export const LUX = [6.13, 49.61];
export const NODES = {
  FR: [6.17, 49.20], BE: [5.72, 49.70], DE: [6.66, 49.77],
  paris: [2.35, 48.86], brussels: [4.35, 50.85], frankfurt: [8.68, 50.11], london: [-0.13, 51.51], amsterdam: [4.9, 52.37],
  zurich: [8.54, 47.37], milan: [9.19, 45.46], madrid: [-3.7, 40.42], lisbon: [-9.14, 38.72], dublin: [-6.26, 53.35],
  stockholm: [18.07, 59.33], warsaw: [21.0, 52.23], beyond: [-14.5, 45.6],
  newyork: [-74, 40.7], saopaulo: [-46.6, -23.5], lagos: [3.4, 6.5], mumbai: [72.9, 19.1], hongkong: [114.2, 22.3], tokyo: [139.7, 35.7], gulf: [54.4, 24.5],
};
/* Three views: centre [lon, lat] and the width of the map in degrees of longitude. */
export const LEVELS = { gr: { c: [6.13, 49.62], span: 2.0 }, eu: { c: [5.5, 49.2], span: 46 }, world: { c: [22, 24], span: 272 } };

const sh = (obj, total, dir, extra) => Object.entries(obj).map(([node, s]) => ({ node, dir, val: total * s, ...extra }));

const MIG_EU = { lisbon: .08, paris: .14, milan: .07, brussels: .05, frankfurt: .04, madrid: .05, warsaw: .12, london: .10, beyond: .35 };
const MIG_W = { mumbai: .15, lagos: .08, saopaulo: .07, newyork: .05 };
const FUND_EU = { london: .16, frankfurt: .15, zurich: .14, paris: .11, milan: .07, brussels: .04, amsterdam: .03, stockholm: .03, beyond: .27 };
const FUND_W = { newyork: .20, hongkong: .03, tokyo: .01, gulf: .01, saopaulo: .01 };
const TRADE_EU = { frankfurt: .16, paris: .12, brussels: .09, london: .12, zurich: .07, milan: .06, amsterdam: .06, dublin: .04, beyond: .28 };
const TRADE_W = { newyork: .10, hongkong: .05, tokyo: .02, gulf: .01 };
const PENS_EU = { paris: .33, brussels: .20, frankfurt: .20, lisbon: .11, milan: .08, madrid: .03, beyond: .05 };

/* s = one model run, t = year index. Returns streams: {node, dir:'in'|'out', val, unit, kind, ghost?} */
export function streams(family, level, s, t) {
  const g = k => s[k][t];
  const X = g('commuters');
  const byCom = (total, dir, kind) => ['FR', 'BE', 'DE'].map(c => ({ node: c, dir, val: total * g('x' + c) / X, kind }));
  if (family === 'people') {
    if (level === 'gr') return ['FR', 'BE', 'DE'].map(c => ({ node: c, dir: 'in', val: g('x' + c), kind: 'commuters', unit: 'k' }));
    if (level === 'eu') return sh(MIG_EU, g('migration'), 'in', { kind: 'migration', unit: 'k' });
    return [...sh(MIG_W, g('migration'), 'in', { kind: 'migration', unit: 'k' }), { halo: true, val: g('migration') * 0.65, kind: 'migrationEurope', unit: 'k' }];
  }
  if (family === 'money') {
    if (level === 'gr') return byCom(g('wX'), 'out', 'commuterPay').map(x => ({ ...x, unit: 'bn' }));
    const tbl = level === 'eu' ? FUND_EU : FUND_W;
    const out = [...sh(tbl, g('aum'), 'in', { kind: 'fundAssets', unit: 'bn', ghost: true }), ...sh(tbl, g('vaF'), 'in', { kind: 'stays', unit: 'bn' }), ...sh(tbl, g('pInc'), 'out', { kind: 'propertyIncome', unit: 'bn' })];
    if (level === 'eu') out.push(...sh({ paris: .54, brussels: .23, frankfurt: .23 }, g('wX'), 'out', { kind: 'commuterPay', unit: 'bn' }));
    if (level === 'world') out.push({ halo: true, val: g('vaF') * 0.74, kind: 'staysEurope', unit: 'bn' });
    return out;
  }
  if (family === 'trade') {
    if (level === 'gr') return [...byCom(g('imports') * 0.18, 'in', 'goods'), ...sh({ BE: .4, DE: .4, FR: .2 }, g('energyImports'), 'in', { kind: 'energy' })].map(x => ({ ...x, unit: 'bn' }));
    const tbl = level === 'eu' ? TRADE_EU : TRADE_W;
    const out = [...sh(tbl, g('exports'), 'out', { kind: 'exports', unit: 'bn' }), ...sh(tbl, g('imports'), 'in', { kind: 'imports', unit: 'bn' })];
    if (level === 'world') out.push({ halo: true, val: g('exports') * 0.82, kind: 'exportsEurope', unit: 'bn' });
    return out;
  }
  // public finances
  const benefits = g('pensAbroad') + g('famAbroad') + g('healthAbroad');
  if (level === 'gr') return [...byCom(g('taxFromCommuters'), 'in', 'commuterTax'), ...sh({ FR: .46, BE: .27, DE: .27 }, benefits * 0.78, 'out', { kind: 'benefits' })].map(x => ({ ...x, unit: 'bn' }));
  const out = [...sh(PENS_EU, benefits, 'out', { kind: 'benefits', unit: 'bn' }), ...sh({ paris: .54, brussels: .23, frankfurt: .23 }, g('taxFromCommuters'), 'in', { kind: 'commuterTax', unit: 'bn' }),
    ...sh(level === 'eu' ? FUND_EU : FUND_W, g('taxFin'), 'in', { kind: 'financeTax', unit: 'bn' })];
  return out;
}

/* What happens inside Luxembourg: sources feed one pool, the pool splits into uses.
   type: ext = arrives from abroad, dom = from within, stay = stays, leave = leaves again. */
export function inside(family, level, s, t) {
  const g = k => s[k][t];
  if (family === 'people') {
    if (level === 'gr') return { pool: 'jobs', unit: 'k', sources: [{ key: 'resWorkers', val: g('resJobs'), type: 'dom' }, { key: 'fromFR', val: g('xFR'), type: 'ext' }, { key: 'fromBE', val: g('xBE'), type: 'ext' }, { key: 'fromDE', val: g('xDE'), type: 'ext' }],
      uses: [{ key: 'secF', val: g('jobsF'), type: 'stay' }, { key: 'secT', val: g('jobsT'), type: 'stay' }, { key: 'secI', val: g('jobsI'), type: 'stay' }, { key: 'secD', val: g('jobsD'), type: 'stay' }] };
    let arrived = 0; for (let i = 1; i <= t; i++) arrived += s.migration[i];
    const natural = g('pop') - s.pop[0] - arrived, inWork = g('resJobs') + 14.1;   // residents working for foreign and international employers
    return { pool: 'residents', unit: 'k', sources: [{ key: 'pop2025', val: s.pop[0] + Math.min(0, natural), type: 'dom' }, { key: 'natural', val: Math.max(0, natural), type: 'dom' }, { key: 'arrived', val: Math.max(0, arrived), type: 'ext' }],
      uses: [{ key: 'inWork', val: inWork, type: 'stay' }, { key: 'notInWork', val: g('pop') - inWork, type: 'stay' }] };
  }
  if (family === 'money') {
    const k = g('gdp') / g('gva'), home = g('gni');   // GNI = GDP + pay residents earn abroad - commuter pay - profits to foreign owners
    return { pool: 'gdp', unit: 'bn', sources: [{ key: 'vaF', val: g('vaF') * k, type: 'ext' }, { key: 'vaT', val: g('vaT') * k, type: 'dom' }, { key: 'vaI', val: g('vaI') * k, type: 'dom' }, { key: 'vaD', val: g('vaD') * k, type: 'dom' }, { key: 'payAbroad', val: g('wOut'), type: 'ext' }],
      uses: [{ key: 'gniHome', val: home, type: 'stay' }, { key: 'commuterPay', val: g('wX'), type: 'leave' }, { key: 'propertyIncome', val: g('pInc'), type: 'leave' }] };
  }
  if (family === 'trade') return { pool: 'supply', unit: 'bn', sources: [{ key: 'imports', val: g('imports'), type: 'ext' }, { key: 'made', val: g('gdp'), type: 'dom' }],
    uses: [{ key: 'exports', val: g('exports'), type: 'leave' }, { key: 'usedHere', val: g('gdp') + g('imports') - g('exports'), type: 'stay' }] };
  const abroad = g('pensAbroad') + g('famAbroad') + g('healthAbroad'), bal = g('balance');
  const src = [{ key: 'taxCommuters', val: g('taxFromCommuters'), type: 'ext' }, { key: 'taxFinance', val: g('taxFin'), type: 'ext' }, { key: 'taxResidents', val: g('rev') - g('taxFromCommuters') - g('taxFin'), type: 'dom' }];
  const use = [{ key: 'servicesHome', val: g('spend') - abroad, type: 'stay' }, { key: 'benefitsAbroad', val: abroad, type: 'leave' }];
  // the pension scheme's surplus goes to its reserve and its deficit is drawn from it; only the rest is borrowed
  const scheme = g('schemeBal'), other = bal - scheme, drawn = scheme < 0 && g('reserve') > 0 ? -scheme : 0, borrow = Math.max(0, -other) + (scheme < 0 ? -scheme - drawn : 0);
  if (borrow > 0) src.push({ key: 'borrowing', val: borrow, type: 'dom' });
  if (drawn > 0) src.push({ key: 'fromReserve', val: drawn, type: 'dom' });
  if (other > 0) use.push({ key: 'surplus', val: other, type: 'stay' });
  if (scheme > 0) use.push({ key: 'toReserve', val: scheme, type: 'stay' });
  return { pool: 'budget', unit: 'bn', sources: src, uses: use };
}
