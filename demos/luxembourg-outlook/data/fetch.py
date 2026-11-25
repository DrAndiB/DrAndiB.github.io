"""Downloads the public data series behind the Luxembourg Outlook simulator.
Runs in GitHub Actions (see .github/workflows/luxembourg-outlook-data.yml).
Every response is saved unchanged under data/raw/, and data/REPORT.md lists what worked."""
import datetime, pathlib, urllib.parse, urllib.request

HERE = pathlib.Path(__file__).parent
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
ES = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
BORDER = ["FRF31", "FRF32", "FRF33", "BE341", "BE342", "BE343", "BE344", "BE345", "DEB21", "DEB22", "DEB23", "DEB25", "DEC01", "DEC02", "DEC04"]

def es(code, **params):
    q = [("format", "JSON"), ("lang", "EN")]
    for k, v in params.items():
        for item in (v if isinstance(v, list) else [v]):
            q.append((k, item))
    return ES + code + "?" + urllib.parse.urlencode(q)

CSV = {"Accept": "application/vnd.sdmx.data+csv"}
JOBS = [
    # --- Eurostat: quarterly national accounts, Luxembourg and euro area ---
    ("es_namq_10_gdp.json", es("namq_10_gdp", geo=["LU", "EA20"], na_item="B1GQ", unit=["CLV15_MEUR", "CP_MEUR"], s_adj="SCA", sinceTimePeriod="2000-Q1"), {}),
    ("es_namq_10_a10.json", es("namq_10_a10", geo="LU", na_item="B1G", unit=["CLV15_MEUR", "CP_MEUR"], s_adj="SCA", sinceTimePeriod="2000-Q1"), {}),
    ("es_namq_10_a10_e.json", es("namq_10_a10_e", geo="LU", na_item="EMP_DC", unit="THS_PER", s_adj="SCA", sinceTimePeriod="2000-Q1"), {}),
    # --- Eurostat: annual accounts by industry ---
    ("es_nama_10_a10.json", es("nama_10_a10", geo="LU", na_item=["B1G", "D1"], unit=["CLV15_MEUR", "CP_MEUR"], sinceTimePeriod="2000"), {}),
    ("es_nama_10_a10_e.json", es("nama_10_a10_e", geo="LU", na_item=["EMP_DC", "SAL_DC"], unit="THS_PER", sinceTimePeriod="2000"), {}),
    ("es_nama_10_gdp.json", es("nama_10_gdp", geo="LU", unit=["CLV15_MEUR", "CP_MEUR"], sinceTimePeriod="2000"), {}),
    # --- Eurostat: population, projections, border regions ---
    ("es_demo_pjan.json", es("demo_pjan", geo="LU", sinceTimePeriod="2024"), {}),
    ("es_proj_23np.json", es("proj_23np", geo="LU", projection="BSL", sex="T", untilTimePeriod="2050"), {}),
    ("es_proj_19rp3.json", es("proj_19rp3", geo=BORDER, projection="BSL", sex="T", age="TOTAL"), {}),
    ("es_demo_r_pjangrp3.json", es("demo_r_pjangrp3", geo=BORDER, sex="T", sinceTimePeriod="2015"), {}),
    # --- Eurostat: public finances ---
    ("es_gov_10a_main.json", es("gov_10a_main", geo="LU", unit="MIO_EUR", sector="S13", sinceTimePeriod="2010"), {}),
    ("es_gov_10a_taxag.json", es("gov_10a_taxag", geo="LU", unit="MIO_EUR", sector="S13", sinceTimePeriod="2010"), {}),
    ("es_gov_10a_exp.json", es("gov_10a_exp", geo="LU", unit="MIO_EUR", sector="S13", na_item="TE", sinceTimePeriod="2010"), {}),
    # --- Eurostat: interest rate ---
    ("es_irt_st_m.json", es("irt_st_m", geo="EA", sinceTimePeriod="2000-01"), {}),
    # --- ECB: three-month Euribor and Euro Stoxx 50, monthly ---
    ("ecb_euribor3m.csv", "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?format=csvdata&startPeriod=2000-01", {}),
    ("ecb_eurostoxx50.csv", "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.DS.EI.DJES50I.HSTA?format=csvdata&startPeriod=2000-01", {}),
    # --- FRED: Brent oil price and dollar per euro, monthly ---
    ("fred_brent.csv", "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MCOILBRENTEU", {}),
    ("fred_usd_per_eur.csv", "https://fred.stlouisfed.org/graph/fredgraph.csv?id=EXUSEU", {}),
    # --- STATEC LUSTAT: list of all tables (to pick exact ones next), and the main aggregates ---
    ("lustat_dataflows.xml", "https://lustat.statec.lu/rest/dataflow/all/all/latest?detail=allstubs", {}),
    ("lustat_E2100.csv", "https://lustat.statec.lu/rest/data/LU1,DF_E2100,1.0/all?dimensionAtObservation=AllDimensions", CSV),
    # --- Pages to read for file links: fund statistics and pension tables ---
    ("probe_cssf_statistics.html", "https://www.cssf.lu/en/statistics/", {}),
    ("probe_igss_statistics.html", "https://igss.gouvernement.lu/fr/statistiques.html", {}),
]

rows = []
for name, url, headers in JOBS:
    req = urllib.request.Request(url, headers={"User-Agent": "luxembourg-outlook-data/0.1 (andreasbraun.lu)", **headers})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
            (RAW / name).write_bytes(body)
            rows.append((name, "ok", f"{len(body):,} bytes", ""))
    except Exception as e:  # keep going: the report says what failed
        detail = ""
        if hasattr(e, "read"):
            try: detail = e.read()[:200].decode("utf-8", "replace").replace("\n", " ").replace("|", "/")
            except Exception: pass
        rows.append((name, "FAILED", str(e)[:80].replace("|", "/"), detail))

stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
ok = sum(1 for r in rows if r[1] == "ok")
lines = [f"# Data download report", "", f"Run: {stamp}. {ok} of {len(rows)} downloads succeeded.", "", "| File | Status | Size or error | Server message |", "| --- | --- | --- | --- |"]
lines += [f"| {n} | {s} | {a} | {d} |" for n, s, a, d in rows]
lines += ["", "## Addresses", ""] + [f"- `{n}`: {u}" for n, u, _ in JOBS]
(HERE / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines[:6 + len(rows)]))
