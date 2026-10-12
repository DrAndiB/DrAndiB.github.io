// AndroBird Web – port of the AndroBird Android app (AndroBirdMain, AnimalSearchActivity,
// SightingManagementActivity, SightingEditActivity, MapsActivity, SettingsActivity).
import { destination, compassPoint, norm } from "./geo.js";
import { miniAvi, csv, encodeCp1252, QUICK_CODES } from "./export.js";
import { settings, sightings, recent, draft, loadSpecies, findSpecies, GENDERS, CATEGORIES } from "./store.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`);
const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "O" : "W"}`;
const catColor = (c) => getComputedStyle(document.documentElement).getPropertyValue(`--cat-${c}`).trim() || "#13708c";

let cfg = settings.get();
let speciesList = [];

/* ================= toast ================= */
let toastTimer;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), kind === "error" ? 4500 : 2600);
}

/* ================= routing ================= */
const VIEWS = ["erfassen", "sichtungen", "karte", "einstellungen"];
let currentView = null;
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "erfassen";
  if (v === currentView) return;
  currentView = v;
  for (const id of VIEWS) $(`#view-${id}`).hidden = id !== v;
  $$(".tabbar a").forEach((a) => (a.dataset.view === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  v === "einstellungen" ? $("#settingsLink").setAttribute("aria-current", "page") : $("#settingsLink").removeAttribute("aria-current");
  $("#viewTitle").textContent = $(`#view-${v}`).dataset.title;
  $("#main").scrollTop = 0;
  if (v === "sichtungen") renderList();
  if (v === "karte") showMap();
  if (v === "einstellungen") fillSettings();
  updateWakeLock();
}
window.addEventListener("hashchange", route);

/* ================= GPS ================= */
let fix = null; // { lat, lon, acc, alt, time }
function startGPS() {
  if (!("geolocation" in navigator)) {
    setGpsUi("Kein GPS in diesem Browser");
    return;
  }
  navigator.geolocation.watchPosition(
    (p) => {
      fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, time: p.timestamp };
      setGpsUi();
      updateProjection();
      updateOwnMarker();
    },
    (err) => {
      setGpsUi(err.code === 1 ? "Standortzugriff verweigert – in den Browser-Einstellungen erlauben." : "Standort wird gesucht …");
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}
function setGpsUi(message) {
  const gps = $("#gpsChip"), acc = $("#accChip");
  if (!fix) {
    gps.className = "chip bad"; gps.textContent = "Kein GPS";
    acc.className = "chip bad"; acc.textContent = "Genauigkeit schwach";
    $("#coords").textContent = message || "Warte auf Standort …";
    return;
  }
  gps.className = "chip ok"; gps.textContent = "GPS OK";
  const a = Math.round(fix.acc);
  // Android thresholds, with the unreachable "Hoch" branch fixed: ≤10 m high, ≤30 m medium.
  if (fix.acc <= 10) { acc.className = "chip ok"; acc.textContent = `Genauigkeit hoch ±${a} m`; }
  else if (fix.acc <= 30) { acc.className = "chip warn"; acc.textContent = `Genauigkeit mittel ±${a} m`; }
  else { acc.className = "chip bad"; acc.textContent = `Genauigkeit schwach ±${a} m`; }
  const alt = fix.alt != null ? ` · ${Math.round(fix.alt)} m ü. NN` : "";
  $("#coords").textContent = fmtCoord(fix.lat, fix.lon) + alt;
}

/* ================= compass ================= */
let heading = 0;          // degrees clockwise from north, where the phone (or the lubber line) points
let headingSource = "none"; // none | sensor | manual
let sensorAvailable = false;
let roseRot = 0;          // cumulative rotation, avoids spinning across 0/360
let recordedBearing = null;
let rafPending = false;

function setHeading(h, source) {
  h = norm(h);
  if (source === "sensor") {
    if (headingSource === "manual") return;
    // low-pass on the circle
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
  const target = -heading;
  const d = ((target - roseRot + 540) % 360) - 180;
  roseRot += d;
  $("#rose").style.transform = `rotate(${roseRot}deg)`;
  const h = Math.round(heading) % 360;
  $("#hdgDeg").textContent = `${h}°`;
  $("#hdgPt").textContent = compassPoint(heading);
  $("#dial").setAttribute("aria-valuenow", h);
  $("#dial").setAttribute("aria-valuetext", `${h} Grad ${compassPoint(heading)}`);
  if (recordedBearing != null) $("#bearingMark").style.transform = `rotate(${recordedBearing - heading + 180}deg)`;
  updateProjection();
}
function updateSourceUi() {
  const btn = $("#sensorBtn");
  if (headingSource === "sensor") {
    $("#hdgSrc").textContent = "Kompass-Sensor aktiv – Gerät in Richtung der Sichtung halten";
    btn.hidden = true;
  } else if (headingSource === "manual") {
    $("#hdgSrc").textContent = "Richtung von Hand eingestellt";
    btn.textContent = "Kompass-Sensor verwenden";
    btn.hidden = !sensorAvailable && !needsPermission();
  } else {
    $("#hdgSrc").textContent = needsPermission() ? "Kompass muss einmal freigegeben werden" : "Kein Kompass-Sensor – Richtung durch Ziehen am Kompass einstellen";
    btn.textContent = "Kompass aktivieren";
    btn.hidden = !needsPermission();
  }
}
const needsPermission = () => typeof window.DeviceOrientationEvent?.requestPermission === "function" && !sensorAvailable;
const screenAngle = () => (screen.orientation?.angle ?? window.orientation ?? 0) || 0;

function onOrientation(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;
  else if ((e.type === "deviceorientationabsolute" || e.absolute) && e.alpha != null) h = 360 - e.alpha;
  if (h == null) return;
  if (!sensorAvailable) { sensorAvailable = true; updateSourceUi(); }
  setHeading(h + screenAngle(), "sensor");
}
function listenSensor() {
  if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", onOrientation);
  else window.addEventListener("deviceorientation", onOrientation);
}
async function enableSensor() {
  if (needsPermission()) {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") { toast("Kompass-Zugriff wurde nicht erlaubt.", "error"); return; }
      listenSensor();
    } catch { toast("Kompass konnte nicht aktiviert werden.", "error"); return; }
  }
  headingSource = "sensor-pending";
  setTimeout(() => { if (headingSource === "sensor-pending") { headingSource = "none"; updateSourceUi(); } }, 1500);
}

function initCompass() {
  if (!needsPermission()) listenSensor();
  updateSourceUi();
  $("#sensorBtn").addEventListener("click", enableSensor);

  // Manual mode: drag the rose. Equivalent to the Android "Manueller Modus" when no magnetometer exists.
  const dial = $("#dial");
  let drag = null;
  const angleAt = (ev) => {
    const r = dial.getBoundingClientRect();
    return (Math.atan2(ev.clientX - (r.left + r.width / 2), -(ev.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
  };
  dial.addEventListener("pointerdown", (ev) => {
    drag = { a: angleAt(ev), h: heading };
    dial.setPointerCapture(ev.pointerId);
  });
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
    const map = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 10, PageDown: -10 };
    if (!(ev.key in map)) return;
    ev.preventDefault();
    setHeading(heading + map[ev.key], "manual");
  });

  $("#bearingBtn").addEventListener("click", () => setBearingRecorded(recordedBearing == null ? Math.round(heading) % 360 : null));
}
function setBearingRecorded(b) {
  recordedBearing = b;
  const on = b != null;
  $("#bearingBtn").setAttribute("aria-pressed", on);
  $("#bearingLabel").textContent = on ? `Zugrichtung ${b}° (${compassPoint(b)}) gespeichert` : "Zugrichtung speichern";
  $("#bearingMark").hidden = !on;
  $(".instrument").classList.toggle("is-recording", on);
  if (on) renderCompass();
  saveDraft();
}

/* ================= distance ================= */
// Android: distance = progress² / max  (fine control close by, coarse far away)
const distanceFor = (p, max) => Math.round((p * p) / max);
function initDistance() {
  const r = $("#dist");
  r.addEventListener("input", () => { updateDistance(); });
  r.addEventListener("change", saveDraft);
  applyMaxDistance(draft.get().progress ?? 0);
}
function applyMaxDistance(progress) {
  const r = $("#dist"), max = cfg.maxDistance;
  r.max = max;
  r.value = Math.min(progress ?? r.value, max);
  $("#distTicks").innerHTML = [0, 0.25, 0.5, 0.75, 1].map((t) => `<span>${fmtDist(t * t * max)}</span>`).join("");
  updateDistance();
}
function currentDistance() {
  const r = $("#dist");
  return distanceFor(+r.value, +r.max);
}
function updateDistance() {
  const r = $("#dist");
  r.style.setProperty("--pct", `${(r.value / r.max) * 100}%`);
  $("#distOut").textContent = fmtDist(currentDistance());
  updateProjection();
}
function updateProjection() {
  const d = currentDistance();
  const p = $("#projText");
  if (!d) { p.textContent = "Die Sichtung wird an deinem Standort gespeichert."; return; }
  const h = Math.round(heading) % 360;
  p.textContent = `Die Sichtung wird ${fmtDist(d)} in Richtung ${h}° (${compassPoint(heading)}) von deinem Standort eingetragen.`;
}

/* ================= species picker ================= */
let pickCallback = null;
let pickerCats = [];
function openPicker(onPick) {
  pickCallback = onPick;
  pickerCats = [...cfg.categories];
  const dlg = $("#speciesDialog");
  $("#speciesSearch").value = "";
  renderCatFilter();
  renderResults();
  dlg.showModal();
  setTimeout(() => $("#speciesSearch").focus(), 30);
}
function renderCatFilter() {
  $("#catFilter").innerHTML = Object.entries(CATEGORIES)
    .map(([k, label]) => `<button type="button" data-cat="${k}" style="--c:var(--cat-${k})" aria-pressed="${pickerCats.includes(k)}">${esc(label)}</button>`)
    .join("");
}
function highlight(text, q) {
  const i = text.toLocaleLowerCase("de").indexOf(q);
  if (!q || i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}
function renderResults() {
  const q = $("#speciesSearch").value.trim();
  const ql = q.toLocaleLowerCase("de");
  let items;
  if (!q) {
    const byName = new Map(speciesList.map((s) => [s.de, s]));
    items = recent.get().map((n) => byName.get(n)).filter(Boolean);
    $("#speciesSub").textContent = items.length ? "Zuletzt gewählt" : "Namen, lateinischen Namen oder Abkürzung eintippen";
  } else {
    items = findSpecies(speciesList, q, { mode: cfg.searchType, categories: pickerCats });
    $("#speciesSub").textContent = items.length ? `${items.length === 60 ? "Über 60" : items.length} Treffer` : "Keine Art gefunden";
  }
  $("#speciesResults").innerHTML = items
    .map((s, i) => `<li><button type="button" data-i="${i}" style="--c:var(--cat-${s.c})">
      <span class="dot" aria-hidden="true"></span>
      <span><span class="nm">${highlight(s.de, ql)}</span><span class="la">${highlight(s.la, ql)}</span></span>
      ${s.a ? `<span class="abk" title="Abkürzung">${esc(s.a)}</span>` : "<span></span>"}
    </button></li>`)
    .join("");
  $("#speciesResults")._items = items;
}
function pickSpecies(s) {
  recent.push(s.de);
  $("#speciesDialog").close();
  pickCallback?.(s);
}
function initPicker() {
  $("#speciesSearch").addEventListener("input", renderResults);
  $("#speciesSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = $("#speciesResults")._items?.[0];
      if (first) pickSpecies(first);
    }
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
  const btn = $(prefix === "edit" ? "#editSpeciesBtn" : "#speciesBtn");
  btn.classList.toggle("empty", !s);
  $(`#${prefix === "edit" ? "editSpeciesName" : "speciesName"}`).textContent = s ? s.de : "Art wählen";
  $(`#${prefix === "edit" ? "editSpeciesLatin" : "speciesLatin"}`).textContent = s
    ? `${s.la} · ${CATEGORIES[s.c]}`
    : prefix === "edit" ? "" : "Tippen, um Vogel- oder Tierart zu suchen";
}

/* ================= capture ================= */
let selected = null;
function genderOptions(sel) {
  sel.innerHTML = GENDERS.map((g) => `<option>${g}</option>`).join("");
}
function resetCaptureDefaults() {
  $("#count").value = cfg.defaultCount || 1;
  $("#gender").value = cfg.defaultGender;
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
function initCapture() {
  genderOptions($("#gender"));
  resetCaptureDefaults();
  const d = draft.get();
  if (d.comment) $("#comment").value = d.comment;
  if (d.species) {
    selected = speciesList.find((s) => s.de === d.species) || null;
  }
  showSpecies("main", selected);
  if (typeof d.heading === "number") setHeading(d.heading, "manual");
  if (typeof d.bearing === "number") setBearingRecorded(d.bearing);

  $("#speciesBtn").addEventListener("click", () => openPicker((s) => { selected = s; showSpecies("main", s); saveDraft(); }));
  $$(".stepper button").forEach((b) => b.addEventListener("click", () => {
    const inp = b.parentElement.querySelector("input");
    inp.value = Math.max(1, (parseInt(inp.value, 10) || 0) + +b.dataset.step);
  }));
  $("#comment").addEventListener("change", saveDraft);

  $("#captureForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!fix) {
      toast("Speichern ist ohne GPS-Signal nicht möglich. Auf der Karte lange drücken, um eine Sichtung von Hand zu setzen.", "error");
      return;
    }
    if (!selected) {
      toast("Speichern ist ohne Artangabe nicht möglich.", "error");
      openPicker((s) => { selected = s; showSpecies("main", s); saveDraft(); });
      return;
    }
    const now = Date.now();
    const dist = currentDistance();
    const pos = destination(fix.lat, fix.lon, heading, dist);
    // Auto comments in the Android format: " *WIN=… *UHR=… *ALT=…*"
    let auto = "";
    if (recordedBearing != null) auto += ` *WIN=${recordedBearing}`;
    if (cfg.autoTime) auto += ` *UHR=${hhmm(new Date(now))}`;
    if (cfg.autoAltitude && fix.alt != null) auto += ` *ALT=${Math.round(fix.alt)}`;
    if (auto) auto += "*";
    const rec = sightings.add({
      timestamp: now,
      latitude: pos.lat,
      longitude: pos.lon,
      latinname: selected.la,
      germanname: selected.de,
      category: selected.c,
      number: Math.max(1, parseInt($("#count").value, 10) || 1),
      gender: $("#gender").value,
      comment: ($("#comment").value + auto).trim(),
      accuracy: Math.round(fix.acc),
      distance: dist,
      heading: Math.round(heading) % 360,
      origin: { lat: fix.lat, lon: fix.lon },
    });
    if (!rec) { toast("Speicher voll oder gesperrt – Sichtung konnte nicht gespeichert werden.", "error"); return; }
    navigator.storage?.persist?.();
    toast(`Sichtung gespeichert: ${rec.number}× ${rec.germanname}`);
    resetCaptureDefaults();
    if (cfg.headingMode !== "dynamic") setBearingRecorded(null);
    saveDraft();
    updateBadge();
    if (map) refreshMarkers();
  });
}

/* ================= sightings list ================= */
function updateBadge() {
  const n = sightings.all().length;
  const b = $("#countBadge");
  b.hidden = !n;
  b.textContent = n > 999 ? "999+" : n;
}
function renderList() {
  const list = sightings.all().sort((a, b) => b.timestamp - a.timestamp);
  const todayKey = new Date().toDateString();
  const today = list.filter((s) => new Date(s.timestamp).toDateString() === todayKey).length;
  const species = new Set(list.map((s) => s.germanname)).size;
  $("#summary").innerHTML = `<span><b>${list.length}</b>Sichtungen</span><span><b>${species}</b>Arten</span><span><b>${today}</b>heute</span>`;
  $("#exportBtn").disabled = !list.length;
  $("#clearBtn").disabled = !list.length;
  $("#clearConfirm").hidden = true;

  if (!list.length) {
    $("#sightingList").innerHTML = `<div class="empty-state"><img src="img/icon-192.png" alt="">
      <h3>Noch keine Sichtungen</h3>
      <p>Erfasse die erste Beobachtung im Tab „Erfassen“ oder drücke auf der Karte lange auf den Fundort.</p></div>`;
    return;
  }
  const days = new Map();
  for (const s of list) {
    const k = new Date(s.timestamp).toDateString();
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(s);
  }
  const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("#sightingList").innerHTML = [...days.values()].map((items) => `
    <section class="day">
      <h3><span>${esc(dayFmt.format(new Date(items[0].timestamp)))}</span><span>${items.length}</span></h3>
      <ol>${items.map((s) => `<li><button type="button" class="s-item" data-id="${esc(s.id)}" style="--cat:var(--cat-${esc(s.category)})">
        <span class="stripe" aria-hidden="true"></span>
        <time>${hhmm(new Date(s.timestamp))}</time>
        <span><span class="nm">${esc(s.germanname)}</span><span class="la">${esc(s.latinname)}${s.comment ? " · " + esc(s.comment) : ""}</span></span>
        <span class="meta">${esc(s.number)}×${s.gender && s.gender !== "Unbekannt" ? `<small>${esc(s.gender)}</small>` : ""}</span>
      </button></li>`).join("")}</ol>
    </section>`).join("");
}
function initList() {
  $("#sightingList").addEventListener("click", (e) => {
    const b = e.target.closest(".s-item");
    if (!b) return;
    const rec = sightings.all().find((s) => s.id === b.dataset.id);
    if (rec) openEdit(rec);
  });
  $("#clearBtn").addEventListener("click", () => {
    $("#clearText").textContent = `Möchtest du tatsächlich alle ${sightings.all().length} Sichtungen löschen? Das lässt sich nicht rückgängig machen.`;
    $("#clearConfirm").hidden = false;
  });
  $("#clearNo").addEventListener("click", () => ($("#clearConfirm").hidden = true));
  $("#clearYes").addEventListener("click", () => {
    sightings.clear();
    renderList(); updateBadge();
    if (map) refreshMarkers();
    toast("Alle Sichtungen gelöscht");
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
  const sp = speciesList.find((s) => s.de === rec.germanname) || (rec.germanname ? { de: rec.germanname, la: rec.latinname, c: rec.category } : null);
  editing = { rec, isNew, species: sp };
  $("#editTitle").textContent = isNew ? "Neue Sichtung" : "Sichtung bearbeiten";
  showSpecies("edit", sp);
  $("#editDate").value = toLocalInput(rec.timestamp);
  $("#editCount").value = rec.number ?? cfg.defaultCount ?? 1;
  $("#editGender").value = rec.gender || cfg.defaultGender;
  $("#editComment").value = rec.comment ?? "";
  let where = fmtCoord(rec.latitude, rec.longitude);
  if (rec.distance) where += ` · ${fmtDist(rec.distance)} in Richtung ${rec.heading}° vom Standort`;
  if (rec.accuracy) where += ` · GPS ±${rec.accuracy} m`;
  $("#editCoords").textContent = where;
  $("#delConfirm").hidden = true;
  $("#editDelete").hidden = isNew;
  $("#editShowMap").hidden = isNew;
  $("#editDialog").showModal();
}
function appendComment(text) {
  const c = $("#editComment");
  c.value = (c.value.trimEnd() + " " + text).trim();
}
function initEdit() {
  genderOptions($("#editGender"));
  $("#quickBtns").innerHTML = [
    ["time", "Uhrzeit"], ["alt", "Höhe"], ["win", "Zugrichtung"], ...QUICK_CODES,
  ].map(([k, l]) => `<button type="button" data-q="${k}">${l}</button>`).join("");
  $("#quickBtns").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-q]");
    if (!b) return;
    const q = b.dataset.q;
    if (q === "time") appendComment(`UHR=${($("#editDate").value || "").slice(11, 16)}`);
    else if (q === "alt") {
      if (fix?.alt == null) { toast("Keine Höhenangabe vom GPS verfügbar.", "error"); return; }
      appendComment(`ALT=${Math.round(fix.alt)}`);
    } else if (q === "win") appendComment(`WIN=${recordedBearing ?? Math.round(heading) % 360}`);
    else appendComment(q);
  });
  $("#editSpeciesBtn").addEventListener("click", () => openPicker((s) => {
    editing.species = s;
    showSpecies("edit", s);
    $("#editDialog").open || $("#editDialog").showModal();
  }));
  $("#editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!editing.species) { toast("Speichern ist ohne Artangabe nicht möglich.", "error"); return; }
    // Keep the original timestamp (with seconds) unless the minute shown was actually changed.
    const v = $("#editDate").value;
    const ts = v && v !== toLocalInput(editing.rec.timestamp) ? new Date(v).getTime() : editing.rec.timestamp;
    const rec = {
      ...editing.rec,
      germanname: editing.species.de,
      latinname: editing.species.la,
      category: editing.species.c,
      number: Math.max(1, parseInt($("#editCount").value, 10) || 1),
      gender: $("#editGender").value,
      comment: $("#editComment").value.trim(),
      timestamp: Number.isFinite(ts) ? ts : editing.rec.timestamp,
    };
    const ok = editing.isNew ? sightings.add(rec) : sightings.update(rec);
    if (!ok) { toast("Sichtung konnte nicht gespeichert werden.", "error"); return; }
    $("#editDialog").close();
    toast("Sichtung wurde gespeichert");
    updateBadge();
    if (currentView === "sichtungen") renderList();
    if (map) refreshMarkers();
  });
  $("#editDelete").addEventListener("click", () => ($("#delConfirm").hidden = false));
  $("#delNo").addEventListener("click", () => ($("#delConfirm").hidden = true));
  $("#delYes").addEventListener("click", () => {
    sightings.remove(editing.rec.id);
    $("#editDialog").close();
    toast("Sichtung gelöscht");
    updateBadge();
    if (currentView === "sichtungen") renderList();
    if (map) refreshMarkers();
  });
  $("#editShowMap").addEventListener("click", () => {
    const id = editing.rec.id;
    $("#editDialog").close();
    focusOnMap = id;
    location.hash = "#karte";
    if (currentView === "karte") showMap();
  });
}

