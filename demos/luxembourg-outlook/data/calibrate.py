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
# one year's balance is a poor guide to twenty: the budget starts at the outturn and moves to the three-year average share of GDP
yrs3 = [str(int(Y) - i) for i in range(3)]; ratios = []
for y in yrs3:
    b, gq = gm.get(time=y, na_item="B9", unit="MIO_EUR", sector="S13", geo="LU"), gdp.get(time=y, na_item="B1GQ", unit="CP_MEUR", geo="LU")
    if b is not None and gq: ratios.append(b / gq)
if len(ratios) == 3:
    P["balStruct"] = {"v": round(sum(ratios) / 3, 4), "lo": round(min(ratios), 4), "hi": round(max(ratios), 4),
                      "src": f"Structural balance behind the 2025 outturn, as a share of GDP (assumption): spending worth the difference fades by 2028; ageing and scenarios act on top. Set to average net lending {yrs3[-1]} to {Y} ({', '.join(f'{r * 100:+.1f}%' for r in reversed(ratios))}, Eurostat gov_10a_main)"}
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
WORK5 = {"Y15-19", "Y20-24", "Y25-29", "Y30-34", "Y35-39", "Y40-44", "Y45-49", "Y50-54", "Y55-59", "Y60-64"}; WORK1 = {f"Y{a}" for a in range(15, 65)}
def regional(files, ages, year):
    """Working-age residents by district (thousand) in the given files."""
    tot = {}
    for fn in files:
        try: st = Stat(fn)
        except Exception as e: notes.append(f"{fn}: {e}"); continue
        for x in st.codes("geo"):
            vals = [st.get(time=year(st), geo=x, age=a, sex="T") for a in st.codes("age") if a in ages]
            if vals and all(v is not None for v in vals): tot[x] = sum(vals) / 1000
    return tot
now = regional(["es_demo_r_pjangrp3.json", "es_demo_r_pjangrp3_verviers.json"], WORK5, lambda st: st.codes("time")[-1])
p25, p45 = [regional(["es_proj_19rp3_age.json", "es_proj_19rp3_age_verviers.json"], WORK1, lambda st, y=y: y) for y in ("2025", "2045")]
AREA = {"FR": "Meurthe-et-Moselle, Meuse and Moselle", "BE": "the province of Luxembourg and the Verviers districts", "DE": "the Trier region and the western Saarland"}
for c in ["FR", "BE", "DE"]:
    d = [x for x in now if x.startswith(c)]
    if d: put("pool" + c, sum(now[x] for x in d), f"Eurostat demo_r_pjangrp3, residents aged 15 to 64 in {AREA[c]}, 2025 (thousand)")
    # the trend uses only districts where the projection starts close to the actual 2025 figure
    ok = [x for x in d if x in p25 and x in p45 and abs(p25[x] / now[x] - 1) < 0.2]; off = [x for x in d if x in p25 and x not in ok]
    if ok: put("poolG" + c, (sum(p45[x] for x in ok) / sum(p25[x] for x in ok)) ** (1 / 20) - 1, "Eurostat regional projection (proj_19rp3), yearly change of residents aged 15 to 64 in the same districts, 2025 to 2045" + (f"; {len(off)} district left out because its projection starts more than 20% away from the 2025 count ({', '.join(off)})" if off else ""))

# housing: dwellings completed, and what recent permits imply for the next years
done = {r["TIME_PERIOD"]: float(r["OBS_VALUE"]) for r in lustat("lustat_D4200_finished_buildings.csv") if r["BUILDINGS"] == "B02" and r["SPECIFICATION"] == "L01"}
perm = {r["TIME_PERIOD"]: float(r["OBS_VALUE"]) for r in lustat("lustat_D4111_building_permits.csv") if r["FREQ"] == "A" and r["PRODUCT_BCS"] == "CPA_F41001_41002"}
ten = sorted(done)[-10:]; both = [y for y in ten if y in perm]; last3 = sorted(perm)[-3:]
if len(ten) == 10 and both and len(last3) == 3:
    avg = sum(done[y] for y in ten) / 10; rate = sum(done[y] for y in both) / sum(perm[y] for y in both)
    put("complLR", avg / 1000, f"STATEC D4200, dwellings completed per year, average {ten[0]} to {ten[-1]} (thousand); the baseline returns to it by 2032")
    put("compl0", rate * sum(perm[y] for y in last3) / 3 / 1000, f"STATEC D4111, dwellings authorised {last3[0]} to {last3[-1]}, times the {rate:.0%} of permits completed in {both[0]} to {both[-1]} (thousand a year)")

# trade in goods and services
for key, item, what in [("exports0", "P6", "exports"), ("imports0", "P7", "imports")]:
    v = gdp.get(time=Y, na_item=item, unit="CP_MEUR", geo="LU"); put(key, v / 1000 if v else None, f"Eurostat nama_10_gdp, {what} of goods and services {Y} (EUR bn)")

# published figures the baseline is compared with (not used by the model)
ref = {}
try:
    pp = Stat("es_proj_23np.json"); v46 = pp.get(time="2046", geo="LU", age="TOTAL", sex="T", projection="BSL")
    if v46: ref["pop2046"] = round(v46 / 1000, 1)
except Exception as e: notes.append(f"population projection: {e}")

out = "/* Generated by data/calibrate.py from the files in data/raw. Do not edit by hand. */\nexport const CALIB = " + json.dumps({"params": P, "ref": ref, "age": [round(a, 2) for a in ages], "ageYear": ty}, indent=1) + ";\n"
(HERE.parent / "dev" / "src" / "calib.js").write_text(out, encoding="utf-8")
for k, e in P.items(): print(f"{k:11s} {e['v']:>10}  {e['src'][:110]}")
print("age groups:", [round(a) for a in ages]); print("tax lines (EUR m):", lines, "| TE", te); print("notes:", notes)
