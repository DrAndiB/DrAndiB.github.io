"""Estimates how Luxembourg has responded to foreign shocks, from the quarterly files in data/raw.
A vector autoregression in growth rates with block exogeneity (Luxembourg does not move the foreign block),
lag-weighted ridge shrinkage and down-weighted pandemic quarters. The responses are turned into the handful of
numbers the model uses, each with a 90% interval from a wild bootstrap. Writes dev/src/shortrun.js."""
import csv, json, pathlib, numpy as np

HERE = pathlib.Path(__file__).parent; RAW = HERE / "raw"
P_LAGS, KAPPA, COVID_W, H, BOOT = 4, 1.0, 0.1, 20, 400

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

fb, lb = list(range(nf)), list(range(nf, nf + nl)); W = w_all[P_LAGS:]

def fit(S):
    """Foreign block on its own lags; Luxembourg block on its own lags and on current and lagged foreign variables."""
    lag = lambda j, l: S[P_LAGS - l: T - l, j]
    def ridge(yv, cols, lags):  # weighted ridge, heavier penalty on longer lags
        X = np.column_stack(cols); pen = np.diag([KAPPA * max(l, 0.3) ** 2 for l in lags])
        b = np.linalg.solve(X.T @ (X * W[:, None]) + pen, X.T @ (W * yv)); return b, yv - X @ b
    fcols = [lag(j, l) for l in range(1, P_LAGS + 1) for j in fb]; flags = [l for l in range(1, P_LAGS + 1) for j in fb]
    lcols = [lag(j, l) for l in range(0, P_LAGS + 1) for j in fb] + [lag(j, l) for l in range(1, P_LAGS + 1) for j in lb]
    llags = [l for l in range(0, P_LAGS + 1) for j in fb] + [l for l in range(1, P_LAGS + 1) for j in lb]
    F = [ridge(S[P_LAGS:, j], fcols, flags) for j in fb]; L = [ridge(S[P_LAGS:, j], lcols, llags) for j in lb]
    Bf, ef = [b for b, _ in F], np.array([e for _, e in F]).T; Bl, el = [b for b, _ in L], np.array([e for _, e in L]).T
    cov = (ef * W[:, None]).T @ ef / W.sum()
    return Bf, Bl, np.linalg.cholesky(cov), ef, el

def step(hist, t, Bf, Bl, ef=0, el=0):
    xf = np.array([hist[t - l, j] for l in range(1, P_LAGS + 1) for j in fb]); hist[t, fb] = np.array([b @ xf for b in Bf]) + ef
    xl = np.array([hist[t - l, j] for l in range(0, P_LAGS + 1) for j in fb] + [hist[t - l, j] for l in range(1, P_LAGS + 1) for j in lb]); hist[t, lb] = np.array([b @ xl for b in Bl]) + el

yearly = lambda lev: [float(lev[4 * y: 4 * y + 4].mean()) for y in range(5)]
UNIT = {"energy": 10, "ea": 1, "rate": 1, "equity": 10}
def responses(Bf, Bl, chol):
    """Yearly level responses (years 1 to 5) of every variable to each foreign shock, scaled to the units above."""
    out = {}
    for s, k in enumerate(FOREIGN):
        hist = np.zeros((P_LAGS + H, nf + nl))
        for h in range(H): step(hist, P_LAGS + h, Bf, Bl, chol[:, s] if h == 0 else 0)
        lev = np.cumsum(hist[P_LAGS:] * sd, axis=0); own = yearly(lev[:, s]); scale = UNIT[k] / own[0]
        out[k] = {"own": [v * scale for v in own], **{n: [v * scale for v in yearly(lev[:, i])] for i, n in enumerate(names) if i != s}}
    return out

