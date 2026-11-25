/* Luxembourg Outlook Simulator, model v0.2
   Annual engine, base year 2025, horizon 2046.
   Closure: what Luxembourg can sell sets the jobs firms want; residents, immigrants and commuters set the workers
   available. Pay moves when the two differ, and pay moves both sales (through unit labour costs) and the inflow
   of foreign workers (through relative income). Demand rules the first years, labour supply the long run.
   Every number lives in the parameter register P with a label: data (published figure), literature (from a
   published model or study), estimated (from the quarterly data, with a bootstrap interval), assumption (judgement). */

import { CALIB } from './calib.js';
import { SHORTRUN } from './shortrun.js';

export const REF = CALIB.ref || {};                                   // published figures the baseline is compared with
export const BASE = 2025, END = 2046, T = END - BASE;           // 21 simulated years
export const YEARS = Array.from({ length: T + 1 }, (_, i) => BASE + i);
export const SECTORS = ['F', 'T', 'I', 'D'];                     // finance, traded services, industry+construction, domestic+public
export const POOLS = ['FR', 'BE', 'DE'];

const p = (v, label, src, lo, hi) => ({ v, label, src, lo, hi });
export const P = {
  // ---- starting levels ----
  gdp0:        p(89.5,  'data', 'STATEC, Luxembourg in figures 2026 (GDP 2025, EUR bn)'),
  pop0:        p(691,   'data', 'STATEC, residents on 1 January 2026 (thousand)'),
  commuters0:  p(237.2, 'data', 'STATEC, incoming cross-border workers 2025 (thousand)'),
  shareFR:     p(0.542, 'data', 'STATEC Regards 01/2026, share of commuters living in France, 2023'),
  shareBE:     p(0.227, 'data', 'STATEC Regards 01/2026, Belgium, 2023'),
  shareDE:     p(0.230, 'data', 'STATEC Regards 01/2026, Germany, 2023'),
  resJobs0:    p(285,   'assumption', 'Residents in domestic employment: labour force 318,200 less unemployed and outbound workers', 278, 292),
  outbound0:   p(14.1,  'data', 'STATEC Regards 01/2026, residents working for foreign or international employers (thousand)'),
  aum0:        p(6797,  'data', 'CSSF, fund net assets 30 September 2026 (EUR bn), used as the 2025 starting level'),
  debt0:       p(23.7,  'data', 'STATEC, public debt 2025 (EUR bn)'),
  reserve0:    p(30,    'assumption', 'Pension reserve 2025 (EUR bn); IGSS reports 31.4% of GDP in 2022'),
  benefits0:   p(7.0,   'assumption', 'General-scheme pension benefits 2025 (EUR bn), from reserve = 4.4 years of benefits (IGSS)'),
  exports0:    p(185,   'data', 'Exports of goods and services 2025 (EUR bn)'),
  imports0:    p(156,   'data', 'Imports of goods and services 2025 (EUR bn)'),
  gniGap0:     p(0.346, 'data', 'CNFP note April 2026: GDP minus GNI was 34.6% of GDP in 2024'),
  // ---- sector structure (shares of value added and of jobs) ----
  vaF: p(0.25, 'literature', 'Finance share of value added; 26.9% in LOLA 3.0 calibration (2014)', 0.23, 0.27),
  vaT: p(0.28, 'assumption', 'Other traded services share of value added', 0.25, 0.31),
  vaI: p(0.11, 'assumption', 'Industry and construction share of value added', 0.10, 0.13),
  jobF: p(0.105, 'literature', 'Finance share of jobs; 11.0% in LOLA 3.0 calibration (2014)', 0.10, 0.11),
  jobT: p(0.30, 'assumption', 'Other traded services share of jobs'),
  jobI: p(0.16, 'assumption', 'Industry and construction share of jobs'),
  wF: p(135, 'assumption', 'Compensation per job, finance (EUR thousand)'),
  wT: p(88,  'assumption', 'Compensation per job, traded services'),
  wI: p(68,  'assumption', 'Compensation per job, industry and construction'),
  wD: p(76,  'assumption', 'Compensation per job, domestic and public services'),
  commuterPay: p(0.83, 'literature', 'Commuter pay relative to average compensation per job; set so pay leaving the country matches EUR 17.1 bn in 2024 (CNFP)', 0.79, 0.87),
  // ---- labour ----
  eps:      p(3.4,  'literature', 'Elasticity of foreign-worker inflow to relative income (STATEC Bulletin 3-17)', 2.4, 4.4),
  Fbar:     p(9.0,  'assumption', 'Foreign workers who come per year at today\'s relative income (thousand); set so the labour market starts in balance', 7.5, 10.5),
  sigma:    p(0.45, 'literature', 'Share of foreign inflow that settles as immigrants; STATEC used 50%, recent job creation leans to commuters', 0.34, 0.60),
  kappa:    p(1.0,  'assumption', 'Fall in the settling share per unit of housing pressure', 0.4, 1.6),
  otherMig: p(3.5,  'assumption', 'Net migration not tied to new jobs: family, study, protection (thousand a year)', 2, 5),
  uStar:    p(0.055,'assumption', 'Unemployment rate at which the labour market is balanced', 0.045, 0.065),
  lambda:   p(0.6,  'assumption', 'Extra real pay growth when firms want 1% more workers than come forward (points)', 0.3, 0.9),
  wFloor:   p(-0.005, 'assumption', 'Lowest yearly change of real pay per job; wage indexation limits cuts', -0.015, 0),
  stretch:  p(0.5,  'assumption', 'Share of the workers wanted beyond the normal inflow that firms still find within the year', 0.3, 0.7),
  spill:    p(0.35, 'assumption', 'Share of would-be commuters who settle in Luxembourg instead when the border districts run short', 0.15, 0.55),
  theta:    p(0.8,  'literature', 'Share of extra productivity growth passed into pay; "below one" in STATEC Bulletin 3-17', 0.6, 0.95),
  poolFR:   p(1217, 'assumption', 'Working-age residents within commuting distance, France (thousand)'),
  poolBE:   p(379,  'assumption', 'Working-age residents within commuting distance, Belgium (thousand)'),
  poolDE:   p(701,  'assumption', 'Working-age residents within commuting distance, Germany (thousand)'),
  headFR:   p(1.65, 'assumption', 'How far the commuting share of the French border districts can rise, as a multiple of today', 1.3, 2.0),
  headBE:   p(1.5,  'assumption', 'Same ceiling for the Belgian border districts', 1.2, 1.8),
  headDE:   p(1.6,  'assumption', 'Same ceiling for the German border districts', 1.25, 1.95),
  poolGFR:  p(-0.004, 'assumption', 'Yearly change of the French pool (ageing)', -0.008, 0),
  poolGBE:  p(-0.002, 'assumption', 'Yearly change of the Belgian pool', -0.006, 0.002),
  poolGDE:  p(-0.007, 'assumption', 'Yearly change of the German pool', -0.011, -0.003),
  moveOut:  p(0.02, 'assumption', 'Share of resident workers who move across the border per unit of housing pressure', 0.01, 0.04),
  // ---- demand and productivity ----
  muT: p(2.1, 'assumption', 'Elasticity of traded-services output to euro area GDP', 1.7, 2.5),
  eaFin: p(1.3, 'assumption', 'Elasticity of banking and insurance output to euro area GDP', 0.9, 1.7),
  muI: p(0.8, 'assumption', 'Elasticity of industrial output to euro area GDP', 0.5, 1.1),
  gammaC: p(2.0, 'assumption', 'Long-run fall in traded-services and industry sales when unit labour costs rise 1% against competitors (%); finance, tied to assets and regulation, reacts 30% as much', 1.2, 3.0),
  compAdj: p(0.3, 'assumption', 'Share of that cost effect on sales that arrives each year', 0.2, 0.45),
  etaA: p(0.6, 'assumption', 'Elasticity of fund-service output to real fund assets', 0.4, 0.8),
  thFund: p(0.50, 'assumption', 'Weight of fund services in finance'),
  thBank: p(0.35, 'assumption', 'Weight of banking in finance'),
  tfpF: p(0.011, 'assumption', 'Baseline productivity growth, finance', 0.004, 0.016),
  tfpT: p(0.010, 'assumption', 'Baseline productivity growth, traded services', 0.004, 0.014),
  tfpI: p(0.008, 'assumption', 'Baseline productivity growth, industry and construction', 0.003, 0.013),
  tfpD: p(0.006, 'assumption', 'Baseline productivity growth, domestic and public services', 0.001, 0.009),
  prodStart: p(0.4, 'assumption', 'Share of the productivity growth below that is reached in 2026; it rises to the full rate by 2036. STATEC expects output per job to grow 0.1% to 0.4% a year to 2029', 0.2, 0.7),
  incD: p(0.75, 'assumption', 'Response of domestic demand per head to productivity growth', 0.5, 1.0),
  commSpend: p(0.2, 'assumption', 'Weight of one commuter in domestic demand, relative to one resident', 0.1, 0.3),
  // ---- income accounts ----
  piF: p(0.75,  'assumption', 'Share of finance profits paid abroad as property income', 0.6, 0.9),
  piO: p(0.57, 'assumption', 'Share of non-finance corporate profits paid abroad; set so GNI is 65% of GDP as in 2024 (CNFP)', 0.45, 0.7),
  prodTax: p(0.11, 'assumption', 'Taxes on products as a share of value added'),
  // ---- public finances, EUR bn 2025 ----
  rev0:      p(42.17, 'data', 'STATEC, general government revenue (as reported in Luxembourg in figures 2026)'),
  balance0:  p(-0.9,  'assumption', 'Starting balance; STATEC forecast -0.4% to -1.0% of GDP, reported figure -2.0%', -1.8, -0.3),
  rSoc: p(11.5, 'assumption', 'Social contributions'), rWage: p(9.0, 'assumption', 'Wage and personal income tax'),
  rCorpF: p(3.0, 'assumption', 'Corporate taxes paid by finance'), rCorpO: p(2.5, 'assumption', 'Corporate taxes, other sectors'),
  rVat: p(5.8, 'data', 'VAT receipts 2025 (Ministry of Finance budget tables)'), rFuel: p(0.8, 'assumption', 'Fuel excise'),
  rTob: p(1.2, 'data', 'Tobacco excise 2025 (Ministry of Finance budget tables)'), rAbo: p(1.32, 'data', 'Subscription tax 2025 (Ministry of Finance)'),
  sPensOther: p(1.5, 'assumption', 'Pensions outside the general scheme'), sHealth: p(6.5, 'assumption', 'Health and long-term care'),
  sFamily: p(5.5, 'assumption', 'Family and other social benefits'), sWages: p(14.0, 'assumption', 'Public wages and services'),
  sInvest: p(3.9, 'assumption', 'Public investment'),
  fuelTrend: p(-0.03, 'assumption', 'Yearly change in fuel volumes sold', -0.06, -0.01),
  wageTaxEl: p(1.2, 'assumption', 'Elasticity of wage tax to real pay per job', 1.0, 1.4),
  realRate: p(0.01, 'assumption', 'Real interest rate on public debt', 0, 0.02),
  // ---- pensions (general scheme) ----
  tau0: p(0.255, 'data', 'Contribution rate from January 2026 (law of 19 December 2025)'),
  wIns0: p(31.2, 'assumption', 'Insured wage bill 2025 (EUR bn): benefits divided by a 23% pay-as-you-go premium'),
  gBen: p(0.0385, 'literature', 'Real growth of benefits, set so the pre-reform run reproduces the IGSS dates (2033, 2041, 2047)', 0.0345, 0.0425),
  benWage: p(0.5, 'assumption', 'Pass-through of real wage surprises to benefits (readjustment)', 0.3, 0.7),
  resShare: p(0.7, 'assumption', 'Return on the pension reserve as a share of the blended market return (a balanced portfolio)', 0.5, 0.9),
  nonResPens: p(0.38, 'assumption', 'Share of benefit spending paid to non-residents; 50% of pensions by number (IGSS)', 0.32, 0.44),
  // ---- housing ----
  stock0: p(290, 'assumption', 'Dwellings 2025 (thousand)'), replace: p(0.5, 'assumption', 'Dwellings replaced per year (thousand)', 0.3, 0.8),
  compl0: p(2.8, 'assumption', 'Dwellings completed per year at the start (thousand)'),
  complLR: p(3.6, 'assumption', 'Baseline completions from 2032 (thousand a year)', 2.8, 4.4),
  // ---- foreign baseline ----
  gEA: p(0.012, 'assumption', 'Euro area growth after 2029; 0.8% in 2026 and 1.6% in 2027 to 2029 follow STATEC\'s assumptions', 0.008, 0.016),
  rMkt: p(0.03, 'assumption', 'Real return on a blended fund portfolio after 2029', 0.015, 0.04),
  nSales: p(0.012, 'assumption', 'Net new money into Luxembourg funds, share of assets per year', 0.004, 0.02),
  gProdN: p(0.008, 'assumption', 'Productivity growth in FR, BE, DE', 0.005, 0.011),
  // ---- uncertainty (yearly standard deviations) ----
  sdMkt: p(0.075, 'assumption', 'Volatility of the blended return'), sdEA: p(0.013, 'assumption', 'Volatility of euro area growth'),
  sdEnergy: p(0.18, 'assumption', 'Volatility of energy prices'),
};

