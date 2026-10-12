// Local persistence. Mirrors the Room tables (sightings) and SharedPreferences.

const KEY = { sightings: "androbird.sightings", settings: "androbird.settings", recent: "androbird.recent", draft: "androbird.draft" };

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

export const CATEGORIES = {
  BIRD: "Vögel",
  AMPHIBIAN: "Amphibien",
  INSECT: "Tagfalter & Libellen",
  MAMMAL: "Säugetiere",
};

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

let speciesCache = null;
export async function loadSpecies() {
  if (speciesCache) return speciesCache;
  const res = await fetch("data/species.json");
  speciesCache = await res.json();
  speciesCache.forEach((s) => {
    s.key = s.de.toLocaleLowerCase("de");
    s.lkey = s.la.toLowerCase();
  });
  return speciesCache;
}

export function findSpecies(list, query, { mode = "names", categories } = {}) {
  const q = query.trim().toLocaleLowerCase("de");
  const pool = categories ? list.filter((s) => categories.includes(s.c)) : list;
  if (!q) return [];
  const abbr = [], starts = [], within = [];
  for (const s of pool) {
    if (mode === "abbreviations" && s.a && s.a.toLocaleLowerCase("de").startsWith(q)) { abbr.push(s); continue; }
    if (s.key.startsWith(q) || s.lkey.startsWith(q)) starts.push(s);
    else if (q.length > 1 && (s.key.includes(q) || s.lkey.includes(q))) within.push(s);
  }
  const byName = (a, b) => a.de.localeCompare(b.de, "de");
  // Abbreviation mode lists abbreviation hits first (exact match on top), then names.
  abbr.sort((a, b) => (a.a.toLocaleLowerCase("de") === q ? -1 : 0) - (b.a.toLocaleLowerCase("de") === q ? -1 : 0) || a.a.localeCompare(b.a, "de"));
  return [...abbr, ...starts.sort(byName), ...within.sort(byName)].slice(0, 60);
}
