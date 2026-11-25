import { P, values, run, YEARS } from '../src/model.js';
import { compose } from '../src/scenarios.js';
const args = process.argv.slice(2), id = args[0], k = +(args[1] || 1);
const v = values(), b = run(v), s = id && id !== 'base' ? run(v, compose([{ id, k, dir: +(args[2] || 1) }])) : b;
const yrs = [1, 2, 3, 4, 5, 6, 8, 11, 16, 21];
const row = (name, f, d = 2) => console.log(name.padEnd(18) + yrs.map(i => f(i).toFixed(d).padStart(8)).join(''));
console.log(''.padEnd(18) + yrs.map(i => String(YEARS[i]).padStart(8)).join(''));
row('foreign need k', i => s.foreignNeed[i]); row('foreign supply k', i => s.foreignSupply[i]); row('unfilled %', i => s.tight[i] * 100);
row('pay vs norm', i => s.wPrem[i], 3); row('ulc (traded)', i => s.ulc[i], 3); row('omega', i => s.omega[i], 3); row('unemp %', i => s.unempRate[i] * 100);
row('jobs growth %', i => (s.jobs[i] / s.jobs[i - 1] - 1) * 100); row('GDP growth %', i => s.gdpGrowth[i] * 100); row('GDP/job gr %', i => ((s.gdp[i] / s.jobs[i]) / (s.gdp[i - 1] / s.jobs[i - 1]) - 1) * 100);
if (s !== b) { row('GDP vs base %', i => (s.gdp[i] / b.gdp[i] - 1) * 100); row('jobs vs base k', i => s.jobs[i] - b.jobs[i], 1); row('commuters vs b k', i => s.commuters[i] - b.commuters[i], 1); row('pop vs base k', i => s.pop[i] - b.pop[i], 1); row('GNI/head vs b %', i => (s.gniPerHead[i] / b.gniPerHead[i] - 1) * 100); row('debt vs base pp', i => s.debtPct[i] - b.debtPct[i], 1); }
