/* Model properties an economist would ask about: signs and sizes of textbook experiments. */
import { P, values, run, YEARS, T } from '../src/model.js';
const v = values(), b = run(v);
const exp = (name, f, vv = v) => { const s = run(vv, f), bb = f ? (vv === v ? b : run(vv)) : b; const g = (k, i) => ((s[k][i] / bb[k][i] - 1) * 100).toFixed(2).padStart(7);
  console.log(name.padEnd(46) + '| GDP % ' + [3, 4, 6, 8, 13, 21].map(i => g('gdp', i)).join('') + ' | jobs % ' + [3, 8, 21].map(i => g('jobs', i)).join('') + ' | unemp peak ' + (Math.max(...s.unempRate) * 100).toFixed(2) + ' min ' + (Math.min(...s.unempRate) * 100).toFixed(2) + ' | commuters k ' + (s.commuters[21] - bb.commuters[21]).toFixed(1) + ' | pay % ' + g('wIdx', 21)); return s; };
console.log('experiment (from 2028)'.padEnd(46) + '| GDP %    2028   2029   2031   2033   2038   2046');
exp('one-year fall in sales of 4%, all sectors', inp => { for (const s of 'FTID') inp.demAdd[s][3] -= 0.04; });
exp('euro area output 4% lower for good', inp => { inp.gEA[3] -= 0.04; });
exp('euro area output 4% lower for two years', inp => { inp.gEA[3] -= 0.04; inp.gEA[5] += 0.04; });
exp('productivity +1pt a year for 10 years, all', inp => { for (let t = 3; t < 13; t++) for (const s of 'FTID') inp.tfpAdd[s][t] += 0.01; });
exp('participation 55-69 up 15 points over 10 years', inp => { for (let t = 3; t <= T; t++) inp.partAdd[t] += 0.15 * Math.min(1, (t - 2) / 10); });
exp('foreign inflow 80% lower in 2028-32', inp => { for (let t = 3; t < 8; t++) inp.Fmul[t] *= 0.2; });
exp('other migration +3,000 a year', inp => { for (let t = 3; t <= T; t++) inp.otherMigAdd[t] += 3; });
exp('French ceiling 1.3 instead of 1.65', null, { ...v, headFR: 1.3 });
for (const k of ['eps', 'lambda', 'theta', 'gammaC', 'compAdj', 'Fbar', 'stretch', 'spill', 'wFloor', 'kappa', 'empEl', 'jobAdj', 'cycCom']) { const v2 = { ...v, [k]: v[k] * 1.5 }, b2 = run(v2); console.log(('  ' + k + ' x1.5: baseline GDP 2046').padEnd(46) + '| ' + b.gdp[21].toFixed(2) + ' -> ' + b2.gdp[21].toFixed(2)); }
