// Local persistence. Mirrors the Room tables (sightings) and SharedPreferences.

const KEY = {
  sightings: "androbird2.sightings", settings: "androbird2.settings", recent: "androbird2.recent",
  draft: "androbird2.draft", walks: "androbird2.walks", meta: "androbird2.meta",
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const GENDERS = ["Unbekannt", "Männchen", "Weibchen", "Jungtier", "Pullus", "Adult", "Subadult", "Brutpaar", "Nest", "Revier"];

export const CATEGORIES = ["BIRD", "AMPHIBIAN", "INSECT", "MAMMAL"];

export const DEFAULT_SETTINGS = {
  username: "",
  email: "",
  maxDistance: 1000,          // metres; Android: 500 m … 10 km
  mapType: "normal",          // normal | satellite | hybrid | topo
  searchType: "names",        // names | abbreviations
  categories: ["BIRD", "AMPHIBIAN", "INSECT", "MAMMAL"],
  autoTime: false,
  autoAltitude: false,
  defaultCount: 1,
  defaultGender: "Unbekannt",
  defaultComment: "",
  headingMode: "manual",      // manual: "Zugrichtung" resets after each save; dynamic: stays on
  keepAwake: true,
  lang: "auto",               // auto | de | en | fr
  declination: true,          // correct compass readings to true north (WMM 2025)
  blurSensitive: true,        // exports: blur nest sites of sensitive species
};

export const settings = {
  get() {
    return { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) };
  },
  set(patch) {
    const next = { ...this.get(), ...patch };
    write(KEY.settings, next);
    return next;
  },
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const sightings = {
  all() {
    return read(KEY.sightings, []);
  },
  saveAll(list) {
    return write(KEY.sightings, list);
  },
  add(s) {
    const list = this.all();
    const rec = { id: uid(), ...s };
    list.push(rec);
    return this.saveAll(list) ? rec : null;
  },
  update(rec) {
    const list = this.all().map((s) => (s.id === rec.id ? { ...s, ...rec } : s));
    return this.saveAll(list);
  },
  remove(id) {
    return this.saveAll(this.all().filter((s) => s.id !== id));
  },
  clear() {
    return this.saveAll([]);
  },
  /** Merge a backup; returns number of new records. */
  merge(records) {
    const list = this.all();
    const ids = new Set(list.map((s) => s.id));
    let added = 0;
    for (const r of records) {
      if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number" || !r.germanname) continue;
      const rec = { ...r, id: r.id && !ids.has(r.id) ? r.id : uid() };
      ids.add(rec.id);
      list.push(rec);
      added++;
    }
    this.saveAll(list);
    return added;
  },
};

export const recent = {
  get() {
    return read(KEY.recent, []);
  },
  push(name) {
    const list = [name, ...this.get().filter((n) => n !== name)].slice(0, 10);
    write(KEY.recent, list);
    return list;
  },
};

export const draft = {
  get() {
    return read(KEY.draft, {});
  },
  set(patch) {
    write(KEY.draft, { ...this.get(), ...patch });
  },
};

export const walks = {
  all() { return read(KEY.walks, []); },
  save(list) { return write(KEY.walks, list); },
  upsert(w) {
    const list = this.all();
    const i = list.findIndex((x) => x.id === w.id);
    if (i >= 0) list[i] = w; else list.push(w);
    return this.save(list);
  },
  remove(pred) { return this.save(this.all().filter((w) => !pred(w))); },
};

export const meta = {
  get() { return read(KEY.meta, {}); },
  set(patch) { write(KEY.meta, { ...this.get(), ...patch }); },
};

export { uid };

/** Normalise a name for matching: lower case, no accents, ß→ss, hyphens and apostrophes as spaces. */
export const foldName = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/ß/g, "ss").replace(/[-'’`´]/g, " ").replace(/\s+/g, " ").trim();

let speciesCache = null;
/** Add the folded search keys the search and the quick parser use. */
export function prepareSpecies(list) {
  for (const s of list) {
    s.keys = [s.de, s.en, s.fr, s.la, s.syn].filter(Boolean).map(foldName);
    s.alts = (s.alt || []).map(foldName);
    s.words = [...new Set([...s.keys, ...s.alts].flatMap((k) => k.split(" ")).filter(Boolean))];
  }
  return list;
}

export async function loadSpecies() {
  if (speciesCache) return speciesCache;
  const res = await fetch("data/species.json");
  speciesCache = prepareSpecies(await res.json());
  return speciesCache;
}

export function findSpecies(list, query, { mode = "names", categories, lang = "de", limit = 60 } = {}) {
  const fold = foldName;
  const q = fold(query);
  if (!q) return [];
  const pool = categories ? list.filter((s) => categories.includes(s.c)) : list;
  const shownOf = (s) => fold(lang === "de" ? s.de : s[lang] || s.en || s.de);
  const scored = [];
  for (const s of pool) {
    const shown = shownOf(s);
    const abk = s.a ? fold(s.a) : "";
    let sc = Infinity;
    const take = (v) => { if (v < sc) sc = v; };
    if (mode === "abbreviations" && abk) { if (abk === q) take(0); else if (abk.startsWith(q)) take(1); }
    if (shown === q) take(0);
    if (s.alts.includes(q)) take(0.5);                         // Fuchs -> Rotfuchs, hedgehog, renard
    if (s.keys.includes(q)) take(1);                           // exact name in another language
    if (abk && abk === q) take(2.8);                           // exact abbreviation in name mode
    if (shown.startsWith(q)) take(2);
    if (s.alts.some((a) => a.startsWith(q))) take(2.5);
    if (s.words.includes(q)) take(3);                          // whole word: "Fuchs" in "Kleiner Fuchs"
    if (s.keys.some((k) => k.startsWith(q))) take(3.5);
    if (q.length >= 3 && s.words.some((w) => w.length > q.length && w.endsWith(q))) take(4); // Rot|fuchs, Braunbrust|igel
    if (q.length > 1 && s.words.some((w) => w.startsWith(q))) take(4.5);
    if (q.length > 2 && s.keys.some((k) => k.includes(q))) take(6);
    if (sc < Infinity) scored.push([sc - (s.r ? 0.4 : 0), shown, s]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return scored.slice(0, limit).map((x) => x[2]);
}
