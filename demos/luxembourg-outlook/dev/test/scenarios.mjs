import { values, run, YEARS } from '../src/model.js';
import { SCENARIOS, compose } from '../src/scenarios.js';
const v = values(), b = run(v);
const at = [6, 11, 21];
const pct = (s, k, i) => ((s[k][i] / b[k][i] - 1) * 100).toFixed(1).padStart(6);
const dif = (s, k, i, d = 1) => (s[k][i] - b[k][i]).toFixed(d).padStart(6);
console.log('scenario (start 2028)'.padEnd(22) + '| GDP % 31/36/46      | GNI/head %          | jobs k              | commuters k         | balance pp          | reserve yrs         | housing');
const line = (name, s) => console.log(name.padEnd(22) + '|' + at.map(i => pct(s, 'gdp', i)).join(' ') + ' |' + at.map(i => pct(s, 'gniPerHead', i)).join(' ') + ' |' + at.map(i => dif(s, 'jobs', i)).join(' ') + ' |' + at.map(i => dif(s, 'commuters', i)).join(' ') + ' |' + at.map(i => dif(s, 'balancePct', i, 2)).join(' ') + ' |' + at.map(i => dif(s, 'reserveYears', i, 2)).join(' ') + ' |' + at.map(i => dif(s, 'housing', i, 3)).join(' '));
for (const sc of SCENARIOS) {
  if (sc.twoSided) { line(sc.id + ' (+)', run(v, compose([{ id: sc.id, dir: 1 }]))); line(sc.id + ' (-)', run(v, compose([{ id: sc.id, dir: -1 }]))); }
  else line(sc.id, run(v, compose([{ id: sc.id }])));
}
const bad = SCENARIOS.flatMap(sc => [1, -1].map(dir => run(v, compose([{ id: sc.id, k: 2, dir }])))).some(s => Object.values(s).some(a => a.some(x => !Number.isFinite(x))));
console.log('non-finite values at 200% intensity:', bad);
