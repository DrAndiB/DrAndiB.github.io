"""Estimates how Luxembourg has responded to foreign shocks, from the quarterly files in data/raw.
A vector autoregression in growth rates with block exogeneity (Luxembourg does not move the foreign block),
lag-weighted ridge shrinkage and down-weighted pandemic quarters. Writes dev/src/shortrun.js."""
import csv, json, pathlib, numpy as np

HERE = pathlib.Path(__file__).parent; RAW = HERE / "raw"
P_LAGS, KAPPA, COVID_W, H = 4, 1.0, 0.1, 20

def jstat(fn, **sel):
    j = json.load(open(RAW / fn)); ids, size = j["id"], j["size"]; pos = {d: j["dimension"][d]["category"]["index"] for d in ids}; out = {}
    for t in sorted(pos["time"], key=lambda k: pos["time"][k]):
        idx = 0
        for d, n in zip(ids, size):
            c = t if d == "time" else sel.get(d, next(iter(pos[d]))); idx = idx * n + pos[d][c]
        v = j["value"].get(str(idx)) if isinstance(j["value"], dict) else j["value"][idx]
        if v is not None: out[t] = v
    return out
def monthly(fn):
    q = {}
    for r in csv.DictReader(open(RAW / fn, encoding="utf-8-sig")):
        if r.get("OBS_VALUE"):
            y, m = r["TIME_PERIOD"][:4], int(r["TIME_PERIOD"][5:7]); q.setdefault(f"{y}-Q{(m - 1) // 3 + 1}", []).append(float(r["OBS_VALUE"]))
    return {k: sum(v) / len(v) for k, v in q.items()}
def brent():
    try:
        import xlrd, datetime
        sh = xlrd.open_workbook(RAW / "eia_brent.xls").sheet_by_index(1); q = {}
        for i in range(sh.nrows):
            a, b = sh.cell_value(i, 0), sh.cell_value(i, 1)
            if isinstance(a, float) and isinstance(b, float) and a > 30000:
                d = xlrd.xldate_as_datetime(a, 0); q.setdefault(f"{d.year}-Q{(d.month - 1) // 3 + 1}", []).append(b)
        return {k: sum(v) / len(v) for k, v in q.items()}
    except Exception as e: print("oil price not readable:", e); return None

sa = dict(unit="CLV15_MEUR", s_adj="SCA")
ea = jstat("es_namq_10_gdp.json", geo="EA20", na_item="B1GQ", **sa)
tot = jstat("es_namq_10_a10.json", geo="LU", na_item="B1G", nace_r2="TOTAL", **sa); fin = jstat("es_namq_10_a10.json", geo="LU", na_item="B1G", nace_r2="K", **sa)
emp = {}
for r in csv.DictReader(open(RAW / "lustat_B3002_employment_by_residence.csv", encoding="utf-8-sig")):
    if r["ADJUSTMENT"] == "Y" and r["OBS_VALUE"]: emp.setdefault(r["RESIDENCE"], {})[r["TIME_PERIOD"]] = float(r["OBS_VALUE"])
res = emp.get("_T_RES", {}); com = {t: emp["_T"][t] - res[t] for t in emp.get("_T", {}) if t in res}
eq, rate, usd, oil = monthly("ecb_eurostoxx50.csv"), monthly("ecb_euribor3m.csv"), monthly("ecb_usd_per_eur.csv"), brent()
oil_eur = {t: oil[t] / usd[t] for t in oil if t in usd} if oil else None

levels = {"energy": oil_eur, "ea": ea, "rate": rate, "equity": eq, "gvaF": fin, "gvaNF": {t: tot[t] - fin[t] for t in tot if t in fin}, "res": res, "com": com}
FOREIGN = [k for k in ["energy", "ea", "rate", "equity"] if levels[k]]; LUX = ["gvaF", "gvaNF", "res", "com"]; names = FOREIGN + LUX
qs = sorted(set.intersection(*[set(levels[k]) for k in names]))
qs = [t for i, t in enumerate(qs)]
def growth(k):
    v = np.array([levels[k][t] for t in qs]); return np.diff(v) if k == "rate" else 100 * np.diff(np.log(v))
Z = np.column_stack([growth(k) for k in names]); tq = qs[1:]; sd = Z.std(0); mu = Z.mean(0); S = (Z - mu) / sd
w_all = np.array([COVID_W if "2020-Q1" <= t <= "2021-Q2" else 1.0 for t in tq])
nf, nl, T = len(FOREIGN), len(LUX), len(S)

