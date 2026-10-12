// AndroBird Web 2.0 – port and extension of the AndroBird Android app.
import { destination, compassPoint, norm, haversine } from "./geo.js";
import { miniAvi, csv, ebird, gpx, geojson, blurred, encodeCp1252, QUICK_CODES } from "./export.js";
import { settings, sightings, recent, draft, walks, meta, loadSpecies, findSpecies, GENDERS, CATEGORIES } from "./store.js";
import { t, setLang, detectLang, getLang, locale, speciesName, isGermanFallback, BREEDING_CODES, applyStatic } from "./i18n.js";
import { declination } from "./wmm.js";
import { createHeadingTracker } from "./heading.js";
import { buildIndex, parseQuick } from "./quick.js";
import { exampleData } from "./examples.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const num = (n, d = 1) => Number(n).toLocaleString(locale(), { maximumFractionDigits: d });
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${num(m / 1000)} km`);
const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? t("N") : t("S")} · ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? t("E") : t("W")}`;
const catColor = (c) => getComputedStyle(document.documentElement).getPropertyValue(`--cat-${c}`).trim() || "#13708c";
const gLabel = (g) => t(`g.${g}`);
const pointName = (h) => {
  const p = compassPoint(h); // German points (O = Ost)
  return getLang() === "de" ? p : getLang() === "fr" ? p.replace(/W/g, "O*").replace(/O(?!\*)/g, "E").replace(/\*/g, "") : p.replace(/O/g, "E");
};

const quoted = (x) => ({ de: `„${x}“`, en: `“${x}”`, fr: `« ${x} »` })[getLang()] || x;
const nSightings = (n) => `${n} ${n === 1 ? t("sum.sighting1") : t("sum.sightings")}`;

let cfg = settings.get();
let speciesList = [];
let byLatin = new Map();
let abbreviations = new Map();

/** Species record for a stored sighting (by scientific name, old name or German name). */
const speciesOf = (s) => byLatin.get(s.latinname) || speciesList.find((x) => x.de === s.germanname) || null;
const nameOfSighting = (s) => { const sp = speciesOf(s); return sp ? speciesName(sp) : s.germanname; };
const englishName = (s) => speciesOf(s)?.en || "";

/* ================= toast ================= */
let toastTimer;
function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), kind === "error" ? 4500 : 2600);
}

/* ================= language ================= */
function applyLanguage() {
  setLang(detectLang(cfg.lang));
  fillSelects();
  $("#viewTitle").textContent = currentView ? t($(`#view-${currentView}`).dataset.title) : "";
  showSpecies("main", selected);
  renderRecentChips();
  setGpsUi();
  updateSourceUi();
  setBearingRecorded(recordedBearing, false);
  updateDistance();
  updateWalkUi();
  updateQuickPreview();
  updateBadge();
  if (currentView === "sichtungen") renderList();
  if (map) { buildLayerControl(); refreshMarkers(); }
}
function fillSelects() {
  const opts = (sel, value) => {
    const v = value ?? sel.value;
    sel.innerHTML = GENDERS.map((g) => `<option value="${g}">${esc(gLabel(g))}</option>`).join("");
    if (v) sel.value = v;
  };
  opts($("#gender"), $("#gender").value || cfg.defaultGender);
  opts($("#editGender"));
  opts($("#s-defaultGender"), cfg.defaultGender);
  for (const sel of [$("#breeding"), $("#editBreeding")]) {
    const v = sel.value;
    sel.innerHTML = `<option value="">${esc(t("breeding.none"))}</option>` +
      ["A", "B", "C"].map((grp) => `<optgroup label="${esc(t(`bc.${grp}`))}">${BREEDING_CODES.filter((c) => c[0] === grp)
        .map((c) => `<option value="${c}">${c} · ${esc(t(`bc.${c}`))}</option>`).join("")}</optgroup>`).join("");
    sel.value = v;
  }
  const f = $("#csvFilter"), fv = f.value || "ALL";
  f.innerHTML = `<option value="ALL">${esc(t("filter.ALL"))}</option>` + CATEGORIES.map((c) => `<option value="${c}">${esc(t(`cat.${c}`))}</option>`).join("");
  f.value = fv;
}