X0, R0 = np.mean([com[t] for t in qs[-4:]]), np.mean([res[t] for t in qs[-4:]])
def numbers(I):
    """The numbers the model uses. Euro area effects are net of the share-price movement that comes with a euro area
    shock, because scenarios set growth and market returns separately."""
    ea, eqs = I["ea"], I["equity"]; m3 = lambda f: float(np.mean([f(i) for i in range(3)]))
    net = lambda n: m3(lambda i: (ea[n][i] - eqs[n][i] * ea["equity"][i] / eqs["own"][i]) / ea["own"][i])
    jobs = lambda i: (ea["res"][i] * R0 + ea["com"][i] * X0) / (R0 + X0); ratio = [jobs(i) / ea["gvaNF"][i] if abs(ea["gvaNF"][i]) > 1e-9 else np.nan for i in range(5)]
    emp_el = float(np.mean(ratio[2:])); sp = [ratio[0] / emp_el, 1 - np.sqrt(max(0.0, 1 - min(1.0, ratio[1] / emp_el)))] if emp_el > 0 else [np.nan, np.nan]
    return {"srFea": net("gvaF"), "srFeaTotal": m3(lambda i: ea["gvaF"][i] / ea["own"][i]), "srNFea": net("gvaNF"), "srNFeaTotal": m3(lambda i: ea["gvaNF"][i] / ea["own"][i]),
            "srFmkt": m3(lambda i: eqs["gvaF"][i] / eqs["own"][i]), "srFrate": m3(lambda i: I["rate"]["gvaF"][i] / I["rate"]["own"][i]),
            "cycCom": ea["com"][1] * X0 / (ea["com"][1] * X0 + ea["res"][1] * R0), "empEl": emp_el, "jobAdj": float(np.mean(sp))}

Bf, Bl, chol, ef, el = fit(S); irf = responses(Bf, Bl, chol); point = numbers(irf)
r2 = {names[j]: round(1 - (W * el[:, i] ** 2).sum() / (W * (S[P_LAGS:, j] - np.average(S[P_LAGS:, j], weights=W)) ** 2).sum(), 2) for i, j in enumerate(lb)}

# wild bootstrap: flip the sign of each quarter's residuals at random, rebuild the series, estimate again
rng = np.random.default_rng(20261125); draws = {k: [] for k in point}
for b in range(BOOT):
    sign = rng.choice([-1.0, 1.0], size=T - P_LAGS); Sb = S.copy()
    for i, t in enumerate(range(P_LAGS, T)): step(Sb, t, Bf, Bl, ef[i] * sign[i], el[i] * sign[i])
    try: nb = numbers(responses(*fit(Sb)[:3]))
    except np.linalg.LinAlgError: continue
    for k in point: draws[k].append(nb[k])
params = {k: {"v": round(point[k], 3), "lo": round(float(np.nanpercentile(draws[k], 5)), 3), "hi": round(float(np.nanpercentile(draws[k], 95)), 3)} for k in point}

rnd = lambda d: {k: [round(v, 3) for v in a] for k, a in d.items()}
meta = {"sample": f"{tq[P_LAGS]} to {tq[-1]}", "quarters": int(T - P_LAGS), "lags": P_LAGS, "foreign": FOREIGN, "fit": r2, "bootstrap": len(draws["srFea"]),
        "units": {"energy": "energy price 10% higher in year 1", "ea": "euro area GDP 1% higher in year 1", "rate": "interest rate 1 point higher in year 1", "equity": "share prices 10% higher in year 1"}}
(HERE.parent / "dev" / "src" / "shortrun.js").write_text("/* Generated by data/estimate.py. Level responses in percent, yearly averages for years 1 to 5.\n   params: the numbers the model uses, with 90% bootstrap intervals. */\nexport const SHORTRUN = " + json.dumps({"meta": meta, "params": params, "irf": {k: rnd(v) for k, v in irf.items()}}, indent=1) + ";\n", encoding="utf-8")
print("sample", meta["sample"], "|", meta["quarters"], "quarters | fit (weighted R2):", r2, "| bootstrap draws:", meta["bootstrap"])
for k, e in params.items(): print(f"   {k:12s} {e['v']:7.3f}   90% interval {e['lo']:7.3f} to {e['hi']:7.3f}")
for k in FOREIGN:
    print(f"\nshock: {meta['units'][k]}  (own path {[round(v, 2) for v in irf[k]['own']]})")
    for n in names:
        if n in irf[k]: print(f"   {n:6s}", [round(v, 2) for v in irf[k][n]])
