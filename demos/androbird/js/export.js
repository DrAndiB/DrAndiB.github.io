// File exports, ported from SightingManagementActivity.java.
import { toNMEA, toUTM } from "./geo.js";

const CODES = { CODREV: "Rev ", CODNEST: "Nst ", CODADULT: "ad ", CODJUV: "juv ", CODPUL: "pul ", CODBP: "BP " };

/** Quick-comment codes that the edit screen appends to comments. */
export const QUICK_CODES = [
  ["CODREV", "Code Revier"],
  ["CODNEST", "Code Nest"],
  ["CODADULT", "Code Adult"],
  ["CODJUV", "Code Juvenile"],
  ["CODPUL", "Code Pullus"],
  ["CODBP", "Code Brutpaar"],
];

export function removeCodes(comment = "") {
  let r = comment;
  for (const k of Object.keys(CODES)) r = r.split(k).join("");
  return r.replace(/\s{2,}/g, " ").trim();
}
export function codesFrom(comment = "") {
  return Object.entries(CODES).filter(([k]) => comment.includes(k)).map(([, v]) => v).join("");
}

const GENDER_CODE = {
  "Männchen": "M ", "Weibchen": "F ", "Jungtier": "juv ", "Pullus": "pul ", "Adult": "ad. ",
  "Subadult": "suad. ", "Brutpaar": "BP ", "Nest": "Nst ", "Revier": "Rev ", "Unbekannt": "Ind ",
};

const pad = (n) => String(n).padStart(2, "0");
const clean = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ");

/** MiniAvi tab-separated file (beobachtungen.asc) – birds only. */
export function miniAvi(sightings, observer = "") {
  const header = "Euring\tArtname\tDatum\tOst\tNord\tOrt\tmale\tfemale\tInd.\tcode\tBio\tKommentar\tBeobachter\n";
  const lines = sightings
    .filter((s) => s.category === "BIRD")
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => {
      const d = new Date(s.timestamp);
      const code = (GENDER_CODE[s.gender] || "") + codesFrom(s.comment);
      return [
        "0", clean(s.germanname), pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear(),
        toNMEA(s.longitude), toNMEA(s.latitude), "", "0", "0", s.number, code, "0",
        clean(removeCodes(s.comment)), clean(observer || "0"),
      ].join("\t") + "\t";
    });
  return header + lines.join("\n") + (lines.length ? "\n" : "");
}

/** Java Date.toString()-style stamp: "Mon Oct 12 22:55:00 CEST 2026". */
function javaDate(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  let tz = "";
  try {
    tz = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" }).formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value || "";
  } catch { /* ignore */ }
  return `${day} ${mon} ${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${tz} ${d.getFullYear()}`;
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV export (beobachtungen.csv). `category` = "ALL" or BIRD/AMPHIBIAN/INSECT/MAMMAL. */
export function csv(sightings, category = "ALL") {
  const header = "Title,Date Created,Latitude,Longitude,Northing,Easting,Description,Avi,Sex,Sonstiges,Sonstiges 2,Verhalten,Zahl\n";
  const rows = sightings
    .filter((s) => category === "ALL" || s.category === category)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => {
      const utm = toUTM(s.latitude, s.longitude);
      return [
        "", javaDate(s.timestamp), s.latitude, s.longitude, Math.trunc(utm.northing), Math.trunc(utm.easting),
        "", s.germanname, s.gender, "", "", removeCodes(s.comment), s.number,
      ].map(csvCell).join(",");
    });
  return header + rows.join("\n") + (rows.length ? "\n" : "");
}

// Windows-1252 encoder (the Android app wrote "Cp1252").
const CP1252_HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
export function encodeCp1252(text) {
  const out = new Uint8Array(text.length);
  let i = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    out[i++] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP1252_HIGH[c] ?? 0x3f;
  }
  return out.slice(0, i);
}