/* ================= export ================= */
function exportPayload() {
  const fmt = $("input[name=fmt]:checked").value;
  const all = sightings.all();
  if (fmt === "miniavi") {
    const n = all.filter((s) => s.category === "BIRD").length;
    return { n, name: "beobachtungen.asc", type: "text/plain", data: () => encodeCp1252(miniAvi(all, cfg.username)) };
  }
  if (fmt === "csv") {
    const f = $("#csvFilter").value;
    const n = all.filter((s) => f === "ALL" || s.category === f).length;
    return { n, name: "beobachtungen.csv", type: "text/csv", data: () => encodeCp1252(csv(all, f)) };
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    n: all.length, name: `androbird-sicherung-${stamp}.json`, type: "application/json",
    data: () => JSON.stringify({ app: "AndroBird Web", version: 1, exported: new Date().toISOString(), settings: cfg, sightings: all }, null, 1),
  };
}
function updateExportUi() {
  const fmt = $("input[name=fmt]:checked").value;
  $("#csvFilterField").hidden = fmt !== "csv";
  const p = exportPayload();
  $("#exportCount").textContent = p.n ? `${p.n} ${p.n === 1 ? "Sichtung wird" : "Sichtungen werden"} exportiert.` : "Keine passenden Sichtungen.";
  $("#shareBtn").disabled = $("#downloadBtn").disabled = !p.n;
  let canShareFiles = false;
  try { canShareFiles = !!navigator.canShare && navigator.canShare({ files: [new File(["x"], "t.txt", { type: "text/plain" })] }); } catch { /* not supported */ }
  $("#shareBtn").hidden = !canShareFiles;
  $("#recipient").hidden = !cfg.email;
  $("#recipientMail").textContent = cfg.email;
}
function openExport() {
  updateExportUi();
  $("#exportDialog").showModal();
}
function initExport() {
  $$("input[name=fmt]").forEach((r) => r.addEventListener("change", updateExportUi));
  $("#csvFilter").addEventListener("change", updateExportUi);
  $("#downloadBtn").addEventListener("click", () => {
    const p = exportPayload();
    const url = URL.createObjectURL(new Blob([p.data()], { type: p.type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: p.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`${p.name} heruntergeladen`);
  });
  $("#shareBtn").addEventListener("click", async () => {
    const p = exportPayload();
    const file = new File([p.data()], p.name, { type: p.type });
    try {
      await navigator.share({ files: [file], title: "Beobachtungen", text: "Beobachtungen" });
    } catch (err) {
      if (err?.name !== "AbortError") toast("Teilen ist hier nicht möglich – bitte herunterladen.", "error");
    }
  });
  $("#copyMail").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(cfg.email); toast("E-Mail-Adresse kopiert"); }
    catch { toast(cfg.email); }
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
      toast(`${n} ${n === 1 ? "Sichtung" : "Sichtungen"} eingelesen`);
      updateBadge(); renderList(); updateExportUi();
      if (map) refreshMarkers();
    } catch {
      toast("Die Datei ist keine AndroBird-Sicherung.", "error");
    }
  });
}

