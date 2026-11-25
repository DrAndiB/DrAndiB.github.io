"""Turns the downloaded files in data/raw into starting figures for the model.
Writes dev/src/calib.js (parameter overrides with their sources) and prints a summary."""
import csv, json, pathlib

HERE = pathlib.Path(__file__).parent
RAW = HERE / "raw"

class Stat:  # one Eurostat JSON-stat file
    def __init__(self, fn):
        j = json.load(open(RAW / fn)); self.ids, self.size, self.val = j["id"], j["size"], j["value"]
        self.pos = {d: j["dimension"][d]["category"]["index"] for d in self.ids}
    def codes(self, dim): return sorted(self.pos[dim], key=lambda k: self.pos[dim][k])
    def get(self, **sel):
        idx = 0
        for d, n in zip(self.ids, self.size):
            c = sel.get(d) or (self.codes(d)[0] if n == 1 else None)
            if c is None or c not in self.pos[d]: return None
            idx = idx * n + self.pos[d][c]
        v = self.val.get(str(idx)) if isinstance(self.val, dict) else self.val[idx]
        return v
    def last(self, **sel):
        for t in reversed(self.codes("time")):
            v = self.get(time=t, **sel)
            if v is not None: return t, v
        return None, None

def lustat(fn):
    return [r for r in csv.DictReader(open(RAW / fn, encoding="utf-8-sig")) if r["OBS_VALUE"] not in ("", None)]

P, notes = {}, []
def put(key, value, src):
    if value is None: notes.append(f"missing: {key}"); return
    P[key] = {"v": round(value, 4), "src": src}

Y = "2025"
gdp = Stat("es_nama_10_gdp.json"); put("gdp0", gdp.get(time=Y, na_item="B1GQ", unit="CP_MEUR", geo="LU") / 1000, f"Eurostat nama_10_gdp, GDP at current prices {Y} (EUR bn)")
va, emp = Stat("es_nama_10_a10.json"), Stat("es_nama_10_a10_e.json")
SECT = {"F": ["K"], "T": ["J", "M_N"], "I": ["A", "B-E", "F"], "D": ["G-I", "L", "O-Q", "R-U"]}
def tot(st, codes, **sel):
    vals = [st.get(nace_r2=c, **sel) for c in codes]
    return None if any(v is None for v in vals) else sum(vals)
vat = va.get(time=Y, na_item="B1G", unit="CP_MEUR", geo="LU", nace_r2="TOTAL"); et = emp.get(time=Y, na_item="EMP_DC", unit="THS_PER", geo="LU", nace_r2="TOTAL")
sec = {}
for s, codes in SECT.items():
    v, e = tot(va, codes, time=Y, na_item="B1G", unit="CP_MEUR", geo="LU"), tot(emp, codes, time=Y, na_item="EMP_DC", unit="THS_PER", geo="LU")
    d1, sal = tot(va, codes, time=Y, na_item="D1", unit="CP_MEUR", geo="LU"), tot(emp, codes, time=Y, na_item="SAL_DC", unit="THS_PER", geo="LU")
    sec[s] = (v, e, d1, sal)
    if s != "D":
        put("va" + s, v / vat if v else None, f"Eurostat nama_10_a10, share of value added {Y}")
        put("job" + s, e / et if e else None, f"Eurostat nama_10_a10_e, share of domestic employment {Y}")
    put("w" + s, d1 / sal if d1 and sal else None, f"Eurostat nama_10_a10, compensation per employee {Y} (EUR thousand)")
put("prodTax", gdp.get(time=Y, na_item="B1GQ", unit="CP_MEUR", geo="LU") / vat - 1, f"Eurostat, GDP over total value added {Y}")