/* ================= routing ================= */
const VIEWS = ["erfassen", "sichtungen", "karte", "einstellungen"];
let currentView = null;
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "erfassen";
  if (v === currentView) return;
  if (currentView === "karte" && v !== "karte") setPickMode(false);
  currentView = v;
  for (const id of VIEWS) $(`#view-${id}`).hidden = id !== v;
  $$(".tabbar a").forEach((a) => (a.dataset.view === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  v === "einstellungen" ? $("#settingsLink").setAttribute("aria-current", "page") : $("#settingsLink").removeAttribute("aria-current");
  $("#viewTitle").textContent = t($(`#view-${v}`).dataset.title);
  $("#main").scrollTop = 0;
  if (v === "sichtungen") renderList();
  if (v === "karte") showMap();
  if (v === "einstellungen") fillSettings();
  updateWakeLock();
}
window.addEventListener("hashchange", route);

/* ================= GPS ================= */
let fix = null; // { lat, lon, acc, alt, time }
let gpsMessage = null;
let declDeg = 0, declAt = null;
function startGPS() {
  if (!("geolocation" in navigator)) { gpsMessage = "gps.unsupported"; setGpsUi(); return; }
  navigator.geolocation.watchPosition(
    (p) => {
      fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, time: p.timestamp };
      gpsMessage = null;
      if (!declAt || haversine(declAt.lat, declAt.lon, fix.lat, fix.lon) > 20000) {
        declDeg = declination(fix.lat, fix.lon, (fix.alt || 0) / 1000);
        declAt = { lat: fix.lat, lon: fix.lon };
        updateSourceUi();
      }
      setGpsUi();
      updateProjection();
      updateOwnMarker();
      trackWalk();
    },
    (err) => { gpsMessage = err.code === 1 ? "gps.denied" : "gps.searching"; setGpsUi(); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}
function setGpsUi() {
  const gps = $("#gpsChip"), acc = $("#accChip");
  if (!fix) {
    gps.className = "chip bad"; gps.textContent = t("gps.none");
    acc.className = "chip bad"; acc.textContent = t("acc.none");
    $("#coords").textContent = t(gpsMessage || "gps.wait");
    return;
  }
  gps.className = "chip ok"; gps.textContent = t("gps.ok");
  const m = Math.round(fix.acc);
  if (fix.acc <= 10) { acc.className = "chip ok"; acc.textContent = t("acc.high", { m }); }
  else if (fix.acc <= 30) { acc.className = "chip warn"; acc.textContent = t("acc.mid", { m }); }
  else { acc.className = "chip bad"; acc.textContent = t("acc.low", { m }); }
  const alt = fix.alt != null ? ` · ${Math.round(fix.alt)} ${t("alt")}` : "";
  $("#coords").textContent = fmtCoord(fix.lat, fix.lon) + alt;
}

/* ================= compass ================= */
let heading = 0;            // true heading in degrees (what is saved and projected)
let headingSource = "none"; // none | sensor | manual | pending
let headingMode = "flat";   // flat | camera
let sensorAvailable = false;
let roseRot = 0;
let recordedBearing = null;
let rafPending = false;
const screenAngle = () => (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
const tracker = createHeadingTracker({ screenAngle });

function setHeading(h, source) {
  h = norm(h);
  if (source === "sensor") {
    if (headingSource === "manual") return;
    const d = ((h - heading + 540) % 360) - 180;
    h = headingSource === "sensor" ? norm(heading + d * 0.25) : h;
  }
  heading = h;
  if (source !== headingSource) { headingSource = source; updateSourceUi(); }
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderCompass(); });
  }
}
function renderCompass() {
  const d = ((-heading - roseRot + 540) % 360) - 180;
  roseRot += d;
  $("#rose").style.transform = `rotate(${roseRot}deg)`;
  const h = Math.round(heading) % 360;
  $("#hdgDeg").textContent = `${h}°`;
  $("#hdgPt").textContent = pointName(heading);
  $("#dial").setAttribute("aria-valuenow", h);
  $("#dial").setAttribute("aria-valuetext", `${h}° ${pointName(heading)}`);
  $("#modeBadge").hidden = !(headingSource === "sensor" && headingMode === "camera");
  if (recordedBearing != null) $("#bearingMark").style.transform = `rotate(${recordedBearing - heading + 180}deg)`;
  updateProjection();
}
const needsPermission = () => typeof window.DeviceOrientationEvent?.requestPermission === "function" && !sensorAvailable;
function updateSourceUi() {
  const btn = $("#sensorBtn");
  if (headingSource === "sensor") {
    $("#hdgSrc").textContent = t("hdg.sensor");
    btn.hidden = true;
  } else if (headingSource === "manual") {
    $("#hdgSrc").textContent = t("hdg.manual");
    btn.textContent = t("hdg.useSensor");
    btn.hidden = !sensorAvailable && !needsPermission();
  } else {
    $("#hdgSrc").textContent = needsPermission() ? t("hdg.needsPerm") : t("hdg.none");
    btn.textContent = t("hdg.enable");
    btn.hidden = !needsPermission();
  }
  const showDecl = headingSource === "sensor" && cfg.declination && declAt && Math.abs(declDeg) >= 0.05;
  $("#declNote").hidden = !showDecl;
  if (showDecl) $("#declNote").textContent = t("hdg.decl", { d: (declDeg > 0 ? "+" : "") + num(declDeg) });
}
function onOrientation(e) {
  const r = tracker(e);
  if (!r) return;
  if (!sensorAvailable) { sensorAvailable = true; updateSourceUi(); }
  headingMode = r.mode;
  setHeading(r.heading + (cfg.declination ? declDeg : 0), "sensor");
}
function listenSensor() {
  if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", onOrientation);
  else window.addEventListener("deviceorientation", onOrientation);
}
async function enableSensor() {
  if (needsPermission()) {
    try {
      if ((await DeviceOrientationEvent.requestPermission()) !== "granted") { toast(t("hdg.denied"), "error"); return; }
      listenSensor();
    } catch { toast(t("hdg.denied"), "error"); return; }
  }
  headingSource = "pending";
  setTimeout(() => { if (headingSource === "pending") { headingSource = "none"; updateSourceUi(); } }, 1500);
}
function initCompass() {
  if (!needsPermission()) listenSensor();
  $("#sensorBtn").addEventListener("click", enableSensor);
  const dial = $("#dial");
  let drag = null;
  const angleAt = (ev) => {
    const r = dial.getBoundingClientRect();
    return (Math.atan2(ev.clientX - (r.left + r.width / 2), -(ev.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
  };
  dial.addEventListener("pointerdown", (ev) => { drag = { a: angleAt(ev), h: heading }; dial.setPointerCapture(ev.pointerId); });
  dial.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const d = angleAt(ev) - drag.a;
    if (Math.abs(d) < 0.5 && headingSource !== "manual") return;
    setHeading(drag.h - d, "manual");
  });
  const end = () => { drag = null; saveDraft(); };
  dial.addEventListener("pointerup", end);
  dial.addEventListener("pointercancel", end);
  dial.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 10 : 1;
    const m = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 10, PageDown: -10 };
    if (!(ev.key in m)) return;
    ev.preventDefault();
    setHeading(heading + m[ev.key], "manual");
  });
  $("#bearingBtn").addEventListener("click", () => setBearingRecorded(recordedBearing == null ? Math.round(heading) % 360 : null));
}
function setBearingRecorded(b, persist = true) {
  recordedBearing = b;
  const on = b != null;
  $("#bearingBtn").setAttribute("aria-pressed", on);
  $("#bearingLabel").textContent = on ? t("bearing.saved", { b, p: pointName(b) }) : t("bearing.save");
  $("#bearingMark").hidden = !on;
  $(".instrument").classList.toggle("is-recording", on);
  if (on) renderCompass();
  if (persist) saveDraft();
}

