# Luxembourg Outlook

Economic outlook simulator for Luxembourg: flows of people, money, trade and public funds, with 20 scenarios to 2046.

- `data/` holds the public data series. `data/fetch.py` downloads them in GitHub Actions; `data/REPORT.md` lists the last run.
- `dev/` holds the source. `npm install`, then `npm run build` writes one self-contained `dist/index.html`. `npm run check` prints the baseline and scenario tables.
- The page is not published on the site yet.

Model version 0.1 is calibrated, not estimated; most parameters are marked as assumptions in the page's "How it works" panel.