/* Published figures replace the first guesses wherever the downloaded data covers them.
   A figure that rests on a split or a judgement of ours stays an assumption; ranges are kept. */
for (const k in CALIB.params) if (P[k]) {
  const c = CALIB.params[k], own = /\(assumption\)|baseline returns/.test(c.src), proj = /projection/.test(c.src), keep = own || proj;
  P[k] = { v: c.v, label: own ? 'assumption' : proj ? 'literature' : 'data', src: c.src, lo: c.lo ?? (keep ? P[k].lo : undefined), hi: c.hi ?? (keep ? P[k].hi : undefined) };
}

/* Short-run responses from the quarterly data (data/estimate.py), with 90% bootstrap intervals.
   They apply to deviations of the foreign inputs from their baseline paths. */
{
  const E = SHORTRUN.params, how = '; vector autoregression on ' + SHORTRUN.meta.quarters + ' quarters, ' + SHORTRUN.meta.sample + ', 90% interval from ' + SHORTRUN.meta.bootstrap + ' bootstrap draws';
  const est = (k, what, mul = 1) => ({ v: +(E[k].v * mul).toFixed(3), label: 'estimated', src: what + how, lo: +(E[k].lo * mul).toFixed(3), hi: +(E[k].hi * mul).toFixed(3) });
  P.srFea = est('srFea', 'Response of finance output to a 1% deviation of euro area GDP, share prices held fixed (%)');
  P.srNFea = est('srNFea', 'Response of output outside finance to a 1% deviation of euro area GDP, share prices held fixed (%)');
  P.srFmkt = est('srFmkt', 'Response of finance output to a 1% deviation of fund portfolio returns (%); share prices weigh 45%', 1 / 0.45);
  P.srFrate = { v: 0, label: 'assumption', lo: -1.5, hi: 1.5, src: 'Response of finance output to a one-point rise of the interest rate (%). The data do not pin it down (estimate ' + E.srFrate.v.toFixed(1) + ', 90% interval ' + E.srFrate.lo.toFixed(1) + ' to ' + E.srFrate.hi.toFixed(1) + ', and the estimated shock is not a clean tightening), so it is set to zero' };
  P.cycCom = est('cycCom', 'Share of cyclical job losses that falls on commuters');
  P.empEl = est('empEl', 'Change in jobs per 1% change in output after three to five years (%); the rest shows up as output per job');
  P.jobAdj = est('jobAdj', 'Share of the gap between jobs wanted and jobs held that closes within a year');
}