/* ================= distance ================= */
const distanceFor = (p, max) => Math.round((p * p) / max); // Android: progress² / max
function initDistance() {
  $("#dist").addEventListener("input", updateDistance);
  $("#dist").addEventListener("change", saveDraft);
  applyMaxDistance(draft.get().progress ?? 0);
}
function applyMaxDistance(progress) {
  const r = $("#dist"), max = cfg.maxDistance;
  r.max = max;
  r.value = Math.min(progress ?? r.value, max);
  updateDistance();
}
const currentDistance = () => distanceFor(+$("#dist").value, +$("#dist").max);
function updateDistance() {
  const r = $("#dist"), max = +r.max;
  r.style.setProperty("--pct", `${(r.value / max) * 100}%`);
  $("#distTicks").innerHTML = [0, 0.25, 0.5, 0.75, 1].map((x) => `<span>${fmtDist(x * x * max)}</span>`).join("");
  $("#distOut").textContent = fmtDist(currentDistance());
  updateProjection();
}
function updateProjection() {
  const d = currentDistance();
  $("#projText").textContent = d
    ? t("proj.away", { d: fmtDist(d), h: Math.round(heading) % 360, p: pointName(heading) })
    : t("proj.here");
}

/* ================= species picker ================= */
let pickCallback = null;
let pickerCats = [];
function openPicker(onPick) {
  pickCallback = onPick;
  pickerCats = [...cfg.categories];
  $("#speciesSearch").value = "";
  renderCatFilter();
  renderResults();
  $("#speciesDialog").showModal();
  setTimeout(() => $("#speciesSearch").focus(), 30);
}
function renderCatFilter() {
  $("#catFilter").innerHTML = CATEGORIES
    .map((k) => `<button type="button" data-cat="${k}" style="--c:var(--cat-${k})" aria-pressed="${pickerCats.includes(k)}">${esc(t(`cat.${k}`))}</button>`)
    .join("");
}
const foldS = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function highlight(text, q) {
  const i = foldS(text).indexOf(foldS(q));
  if (!q || i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}
function secondaryLine(s) {
  const parts = [s.la];
  if (getLang() !== "de") parts.push(isGermanFallback(s) ? t("deOnly") : s.de);
  return parts.join(" · ");
}
function renderResults() {
  const q = $("#speciesSearch").value.trim();
  let items;
  if (!q) {
    items = recent.get().map((n) => speciesList.find((s) => s.de === n)).filter(Boolean);
    $("#speciesSub").textContent = items.length ? t("search.recent") : t("search.type");
  } else {
    items = findSpecies(speciesList, q, { mode: cfg.searchType, categories: pickerCats, lang: getLang() });
    $("#speciesSub").textContent = items.length ? (items.length === 60 ? t("search.many") : t("search.hits", { n: items.length })) : t("search.none");
  }
  $("#speciesResults").innerHTML = items
    .map((s, i) => `<li><button type="button" data-i="${i}" style="--c:var(--cat-${s.c})">
      <span class="dot" aria-hidden="true"></span>
      <span><span class="nm">${highlight(speciesName(s), q)}</span><span class="la">${highlight(secondaryLine(s), q)}</span></span>
      ${s.a ? `<span class="abk" title="${esc(t("abbr"))}">${esc(s.a)}</span>` : "<span></span>"}
    </button></li>`).join("");
  $("#speciesResults")._items = items;
}
function pickSpecies(s) {
  recent.push(s.de);
  $("#speciesDialog").close();
  renderRecentChips();
  pickCallback?.(s);
}
function initPicker() {
  $("#speciesSearch").addEventListener("input", renderResults);
  $("#speciesSearch").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = $("#speciesResults")._items?.[0];
    if (first) pickSpecies(first);
  });
  $("#speciesResults").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (b) pickSpecies($("#speciesResults")._items[+b.dataset.i]);
  });
  $("#catFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cat]");
    if (!b) return;
    const c = b.dataset.cat;
    pickerCats = pickerCats.includes(c) ? pickerCats.filter((x) => x !== c) : [...pickerCats, c];
    if (!pickerCats.length) pickerCats = [c];
    cfg = settings.set({ categories: pickerCats });
    renderCatFilter();
    renderResults();
  });
}
function showSpecies(prefix, s) {
  const edit = prefix === "edit";
  $(edit ? "#editSpeciesBtn" : "#speciesBtn").classList.toggle("empty", !s);
  $(edit ? "#editSpeciesName" : "#speciesName").textContent = s ? speciesName(s) : t("species.choose");
  $(edit ? "#editSpeciesLatin" : "#speciesLatin").textContent = s
    ? `${secondaryLine(s)} · ${t(`cat.${s.c}`)}`
    : edit ? "" : t("species.hint");
}

/* ================= capture ================= */
let selected = null;
function selectSpecies(s) { selected = s; showSpecies("main", s); renderRecentChips(); saveDraft(); }
function renderRecentChips() {
  const list = recent.get().map((n) => speciesList.find((s) => s.de === n)).filter(Boolean).slice(0, 6);
  $("#recentChips").innerHTML = list.length
    ? `<span class="chips-label">${esc(t("recent"))}</span>` + list.map((s) => `<button type="button" data-de="${esc(s.de)}" style="--c:var(--cat-${s.c})" aria-pressed="${selected?.de === s.de}">${esc(speciesName(s))}</button>`).join("")
    : "";
}
function resetCaptureDefaults() {
  $("#count").value = cfg.defaultCount || 1;
  $("#gender").value = cfg.defaultGender;
  $("#breeding").value = "";
  $("#comment").value = cfg.defaultComment || "";
}
function saveDraft() {
  draft.set({
    species: selected?.de ?? null,
    progress: +$("#dist").value,
    comment: $("#comment").value,
    heading: headingSource === "manual" ? heading : undefined,
    bearing: recordedBearing,
  });
}
function formValues() {
  return {
    number: Math.max(1, parseInt($("#count").value, 10) || 1),
    gender: $("#gender").value,
    breeding: $("#breeding").value || undefined,
    comment: $("#comment").value.trim(),
  };
}
function autoComments(ts, altitude) {
  let auto = "";
  if (recordedBearing != null) auto += ` *WIN=${recordedBearing}`;
  if (cfg.autoTime) auto += ` *UHR=${hhmm(new Date(ts))}`;
  if (cfg.autoAltitude && altitude != null) auto += ` *ALT=${Math.round(altitude)}`;
  return auto ? auto + "*" : "";
}
function afterSave(rec) {
  navigator.storage?.persist?.();
  toast(t("toast.saved", { n: rec.number, s: nameOfSighting(rec) }));
  resetCaptureDefaults();
  $("#quickInput").value = "";
  updateQuickPreview();
  if (cfg.headingMode !== "dynamic") setBearingRecorded(null);
  saveDraft();
  updateBadge();
  updateWalkUi();
  if (map) refreshMarkers();
}
function initCapture() {
  const d = draft.get();
  resetCaptureDefaults();
  if (d.comment) $("#comment").value = d.comment;
  if (d.species) selected = speciesList.find((s) => s.de === d.species) || null;
  if (typeof d.heading === "number") setHeading(d.heading, "manual");
  if (typeof d.bearing === "number") setBearingRecorded(d.bearing, false);

  $("#speciesBtn").addEventListener("click", () => openPicker(selectSpecies));
  $("#recentChips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-de]");
    if (b) { selectSpecies(speciesList.find((s) => s.de === b.dataset.de)); recent.push(b.dataset.de); }
  });
  $$(".stepper button").forEach((b) => b.addEventListener("click", () => {
    const inp = b.parentElement.querySelector("input");
    inp.value = Math.max(1, (parseInt(inp.value, 10) || 0) + +b.dataset.step);
  }));
  $("#comment").addEventListener("change", saveDraft);

  $("#captureForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!fix) { toast(t("err.noGps"), "error"); return; }
    if (!selected) { toast(t("err.noSpecies"), "error"); openPicker(selectSpecies); return; }
    const now = Date.now();
    const dist = currentDistance();
    const pos = destination(fix.lat, fix.lon, heading, dist);
    const v = formValues();
    const rec = sightings.add({
      timestamp: now, latitude: pos.lat, longitude: pos.lon,
      latinname: selected.la, germanname: selected.de, category: selected.c,
      ...v, comment: (v.comment + autoComments(now, fix.alt)).trim(),
      accuracy: Math.round(fix.acc), distance: dist, heading: Math.round(heading) % 360,
      origin: { lat: fix.lat, lon: fix.lon }, walkId: activeWalk?.id,
    });
    if (!rec) { toast(t("err.storage"), "error"); return; }
    afterSave(rec);
  });

  $("#pickBtn").addEventListener("click", () => {
    if (!selected) { toast(t("err.noSpecies"), "error"); openPicker(selectSpecies); return; }
    pickPending = true;
    location.hash = "#karte";
    if (currentView === "karte") setPickMode(true);
  });
}

