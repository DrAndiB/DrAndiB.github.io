# Luxembourg Outlook

Economic outlook simulator for Luxembourg: flows of people, money, trade and public funds, with 20 scenarios to 2046.

- `data/` holds the public data series. `data/fetch.py` downloads them in GitHub Actions; `data/REPORT.md` lists the last run. `data/calibrate.py` turns them into starting figures (`dev/src/calib.js`), `data/estimate.py` into the estimated responses with bootstrap intervals (`dev/src/shortrun.js`).
- `dev/` holds the source. `npm install`, then `npm run build` writes one self-contained `dist/index.html`. `npm run check` prints the baseline and scenario tables; `node test/props.mjs` prints how the model answers standard experiments.
- The page is not published on the site yet.

## Model version 0.3

What Luxembourg can sell sets the jobs firms want. Residents, immigrants and commuters set the workers available. Pay moves when the two differ, and pay feeds back on sales (through unit labour costs) and on the inflow of foreign workers (through relative income). Demand rules the first years, labour supply the long run.

Of 108 parameters, 36 are published data, 5 come from published models or projections, 6 are estimated from quarterly data and 61 are assumptions. All are listed with sources and ranges in the page's "How it works" panel.

Versions 0.1 and 0.2 were each reviewed by an AI model briefed as a sceptical macroeconomist; `dev/test/review.mjs` re-checks the findings of both rounds. No human economist has reviewed the model yet.
