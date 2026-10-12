// Geodesy helpers, ported from GPSTool.java (gavaghan geodesy + jcoord).

const A = 6378137.0;               // WGS84 semi-major axis
const F = 1 / 298.257223563;       // WGS84 flattening
const B = (1 - F) * A;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/**
 * Vincenty direct solution: the point `distance` metres from (lat, lon)
 * along initial bearing `bearing` (degrees). Same as
 * GeodeticCalculator.calculateEndingGlobalCoordinates(WGS84, ...).
 */
export function destination(lat, lon, bearing, distance) {
  if (!distance) return { lat, lon };
  const a1 = rad(bearing);
  const sinA1 = Math.sin(a1), cosA1 = Math.cos(a1);
  const tanU1 = (1 - F) * Math.tan(rad(lat));
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1), sinU1 = tanU1 * cosU1;
  const s1 = Math.atan2(tanU1, cosA1);
  const sinA = cosU1 * sinA1;
  const cos2A = 1 - sinA * sinA;
  const u2 = (cos2A * (A * A - B * B)) / (B * B);
  const AA = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const BB = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));

  let s = distance / (B * AA), sPrev, cos2Sm, sinS, cosS, guard = 0;
  do {
    cos2Sm = Math.cos(2 * s1 + s);
    sinS = Math.sin(s); cosS = Math.cos(s);
    const dS = BB * sinS * (cos2Sm + (BB / 4) * (cosS * (-1 + 2 * cos2Sm * cos2Sm) -
      (BB / 6) * cos2Sm * (-3 + 4 * sinS * sinS) * (-3 + 4 * cos2Sm * cos2Sm)));
    sPrev = s;
    s = distance / (B * AA) + dS;
  } while (Math.abs(s - sPrev) > 1e-12 && ++guard < 200);

  cos2Sm = Math.cos(2 * s1 + s); sinS = Math.sin(s); cosS = Math.cos(s);
  const x = sinU1 * sinS - cosU1 * cosS * cosA1;
  const lat2 = Math.atan2(sinU1 * cosS + cosU1 * sinS * cosA1, (1 - F) * Math.sqrt(sinA * sinA + x * x));
  const lambda = Math.atan2(sinS * sinA1, cosU1 * cosS - sinU1 * sinS * cosA1);
  const C = (F / 16) * cos2A * (4 + F * (4 - 3 * cos2A));
  const L = lambda - (1 - C) * F * sinA * (s + C * sinS * (cos2Sm + C * cosS * (-1 + 2 * cos2Sm * cos2Sm)));
  let lon2 = lon + deg(L);
  lon2 = ((lon2 + 540) % 360) - 180;
  return { lat: deg(lat2), lon: lon2 };
}

/** Decimal degrees -> NMEA ddmm.mmmm, exactly as GPSTool.locationToNMEA. */
export function toNMEA(measure) {
  let result;
  if (measure >= 0) {
    const d = Math.floor(measure);
    result = d * 100 + (measure - d) * 60;
  } else {
    const d = Math.ceil(measure);
    result = d * 100 - Math.abs(measure - d) * 60;
  }
  return result.toFixed(4);
}

/** WGS84 lat/lon -> UTM { zone, band, easting, northing } (jcoord LatLng.toUTMRef). */
export function toUTM(lat, lon) {
  const k0 = 0.9996;
  const e2 = F * (2 - F);
  const ep2 = e2 / (1 - e2);
  let zone = Math.floor((lon + 180) / 6) + 1;
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
  if (lat >= 72 && lat < 84) {
    if (lon >= 0 && lon < 9) zone = 31;
    else if (lon >= 9 && lon < 21) zone = 33;
    else if (lon >= 21 && lon < 33) zone = 35;
    else if (lon >= 33 && lon < 42) zone = 37;
  }
  const lon0 = rad((zone - 1) * 6 - 180 + 3);
  const phi = rad(lat);
  const sinP = Math.sin(phi), cosP = Math.cos(phi), tanP = Math.tan(phi);
  const N = A / Math.sqrt(1 - e2 * sinP * sinP);
  const T = tanP * tanP;
  const C = ep2 * cosP * cosP;
  const AA = cosP * (rad(lon) - lon0);
  const e4 = e2 * e2, e6 = e4 * e2;
  const M = A * ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi
    - ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi)
    + ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi)
    - ((35 * e6) / 3072) * Math.sin(6 * phi));
  const easting = k0 * N * (AA + ((1 - T + C) * AA ** 3) / 6
    + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * AA ** 5) / 120) + 500000;
  let northing = k0 * (M + N * tanP * ((AA * AA) / 2
    + ((5 - T + 9 * C + 4 * C * C) * AA ** 4) / 24
    + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * AA ** 6) / 720));
  if (lat < 0) northing += 10000000;
  const band = "CDEFGHJKLMNPQRSTUVWXX"[Math.max(0, Math.min(20, Math.floor((lat + 80) / 8)))];
  return { zone, band, easting, northing };
}

const POINTS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** 247 -> "WSW" (German compass points, O = Ost). */
export function compassPoint(h) {
  return POINTS[Math.round(norm(h) / 22.5) % 16];
}
export function norm(h) {
  return ((h % 360) + 360) % 360;
}

/** Great-circle distance in metres (for display only). */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371008.8;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