/* Age structure: 18 five-year groups, thousand people (Eurostat), scaled to pop0. */
const AGE0 = CALIB.age;
const MORT = [.0006, .0003, .0003, .0003, .0003, .0003, .0003, .0003, .0008, .0013, .0022, .0035, .0057, .0095, .016, .028, .052, .14];
const PART = [0, 0, 0, .08, .50, .80, .80, .80, .80, .80, .80, .62, .22, .04, 0, 0, 0, 0];
const MIGW = [.06, .05, .04, .05, .16, .22, .16, .10, .06, .04, .02, .01, .01, .01, .01, 0, 0, 0];
const HEAD = [0, 0, 0, 0, .15, .38, .48, .55, .55, .55, .55, .55, .55, .62, .62, .62, .68, .68];
const CARE = [.5, .5, .5, .5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 7, 7];
const TFR = 1.27;
const COMP = { F: 0.3, T: 1, I: 0.5 };        // how much of each sector's output answers to unit labour costs (half of I is construction)
const CYC = { F: 1, T: 1.3, I: 1.3, D: 0.7 };  // spread of the euro area response outside finance: traded sectors react more

const sum = a => a.reduce((x, y) => x + y, 0);
const dot = (a, b) => a.reduce((x, y, i) => x + y * b[i], 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* Baseline inputs: one value per year (index 0 = 2025). */
const prodRamp = (v, t) => v.prodStart + (1 - v.prodStart) * clamp((t - 1) / 10, 0, 1);   // productivity growth starts low, here and next door
const baseEA = (v, y) => y === 2026 ? 0.008 : y <= 2029 ? 0.016 : v.gEA, baseRet = (v, y) => y <= 2029 ? Math.min(0.02, v.rMkt) : v.rMkt;
export function baselineInputs(v) {
  const arr = f => Array.from({ length: T + 1 }, (_, t) => f(t, BASE + t));
  return {
    gEA: arr((t, y) => baseEA(v, y)),
    rMkt: arr((t, y) => baseRet(v, y)),
    nSales: arr(() => v.nSales),
    dRate: arr(() => 0),                    // change in the short rate, points
    energy: arr(() => 1),                   // real energy price index
    gProdN: arr(t => v.gProdN * prodRamp(v, t)),
    nbrWage: arr(() => 0),                  // extra wage growth next door
    poolAdd: arr(() => 0),                  // extra yearly pool change
    sMaxMul: arr(() => 1), commuteGain: arr(() => 1), Fmul: arr(() => 1), sigmaAdd: arr(() => 0), otherMigAdd: arr(() => 0),
    tfpAdd: { F: arr(() => 0), T: arr(() => 0), I: arr(() => 0), D: arr(() => 0) },
    demAdd: { F: arr(() => 0), T: arr(() => 0), I: arr(() => 0), D: arr(() => 0) },
    completions: arr((t, y) => v.compl0 + (v.complLR - v.compl0) * clamp((y - 2025) / 7, 0, 1)),
    tau: arr(() => v.tau0), benMul: arr(() => 1),
    partAdd: arr(() => 0),                  // added participation of people aged 55 to 69, points
    finTaxMul: arr(() => 1), fuelAdd: arr(() => 0), pubInvAdd: arr(() => 0), privInvAdd: arr(() => 0),
    energyImportMul: arr(() => 1), etaAdd: arr(() => 0), reform: true,
  };
}

export const values = (reg = P) => Object.fromEntries(Object.entries(reg).map(([k, e]) => [k, e.v]));

/* One 21-year run. v = parameter values, inp = inputs (after scenarios and random shocks). */
export function simulate(v, inp) {
  const out = {};
  const S = k => (out[k] = out[k] || new Array(T + 1).fill(0));
  // ---------- initial state ----------
  const scale = v.pop0 / sum(AGE0);
  let N = AGE0.map(x => x * scale);
  const va0 = v.gdp0 / (1 + v.prodTax);
  const vaShare = { F: v.vaF, T: v.vaT, I: v.vaI, D: 1 - v.vaF - v.vaT - v.vaI };
  const jobShare = { F: v.jobF, T: v.jobT, I: v.jobI, D: 1 - v.jobF - v.jobT - v.jobI };
  const E0 = v.resJobs0 + v.commuters0;
  let Y = {}, E = {}, pi = {}, w = { F: v.wF, T: v.wT, I: v.wI, D: v.wD };
  for (const s of SECTORS) { Y[s] = va0 * vaShare[s]; E[s] = E0 * jobShare[s]; pi[s] = Y[s] / E[s] * 1.011 / (1 + 0.011 / v.jobAdj); }  // start on a steady path: jobs trail wanted jobs by the usual gap
  const share0 = { FR: v.shareFR, BE: v.shareBE, DE: v.shareDE };
  let X = { FR: v.commuters0 * v.shareFR, BE: v.commuters0 * v.shareBE, DE: v.commuters0 * v.shareDE };
  let pool = { FR: v.poolFR, BE: v.poolBE, DE: v.poolDE };
  const sMax = { FR: v.headFR * X.FR / v.poolFR, BE: v.headBE * X.BE / v.poolBE, DE: v.headDE * X.DE / v.poolDE }, poolG = { FR: v.poolGFR, BE: v.poolGBE, DE: v.poolGDE };
  // participation rates are scaled so that residents in work in 2025 match the data at normal unemployment
  const partScale = (v.resJobs0 + v.outbound0) / ((1 - v.uStar) * dot(N, PART)), PART0 = PART.map(x => x * partScale);
  const actImm = dot(MIGW, PART0) * (1 - v.uStar);                 // workers per migrant, from the age profile of migrants
  const prodFull = sum(SECTORS.map(s => jobShare[s] * v['tfp' + s])), ramp = t => prodRamp(v, t);
  let A = v.aum0, omega = 1, wIdx = 1, tight = 0, tauW = 0, rate = 0, fuelVol = 1, tobVol = 1;
  let ulc = { F: 0, T: 0, I: 0 }, comp = { F: 0, T: 0, I: 0 };     // log relative unit labour costs, and their effect on sales so far
  let debt = v.debt0, reserve = v.reserve0, B = v.benefits0, pensOther = v.sPensOther;
  let stock = v.stock0, U = 0, Hp = 1, prodTrendPrev = prodFull * ramp(1), gGdpPrev = 0.015, wNorm = 1;
  const hh = n => dot(n, HEAD), care = n => dot(n, CARE), kids = n => n[0] + n[1] + n[2] + n[3];
  let HH = hh(N), LF = dot(N, PART0), Uex = 0, pulled = 0;         // residents out of work beyond the normal rate; residents drawn in by a tight market
  const base = { pop: sum(N), care: care(N), kids: kids(N), X: v.commuters0, E: E0 };
  const gosOf = () => Object.fromEntries(SECTORS.map(s => [s, Y[s] - E[s] * w[s] * wIdx / 1000]));
  const gos0 = gosOf();
  const W0 = sum(SECTORS.map(s => E[s] * w[s] / 1000));
  const cons0 = v.gdp0 * (1 - v.gniGap0);
  const spendOther0 = (v.rev0 - v.balance0) - (v.benefits0 * 1.025 + v.sPensOther + v.sHealth + v.sFamily + v.sWages + v.sInvest + v.realRate * v.debt0);
  const revOther0 = v.rev0 - (v.rSoc + v.rWage + v.rCorpF + v.rCorpO + v.rVat + v.rFuel + v.rTob + v.rAbo);
  let Mprev = 7.8, resEmp = v.resJobs0, need0 = 0, sup0 = 0;

  const record = (t, x) => { for (const k in x) S(k)[t] = x[k]; };
  const snapshot = (t, extra) => {
    const gva = sum(SECTORS.map(s => Y[s])), gdp = gva * (1 + v.prodTax);
    const gos = gosOf(), Wb = sum(SECTORS.map(s => E[s] * w[s] * wIdx / 1000));
    const Xtot = X.FR + X.BE + X.DE, Etot = sum(SECTORS.map(s => E[s]));
    const wAvg = Wb / Etot * 1000;
    const wX = Xtot * wAvg * v.commuterPay / 1000, wOut = v.outbound0 * 155 * wIdx / 1000;
    const pInc = v.piF * gos.F + v.piO * (gos.T + gos.I);
    const gni = gdp - wX + wOut - pInc, pop = sum(N);
    // ---- public finances ----
    const pensContrib = (2 / 3) * (extra.tau) * v.wIns0 * Wb / W0;
    const soc = (v.rSoc - (2 / 3) * 0.24 * v.wIns0) * Wb / W0 + pensContrib;
    const wageTax = v.rWage * (Etot / base.E) * Math.pow(wAvg / (W0 / base.E * 1000), v.wageTaxEl);
    const corpF = v.rCorpF * gos.F / gos0.F * extra.finTaxMul;
    const corpO = v.rCorpO * (gos.T + gos.I + 0.3 * gos.D) / (gos0.T + gos0.I + 0.3 * gos0.D);
    const vat = v.rVat * (0.75 * gni / cons0 + 0.12 * (Xtot * wIdx) / base.X + 0.13 * Y.F / (va0 * vaShare.F));
    const fuel = v.rFuel * fuelVol, tob = v.rTob * tobVol, abo = v.rAbo * A / v.aum0 * extra.finTaxMul;
    const revOther = revOther0 * gdp / v.gdp0;
    const rev = soc + wageTax + corpF + corpO + vat + fuel + tob + abo + revOther;
    const popI = pop / base.pop;
    const health = v.sHealth * (0.8 * care(N) / base.care + 0.2 * Xtot / base.X) * wIdx;
    const family = v.sFamily * (0.6 * (0.7 * kids(N) / base.kids + 0.3 * Xtot / base.X) + 0.4 * popI) * Math.sqrt(wIdx) + 0.03 * Math.max(0, Uex);
    const pubWages = v.sWages * Math.pow(popI, 0.9) * wIdx;
    const invest = (v.sInvest / v.gdp0 + extra.pubInvAdd) * gdp;
    const interest = (v.realRate + 0.5 * rate) * debt;
    const pensions = B * 1.025 + pensOther;
    const spend = pensions + health + family + pubWages + invest + interest + spendOther0 * gdp / v.gdp0;
    const balance = rev - spend;
    const contrib = extra.tau * v.wIns0 * Wb / W0;
    const schemeBal = contrib - B * 1.025;
    const comShareW = wX / Wb;
    const idx = s => Y[s] / (va0 * vaShare[s]);
    record(t, {
      gdp, gni, gva, pop, gniPerHead: gni / pop * 1000, gdpPerJob: gdp / Etot * 1000, gniShare: gni / gdp,
      jobs: Etot, resJobs: Etot - Xtot, commuters: Xtot, xFR: X.FR, xBE: X.BE, xDE: X.DE, comShare: Xtot / Etot,
      jobsF: E.F, jobsT: E.T, jobsI: E.I, jobsD: E.D, vaF: Y.F, vaT: Y.T, vaI: Y.I, vaD: Y.D,
      unempRate: v.uStar + (Uex - pulled) / LF, migration: Mprev, omega, tight, wIdx, wPrem: wIdx / wNorm, ulc: ulc.T,
      foreignNeed: need0, foreignSupply: sup0,
      aum: A, wX, wOut, pInc, wageBill: Wb,
      rev, spend, balance, balancePct: balance / gdp * 100, debt, debtPct: debt / gdp * 100,
      reserve, reservePct: reserve / gdp * 100, reserveYears: reserve / B, contrib, benefits: B, schemeBal, premium: B * 1.025 / (v.wIns0 * Wb / W0) * 100,
      pensions, health, taxFin: corpF + abo, aboTax: abo, fuelTax: fuel,
      taxFromCommuters: (soc + wageTax) * comShareW, pensAbroad: B * (v.nonResPens + 0.003 * t), famAbroad: 0.5 * Xtot / base.X * Math.sqrt(wIdx), healthAbroad: 1.3 * Xtot / base.X * wIdx,
      households: HH, completions: extra.completions, shortfall: U, housing: Hp,
      exports: v.exports0 * (0.55 * idx('F') + 0.33 * idx('T') + 0.12 * idx('I')),
      imports: v.imports0 * (0.5 * idx('F') + 0.25 * idx('T') + 0.25 * gni / cons0),
      energyImports: 2.4 * extra.energy * extra.energyImportMul * Math.pow(0.985, t) * popI,
      prodGrowth: prodTrendPrev, gdpGrowth: gGdpPrev,
    });
    return { gdp, balance, schemeBal, contrib, Wb };
  };
  snapshot(0, { tau: 0.24, finTaxMul: 1, pubInvAdd: 0, completions: inp.completions[0], energy: 1, energyImportMul: 1 });

  // ---------- yearly loop ----------
  for (let t = 1; t <= T; t++) {
    const gEA = inp.gEA[t], dR = inp.dRate[t]; rate += dR;
    const dEn = Math.log(inp.energy[t] / inp.energy[t - 1]);
    const dEA = gEA - baseEA(v, BASE + t), dRet = inp.rMkt[t] - baseRet(v, BASE + t);    // deviations of the foreign inputs from their baseline paths
    // 1. productivity, pay and unit labour costs
    const gPi = {}, exS = {}; let prodTrend = 0;
    const baseProd = prodFull * ramp(t); wNorm *= 1 + baseProd;
    for (const s of SECTORS) { exS[s] = inp.tfpAdd[s][t] + 0.25 * inp.privInvAdd[t]; gPi[s] = v['tfp' + s] * ramp(t) + exS[s]; prodTrend += jobShare[s] * gPi[s]; }
    const exL = prodTrend - baseProd, nbrProd = v.gProdN * ramp(t), exN = inp.gProdN[t] - nbrProd;
    const gW = Math.max(v.wFloor, baseProd + v.theta * exL + v.lambda * tauW);            // real pay per job: productivity plus last year's labour-market pressure
    const dComp = {};
    for (const s of ['F', 'T', 'I']) {
      ulc[s] += (gW - baseProd) - exS[s] + (1 - v.theta) * exN;                           // against competitors, whose pay follows their productivity the same way
      const d = v.compAdj * (-v.gammaC * COMP[s] * ulc[s] - comp[s]); comp[s] += d; dComp[s] = d;
    }
    // 2. what Luxembourg can sell
    const gA = inp.rMkt[t] + inp.nSales[t];
    A *= 1 + gA;
    const eta = v.etaA + inp.etaAdd[t];
    const gY = {}, cyc = {};
    cyc.F = v.srFea * dEA + v.srFmkt * dRet + v.srFrate * dR;                             // estimated responses to deviations
    cyc.T = CYC.T * v.srNFea * dEA - 0.01 * dEn; cyc.I = CYC.I * v.srNFea * dEA - 0.02 * dEn; cyc.D = CYC.D * v.srNFea * dEA - 0.02 * dEn;
    gY.F = v.thFund * eta * (gA - dRet) + (1 - v.thFund) * v.eaFin * (gEA - dEA) + cyc.F + dComp.F + inp.demAdd.F[t];
    gY.T = v.muT * (gEA - dEA) + cyc.T + dComp.T + inp.demAdd.T[t] + 0.5 * inp.privInvAdd[t];
    const dCompl = Math.log(inp.completions[t] / inp.completions[t - 1]);
    const gConstr = 0.25 * dCompl + 0.65 * gGdpPrev + 4 * (inp.pubInvAdd[t] - inp.pubInvAdd[t - 1]) + 3 * (inp.privInvAdd[t] - inp.privInvAdd[t - 1]) - 2 * dR;
    gY.I = 0.5 * v.muI * (gEA - dEA) + cyc.I + dComp.I + 0.5 * gConstr + inp.demAdd.I[t];
    // 3. demography (start-of-year population)
    const deaths = N.map((n, g) => n * MORT[g]);
    const births = TFR * 0.5 * (N[3] + N[4] + N[5] + N[6] + N[7] + N[8] + N[9]) / 35;
    const next = N.map((n, g) => (n - deaths[g]) * (g < 17 ? 0.8 : 1));
    for (let g = 0; g < 17; g++) next[g + 1] += (N[g] - deaths[g]) * 0.2;
    next[0] += births;
    const popPrev = sum(N), Xprev = X.FR + X.BE + X.DE, Eprev = sum(SECTORS.map(s => E[s]));
    const popLag = t >= 2 ? S('pop')[t - 2] : popPrev / 1.011, xLag = t >= 2 ? S('commuters')[t - 2] : Xprev / 1.015;
    const popEffG = (popPrev + v.commSpend * Xprev) / (popLag + v.commSpend * xLag) - 1;
    gY.D = popEffG + v.incD * prodTrendPrev + cyc.D + inp.demAdd.D[t] + 0.2 * (gGdpPrev - 0.018);
    // 4. jobs wanted: output over output per job; in a swing, part of the change in output is absorbed by output per job
    const want = {}; let wantTot = 0;
    for (const s of SECTORS) { Y[s] *= 1 + gY[s]; pi[s] *= 1 + gPi[s] + (1 - v.empEl) * cyc[s]; want[s] = E[s] + v.jobAdj * (Y[s] / pi[s] - E[s]); wantTot += want[s]; }
    // 5. workers available
    const part = PART0.map((x, g) => x + (g >= 11 && g <= 13 ? inp.partAdd[t] * (g === 12 ? 1 : 0.4) : 0));
    LF = dot(next, part); pulled *= 0.7;
    const LR = LF * (1 - v.uStar) - v.outbound0 + pulled;                                 // residents available at normal unemployment
    for (const c of POOLS) { pool[c] *= 1 + poolG[c] + inp.poolAdd[t]; X[c] *= 1 - 0.03 * (1 - inp.commuteGain[t]); X[c] = Math.min(X[c], Math.max(0.97 * X[c], sMax[c] * inp.sMaxMul[t] * pool[c])); }
    let Xnow = X.FR + X.BE + X.DE;
    const need = wantTot - (LR + Xnow);                                                   // workers wanted from abroad (or, if negative, workers too many)
    // foreign workers who come forward at today's relative income; commuters thin out as the border districts fill up
    const sig = clamp(v.sigma + inp.sigmaAdd[t] - v.kappa * (Hp - 1), 0.1, 0.8);
    const F = v.Fbar * inp.Fmul[t] * Math.pow(omega, v.eps);
    const wgt = {}; let room = 0;
    for (const c of POOLS) { wgt[c] = share0[c] * Math.max(0, 1 - X[c] / (sMax[c] * inp.sMaxMul[t] * pool[c])) / (1 - 1 / v['head' + c]); room += wgt[c]; }
    const hf = clamp(1 - 2 * (Hp - 1), 0.2, 1);
    const supCom = (1 - sig) * F * inp.commuteGain[t] * room;
    const supImm = F * (sig + v.spill * (1 - sig) * Math.max(0, 1 - inp.commuteGain[t] * room) * hf);
    const sup = supCom + supImm;
    // when fewer foreign workers are needed than normally come, residents share the slack: some stay out of work, half find work each year
    Uex = 0.5 * Uex + (1 - v.cycCom) * Math.max(0, sup - need);
    const Nf = need + Uex;                                                                // foreign workers hired (or, if negative, let go)
    let newCom = 0, newImm = 0, unfilled = 0;
    if (Nf >= 0) {
      const hired = Nf <= sup ? Nf : sup + v.stretch * (Nf - sup);
      unfilled = Nf - hired;
      newCom = hired * supCom / sup; newImm = hired * supImm / sup;
      const pull = Math.max(0, Math.min(0.3 * unfilled, 0.3 * v.uStar * LF - pulled)); pulled += pull; unfilled -= pull;   // a tight market draws some residents out of unemployment
      for (const c of POOLS) X[c] += room > 0 ? newCom * wgt[c] / room : 0;
    } else {
      const cut = Math.min(-Nf, 0.08 * Xnow);
      for (const c of POOLS) X[c] -= cut * X[c] / Xnow;
      Uex += -Nf - cut;
    }
    tauW = (need - sup) / Eprev; need0 = need; sup0 = sup;
    // residents moving across the border and commuting back; unemployed residents who leave
    const movers = v.moveOut * Math.max(0, Hp - 1) * resEmp, leave = 0.15 * Uex;
    X.FR += 0.6 * movers; X.BE += 0.25 * movers; X.DE += 0.15 * movers;
    pool.FR += 0.6 * movers; pool.BE += 0.25 * movers; pool.DE += 0.15 * movers;
    Uex -= leave;
    const M = (newImm - movers - leave) / actImm + v.otherMig + inp.otherMigAdd[t];
    N = next.map((n, g) => Math.max(0, n + M * MIGW[g]));
    Mprev = M;
    tight = unfilled / wantTot;
    for (const s of SECTORS) { E[s] = want[s] * (1 - tight); Y[s] *= 1 - 0.8 * tight; }
    Xnow = X.FR + X.BE + X.DE; resEmp = sum(SECTORS.map(s => E[s])) - Xnow;
    // 6. pay and relative income
    wIdx *= 1 + gW - 0.05 * dEn;                                                          // dearer energy takes a little off real pay, cheaper energy gives it back
    omega *= 1 + gW - (nbrProd + v.theta * exN + inp.nbrWage[t]);
    // 7. housing
    const HHn = hh(N); const needQ = (HHn - HH) + v.replace; HH = HHn;
    U += needQ - inp.completions[t]; stock += inp.completions[t] - v.replace; Hp = 1 + U / stock;
    // 8. pensions and public finances
    const gBen = v.gBen + (inp.reform ? (t >= 2 && t <= 6 ? -0.0015 : 0) : 0) + v.benWage * (gW - baseProd);
    B *= (1 + gBen) * (inp.benMul[t] / inp.benMul[t - 1]);
    pensOther *= 1.02;
    fuelVol *= 1 + v.fuelTrend + inp.fuelAdd[t] - 0.15 * dEn; tobVol *= 0.99;
    const tau = inp.reform ? inp.tau[t] : 0.24 + (inp.tau[t] - v.tau0);
    const gdpBefore = S('gdp')[t - 1];
    const snap = snapshot(t, { tau, finTaxMul: inp.finTaxMul[t], pubInvAdd: inp.pubInvAdd[t], completions: inp.completions[t], energy: inp.energy[t], energyImportMul: inp.energyImportMul[t] });
    // the scheme's surplus goes to its reserve; once the reserve is empty the state covers the shortfall
    reserve = reserve * (1 + v.resShare * inp.rMkt[t]) + snap.schemeBal;
    const shortfall = Math.max(0, -reserve); reserve = Math.max(0, reserve);
    debt = debt - (snap.balance - snap.schemeBal) + shortfall;
    out.reserve[t] = reserve; out.reservePct[t] = reserve / snap.gdp * 100; out.reserveYears[t] = reserve / B;
    out.debt[t] = debt; out.debtPct[t] = debt / snap.gdp * 100;
    gGdpPrev = snap.gdp / gdpBefore - 1; out.gdpGrowth[t] = gGdpPrev; out.prodGrowth[t] = prodTrend; prodTrendPrev = prodTrend;
  }
  return out;
}

/* ---------- random futures ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const MC_PARAMS = Object.keys(P).filter(k => P[k].lo !== undefined && !['gdp0', 'pop0'].includes(k));

export function makeDraws(n = 300, seed = 20261125, reg = P) {
  const r = rng(seed), draws = [];
  for (let i = 0; i < n; i++) {
    const v = values(reg);
    for (const k of MC_PARAMS) { const e = reg[k], u = (r() + r()) / 2; v[k] = clamp(e.v + (e.hi - e.lo) * (u - 0.5), e.lo, e.hi); }
    // market draws carry half their variance as drift: the baseline return is a compound average, so the middle draw must match it
    const sh = { mkt: [0], ea: [0], en: [0] }; let ea = 0, en = 0;
    for (let t = 1; t <= T; t++) { const z1 = gauss(r), z2 = gauss(r), z3 = gauss(r); ea = 0.3 * ea + v.sdEA * z1; en = 0.75 * en + v.sdEnergy * z3; sh.ea.push(ea); sh.mkt.push(v.sdMkt * (0.5 * z1 + Math.sqrt(0.75) * z2) + v.sdMkt * v.sdMkt / 2); sh.en.push(en); }
    draws.push({ v, sh });
  }
  return draws;
}

/* Run one parameter set with a scenario function applied to its inputs. */
export function run(v = values(), applyScenario, shocks) {
  const inp = baselineInputs(v);
  if (shocks) for (let t = 1; t <= T; t++) { inp.gEA[t] += shocks.ea[t]; inp.rMkt[t] += shocks.mkt[t]; inp.energy[t] *= Math.exp(shocks.en[t]); }
  if (applyScenario) applyScenario(inp, v);
  return simulate(v, inp);
}

export function fan(draws, applyScenario, keys) {
  const runs = draws.map(d => run(d.v, applyScenario, d.sh));
  const q = [0.05, 0.25, 0.5, 0.75, 0.95], res = {};
  for (const k of keys) {
    res[k] = q.map(() => new Array(T + 1));
    for (let t = 0; t <= T; t++) { const xs = runs.map(r => r[k][t]).sort((a, b) => a - b); q.forEach((qq, j) => { res[k][j][t] = xs[Math.min(xs.length - 1, Math.floor(qq * xs.length))]; }); }
  }
  return res;
}
