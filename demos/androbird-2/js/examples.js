// Example data for website visitors: a morning survey walk around the Haff Réimech wetlands
// (Remerschen, Luxembourg). Marked with example: true so it can be removed in one go.
import { destination } from "./geo.js";

// Loop path around the ponds (approximate, for illustration)
const PATH = [
  [49.49152, 6.35020], [49.49105, 6.35310], [49.49040, 6.35580], [49.48955, 6.35795], [49.48850, 6.35930],
  [49.48720, 6.35985], [49.48590, 6.35930], [49.48500, 6.35780], [49.48460, 6.35560], [49.48490, 6.35330],
  [49.48575, 6.35140], [49.48690, 6.35010], [49.48820, 6.34950], [49.48960, 6.34945], [49.49080, 6.34975],
];

// [German name, path index, minutes after start, count, sex/code, breeding code, distance m, bearing, comment]
const RECORDS = [
  ["Blaukehlchen", 1, 6, 1, "Männchen", "A2", 35, 120, { de: "singend im Schilf", en: "singing in the reeds", fr: "chanteur dans les roseaux" }],
  ["Teichrohrsänger", 2, 11, 3, "Unbekannt", "A2", 25, 150, { de: "singend", en: "singing", fr: "chanteurs" }],
  ["Haubentaucher", 3, 18, 2, "Brutpaar", "B5", 120, 220, { de: "Balz", en: "courtship display", fr: "parade" }],
  ["Kormoran", 4, 24, 14, "Unbekannt", "", 260, 250, { de: "auf der Insel rastend", en: "resting on the island", fr: "au repos sur l'île" }],
  ["Eisvogel", 5, 29, 1, "Adult", "C13", 60, 300, { de: "fliegt Brutröhre an", en: "entering nest burrow", fr: "entre dans le terrier" }],
  ["Graureiher", 6, 34, 2, "Adult", "", 180, 330, { de: "jagend am Ufer", en: "hunting at the edge", fr: "chasse sur la berge" }],
  ["Rotmilan", 7, 40, 1, "Unbekannt", "", 400, 200, { de: "überfliegend Richtung Mosel", en: "flying over towards the Moselle", fr: "survole vers la Moselle" }],
  ["Graugans", 8, 47, 23, "Unbekannt", "", 150, 20, { de: "", en: "", fr: "" }],
  ["Zwergtaucher", 9, 52, 1, "Unbekannt", "A1", 80, 60, { de: "", en: "", fr: "" }],
  ["Grasfrosch", 10, 58, 5, "Unbekannt", "", 5, 0, { de: "Laichballen im Graben", en: "spawn clumps in the ditch", fr: "pontes dans le fossé" }],
  ["Rohrammer", 11, 66, 2, "Männchen", "B4", 40, 90, { de: "", en: "", fr: "" }],
  ["Schwarzmilan", 12, 73, 2, "Unbekannt", "", 500, 40, { de: "kreisend", en: "circling", fr: "en cercle" }],
  ["Nachtigall", 13, 81, 1, "Männchen", "A2", 30, 270, { de: "singend im Gebüsch", en: "singing in the scrub", fr: "chanteur dans les buissons" }],
];

export function exampleData(speciesList, lang = document.documentElement.lang || "de") {
  const byDe = new Map(speciesList.map((s) => [s.de, s]));
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(7, 5, 0, 0);
  const t0 = start.getTime();
  const walkId = "w-example";
  const points = PATH.map(([la, lo], i) => [la, lo, t0 + i * 6 * 60000]);
  points.push([...PATH[0], t0 + PATH.length * 6 * 60000]);
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points[i - 1], [c, d] = points[i];
    const dy = (c - a) * 111320, dx = (d - b) * 111320 * Math.cos((a * Math.PI) / 180);
    length += Math.hypot(dx, dy);
  }
  const sightings = RECORDS.map(([de, idx, min, n, gender, breeding, dist, brg, comment], i) => {
    const sp = byDe.get(de);
    const [olat, olon] = PATH[idx];
    const pos = destination(olat, olon, brg, dist);
    return {
      id: `example-${i}`, example: true, walkId,
      timestamp: t0 + min * 60000, latitude: pos.lat, longitude: pos.lon,
      latinname: sp?.la || de, germanname: de, category: sp?.c || "BIRD",
      number: n, gender, breeding: breeding || undefined, comment: comment[lang] ?? comment.de,
      accuracy: 6, distance: dist, heading: brg, origin: { lat: olat, lon: olon },
    };
  });
  return { sightings, walk: { id: walkId, example: true, start: t0, end: t0 + 92 * 60000, points, length } };
}
