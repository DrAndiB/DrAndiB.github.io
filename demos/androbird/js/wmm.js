// Magnetic declination from the World Magnetic Model (degree 12), after NOAA's geomag algorithm.
import { WMM_EPOCH, WMM_COEFFS } from "./wmm2025.js";

const N = 12;
const zeros = () => Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
const c = zeros(), cd = zeros(), k = zeros(), snorm = zeros();
const fn = new Array(N + 1).fill(0), fm = new Array(N + 1).fill(0);

for (const [n, m, g, h, dg, dh] of WMM_COEFFS) {
  if (m > n) continue;
  c[m][n] = g; cd[m][n] = dg;
  if (m !== 0) { c[n][m - 1] = h; cd[n][m - 1] = dh; }
}
// Schmidt semi-normalisation
snorm[0][0] = 1;
for (let n = 1; n <= N; n++) {
  snorm[0][n] = (snorm[0][n - 1] * (2 * n - 1)) / n;
  let j = 2;
  for (let m = 0; m <= n; m++) {
    k[m][n] = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
    if (m > 0) {
      const flnmj = ((n - m + 1) * j) / (n + m);
      snorm[m][n] = snorm[m - 1][n] * Math.sqrt(flnmj);
      j = 1;
      c[n][m - 1] *= snorm[m][n];
      cd[n][m - 1] *= snorm[m][n];
    }
    c[m][n] *= snorm[m][n];
    cd[m][n] *= snorm[m][n];
  }
  fn[n] = n + 1;
  fm[n] = n;
}
k[1][1] = 0;

/** Declination in degrees (east positive) at lat/lon (deg), altitude (km), decimal year. */
export function declination(lat, lon, altKm = 0, year = decimalYear()) {
  const a = 6378.137, b = 6356.7523142, re = 6371.2;
  const a2 = a * a, b2 = b * b, c2 = a2 - b2, a4 = a2 * a2, b4 = b2 * b2, c4 = a4 - b4;
  const dt = year - WMM_EPOCH;
  const rlat = (lat * Math.PI) / 180, rlon = (lon * Math.PI) / 180;
  const srlat = Math.sin(rlat), crlat = Math.cos(rlat), srlon = Math.sin(rlon), crlon = Math.cos(rlon);
  const srlat2 = srlat * srlat, crlat2 = crlat * crlat;
  const sp = new Array(N + 1).fill(0), cp = new Array(N + 1).fill(0);
  sp[0] = 0; cp[0] = 1; sp[1] = srlon; cp[1] = crlon;

  const q = Math.sqrt(a2 - c2 * srlat2);
  const q1 = altKm * q;
  const q2 = ((q1 + a2) / (q1 + b2)) ** 2;
  const ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
  const st = Math.sqrt(1 - ct * ct);
  const r2 = altKm * altKm + 2 * q1 + (a4 - c4 * srlat2) / (q * q);
  const r = Math.sqrt(r2);
  const d = Math.sqrt(a2 * crlat2 + b2 * srlat2);
  const ca = (altKm + d) / r, sa = (c2 * crlat * srlat) / (r * d);
  for (let m = 2; m <= N; m++) {
    sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
    cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
  }
  const aor = re / r;
  let ar = aor * aor, br = 0, bt = 0, bp = 0;
  const p = zeros(), dp = zeros(), tc = zeros();
  p[0][0] = 1;
  for (let n = 1; n <= N; n++) {
    ar *= aor;
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        p[m][n] = st * p[m - 1][n - 1];
        dp[m][n] = st * dp[m - 1][n - 1] + ct * p[m - 1][n - 1];
      } else if (n === 1 && m === 0) {
        p[m][n] = ct * p[m][n - 1];
        dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1];
      } else {
        if (m > n - 2) { p[m][n - 2] = 0; dp[m][n - 2] = 0; }
        p[m][n] = ct * p[m][n - 1] - k[m][n] * p[m][n - 2];
        dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1] - k[m][n] * dp[m][n - 2];
      }
      tc[m][n] = c[m][n] + dt * cd[m][n];
      if (m !== 0) tc[n][m - 1] = c[n][m - 1] + dt * cd[n][m - 1];
      const par = ar * p[m][n];
      let t1, t2;
      if (m === 0) { t1 = tc[m][n] * cp[m]; t2 = tc[m][n] * sp[m]; }
      else { t1 = tc[m][n] * cp[m] + tc[n][m - 1] * sp[m]; t2 = tc[m][n] * sp[m] - tc[n][m - 1] * cp[m]; }
      bt -= ar * t1 * dp[m][n];
      bp += fm[m] * t2 * par;
      br += fn[n] * t1 * par;
    }
  }
  if (st !== 0) bp /= st;
  const bx = -bt * ca - br * sa;
  const by = bp;
  return (Math.atan2(by, bx) * 180) / Math.PI;
}

export function decimalYear(date = new Date()) {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}