def ridge(yv, cols, lags):  # weighted ridge, heavier penalty on longer lags
    X = np.column_stack(cols); W = w_all[P_LAGS:]; pen = np.diag([KAPPA * max(l, 0.3) ** 2 for l in lags])
    return np.linalg.solve(X.T @ (X * W[:, None]) + pen, X.T @ (W * yv)), X
def lagmat(block, l): return S[P_LAGS - l: T - l][:, block]
fb, lb = list(range(nf)), list(range(nf, nf + nl))
# foreign block on its own lags
fcols, flags = [], []
for l in range(1, P_LAGS + 1):
    for j in fb: fcols.append(lagmat([j], l)[:, 0]); flags.append(l)
Bf, resid_f = [], []
for j in fb:
    b, X = ridge(S[P_LAGS:, j], fcols, flags); Bf.append(b); resid_f.append(S[P_LAGS:, j] - X @ b)
resid_f = np.array(resid_f).T; W = w_all[P_LAGS:]; cov = (resid_f * W[:, None]).T @ resid_f / W.sum(); chol = np.linalg.cholesky(cov)
# Luxembourg block on its own lags and on current and lagged foreign variables
lcols, llags = [], []
for l in range(0, P_LAGS + 1):
    for j in fb: lcols.append(lagmat([j], l)[:, 0]); llags.append(l)
for l in range(1, P_LAGS + 1):
    for j in lb: lcols.append(lagmat([j], l)[:, 0]); llags.append(l)
Bl, r2 = [], {}
for j in lb:
    b, X = ridge(S[P_LAGS:, j], lcols, llags); Bl.append(b); e = S[P_LAGS:, j] - X @ b; r2[names[j]] = round(1 - (W * e * e).sum() / (W * (S[P_LAGS:, j] - np.average(S[P_LAGS:, j], weights=W)) ** 2).sum(), 2)

def irf(shock):  # level responses over H quarters to a one-standard-deviation structural shock
    hist = np.zeros((P_LAGS + H, nf + nl))
    for h in range(H):
        t = P_LAGS + h; xf = np.array([hist[t - l, j] for l in range(1, P_LAGS + 1) for j in fb])
        hist[t, fb] = np.array([Bf[i] @ xf for i in range(nf)]) + (chol[:, shock] if h == 0 else 0)
        xl = np.array([hist[t - l, j] for l in range(0, P_LAGS + 1) for j in fb] + [hist[t - l, j] for l in range(1, P_LAGS + 1) for j in lb])
        hist[t, lb] = [Bl[i] @ xl for i in range(nl)]
    return np.cumsum(hist[P_LAGS:] * sd, axis=0)
yearly = lambda lev: [float(lev[4 * y: 4 * y + 4].mean()) for y in range(5)]
UNIT = {"energy": 10, "ea": 1, "rate": 1, "equity": 10}
out = {}
for s, k in enumerate(FOREIGN):
    lev = irf(s); own = yearly(lev[:, s]); scale = UNIT[k] / own[0]
    out[k] = {"own": [round(v * scale, 3) for v in own], **{n: [round(v * scale, 3) for v in yearly(lev[:, nf + i])] for i, n in enumerate(LUX)}}
meta = {"sample": f"{tq[P_LAGS]} to {tq[-1]}", "quarters": int(T - P_LAGS), "lags": P_LAGS, "foreign": FOREIGN, "fit": r2, "units": {"energy": "energy price 10% higher in year 1", "ea": "euro area GDP 1% higher in year 1", "rate": "interest rate 1 point higher in year 1", "equity": "share prices 10% higher in year 1"}}
(HERE.parent / "dev" / "src" / "shortrun.js").write_text("/* Generated by data/estimate.py. Level responses in percent, yearly averages for years 1 to 5. */\nexport const SHORTRUN = " + json.dumps({"meta": meta, "irf": out}, indent=1) + ";\n", encoding="utf-8")
print("sample", meta["sample"], "|", meta["quarters"], "quarters | fit (weighted R2):", r2)
for k in FOREIGN:
    print(f"\nshock: {meta['units'][k]}  (own path {out[k]['own']})")
    for n in LUX: print(f"   {n:6s}", out[k][n])
