/* The 20 scenarios. Each one shifts model inputs; k is intensity (1 = default size),
   t0 the first affected year index, dir the direction for two-sided scenarios. */
import { T, BASE } from './model.js';

const span = (t0, n, f) => { for (let i = 0; i < n && t0 + i <= T; i++) f(t0 + i, i); };
const from = (t0, f) => { for (let t = t0; t <= T; t++) f(t, t - t0); };
const ramp = (i, n) => Math.min(1, (i + 1) / n);
const ALL = ['F', 'T', 'I', 'D'];

export const SCENARIOS = [
  { id: 'crisis', family: 'global', basis: 'history', apply(inp, k, t0) {
      span(t0, 3, (t, i) => { inp.rMkt[t] += k * [-0.19, 0.05, 0.03][i]; inp.gEA[t] += k * [-0.04, 0.01, 0.01][i]; });
      span(t0, 2, (t, i) => { inp.nSales[t] += k * [-0.03, -0.015][i]; });
      inp.dRate[t0] -= 0.015 * k; if (t0 + 3 <= T) inp.dRate[t0 + 3] += 0.01 * k; } },
  { id: 'tradewar', family: 'global', basis: 'source', apply(inp, k, t0) {
      span(t0, 3, t => { inp.gEA[t] -= 0.003 * k; inp.demAdd.I[t] -= 0.006 * k; inp.demAdd.T[t] -= 0.003 * k; });
      inp.rMkt[t0] -= 0.04 * k; } },
  { id: 'energy', family: 'global', basis: 'history', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.energy[t] *= 1 + k * (i < 3 ? [0.8, 0.5, 0.25][i] : 0.1); });
      span(t0, 2, (t, i) => { inp.gEA[t] -= k * [0.008, 0.003][i]; });
      inp.dRate[t0] += 0.01 * k; if (t0 + 2 <= T) inp.dRate[t0 + 2] -= 0.01 * k; } },
  { id: 'stagnation', family: 'global', basis: 'assumption', apply(inp, k, t0) {
      span(t0, 10, t => { inp.gEA[t] -= 0.01 * k; inp.gProdN[t] -= 0.004 * k; inp.rMkt[t] -= 0.01 * k; }); } },
  { id: 'cmu', family: 'global', basis: 'assumption', apply(inp, k, t0) {
      span(t0, 10, (t, i) => { inp.nSales[t] += 0.01 * k * ramp(i, 2); inp.gEA[t] += 0.001 * k; }); } },

  { id: 'saturation', family: 'lux', basis: 'source', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.sMaxMul[t] *= Math.max(0.3, 1 - 0.18 * k * ramp(i, 5)); inp.poolAdd[t] -= 0.004 * k; }); } },
  { id: 'friction', family: 'lux', basis: 'assumption', apply(inp, k, t0) {
      from(t0, t => { inp.commuteGain[t] *= Math.max(0.2, 1 - 0.25 * k); inp.sMaxMul[t] *= 1 - 0.05 * k; });
      span(t0, 3, t => { inp.tfpAdd.T[t] -= 0.002 * k; }); } },
  { id: 'housing', family: 'lux', basis: 'history', twoSided: true, apply(inp, k, t0, dir) {
      // build-out climbs to the record of 4,440 dwellings (2008); gridlock stays at the 2025 rate instead of recovering
      from(t0, (t, i) => { const b = inp.completions[t];
        inp.completions[t] = dir > 0 ? b + k * Math.max(0, 4.44 - b) * ramp(i, 6) : Math.max(1.5, b - k * Math.max(0, b - inp.completions[0])); }); } },
  { id: 'pension', family: 'lux', basis: 'source', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.tau[t] += 0.02 * k; inp.benMul[t] *= 1 - 0.05 * k * ramp(i, 8); inp.partAdd[t] += 0.08 * k * ramp(i, 8); }); } },
  { id: 'erosion', family: 'lux', basis: 'literature', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.nSales[t] -= k * (i < 10 ? 0.02 : 0.01); inp.finTaxMul[t] *= 1 - 0.15 * k * ramp(i, 5); });
      span(t0, 10, t => { inp.demAdd.F[t] -= 0.005 * k; }); } },

  { id: 'aiboom', family: 'tech', basis: 'assumption', apply(inp, k, t0) {
      span(t0, 10, (t, i) => { const r = ramp(i, 2); for (const s of ALL) inp.tfpAdd[s][t] += 0.006 * k * r;
        inp.gProdN[t] += 0.006 * k * r; inp.gEA[t] += 0.004 * k * r; inp.rMkt[t] += 0.01 * k * r; }); } },
  { id: 'automation', family: 'tech', basis: 'assumption', apply(inp, k, t0) {
      span(t0, 8, t => { inp.tfpAdd.F[t] += 0.02 * k; inp.tfpAdd.T[t] += 0.004 * k; }); } },
  { id: 'compute', family: 'tech', basis: 'source', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.privInvAdd[t] += k * (i < 6 ? 0.008 : 0.003); inp.energyImportMul[t] *= 1 + 0.25 * k * ramp(i, 6); });
      span(t0, 6, t => { inp.pubInvAdd[t] += 0.002 * k; });
      span(t0 + 2, 8, t => { inp.demAdd.T[t] += 0.004 * k; }); } },
  { id: 'niche', family: 'tech', basis: 'assumption', apply(inp, k, t0) {
      span(t0, 10, t => { inp.nSales[t] += 0.01 * k; inp.demAdd.F[t] += 0.002 * k; });
      from(t0, t => { inp.etaAdd[t] += 0.1 * k; }); } },
  { id: 'laggard', family: 'tech', basis: 'assumption', apply(inp, k, t0) {
      span(t0, 10, t => { inp.gProdN[t] += 0.005 * k; for (const s of ALL) inp.tfpAdd[s][t] += 0.001 * k;
        inp.demAdd.T[t] -= 0.002 * k; inp.demAdd.F[t] -= 0.001 * k; }); } },   // half of the yearly productivity gap is lost in market share, beyond the cost effect

  { id: 'ageing', family: 'demo', basis: 'source', apply(inp, k, t0) {
      from(t0, t => { inp.poolAdd[t] -= 0.01 * k; });
      span(t0, 15, t => { inp.nbrWage[t] += 0.004 * k; }); } },
  { id: 'immigration', family: 'demo', basis: 'literature', twoSided: true, apply(inp, k, t0, dir) {
      from(t0, t => { inp.Fmul[t] *= Math.max(0.2, 1 + 0.3 * k * dir); inp.sigmaAdd[t] += 0.1 * k * dir; inp.otherMigAdd[t] += 1.5 * k * dir; }); } },
  { id: 'worklonger', family: 'demo', basis: 'assumption', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.partAdd[t] += 0.15 * k * ramp(i, 10); inp.benMul[t] *= 1 - 0.04 * k * ramp(i, 10); }); } },
  { id: 'carbon', family: 'demo', basis: 'source', apply(inp, k, t0) {
      from(t0, (t, i) => { inp.fuelAdd[t] -= 0.08 * k; inp.energy[t] *= 1 + 0.15 * k * ramp(i, 5); });
      span(t0, 5, t => { inp.demAdd.I[t] -= 0.003 * k; }); } },
  { id: 'transition', family: 'demo', basis: 'source', apply(inp, k, t0) {
      span(t0, 10, t => { inp.pubInvAdd[t] += 0.006 * k; inp.privInvAdd[t] += 0.006 * k; inp.tfpAdd.I[t] += 0.001 * k; });
      from(t0 + 3, (t, i) => { inp.energyImportMul[t] *= Math.max(0.5, Math.pow(1 - 0.03 * k, i + 1)); }); } },
];
export const FAMILIES = ['global', 'lux', 'tech', 'demo'];
export const byId = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));

/* active = [{id, k, year, dir}] -> function that applies them all to an input set */
export const compose = active => (active && active.length) ? (inp => { for (const a of active) byId[a.id].apply(inp, a.k ?? 1, Math.max(1, (a.year ?? 2028) - BASE), a.dir ?? 1); }) : null;
