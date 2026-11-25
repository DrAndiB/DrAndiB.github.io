"""Downloads the public data series behind the Luxembourg Outlook simulator.
Runs in GitHub Actions (see .github/workflows/luxembourg-outlook-data.yml).
Every response is saved unchanged under data/raw/, and data/REPORT.md lists what worked."""
import datetime, pathlib, urllib.parse, urllib.request

HERE = pathlib.Path(__file__).parent
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
ES = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
BORDER = ["FRF31", "FRF32", "FRF33", "BE341", "BE342", "BE343", "BE344", "BE345", "DEB21", "DEB22", "DEB23", "DEB25", "DEC01", "DEC02", "DEC04"]
VERVIERS = ["BE335", "BE336"]

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
    # Verviers districts (Liege province) widen the Belgian commuter pool; projections by age give the working-age trend
    ("es_demo_r_pjangrp3_verviers.json", es("demo_r_pjangrp3", geo=VERVIERS, sex="T", sinceTimePeriod="2015"), {}),
    ("es_proj_19rp3_age.json", es("proj_19rp3", geo=BORDER, projection="BSL", sex="T", time=["2025", "2035", "2045"]), {}),
    ("es_proj_19rp3_age_verviers.json", es("proj_19rp3", geo=VERVIERS, projection="BSL", sex="T", time=["2025", "2035", "2045"]), {}),
    # --- Eurostat: public finances ---
    ("es_gov_10a_main.json", es("gov_10a_main", geo="LU", unit="MIO_EUR", sector="S13", sinceTimePeriod="2010"), {}),
    ("es_gov_10a_taxag.json", es("gov_10a_taxag", geo="LU", unit="MIO_EUR", sector="S13", sinceTimePeriod="2010"), {}),
    ("es_gov_10a_exp.json", es("gov_10a_exp", geo="LU", unit="MIO_EUR", sector="S13", na_item="TE", sinceTimePeriod="2010"), {}),
    # --- Eurostat: interest rate ---
    ("es_irt_st_m.json", es("irt_st_m", geo="EA", sinceTimePeriod="2000-01"), {}),
    # --- ECB: three-month Euribor and Euro Stoxx 50, monthly ---
    ("ecb_euribor3m.csv", "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?format=csvdata&startPeriod=2000-01", {}),
    ("ecb_eurostoxx50.csv", "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.DS.EI.DJES50I.HSTA?format=csvdata&startPeriod=2000-01", {}),
    # --- Oil price (two sources, either will do) and dollar per euro, monthly ---
    ("eia_brent.xls", "https://www.eia.gov/dnav/pet/hist_xls/RBRTEm.xls", {}),
    ("datahub_brent.csv", "https://datahub.io/core/oil-prices/r/brent-monthly.csv", {}),
    ("ecb_usd_per_eur.csv", "https://data-api.ecb.europa.eu/service/data/EXR/M.USD.EUR.SP00.A?format=csvdata&startPeriod=2000-01", {}),
    ("es_gov_10dd_edpt1.json", es("gov_10dd_edpt1", geo="LU", sector="S13", unit=["MIO_EUR", "PC_GDP"], sinceTimePeriod="2010"), {}),
    # --- STATEC LUSTAT: list of all tables (to pick exact ones next), and the main aggregates ---
    ("lustat_dataflows.xml", "https://lustat.statec.lu/rest/dataflow/all/all/latest?detail=allstubs", {}),
    ("lustat_E2100.csv", "https://lustat.statec.lu/rest/data/LU1,DF_E2100,1.0/all?dimensionAtObservation=AllDimensions", CSV),
    # --- STATEC LUSTAT tables picked from the list ---
    ("lustat_B3107_frontier_workers.csv", "https://lustat.statec.lu/rest/data/LU1,DF_B3107,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_B3002_employment_by_residence.csv", "https://lustat.statec.lu/rest/data/LU1,DSD_EMPLOI_SAL@DF_B3002,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_E3310_tax_receipts.csv", "https://lustat.statec.lu/rest/data/LU1,DF_E3310,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_D4200_finished_buildings.csv", "https://lustat.statec.lu/rest/data/LU1,DF_D4200,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_D4111_building_permits.csv", "https://lustat.statec.lu/rest/data/LU1,DF_D4111,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_B2400_migration.csv", "https://lustat.statec.lu/rest/data/LU1,DF_B2400,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_D7300_investment_funds.csv", "https://lustat.statec.lu/rest/data/LU1,DF_D7300,/all?dimensionAtObservation=AllDimensions", CSV),
    ("lustat_C2105_pensions.csv", "https://lustat.statec.lu/rest/data/LU1,DF_C2105,/all?dimensionAtObservation=AllDimensions", CSV),
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
