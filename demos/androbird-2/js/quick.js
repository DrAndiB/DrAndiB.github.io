// Quick entry: "3 Rotmilane überfliegend", "two red kites flying over", "trois milans royaux en vol".
// Finds a count, a species (fuzzy, plural-tolerant, in German/English/French/scientific),
// sex and a breeding hint; everything else becomes the comment.

export const fold = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss")
    .replace(/[’'`´-]/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const NUMBERS = {
  de: ["null", "ein|eine|einen|einer|eins", "zwei", "drei", "vier", "funf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwolf", "dreizehn", "vierzehn", "funfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"],
  en: ["zero", "one|a|an", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"],
  fr: ["zero", "un|une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix sept", "dix huit", "dix neuf", "vingt"],
};
const NUM = new Map();
for (const list of Object.values(NUMBERS)) list.forEach((w, n) => w.split("|").forEach((x) => { if (!x.includes(" ")) NUM.set(x, n); }));
// words that are numbers in one language but common words in another – only count them in front of a species
const WEAK = new Set(["a", "an", "un", "une", "ein", "eine", "einen", "einer"]);

const SEX = [
  [/^(mannchen|maennchen|male|males|m)$/, "Männchen"],
  [/^(weibchen|female|females|femelle|femelles|w|f)$/, "Weibchen"],
  [/^(jungvogel|jungvogel|jungtier|jungtiere|juvenile|juveniles|juv|juvenil)$/, "Jungtier"],
  [/^(adult|adulte|adultes|adults|ad)$/, "Adult"],
  [/^(nest|nid)$/, "Nest"],
  [/^(brutpaar|paar|pair|couple)$/, "Brutpaar"],
  [/^(revier|territory|territoire)$/, "Revier"],
];
const SINGING = /^(singend|singt|gesang|singing|song|chanteur|chanteurs|chante|chant)$/;
const FILLER = new Set(["x", "mal", "stuck", "exemplare", "ex", "ind", "individuen", "individuals", "of", "de", "des", "d"]);

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** Distance between a spoken/typed token and a name token, tolerant to plural endings. */
function tokDist(spoken, name, single = false) {
  if (spoken === name) return 0;
  // German compounds: "fuchs" for "rotfuchs", "igel" for "braunbrustigel"
  if (single && spoken.length >= 4 && name.length > spoken.length + 2 && name.endsWith(spoken)) return 1.6;
  if (single && spoken.length >= 5) { // plural of a compound tail: "Grasmücken" for "Dorngrasmücke"
    const stem = spoken.replace(/(en|n|e|s)$/, "");
    if (stem.length >= 4 && stem !== spoken && name.length > stem.length + 2 && name.endsWith(stem)) return 1.8;
    if (stem.length >= 4 && name.length > spoken.length && name.slice(0, -1).endsWith(stem)) return 1.9;
  }
  if (name.length >= 3 && spoken.startsWith(name) && spoken.length - name.length <= 3) return 0.5; // Rotmilan-e, milan-s
  const d = lev(spoken, name);
  const allowed = name.length >= 8 ? 2 : name.length >= 5 ? 1 : 0;
  return d <= allowed ? d : name.length >= 5 && d <= 2 && spoken.slice(0, 3) === name.slice(0, 3) ? d + 0.5 : 9;
}

let index = null;
/** Build a search index once: every name variant split into folded tokens. */
// Qualifiers people usually leave out when speaking ("Eurasian Blackcap" -> "blackcap")
const EN_QUALIFIERS = new Set(["eurasian", "common", "european", "northern", "western", "eastern", "southern"]);

export function buildIndex(species) {
  index = [];
  const firstCount = new Map();
  const entries = [];
  for (const s of species) {
    const names = ["de", "en", "fr", "la", "syn"].filter((k) => s[k]).map((k) => [k, s[k]]);
    for (const a of s.alt || []) names.push(["alt", a]);
    for (const [key, value] of names) {
      const toks = fold(value).split(" ").filter(Boolean);
      if (!toks.length) continue;
      entries.push({ s, toks, key });
      if (toks.length > 1 && key !== "la" && key !== "syn" && key !== "alt") firstCount.set(toks[0], (firstCount.get(toks[0]) || 0) + 1);
    }
  }
  for (const e of entries) {
    index.push(e);
    if (e.key === "en" && e.toks.length > 1 && EN_QUALIFIERS.has(e.toks[0])) index.push({ ...e, toks: e.toks.slice(1), short: true });
    // "rougegorge" for "Rougegorge familier": first word alone, if no other species starts with it
    if (e.toks.length > 1 && e.toks[0].length >= 6 && firstCount.get(e.toks[0]) === 1 && e.key !== "la" && e.key !== "syn") {
      index.push({ ...e, toks: [e.toks[0]], short: true });
    }
  }
  // a short form must not shadow a real one-word name
  const full = new Set(index.filter((e) => !e.short).map((e) => e.toks.join(" ")));
  index = index.filter((e) => !e.short || !full.has(e.toks.join(" ")));
  return index;
}

/** All species matching some span of the tokens, best first (one entry per species). */
function rankSpecies(tokens, lang) {
  const best = new Map(); // species -> { s, i, len, score }
  for (let len = Math.min(4, tokens.length); len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const span = tokens.slice(i, i + len);
      if (len === 1 && (/^\d+$/.test(span[0]) || span[0].length < 2)) continue;
      for (const e of index) {
        if (e.toks.length !== len) {
          // head word of a longer name: "mésange" -> Mésange bleue, "hawker" -> Southern Hawker, "tit" -> Blue Tit
          if (len === 1 && e.toks.length > 1 && e.key !== "la" && e.key !== "syn") {
            const head = e.key === "fr" ? e.toks[0] : e.toks[e.toks.length - 1];
            if (head.length >= 3 && tokDist(span[0], head) <= 0.5) {
              const score = 1.2 - 2 - (e.s.r ? 0.3 : 0) - (e.key === lang ? 0.1 : 0);
              const prev = best.get(e.s);
              if (!prev || score < prev.score) best.set(e.s, { s: e.s, i, len, score, head: true });
            }
          }
          continue;
        }
        let d = 0;
        for (let k = 0; k < len && d < 9; k++) d += tokDist(span[k], e.toks[k], len === 1);
        if (d >= 9) continue;
        const score = d - len * 2
          - (e.key === lang ? 0.3 : 0) - (e.key === "de" || e.key === "la" || e.key === "alt" ? 0.1 : 0)
          + (e.short ? 0.2 : 0) - (e.s.r ? 0.3 : 0);
        const prev = best.get(e.s);
        if (!prev || score < prev.score) best.set(e.s, { s: e.s, i, len, score });
      }
      // speech recognition often splits German compounds: "rot milane", "Mönchs Grasmücke"
      if (len >= 2 && len <= 3 && span.every((t) => !/^\d+$/.test(t))) {
        const joined = span.join("");
        for (const e of index) {
          if (e.toks.length !== 1) continue;
          const d = tokDist(joined, e.toks[0]);
          if (d >= 9) continue;
          const score = d - len * 2 + 0.3 - (e.s.r ? 0.3 : 0);
          const prev = best.get(e.s);
          if (!prev || score < prev.score) best.set(e.s, { s: e.s, i, len, score });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => a.score - b.score || a.s.de.localeCompare(b.s.de));
}

/** Parse a quick-entry phrase. Returns { species, count, gender, breeding, comment } (fields may be null). */
export function parseQuick(text, { lang = "de", abbreviations, search } = {}) {
  if (!index) return null;
  const raw = String(text || "").trim();
  const tokens = fold(raw).split(" ").filter(Boolean);
  if (!tokens.length) return null;
  const used = new Array(tokens.length).fill(false);

  // species (try with all tokens; numbers never match names)
  let species = null;
  const ranked = rankSpecies(tokens, lang);
  const hit = ranked[0] || null;
  // candidates: the best match plus close alternatives (up to 6), so the user can pick
  const candidates = hit ? ranked.filter((r) => r.score <= hit.score + 2.2).slice(0, 6).map((r) => r.s) : [];
  // top up with look-alikes: names sharing the head word ("Rotmilan" -> Schwarzmilan, "Blaumeise" -> other tits)
  if (hit && candidates.length < 6) {
    const nameOf = (x) => fold(lang === "de" ? x.de : x[lang] || x.en || x.de).split(" ");
    // head noun: first word in French ("Renard roux"), last word in German/English ("Red Fox", "Rot|milan")
    const parts = nameOf(hit.s);
    const head = lang === "fr" ? parts[0] : parts[parts.length - 1];
    const tail = lang !== "fr" && head.length >= 7 ? head.slice(-5) : head;
    const alike = [];
    for (const e of index) {
      if (e.short || candidates.includes(e.s) || alike.includes(e.s) || e.s.c !== hit.s.c) continue;
      if (e.key !== lang && !(lang !== "de" && e.key === "en")) continue;
      const w = lang === "fr" ? e.toks[0] : e.toks[e.toks.length - 1];
      if (w === head || (lang !== "fr" && tail.length >= 5 && w.endsWith(tail))) alike.push(e.s);
    }
    alike.sort((a, b) => (b.r || 0) - (a.r || 0) || a.de.localeCompare(b.de));
    for (const s of alike) { if (candidates.length >= 6) break; candidates.push(s); }
  }
  // top up with search results for the matched words ("Fuchs" -> Rotfuchs, Kleiner Fuchs, Polarfuchs …)
  if (hit && search && candidates.length < 6) {
    const words = raw.split(/\s+/).length === tokens.length ? raw.split(/\s+/).slice(hit.i, hit.i + hit.len).join(" ") : tokens.slice(hit.i, hit.i + hit.len).join(" ");
    for (const s of search(words)) {
      if (candidates.length >= 6) break;
      if (!candidates.includes(s)) candidates.push(s);
    }
  }
  if (hit) {
    species = hit.s;
    for (let k = hit.i; k < hit.i + hit.len; k++) used[k] = true;
  } else if (abbreviations) {
    const i = tokens.findIndex((tk) => abbreviations.has(tk));
    if (i >= 0) { species = abbreviations.get(tokens[i]); used[i] = true; candidates.push(species); }
  }

  let count = null, gender = null, breeding = null;
  tokens.forEach((tk, i) => {
    if (used[i]) return;
    if (/^\d{1,4}$/.test(tk) && count == null) { count = +tk; used[i] = true; return; }
    if (NUM.has(tk) && count == null && (!WEAK.has(tk) || (hit && i < hit.i))) { count = NUM.get(tk) || 1; used[i] = true; return; }
    for (const [re, g] of SEX) if (re.test(tk) && !gender) { gender = g; used[i] = true; return; }
    if (SINGING.test(tk)) breeding = "A2"; // keep the word in the comment as well
    if (FILLER.has(tk)) used[i] = true;
  });

  // comment: the original words that were not consumed, in their original spelling
  const origWords = raw.split(/\s+/);
  const comment = origWords.length === tokens.length
    ? origWords.filter((_, i) => !used[i]).join(" ")
    : tokens.filter((_, i) => !used[i]).join(" ");
  return { species, candidates, count, gender, breeding, comment: comment.replace(/^[,;.\s]+|[,;.\s]+$/g, "") };
}