/* ================= map ================= */
let map = null, markerLayer = null, ownLayer = null, baseLayers = null, focusOnMap = null, mapFitted = false;
const markerById = new Map();
function makeBaseLayers() {
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
  });
  const esriImg = () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Bilder © Esri, Maxar, Earthstar Geographics",
  });
  const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
  const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17, attribution: 'Karte © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), Daten © OpenStreetMap',
  });
  return { normal: osm, satellite: esriImg(), hybrid: L.layerGroup([esriImg(), labels]), topo };
}
const LAYER_NAMES = { normal: "Normal", satellite: "Satellit", hybrid: "Hybrid", topo: "Topographisch" };
function initMap() {
  if (typeof L === "undefined") { $("#map").textContent = "Karte konnte nicht geladen werden."; return; }
  map = L.map("map", { zoomControl: true, attributionControl: true }).setView([50.5, 8.5], 6);
  baseLayers = makeBaseLayers();
  (baseLayers[cfg.mapType] || baseLayers.normal).addTo(map);
  const named = Object.fromEntries(Object.entries(baseLayers).map(([k, l]) => [LAYER_NAMES[k], l]));
  L.control.layers(named, null, { position: "topright" }).addTo(map);
  map.on("baselayerchange", (e) => {
    const key = Object.keys(LAYER_NAMES).find((k) => LAYER_NAMES[k] === e.name);
    if (key) cfg = settings.set({ mapType: key });
  });
  markerLayer = L.layerGroup().addTo(map);
  ownLayer = L.layerGroup().addTo(map);

  map.on("contextmenu", (e) => {
    const { lat, lng } = e.latlng;
    const el = document.createElement("div");
    el.className = "pop";
    el.innerHTML = `<h4>Sichtung hinzufügen?</h4><p class="meta">${esc(fmtCoord(lat, lng))}</p>
      <div class="actions"><button type="button" class="primary" data-act="new">Neue Sichtung</button><button type="button" class="ghost" data-act="cancel">Abbruch</button></div>`;
    const pop = L.popup().setLatLng(e.latlng).setContent(el).openOn(map);
    el.addEventListener("click", (ev) => {
      const act = ev.target.closest("button")?.dataset.act;
      if (!act) return;
      map.closePopup(pop);
      if (act === "new") {
        openEdit({
          timestamp: Date.now(), latitude: lat, longitude: lng, number: cfg.defaultCount || 1,
          gender: cfg.defaultGender, comment: cfg.defaultComment || "", germanname: selected?.de, latinname: selected?.la, category: selected?.c,
        }, true);
      }
    });
  });
  map.on("popupopen", (e) => {
    const el = e.popup.getElement();
    el?.querySelector("[data-edit]")?.addEventListener("click", (ev) => {
      const rec = sightings.all().find((s) => s.id === ev.currentTarget.dataset.edit);
      if (rec) openEdit(rec);
    });
  });
  $("#locateBtn").addEventListener("click", () => {
    if (fix) map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 16));
    else toast("Noch kein Standort verfügbar.", "error");
  });
}
function refreshMarkers() {
  if (!map) return;
  markerLayer.clearLayers();
  markerById.clear();
  const list = sightings.all();
  const counts = {};
  const dtf = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  for (const s of list) {
    counts[s.category] = (counts[s.category] || 0) + 1;
    const col = catColor(s.category);
    if (s.origin && s.distance > 0) {
      L.polyline([[s.origin.lat, s.origin.lon], [s.latitude, s.longitude]], { color: col, weight: 1.5, opacity: 0.55, dashArray: "4 5", interactive: false }).addTo(markerLayer);
    }
    const m = L.circleMarker([s.latitude, s.longitude], { radius: 8, color: "#fff", weight: 2, fillColor: col, fillOpacity: 0.95 })
      .bindPopup(`<div class="pop"><h4>${esc(s.germanname)}</h4><div class="la">${esc(s.latinname)}</div>
        <div class="meta">${esc(dtf.format(new Date(s.timestamp)))}<br>Anzahl: ${esc(s.number)}${s.gender && s.gender !== "Unbekannt" ? " · " + esc(s.gender) : ""}${s.comment ? "<br>" + esc(s.comment) : ""}</div>
        <div class="actions"><button type="button" class="secondary" data-edit="${esc(s.id)}">Bearbeiten</button></div></div>`)
      .addTo(markerLayer);
    markerById.set(s.id, m);
  }
  $("#mapLegend").innerHTML = Object.entries(CATEGORIES)
    .map(([k, l]) => `<span style="--c:var(--cat-${k})"><i></i>${esc(l)} <span class="mono muted">${counts[k] || 0}</span></span>`).join("");
  return list;
}
function updateOwnMarker() {
  if (!map || !fix) return;
  ownLayer.clearLayers();
  const ll = [fix.lat, fix.lon];
  L.circle(ll, { radius: fix.acc, color: catColor("BIRD"), weight: 1, fillOpacity: 0.08, interactive: false }).addTo(ownLayer);
  L.circleMarker(ll, { radius: 7, color: "#fff", weight: 3, fillColor: "#2a7de1", fillOpacity: 1 }).bindTooltip("Mein Standort").addTo(ownLayer);
}
function showMap() {
  if (!map) initMap();
  if (!map) return;
  const list = refreshMarkers();
  updateOwnMarker();
  requestAnimationFrame(() => {
    map.invalidateSize();
    if (focusOnMap && markerById.has(focusOnMap)) {
      const m = markerById.get(focusOnMap);
      map.setView(m.getLatLng(), Math.max(map.getZoom(), 16));
      m.openPopup();
      focusOnMap = null;
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
  $("#s-categories").innerHTML = Object.entries(CATEGORIES)
    .map(([k, l]) => `<label class="check"><input type="checkbox" value="${k}" ${cfg.categories.includes(k) ? "checked" : ""}> ${esc(l)}</label>`).join("");
}
let savedTimer;
function initSettings() {
  genderOptions($("#s-defaultGender"));
  const f = $("#settingsForm");
  f.addEventListener("submit", (e) => e.preventDefault());
  f.addEventListener("change", (e) => {
    const el = e.target;
    let patch = {};
    if (el.closest("#s-categories")) {
      const cats = $$("#s-categories input:checked").map((i) => i.value);
      if (!cats.length) { el.checked = true; toast("Mindestens eine Artliste muss ausgewählt sein.", "error"); return; }
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
      // keep the same distance in metres if it still fits
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
    $("#savedNote").textContent = "Einstellungen gespeichert";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => ($("#savedNote").textContent = ""), 1800);
  });
}

/* ================= wake lock ================= */
let wakeLock = null;
async function updateWakeLock() {
  const want = cfg.keepAwake && currentView === "erfassen" && document.visibilityState === "visible";
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
      if (e.target.closest("[data-close]")) d.close();
      else if (e.target === d) {
        const r = d.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) d.close();
      }
    });
  });
}

/* ================= boot ================= */
async function boot() {
  try {
    speciesList = await loadSpecies();
  } catch {
    toast("Artenliste konnte nicht geladen werden.", "error");
  }
  initDialogs();
  initPicker();
  initCompass();
  initDistance();
  initCapture();
  initList();
  initEdit();
  initExport();
  initSettings();
  renderCompass();
  updateBadge();
  startGPS();
  route();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