/* ================= quick & voice entry ================= */
let quickResult = null;
function updateQuickPreview() {
  const text = $("#quickInput").value.trim();
  quickResult = text ? parseQuick(text, { lang: getLang(), abbreviations }) : null;
  const box = $("#quickPreview");
  if (!quickResult) { box.hidden = true; return; }
  box.hidden = false;
  const q = quickResult;
  const parts = [];
  parts.push(q.species ? `<b>${q.count ?? 1}× ${esc(speciesName(q.species))}</b>` : `<span class="muted">${esc(t("quick.none"))}</span>`);
  if (q.gender) parts.push(esc(gLabel(q.gender)));
  if (q.breeding) parts.push(`${q.breeding}`);
  if (q.comment) parts.push(quoted(esc(q.comment)));
  $("#quickText").innerHTML = parts.join(" · ");
  $("#quickApply").hidden = !q.species;
}
function applyQuick() {
  const q = quickResult;
  if (!q?.species) return;
  selectSpecies(q.species);
  recent.push(q.species.de);
  $("#count").value = q.count ?? 1;
  if (q.gender) $("#gender").value = q.gender;
  if (q.breeding) $("#breeding").value = q.breeding;
  if (q.comment) $("#comment").value = q.comment;
  $("#quickInput").value = "";
  updateQuickPreview();
  renderRecentChips();
  toast(t("quick.applied"));
  $("#saveBtn").focus({ preventScroll: true });
}
function initQuick() {
  const input = $("#quickInput");
  input.addEventListener("input", updateQuickPreview);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyQuick(); } });
  $("#quickApply").addEventListener("click", applyQuick);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const mic = $("#micBtn");
  mic.hidden = false;
  let rec = null;
  mic.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }
    try {
      rec = new SR();
      rec.lang = locale();
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      mic.classList.add("listening");
      input.placeholder = t("quick.listening");
      rec.onresult = (ev) => {
        input.value = [...ev.results].map((r) => r[0].transcript).join(" ");
        updateQuickPreview();
      };
      rec.onerror = (ev) => { if (ev.error !== "aborted" && ev.error !== "no-speech") toast(t("quick.voiceErr"), "error"); };
      rec.onend = () => { mic.classList.remove("listening"); input.placeholder = t("quick.ph"); rec = null; };
      rec.start();
    } catch {
      rec = null; mic.classList.remove("listening");
      toast(t("quick.voiceErr"), "error");
    }
  });
}

/* ================= survey walks ================= */
let activeWalk = null;
let walkTimer = null;
function walkLabel(w) {
  return t("walk.name", { date: new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(w.start)) });
}
function startWalk() {
  activeWalk = { id: `w-${Date.now()}`, start: Date.now(), end: null, points: [], length: 0 };
  walks.upsert(activeWalk);
  meta.set({ activeWalk: activeWalk.id });
  trackWalk();
  updateWalkUi();
  updateWakeLock();
  toast(t("walk.started"));
}
function stopWalk() {
  if (!activeWalk) return;
  activeWalk.end = Date.now();
  walks.upsert(activeWalk);
  const n = sightings.all().filter((s) => s.walkId === activeWalk.id).length;
  toast(t("walk.ended", { d: fmtDist(activeWalk.length), n: nSightings(n) }));
  activeWalk = null;
  meta.set({ activeWalk: null });
  updateWalkUi();
  updateWakeLock();
  if (map) refreshMarkers();
}
function trackWalk() {
  if (!activeWalk || !fix || fix.acc > 50) return;
  const pts = activeWalk.points;
  const last = pts[pts.length - 1];
  const d = last ? haversine(last[0], last[1], fix.lat, fix.lon) : Infinity;
  if (last && d < Math.max(10, fix.acc / 2)) return;
  if (last) activeWalk.length += d;
  pts.push([+fix.lat.toFixed(6), +fix.lon.toFixed(6), fix.time || Date.now()]);
  walks.upsert(activeWalk);
  updateWalkUi();
  if (map) drawTracks();
}
function updateWalkUi() {
  const bar = $("#walkbar");
  $("#walkBtn").hidden = !!activeWalk;
  bar.hidden = !activeWalk;
  clearInterval(walkTimer);
  if (!activeWalk) return;
  const render = () => {
    const mins = Math.floor((Date.now() - activeWalk.start) / 60000);
    const time = mins >= 60 ? `${Math.floor(mins / 60)} h ${pad(mins % 60)} min` : `${mins} min`;
    const n = sightings.all().filter((s) => s.walkId === activeWalk.id).length;
    $("#walkText").textContent = t("walk.running", { d: fmtDist(activeWalk.length), t: time, n: nSightings(n) });
    bar.title = t("walk.note");
  };
  render();
  walkTimer = setInterval(render, 30000);
}
function initWalks() {
  const id = meta.get().activeWalk;
  if (id) activeWalk = walks.all().find((w) => w.id === id && !w.end) || null;
  $("#walkBtn").addEventListener("click", startWalk);
  $("#walkStop").addEventListener("click", stopWalk);
  updateWalkUi();
}

