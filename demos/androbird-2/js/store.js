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

let speciesCache = null;
export async function loadSpecies() {
  if (speciesCache) return speciesCache;
  const res = await fetch("data/species.json");
  speciesCache = await res.json();
  const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
  speciesCache.forEach((s) => {
    s.keys = [s.de, s.en, s.fr, s.la, s.syn].filter(Boolean).map(fold);
  });
  return speciesCache;
}

export function findSpecies(list, query, { mode = "names", categories, lang = "de" } = {}) {
  const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
  const q = fold(query.trim());
  if (!q) return [];
  const pool = categories ? list.filter((s) => categories.includes(s.c)) : list;
  const shown = (s) => fold(lang === "de" ? s.de : s[lang] || s.en || s.de);
  const abbr = [], starts = [], within = [];
  for (const s of pool) {
    if (mode === "abbreviations" && s.a && fold(s.a).startsWith(q)) { abbr.push(s); continue; }
    // a word of any name (German, English, French, scientific, old scientific) starts with the query
    const words = s.keys.flatMap((k) => k.split(/[\s-]+/));
    if (shown(s).startsWith(q)) starts.push([0, s]);
    else if (s.keys.some((k) => k.startsWith(q))) starts.push([1, s]);
    else if (q.length > 1 && words.some((w) => w.startsWith(q))) starts.push([2, s]);
    else if (q.length > 2 && s.keys.some((k) => k.includes(q))) within.push(s);
    else if (q.length > 1 && s.a && fold(s.a) === q) abbr.push(s);
  }
  const byShown = (a, b) => shown(a).localeCompare(shown(b));
  abbr.sort((a, b) => (fold(a.a) === q ? -1 : 0) - (fold(b.a) === q ? -1 : 0) || fold(a.a).localeCompare(fold(b.a)));
  starts.sort((a, b) => a[0] - b[0] || byShown(a[1], b[1]));
  return [...abbr, ...starts.map((x) => x[1]), ...within.sort(byShown)].slice(0, 60);
}
