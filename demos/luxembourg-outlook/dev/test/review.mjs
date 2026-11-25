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
  ok('B1 unemployment rises in the crisis', Math.max(...cr.unempRate) > v.uStar + 0.005, (Math.max(...cr.unempRate) * 100).toFixed(1) + '%'); }
// B2: no cliff: the saturation scenario bites from the start and smoothly
{ const s = run(v, compose([{ id: 'saturation' }])), d = s.gdp.map((x, t) => x / b.gdp[t] - 1); let jump = 0; for (let t = 4; t <= T; t++) jump = Math.max(jump, Math.abs((d[t] - d[t - 1]) - (d[t - 1] - d[t - 2])));
  ok('B2 saturation acts within five years', d[8] < -0.001, (d[8] * 100).toFixed(2) + '% in 2033'); ok('B2 no kink larger than 0.2 points a year', jump < 0.002, (jump * 100).toFixed(3)); }
// B4: the middle of the fan sits near the central run
{ const draws = makeDraws(300), runs = draws.map(d => run(d.v, null, d.sh)), med = k => runs.map(r => r[k][T]).sort((x, y) => x - y)[150];
  ok('B4 fan median close to central (GDP within 2%)', Math.abs(med('gdp') / b.gdp[T] - 1) < 0.02, ((med('gdp') / b.gdp[T] - 1) * 100).toFixed(1) + '%'); ok('B4 fan median close to central (reserve within 0.3 years)', Math.abs(med('reserveYears') - b.reserveYears[T]) < 0.3, med('reserveYears').toFixed(2) + ' vs ' + b.reserveYears[T].toFixed(2)); }
// all scenarios finite at double size
ok('all scenarios finite at 200%', !SCENARIOS.flatMap(sc => [1, -1].map(dir => run(v, compose([{ id: sc.id, k: 2, dir }])))).some(s => Object.values(s).some(a => a.some(x => !Number.isFinite(x)))));
