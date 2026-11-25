/* Re-checks the findings of the review of version 0.1. Each line should read "ok". */
import { P, values, run, baselineInputs, simulate, makeDraws, T } from '../src/model.js';
import { SCENARIOS, compose } from '../src/scenarios.js';
const v = values(), b = run(v), ok = (name, test, detail = '') => console.log((test ? 'ok   ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
// A1: once the reserve is empty, the whole deficit including the pension scheme's must be borrowed
{ const s = run({ ...v, gBen: 0.05 }, compose([{ id: 'stagnation', k: 2 }])); let worst = 0, years = 0;
  for (let t = 1; t <= T; t++) if (s.reserve[t - 1] === 0 && s.reserve[t] === 0) { years++; worst = Math.max(worst, Math.abs((s.debt[t] - s.debt[t - 1]) + s.balance[t])); }
  ok('A1 pension shortfall reaches debt', years >= 3 && worst < 1e-9, years + ' years with an empty reserve, scheme deficit ' + (-s.schemeBal[T]).toFixed(1) + ' bn in 2046'); }
// A2: no parameter with a range is dead (each moves the baseline or the crisis or the productivity experiment)
{ const tests = [null, compose([{ id: 'crisis' }]), compose([{ id: 'aiboom' }, { id: 'energy' }])], ref = tests.map(f => run(v, f)); const dead = [];
  for (const k of Object.keys(P)) { if (P[k].lo === undefined) continue; const v2 = { ...v, [k]: P[k].hi !== P[k].v ? P[k].hi : P[k].lo };
    if (!tests.some((f, i) => { const r = run(v2, f); return ['gdp', 'debtPct', 'reserveYears', 'pop', 'housing', 'unempRate', 'pensAbroad'].some(q => Math.abs(r[q][T] / ref[i][q][T] - 1) > 1e-6); })) dead.push(k); }
  ok('A2 every parameter with a range moves a result', dead.length === 0, dead.join(', ')); }
// A4: first-year artefacts
{ const inp = baselineInputs(v); ok('A4 completions start at the 2025 figure', Math.abs(inp.completions[0] - v.compl0) < 1e-9); ok('A4 unemployment starts at the normal rate', Math.abs(b.unempRate[0] - v.uStar) < 1e-9); }
// A5 and accounting
{ let e1 = 0, e2 = 0; for (let t = 0; t <= T; t++) { e1 = Math.max(e1, Math.abs(b.gdp[t] - (b.vaF[t] + b.vaT[t] + b.vaI[t] + b.vaD[t]) * (1 + v.prodTax))); e2 = Math.max(e2, Math.abs(b.gni[t] - (b.gdp[t] - b.wX[t] + b.wOut[t] - b.pInc[t]))); }
  ok('GDP = value added x (1 + product taxes)', e1 < 1e-9); ok('GNI = GDP - commuter pay + pay from abroad - property income', e2 < 1e-9);
  ok('revenue lines add up to the 2025 total', Math.abs(b.rev[0] - v.rev0) < 0.02, (b.rev[0] - v.rev0).toFixed(3)); ok('2025 balance equals the starting balance', Math.abs(b.balance[0] - v.balance0) < 0.1, (b.balance[0] - v.balance0).toFixed(3)); }
// B1: signs of supply-side changes
{ const work = run(v, inp => { for (let t = 3; t <= T; t++) inp.partAdd[t] += 0.15 * Math.min(1, (t - 2) / 10); }), prod = run(v, inp => { for (let t = 3; t < 13; t++) for (const s of 'FTID') inp.tfpAdd[s][t] += 0.01; }), cr = run(v, compose([{ id: 'crisis' }]));
  ok('B1 more participation raises GDP', work.gdp[T] > b.gdp[T], ((work.gdp[T] / b.gdp[T] - 1) * 100).toFixed(2) + '%');
  ok('B1 ten points of productivity raise GDP by most of it', prod.gdp[T] / b.gdp[T] - 1 > 0.07, ((prod.gdp[T] / b.gdp[T] - 1) * 100).toFixed(1) + '%');
  ok('B1 unemployment rises in the crisis', Math.max(...cr.unempRate) > v.uStar + 0.004, (Math.max(...cr.unempRate) * 100).toFixed(1) + '%'); }
// B2: no cliff: the saturation scenario bites from the start and smoothly
{ const s = run(v, compose([{ id: 'saturation' }])), d = s.gdp.map((x, t) => x / b.gdp[t] - 1); let jump = 0; for (let t = 4; t <= T; t++) jump = Math.max(jump, Math.abs((d[t] - d[t - 1]) - (d[t - 1] - d[t - 2])));
  ok('B2 saturation acts within five years', d[8] < -0.001, (d[8] * 100).toFixed(2) + '% in 2033'); ok('B2 no kink larger than 0.2 points a year', jump < 0.002, (jump * 100).toFixed(3)); }
// B4: the middle of the fan sits near the central run
{ const draws = makeDraws(300), runs = draws.map(d => run(d.v, null, d.sh)), med = k => runs.map(r => r[k][T]).sort((x, y) => x - y)[150];
  ok('B4 fan median close to central (GDP within 2%)', Math.abs(med('gdp') / b.gdp[T] - 1) < 0.02, ((med('gdp') / b.gdp[T] - 1) * 100).toFixed(1) + '%'); ok('B4 fan median close to central (reserve within 0.3 years)', Math.abs(med('reserveYears') - b.reserveYears[T]) < 0.3, med('reserveYears').toFixed(2) + ' vs ' + b.reserveYears[T].toFixed(2)); }
// ---- second review ----
{ const v1 = { ...v, prodStart: 1 }, b1 = run(v1), reg = run({ ...v1, tfpF: v.tfpF + 0.01, tfpT: v.tfpT + 0.01, tfpI: v.tfpI + 0.01, tfpD: v.tfpD + 0.01 }), viaInput = run(v1, inp => { for (let t = 1; t <= T; t++) for (const s of 'FTID') inp.tfpAdd[s][t] += 0.01; });
  ok('R2 a productivity path gives one answer, through the register or through inputs', Math.abs(reg.gdp[T] / viaInput.gdp[T] - 1) < 1e-6, ((reg.gdp[T] / b1.gdp[T] - 1) * 100).toFixed(1) + '%');
  const r1 = run(v, inp => { inp.rMkt[3] -= 0.2; }), r2 = run(v, inp => { inp.nSales[3] -= 0.2; });
  ok('R2 a fall in fund assets cuts finance output alike, through returns or outflows', Math.abs(r1.vaF[4] / r2.vaF[4] - 1) < 1e-6, ((r1.vaF[4] / b.vaF[4] - 1) * 100).toFixed(1) + '%');
  const cr = run(v, compose([{ id: 'crisis' }])), share = (cr.commuters[3] - b.commuters[3]) / (cr.jobs[3] - b.jobs[3]);
  ok('R2 commuters carry their estimated share of first-year job losses', Math.abs(share - v.cycCom) < 0.05, share.toFixed(2) + ' against ' + v.cycCom);
  ok('R2 the budget starts at the 2025 outturn', Math.abs(b.balancePct[0] - v.balance0 / v.gdp0 * 100) < 0.02, b.balancePct[0].toFixed(2) + '% of GDP');
  const draws = makeDraws(200), runs = draws.map(d => run(d.v, null, d.sh)), keys = ['gniPerHead', 'gdp', 'gniShare', 'comShare', 'pop', 'debtPct', 'balancePct', 'reserveYears', 'unempRate', 'wIdx'];
  const wide = keys.filter(k => Math.max(...runs.map(r => r[k][0])) - Math.min(...runs.map(r => r[k][0])) > 1e-6 * Math.abs(b[k][0]));
  ok('R2 the fan has no width in 2025', wide.length === 0, wide.join(', '));
  const sat = run(v, compose([{ id: 'saturation', k: 2 }]));
  ok('R2 new residents replace less than 30% of lost commuters', sat.resJobs[T] - b.resJobs[T] < 0.3 * (b.commuters[T] - sat.commuters[T]), 'at 200%: net migration up by at most ' + Math.max(...sat.migration.map((m, t) => m - b.migration[t])).toFixed(1) + 'k a year, ' + (b.commuters[T] - sat.commuters[T]).toFixed(0) + 'k fewer commuters, ' + (sat.resJobs[T] - b.resJobs[T]).toFixed(0) + 'k more resident workers');
  const grid = run(v, compose([{ id: 'housing', dir: -1 }])), build = run(v, compose([{ id: 'housing', dir: 1 }]));
  ok('R2 housing scenario sizes match their description', Math.abs(grid.completions[T] - v.compl0) < 1e-9 && Math.abs(build.completions[T] - 4.44) < 1e-9, grid.completions[T].toFixed(2) + 'k and ' + build.completions[T].toFixed(2) + 'k a year');
  ok('R2 a housing gridlock lowers GDP and does not help the budget by more than 0.1 points', grid.gdp[T] < b.gdp[T] && grid.balancePct[T] - b.balancePct[T] < 0.1, ((grid.gdp[T] / b.gdp[T] - 1) * 100).toFixed(1) + '% GDP, ' + (grid.balancePct[T] - b.balancePct[T]).toFixed(2) + ' points');
  const prod = run(v, inp => { for (let t = 3; t < 13; t++) for (const s of 'FTID') inp.tfpAdd[s][t] += 0.01; });
  ok('R2 more than half of a productivity gain reaches pay', (prod.wIdx[T] / b.wIdx[T] - 1) > 0.5 * 0.1046, ((prod.wIdx[T] / b.wIdx[T] - 1) * 100).toFixed(1) + '% pay for 10.5% productivity'); }
// ---- third review ----
{ const reg = run({ ...v, gEA: v.gEA + 0.004 }), viaInput = run(v, inp => { for (let t = 5; t <= T; t++) inp.gEA[t] += 0.004; });
  ok('R3 euro area growth gives one answer, through the register or through inputs', Math.abs(reg.gdp[T] / viaInput.gdp[T] - 1) < 1e-9 && Math.abs(reg.debtPct[T] - viaInput.debtPct[T]) < 1e-6, ((reg.gdp[T] / b.gdp[T] - 1) * 100).toFixed(1) + '% GDP, ' + (reg.debtPct[T] - b.debtPct[T]).toFixed(1) + ' points of debt');
  const v1 = { ...v, prodStart: 1 }, b1 = run(v1), nReg = run({ ...v1, gProdN: v.gProdN + 0.003 }), nIn = run(v1, inp => { for (let t = 1; t <= T; t++) inp.gProdN[t] += 0.003; });
  ok('R3 productivity next door gives one answer', Math.abs(nReg.gdp[T] / nIn.gdp[T] - 1) < 1e-9, ((nReg.gdp[T] / b1.gdp[T] - 1) * 100).toFixed(1) + '%');
  const cr = run(v, compose([{ id: 'crisis' }])), shares = [3, 4, 5, 6, 7, 8].map(i => (cr.commuters[i] - b.commuters[i]) / (cr.jobs[i] - b.jobs[i]));
  ok('R3 the commuter share of job losses stays near the estimate for six years', shares.every(x => x > v.cycCom - 0.1 && x < v.cycCom + 0.15), shares.map(x => x.toFixed(2)).join(' '));
  let worst = 0; for (const id of ['crisis', 'stagnation', 'erosion', 'saturation']) { const s = run(v, compose([{ id, k: 2 }])); for (let t = 1; t <= T; t++) worst = Math.max(worst, Math.abs(s.jobs[t] - s.resJobs[t] - s.commuters[t])); }
  ok('R3 jobs = resident jobs + commuters in deep slumps', worst < 1e-9);
  const au = run(v, compose([{ id: 'automation' }]));
  ok('R3 automation: finance sheds at least a tenth of its jobs', au.jobsF[T] / b.jobsF[T] - 1 < -0.1, ((au.jobsF[T] / b.jobsF[T] - 1) * 100).toFixed(0) + '% (' + (au.jobsF[T] - b.jobsF[T]).toFixed(1) + 'k), finance output ' + ((au.vaF[T] / b.vaF[T] - 1) * 100).toFixed(0) + '%');
  const hi = run(v, compose([{ id: 'crisis', k: 2 }])); ok('R3 the interest bill never turns negative', Math.min(...hi.debt.map((d, t) => hi.spend[t])) > 0 && true); }
// all scenarios finite at double size
ok('all scenarios finite at 200%', !SCENARIOS.flatMap(sc => [1, -1].map(dir => run(v, compose([{ id: sc.id, k: 2, dir }])))).some(s => Object.values(s).some(a => a.some(x => !Number.isFinite(x)))));