/* ================= sightings list ================= */
function updateBadge() {
  const n = sightings.all().length;
  const b = $("#countBadge");
  b.hidden = !n;
  b.textContent = n > 999 ? "999+" : n;
}
function renderBanners(list) {
  const hasExamples = list.some((s) => s.example);
  $("#exampleBanner").hidden = !hasExamples;
  const own = list.filter((s) => !s.example);
  const last = meta.get().lastBackup;
  const newSince = own.filter((s) => !last || s.timestamp > last).length;
  const stale = !last || Date.now() - last > 14 * 864e5;
  const show = newSince >= 10 && stale;
  $("#backupBanner").hidden = !show;
  if (show) {
    const when = last ? new Intl.DateTimeFormat(locale(), { dateStyle: "medium" }).format(new Date(last)) : t("backup.never");
    $("#backupText").textContent = t("backup.banner", { when, n: own.length }) +
      (/iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone ? " " + t("install.hint") : "");
  }
}
function renderList() {
  const list = sightings.all().sort((a, b) => b.timestamp - a.timestamp);
  renderBanners(list);
  const todayKey = new Date().toDateString();
  const today = list.filter((s) => new Date(s.timestamp).toDateString() === todayKey).length;
  const nSpecies = new Set(list.map((s) => s.latinname)).size;
  $("#summary").innerHTML = `<span><b>${list.length}</b>${esc(t("sum.sightings"))}</span><span><b>${nSpecies}</b>${esc(t("sum.species"))}</span><span><b>${today}</b>${esc(t("sum.today"))}</span>`;
  $("#exportBtn").disabled = !list.length;
  $("#clearBtn").disabled = !list.length;
  $("#clearConfirm").hidden = true;
  if (!list.length) {
    $("#sightingList").innerHTML = `<div class="empty-state"><img src="img/icon-192.png" alt="">
      <h3>${esc(t("empty.title"))}</h3><p>${esc(t("empty.text"))}</p>
      <button type="button" class="secondary" id="loadExamples">${esc(t("empty.example"))}</button></div>`;
    return;
  }
  const days = new Map();
  for (const s of list) {
    const k = new Date(s.timestamp).toDateString();
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(s);
  }
  const dayFmt = new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const walkMap = new Map(walks.all().map((w) => [w.id, w]));
  $("#sightingList").innerHTML = [...days.values()].map((items) => `
    <section class="day">
      <h3><span>${esc(dayFmt.format(new Date(items[0].timestamp)))}</span><span>${items.length}</span></h3>
      <ol>${items.map((s) => {
        const sp = speciesOf(s);
        const meta2 = [s.gender && s.gender !== "Unbekannt" ? gLabel(s.gender) : "", s.breeding || ""].filter(Boolean).join(" · ");
        const sub = [sp?.la || s.latinname, s.comment].filter(Boolean).join(" · ");
        return `<li><button type="button" class="s-item" data-id="${esc(s.id)}" style="--cat:var(--cat-${esc(s.category)})">
        <span class="stripe" aria-hidden="true"></span>
        <time>${hhmm(new Date(s.timestamp))}</time>
        <span><span class="nm">${esc(nameOfSighting(s))}${s.walkId && walkMap.has(s.walkId) ? ` <svg class="walk-ic" aria-hidden="true"><use href="#i-walk"/></svg>` : ""}</span><span class="la">${esc(sub)}</span></span>
        <span class="meta">${esc(s.number)}×${meta2 ? `<small>${esc(meta2)}</small>` : ""}</span>
      </button></li>`;
      }).join("")}</ol>
    </section>`).join("");
}
function loadExamples() {
  const { sightings: ex, walk } = exampleData(speciesList, getLang());
  sightings.merge(ex);
  walks.upsert(walk);
  toast(t("example.loaded"));
  updateBadge(); renderList();
  mapFitted = false;
  if (map) refreshMarkers();
}
function removeExamples() {
  sightings.saveAll(sightings.all().filter((s) => !s.example));
  walks.remove((w) => w.example);
  updateBadge(); renderList();
  if (map) refreshMarkers();
}
function initList() {
  $("#sightingList").addEventListener("click", (e) => {
    if (e.target.closest("#loadExamples")) { loadExamples(); return; }
    const b = e.target.closest(".s-item");
    if (!b) return;
    const rec = sightings.all().find((s) => s.id === b.dataset.id);
    if (rec) openEdit(rec);
  });
  $("#exampleRemove").addEventListener("click", removeExamples);
  $("#backupNow").addEventListener("click", () => { openExport(); $("input[name=fmt][value=backup]").click(); });
  $("#clearBtn").addEventListener("click", () => {
    $("#clearText").textContent = t("list.clearQ", { n: sightings.all().length });
    $("#clearConfirm").hidden = false;
  });
  $("#clearNo").addEventListener("click", () => ($("#clearConfirm").hidden = true));
  $("#clearYes").addEventListener("click", () => {
    sightings.clear();
    walks.remove((w) => !activeWalk || w.id !== activeWalk.id);
    renderList(); updateBadge();
    if (map) refreshMarkers();
    toast(t("list.cleared"));
  });
  $("#exportBtn").addEventListener("click", openExport);
}