# population by age: 18 five-year groups
pj = Stat("es_demo_pjan.json"); ty = pj.codes("time")[-1]; ages = [0.0] * 18
for a in pj.codes("age"):
    n = 0 if a == "Y_LT1" else 100 if a == "Y_OPEN" else int(a[1:]) if a[1:].isdigit() else None
    v = pj.get(time=ty, age=a, sex="T", geo="LU")
    if n is not None and v is not None: ages[min(17, n // 5)] += v / 1000
# the age structure is used; the level stays at STATEC's 1 January 2026 figure

# commuters by country of residence, 2025 average
rows = [r for r in lustat("lustat_B3002_employment_by_residence.csv") if r["ADJUSTMENT"] == "N" and r["TIME_PERIOD"].startswith(Y)]
res = {}
for r in rows: res.setdefault(r["RESIDENCE"], []).append(float(r["OBS_VALUE"]))
avg = {k: sum(v) / len(v) / 1000 for k, v in res.items()}
fr, be, de = avg.get("F_FR"), avg.get("F_BE"), avg.get("F_DE")
if fr and be and de:
    com = fr + be + de; scale = 1.03  # adds the self-employed: 237.2 thousand in STATEC's 2025 summary against 230.2 salaried
    put("commuters0", com * scale, f"STATEC B3002, salaried cross-border workers {Y} average, plus 3% self-employed")
    put("shareFR", fr / com, f"STATEC B3002, {Y}"); put("shareBE", be / com, f"STATEC B3002, {Y}"); put("shareDE", de / com, f"STATEC B3002, {Y}")
    put("resJobs0", et - com * scale, f"Eurostat domestic employment {Y} less cross-border workers")

# fund assets
fa = [r for r in lustat("lustat_D7300_investment_funds.csv") if r["SPECIFICATION"] == "SL02"]
if fa: last = max(fa, key=lambda r: r["TIME_PERIOD"]); put("aum0", float(last["OBS_VALUE"]), f"STATEC D7300, net assets of Luxembourg funds end {last['TIME_PERIOD']} (EUR bn)")

# public finances
gm, tx = Stat("es_gov_10a_main.json"), Stat("es_gov_10a_taxag.json")
g = lambda st, item: st.get(time=Y, na_item=item, unit="MIO_EUR", sector="S13", geo="LU")
tr, te, b9 = g(gm, "TR"), g(gm, "TE"), g(gm, "B9")
put("rev0", tr / 1000 if tr else None, f"Eurostat gov_10a_main, general government revenue {Y} (EUR bn)")
put("balance0", b9 / 1000 if b9 is not None else None, f"Eurostat gov_10a_main, net lending {Y} (EUR bn)")
lines = {k: g(tx, k) for k in ["D61", "D51A", "D51B", "D211", "D214A", "D5", "D2"]}
for key, item, what in [("rSoc", "D61", "net social contributions"), ("rWage", "D51A", "taxes on household income"), ("rVat", "D211", "VAT")]:
    put(key, lines[item] / 1000 if lines[item] else None, f"Eurostat gov_10a_taxag, {what} {Y} (EUR bn)")
if lines["D51B"]:
    put("rCorpF", 0.55 * lines["D51B"] / 1000, f"Eurostat gov_10a_taxag, corporate income tax {Y}; 55% attributed to finance (assumption)")
    put("rCorpO", 0.45 * lines["D51B"] / 1000, f"Eurostat gov_10a_taxag, corporate income tax {Y}; 45% attributed to other sectors (assumption)")
# excise duties are not usable from this table for Luxembourg; fuel and tobacco stay as set in the model
try:
    dd = Stat("es_gov_10dd_edpt1.json"); d = dd.get(time=Y, na_item="GD", unit="MIO_EUR", sector="S13", geo="LU"); put("debt0", d / 1000 if d else None, f"Eurostat gov_10dd_edpt1, general government debt {Y} (EUR bn)")
except Exception as e: notes.append(f"debt: {e}")

# commuter pools: working-age residents of the border districts, and their projected trend
rp = Stat("es_demo_r_pjangrp3.json"); tr3 = rp.codes("time")[-1]; work = [a for a in rp.codes("age") if a in {"Y15-19", "Y20-24", "Y25-29", "Y30-34", "Y35-39", "Y40-44", "Y45-49", "Y50-54", "Y55-59", "Y60-64"}]
pr = Stat("es_proj_19rp3.json")
for c in ["FR", "BE", "DE"]:
    geos = [x for x in rp.codes("geo") if x.startswith(c)]
    vals = [rp.get(time=tr3, geo=x, age=a, sex="T") for x in geos for a in work]
    if vals and all(v is not None for v in vals): put("pool" + c, sum(vals) / 1000, f"Eurostat demo_r_pjangrp3, residents aged 15 to 64 in the border districts, {tr3} (thousand)")
    pg = [x for x in pr.codes("geo") if x.startswith(c)]
    a0 = [pr.get(time="2025", geo=x) for x in pg]; a1 = [pr.get(time="2045", geo=x) for x in pg]
    if a0 and all(v is not None for v in a0 + a1): notes.append(f"total population trend {c}: {((sum(a1) / sum(a0)) ** (1 / 20) - 1) * 100:.2f}% a year (all ages; not used, the model needs working ages)")

out = "/* Generated by data/calibrate.py from the files in data/raw. Do not edit by hand. */\nexport const CALIB = " + json.dumps({"params": P, "age": [round(a, 2) for a in ages], "ageYear": ty}, indent=1) + ";\n"
(HERE.parent / "dev" / "src" / "calib.js").write_text(out, encoding="utf-8")
for k, e in P.items(): print(f"{k:11s} {e['v']:>10}  {e['src'][:74]}")
print("age groups:", [round(a) for a in ages]); print("tax lines (EUR m):", lines, "| TE", te); print("notes:", notes)
