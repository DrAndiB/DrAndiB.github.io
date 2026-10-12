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
function tokDist(spoken, name) {
  if (spoken === name) return 0;
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
    for (const key of ["de", "en", "fr", "la", "syn"]) {
      if (!s[key]) continue;
      const toks = fold(s[key]).split(" ").filter(Boolean);
      if (!toks.length) continue;
      entries.push({ s, toks, key });
      if (toks.length > 1 && key !== "la" && key !== "syn") firstCount.set(toks[0], (firstCount.get(toks[0]) || 0) + 1);
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

function bestSpecies(tokens, lang) {
  let best = null;
  for (let len = Math.min(4, tokens.length); len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const span = tokens.slice(i, i + len);
      for (const e of index) {
        if (e.toks.length !== len) continue;
        let d = 0;
        for (let k = 0; k < len && d < 9; k++) d += tokDist(span[k], e.toks[k]);
        if (d >= 9) continue;
        const score = d - len * 2 - (e.key === lang ? 0.3 : 0) - (e.key === "de" || e.key === "la" ? 0.1 : 0) + (e.short ? 0.2 : 0);
        if (!best || score < best.score) best = { s: e.s, i, len, score };
      }
    }
    if (best && best.len === len && best.score <= -len * 2 + 0.6) break; // good match at this length
  }
  return best;
}

/** Parse a quick-entry phrase. Returns { species, count, gender, breeding, comment } (fields may be null). */
export function parseQuick(text, { lang = "de", abbreviations } = {}) {
  if (!index) return null;
  const raw = String(text || "").trim();
  const tokens = fold(raw).split(" ").filter(Boolean);
  if (!tokens.length) return null;
  const used = new Array(tokens.length).fill(false);

  // species (try with all tokens; numbers never match names)
  let species = null;
  const hit = bestSpecies(tokens, lang);
  if (hit) {
    species = hit.s;
    for (let k = hit.i; k < hit.i + hit.len; k++) used[k] = true;
  } else if (abbreviations) {
    const i = tokens.findIndex((tk) => abbreviations.has(tk));
    if (i >= 0) { species = abbreviations.get(tokens[i]); used[i] = true; }
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
  return { species, count, gender, breeding, comment: comment.replace(/^[,;.\s]+|[,;.\s]+$/g, "") };
}