/* ================= edit ================= */
let editing = null; // { rec, isNew, species }
const toLocalInput = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hhmm(d)}`;
};
function openEdit(rec, isNew = false) {
  const sp = speciesOf(rec) || (rec.germanname ? { de: rec.germanname, la: rec.latinname, c: rec.category } : null);
  editing = { rec, isNew, species: sp };
  $("#editTitle").textContent = isNew ? t("edit.new") : t("edit.title");
  showSpecies("edit", sp);
  $("#editDate").value = toLocalInput(rec.timestamp);
  $("#editCount").value = rec.number ?? cfg.defaultCount ?? 1;
  $("#editGender").value = rec.gender || cfg.defaultGender;
  $("#editBreeding").value = rec.breeding || "";
  $("#editComment").value = rec.comment ?? "";
  const where = [fmtCoord(rec.latitude, rec.longitude)];
  if (rec.distance) where.push(t("edit.where", { d: fmtDist(rec.distance), h: rec.heading }));
  if (rec.accuracy) where.push(`GPS ±${rec.accuracy} m`);
  $("#editCoords").textContent = where.join(" · ");
  $("#delConfirm").hidden = true;
  $("#editDelete").hidden = isNew;
  $("#editShowMap").hidden = isNew;
  $("#editDialog").showModal();
}
function appendComment(text) {
  const c = $("#editComment");
  c.value = (c.value.trimEnd() + " " + text).trim();
}
function renderQuickBtns() {
  $("#quickBtns").innerHTML = [["time", t("q.time")], ["alt", t("q.alt")], ["win", t("q.win")], ...QUICK_CODES.map(([k]) => [k, t(`q.${k}`)])]
    .map(([k, l]) => `<button type="button" data-q="${k}">${esc(l)}</button>`).join("");
}
function initEdit() {
  $("#quickBtns").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-q]");
    if (!b) return;
    const q = b.dataset.q;
    if (q === "time") appendComment(`UHR=${($("#editDate").value || "").slice(11, 16)}`);
    else if (q === "alt") {
      if (fix?.alt == null) { toast(t("edit.noAlt"), "error"); return; }
      appendComment(`ALT=${Math.round(fix.alt)}`);
    } else if (q === "win") appendComment(`WIN=${recordedBearing ?? Math.round(heading) % 360}`);
    else appendComment(q);
  });
  $("#editSpeciesBtn").addEventListener("click", () => openPicker((s) => {
    editing.species = s;
    showSpecies("edit", s);
    if (!$("#editDialog").open) $("#editDialog").showModal();
  }));
  $("#editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!editing.species) { toast(t("err.noSpecies"), "error"); return; }
    const v = $("#editDate").value;
    const ts = v && v !== toLocalInput(editing.rec.timestamp) ? new Date(v).getTime() : editing.rec.timestamp;
    const rec = {
      ...editing.rec,
      germanname: editing.species.de, latinname: editing.species.la, category: editing.species.c,
      number: Math.max(1, parseInt($("#editCount").value, 10) || 1),
      gender: $("#editGender").value,
      breeding: $("#editBreeding").value || undefined,
      comment: $("#editComment").value.trim(),
      timestamp: Number.isFinite(ts) ? ts : editing.rec.timestamp,
    };
    const ok = editing.isNew ? sightings.add(rec) : sightings.update(rec);
    if (!ok) { toast(t("err.storage"), "error"); return; }
    $("#editDialog").close();
    if (editing.isNew) afterSave(ok); else toast(t("toast.savedPlain"));
    updateBadge();
    if (currentView === "sichtungen") renderList();
    if (map) refreshMarkers();
  });
  $("#editDelete").addEventListener("click", () => ($("#delConfirm").hidden = false));
  $("#delNo").addEventListener("click", () => ($("#delConfirm").hidden = true));
  $("#delYes").addEventListener("click", () => {
    sightings.remove(editing.rec.id);
    $("#editDialog").close();
    toast(t("edit.deleted"));
    updateBadge();
    if (currentView === "sichtungen") renderList();
    if (map) refreshMarkers();
  });
  $("#editShowMap").addEventListener("click", () => {
    focusOnMap = editing.rec.id;
    $("#editDialog").close();
    location.hash = "#karte";
    if (currentView === "karte") showMap();
  });
}

/* ================= export ================= */
function exportPayload() {
  const fmt = $("input[name=fmt]:checked").value;
  const all = sightings.all().filter((s) => !s.example || sightings.all().every((x) => x.example));
  const blur = $("#blurCheck").checked && fmt !== "backup";
  const list = blur ? all.map(blurred) : all;
  const walkList = walks.all();
  const stamp = new Date().toISOString().slice(0, 10);
  const cp = (txt) => encodeCp1252(txt);
  switch (fmt) {
    case "miniavi": return { n: list.filter((s) => s.category === "BIRD").length, name: "beobachtungen.asc", type: "text/plain", data: () => cp(miniAvi(list, cfg.username)) };
    case "csv": {
      const f = $("#csvFilter").value;
      return { n: list.filter((s) => f === "ALL" || s.category === f).length, name: "beobachtungen.csv", type: "text/csv", data: () => cp(csv(list, f)) };
    }
    case "ebird": return { n: list.filter((s) => s.category === "BIRD").length, name: "ebird-import.csv", type: "text/csv", data: () => ebird(list, englishName) };
    case "gpx": return { n: list.length, name: "androbird.gpx", type: "application/gpx+xml", data: () => gpx(list, walkList, nameOfSighting, walkLabel) };
    case "geojson": return { n: list.length, name: "androbird.geojson", type: "application/geo+json", data: () => geojson(list, walkList, nameOfSighting, walkLabel) };
    default: return {
      n: all.length, name: `${getLang() === "de" ? "androbird-sicherung" : getLang() === "fr" ? "androbird-sauvegarde" : "androbird-backup"}-${stamp}.json`, type: "application/json", backup: true,
      data: () => JSON.stringify({ app: "AndroBird Web", version: 2, exported: new Date().toISOString(), settings: cfg, sightings: all, walks: walkList }, null, 1),
    };
  }
}
function updateExportUi() {
  const fmt = $("input[name=fmt]:checked").value;
  $("#csvFilterField").hidden = fmt !== "csv";
  $("#blurField").hidden = fmt === "backup";
  const p = exportPayload();
  $("#exportCount").textContent = !p.n ? t("export.none") : p.n === 1 ? t("export.count1") : t("export.count", { n: p.n });
  $("#shareBtn").disabled = $("#downloadBtn").disabled = !p.n;
  let canShareFiles = false;
  try { canShareFiles = !!navigator.canShare && navigator.canShare({ files: [new File(["x"], "t.txt", { type: "text/plain" })] }); } catch { /* unsupported */ }
  $("#shareBtn").hidden = !canShareFiles;
  $("#recipient").hidden = !cfg.email;
  $("#recipientMail").textContent = cfg.email;
}
function openExport() {
  $("#blurCheck").checked = cfg.blurSensitive;
  updateExportUi();
  $("#exportDialog").showModal();
}
function exported(p) { if (p.backup) { meta.set({ lastBackup: Date.now() }); if (currentView === "sichtungen") renderList(); } }
function initExport() {
  $$("input[name=fmt]").forEach((r) => r.addEventListener("change", updateExportUi));
  $("#csvFilter").addEventListener("change", updateExportUi);
  $("#blurCheck").addEventListener("change", () => { cfg = settings.set({ blurSensitive: $("#blurCheck").checked }); updateExportUi(); });
  $("#downloadBtn").addEventListener("click", () => {
    const p = exportPayload();
    const url = URL.createObjectURL(new Blob([p.data()], { type: p.type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: p.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    exported(p);
    toast(t("downloaded", { f: p.name }));
  });
  $("#shareBtn").addEventListener("click", async () => {
    const p = exportPayload();
    try {
      await navigator.share({ files: [new File([p.data()], p.name, { type: p.type })], title: "AndroBird", text: "AndroBird" });
      exported(p);
    } catch (err) { if (err?.name !== "AbortError") toast(t("shareFail"), "error"); }
  });
  $("#copyMail").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(cfg.email); toast(t("copied")); } catch { toast(cfg.email); }
  });
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      const recs = Array.isArray(json) ? json : json.sightings;
      if (!Array.isArray(recs)) throw new Error("format");
      const n = sightings.merge(recs);
      if (Array.isArray(json.walks)) json.walks.forEach((w) => w?.id && walks.upsert(w));
      toast(t("imported", { n }));
      updateBadge(); renderList(); updateExportUi();
      if (map) refreshMarkers();
    } catch { toast(t("importFail"), "error"); }
  });
}

/* ================= map ================= */
let map = null, markerLayer = null, trackLayer = null, ownLayer = null, baseLayers = null, layerControl = null;
let focusOnMap = null, mapFitted = false, pickMode = false, pickPending = false;
const markerById = new Map();
function makeBaseLayers() {
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
  const img = () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "© Esri, Maxar, Earthstar Geographics" });
  const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
  const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), © OpenStreetMap' });
  return { normal: osm, satellite: img(), hybrid: L.layerGroup([img(), labels]), topo };
}
function buildLayerControl() {
  if (layerControl) layerControl.remove();
  layerControl = L.control.layers(Object.fromEntries(Object.entries(baseLayers).map(([k, l]) => [t(`layer.${k}`), l])), null, { position: "topright" }).addTo(map);
}
function setPickMode(on) {
  pickMode = on;
  $("#mapPick").hidden = !on;
  $("#mapHint").hidden = on;
  $("#map").classList.toggle("picking", on);
}
function newSightingAt(lat, lng) {
  const v = formValues();
  const now = Date.now();
  openEdit({
    timestamp: now, latitude: lat, longitude: lng, ...v,
    comment: (v.comment + autoComments(now, null)).trim(),
    germanname: selected?.de, latinname: selected?.la, category: selected?.c, walkId: activeWalk?.id,
  }, true);
}
function initMap() {
  if (typeof L === "undefined") { $("#map").textContent = t("map.failed"); return; }
  map = L.map("map", { zoomControl: true }).setView([50.5, 8.5], 6);
  baseLayers = makeBaseLayers();
  (baseLayers[cfg.mapType] || baseLayers.normal).addTo(map);
  buildLayerControl();
  map.on("baselayerchange", (e) => {
    const key = Object.keys(baseLayers).find((k) => baseLayers[k] === e.layer);
    if (key) cfg = settings.set({ mapType: key });
  });
  trackLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  ownLayer = L.layerGroup().addTo(map);
  map.on("click", (e) => {
    if (!pickMode) return;
    setPickMode(false);
    newSightingAt(e.latlng.lat, e.latlng.lng);
  });
  map.on("contextmenu", (e) => {
    const { lat, lng } = e.latlng;
    const el = document.createElement("div");
    el.className = "pop";
    el.innerHTML = `<h4>${esc(t("map.addQ"))}</h4><p class="meta">${esc(fmtCoord(lat, lng))}</p>
      <div class="actions"><button type="button" class="primary" data-act="new">${esc(t("map.new"))}</button><button type="button" class="ghost" data-act="cancel">${esc(t("cancel"))}</button></div>`;
    const pop = L.popup().setLatLng(e.latlng).setContent(el).openOn(map);
    el.addEventListener("click", (ev) => {
      const act = ev.target.closest("button")?.dataset.act;
      if (!act) return;
      map.closePopup(pop);
      if (act === "new") newSightingAt(lat, lng);
    });
  });
  map.on("popupopen", (e) => {
    e.popup.getElement()?.querySelector("[data-edit]")?.addEventListener("click", (ev) => {
      const rec = sightings.all().find((s) => s.id === ev.currentTarget.dataset.edit);
      if (rec) openEdit(rec);
    });
  });
  $("#locateBtn").addEventListener("click", () => {
    if (fix) map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 16));
    else toast(t("map.noFix"), "error");
  });
  $("#pickCancel").addEventListener("click", () => setPickMode(false));
}
function drawTracks() {
  trackLayer.clearLayers();
  for (const w of walks.all()) {
    if (w.points?.length < 2) continue;
    L.polyline(w.points.map(([a, b]) => [a, b]), { color: catColor("BIRD"), weight: 3, opacity: 0.6, interactive: true })
      .bindTooltip(`${esc(walkLabel(w))} · ${fmtDist(w.length || 0)}`).addTo(trackLayer);
  }
}
function refreshMarkers() {
  if (!map) return [];
  markerLayer.clearLayers();
  markerById.clear();
  drawTracks();
  const list = sightings.all();
  const counts = {};
  const dtf = new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" });
  for (const s of list) {
    counts[s.category] = (counts[s.category] || 0) + 1;
    const col = catColor(s.category);
    if (s.origin && s.distance > 0) {
      L.polyline([[s.origin.lat, s.origin.lon], [s.latitude, s.longitude]], { color: col, weight: 1.5, opacity: 0.55, dashArray: "4 5", interactive: false }).addTo(markerLayer);
    }
    const extra = [s.gender && s.gender !== "Unbekannt" ? gLabel(s.gender) : "", s.breeding || ""].filter(Boolean).join(" · ");
    const m = L.circleMarker([s.latitude, s.longitude], { radius: 8, color: "#fff", weight: 2, fillColor: col, fillOpacity: 0.95 })
      .bindPopup(`<div class="pop"><h4>${esc(nameOfSighting(s))}</h4><div class="la">${esc(speciesOf(s)?.la || s.latinname)}</div>
        <div class="meta">${esc(dtf.format(new Date(s.timestamp)))}<br>${esc(t("map.count"))}: ${esc(s.number)}${extra ? " · " + esc(extra) : ""}${s.comment ? "<br>" + esc(s.comment) : ""}</div>
        <div class="actions"><button type="button" class="secondary" data-edit="${esc(s.id)}">${esc(t("map.edit"))}</button></div></div>`)
      .addTo(markerLayer);
    markerById.set(s.id, m);
  }
  $("#mapLegend").innerHTML = CATEGORIES
    .map((k) => `<span style="--c:var(--cat-${k})"><i></i>${esc(t(`cat.${k}`))} <span class="mono muted">${counts[k] || 0}</span></span>`).join("");
  return list;
}
function updateOwnMarker() {
  if (!map || !fix) return;
  ownLayer.clearLayers();
  const ll = [fix.lat, fix.lon];
  L.circle(ll, { radius: fix.acc, color: catColor("BIRD"), weight: 1, fillOpacity: 0.08, interactive: false }).addTo(ownLayer);
  L.circleMarker(ll, { radius: 7, color: "#fff", weight: 3, fillColor: "#2a7de1", fillOpacity: 1 }).bindTooltip(t("map.me")).addTo(ownLayer);
}
function showMap() {
  if (!map) initMap();
  if (!map) return;
  const list = refreshMarkers();
  updateOwnMarker();
  if (pickPending) { pickPending = false; setPickMode(true); }
  requestAnimationFrame(() => {
    map.invalidateSize();
    if (focusOnMap && markerById.has(focusOnMap)) {
      const m = markerById.get(focusOnMap);
      map.setView(m.getLatLng(), Math.max(map.getZoom(), 16));
      m.openPopup();
      focusOnMap = null;
      mapFitted = true;
    } else if (pickMode && fix) {
      map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 15));
      mapFitted = true;
    } else if (!mapFitted) {
      if (list.length) map.fitBounds(L.latLngBounds(list.map((s) => [s.latitude, s.longitude])).pad(0.2), { maxZoom: 16 });
      else if (fix) map.setView([fix.lat, fix.lon], 15);
      mapFitted = list.length > 0 || !!fix;
    }
  });
}

/* ================= settings ================= */
function fillSettings() {
  const f = $("#settingsForm");
  for (const el of f.elements) {
    if (!el.name || !(el.name in cfg)) continue;
    if (el.type === "checkbox") el.checked = !!cfg[el.name];
    else el.value = cfg[el.name];
  }
  $("#s-categories").innerHTML = CATEGORIES
    .map((k) => `<label class="check"><input type="checkbox" value="${k}" ${cfg.categories.includes(k) ? "checked" : ""}> ${esc(t(`cat.${k}`))}</label>`).join("");
}
let savedTimer;
function initSettings() {
  const f = $("#settingsForm");
  f.addEventListener("submit", (e) => e.preventDefault());
  f.addEventListener("change", (e) => {
    const el = e.target;
    const patch = {};
    if (el.closest("#s-categories")) {
      const cats = $$("#s-categories input:checked").map((i) => i.value);
      if (!cats.length) { el.checked = true; toast(t("set.listsMin"), "error"); return; }
      patch.categories = cats;
    } else if (el.name) {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (el.name === "maxDistance") v = +v;
      if (el.name === "defaultCount") v = Math.max(1, parseInt(v, 10) || 1);
      patch[el.name] = v;
    }
    const prevMax = cfg.maxDistance;
    cfg = settings.set(patch);
    if (patch.maxDistance && patch.maxDistance !== prevMax) {
      const d = currentDistance();
      applyMaxDistance(Math.round(Math.sqrt(Math.min(d, cfg.maxDistance) * cfg.maxDistance)));
      saveDraft();
    }
    if (patch.mapType && map) {
      Object.values(baseLayers).forEach((l) => map.removeLayer(l));
      baseLayers[cfg.mapType].addTo(map);
    }
    if ("defaultCount" in patch || "defaultGender" in patch) resetCaptureDefaults();
    if ("keepAwake" in patch) updateWakeLock();
    if ("declination" in patch) updateSourceUi();
    if ("lang" in patch) { applyLanguage(); renderQuickBtns(); fillSettings(); }
    $("#savedNote").textContent = t("set.saved");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => ($("#savedNote").textContent = ""), 1800);
  });
}

/* ================= wake lock ================= */
let wakeLock = null;
async function updateWakeLock() {
  const want = (activeWalk || (cfg.keepAwake && currentView === "erfassen")) && document.visibilityState === "visible";
  try {
    if (want && !wakeLock && "wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}
document.addEventListener("visibilitychange", updateWakeLock);

/* ================= dialogs ================= */
function initDialogs() {
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { d.close(); return; }
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  });
}

/* ================= boot ================= */
async function boot() {
  setLang(detectLang(cfg.lang));
  try {
    speciesList = await loadSpecies();
  } catch {
    toast("species.json", "error");
  }
  byLatin = new Map();
  for (const s of speciesList) { byLatin.set(s.la, s); if (s.syn) byLatin.set(s.syn, s); }
  abbreviations = new Map(speciesList.filter((s) => s.a).map((s) => [s.a.toLowerCase(), s]));
  buildIndex(speciesList);

  applyStatic();
  fillSelects();
  renderQuickBtns();
  initDialogs();
  initPicker();
  initCompass();
  initDistance();
  initCapture();
  initQuick();
  initWalks();
  initList();
  initEdit();
  initExport();
  initSettings();
  route();
  applyLanguage();
  renderCompass();
  startGPS();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
