/* Overscored: piece switcher, audio player and a score that follows the music.
   Each piece has data/<piece>.json: { pages, ratio, duration, bars: [[startSeconds, page, x0, y0, x1, y1], ...] }
   with the bar boxes as fractions of the page. */
import { setupCopy } from './copy-edit.js';

const COPY = await setupCopy({ url: new URL('copy.json', import.meta.url), demo: 'overscored' });
const PIECES = ['waterspout', 'omnibus', 'lunaison', 'ring'];
const ZOOMS = [1, 1.5, 2.25, 3.25, 4.5];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const audio = $('#osAudio'), view = $('#osView'), pageEl = $('#osPage'), img = $('#osImg'), mark = $('#osMark');
const playBtn = $('#osPlay'), seek = $('#osSeek'), nowEl = $('#osNow'), durEl = $('#osDur'), barEl = $('#osBarNo');
const followBtn = $('#osFollow'), prevBtn = $('#osPrev'), nextBtn = $('#osNext');
const smooth = matchMedia('(prefers-reduced-motion: no-preference)').matches ? 'smooth' : 'auto';
const state = { piece: null, data: null, page: 0, zoom: innerWidth < 720 ? 2 : 0, follow: true, bar: -1, system: '', dragging: false };
const cache = {};

const fmt = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pageUrl = (piece, p) => `scores/${piece}/page-${String(p).padStart(2, '0')}.svg`;
const load = async piece => (cache[piece] ??= await (await fetch(new URL(`data/${piece}.json`, import.meta.url))).json());

function barAt(t) {
  const bars = state.data.bars;
  let lo = 0, hi = bars.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (bars[mid][0] <= t + 0.02) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

function drawMark() {
  const b = state.data && state.data.bars[state.bar];
  if (!b || b[1] !== state.page) { mark.style.display = 'none'; return; }
  mark.style.display = 'block';
  mark.style.left = b[2] * 100 + '%'; mark.style.top = b[3] * 100 + '%';
  mark.style.width = (b[4] - b[2]) * 100 + '%'; mark.style.height = (b[5] - b[3]) * 100 + '%';
}

function showPage(p, resetScroll = true) {
  const d = state.data; p = clamp(p, 1, d.pages);
  if (p !== state.page) {
    state.page = p;
    img.src = pageUrl(state.piece, p);
    img.alt = `${COPY.t(state.piece + '.title')}, score page ${p} of ${d.pages}`;
    if (p < d.pages) { const pre = new Image(); pre.src = pageUrl(state.piece, p + 1); }
    if (resetScroll) view.scrollTo({ top: 0, left: 0 });
  }
  $('#osPageNo').textContent = p; $('#osPageCount').textContent = d.pages;
  prevBtn.disabled = p <= 1; nextBtn.disabled = p >= d.pages;
  drawMark();
}

/* keep the current bar in view: turn the page, scroll sideways with the music, scroll down only when the system changes */
function reveal(force) {
  const b = state.data.bars[state.bar];
  if (!state.follow || !b) return;
  const turned = b[1] !== state.page;
  if (turned) showPage(b[1], false);
  const W = pageEl.offsetWidth, H = W * state.data.ratio, vw = view.clientWidth, vh = view.clientHeight;
  const left = clamp(b[2] * W - vw * 0.2, 0, Math.max(0, W - vw));
  let top = view.scrollTop;
  const system = b[1] + ':' + b[3];
  if (system !== state.system || force || turned) {
    state.system = system;
    const y0 = b[3] * H, h = (b[5] - b[3]) * H;
    top = clamp(h <= vh ? y0 - (vh - h) / 2 : y0 - 10, 0, Math.max(0, H - vh));
  }
  view.scrollTo({ left, top, behavior: turned ? 'auto' : smooth });
}

function setFollow(on) {
  state.follow = on; followBtn.setAttribute('aria-pressed', on);
  if (on) { if (state.bar < 0 && state.data) state.bar = Math.max(0, barAt(audio.currentTime)); reveal(true); drawMark(); }
}

function setZoom(i) {
  const cx = (view.scrollLeft + view.clientWidth / 2) / pageEl.offsetWidth, cy = (view.scrollTop + view.clientHeight / 2) / pageEl.offsetHeight;
  state.zoom = clamp(i, 0, ZOOMS.length - 1);
  pageEl.style.setProperty('--zoom', ZOOMS[state.zoom]);
  $('#osZoomOut').disabled = state.zoom === 0; $('#osZoomIn').disabled = state.zoom === ZOOMS.length - 1;
  const W = pageEl.offsetWidth, H = state.data ? W * state.data.ratio : pageEl.offsetHeight;
  view.scrollTo({ left: cx * W - view.clientWidth / 2, top: cy * H - view.clientHeight / 2 });
  if (state.follow && state.bar >= 0) reveal(true);
}

function tick() {
  if (!state.data) return;
  const t = audio.currentTime;
  if (!state.dragging) seek.value = t;
  nowEl.textContent = fmt(t);
  const i = barAt(t);
  if (i !== state.bar) {
    state.bar = i;
    barEl.textContent = i >= 0 ? 'bar ' + (i + 1) : '';
    reveal(); drawMark();
  }
}
function loop() { tick(); if (!audio.paused) requestAnimationFrame(loop); }

function seekTo(t, play) {
  const go = () => { audio.currentTime = t; tick(); if (play) audio.play().catch(() => {}); };
  if (audio.readyState >= 1) go(); else { audio.addEventListener('loadedmetadata', go, { once: true }); audio.load(); }
}
function seekBar(i, play) {
  state.bar = -2;                                   /* force a redraw even if the bar is the same */
  if (!state.follow) setFollow(true);
  seekTo(state.data.bars[i][0] + 0.03, play);
}

async function select(piece, push) {
  if (!PIECES.includes(piece)) piece = PIECES[0];
  audio.pause();
  state.piece = piece; state.bar = -1; state.system = ''; state.page = 0;
  $$('.os-tabs a').forEach(a => a.dataset.piece === piece ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
  $$('.os-piece').forEach(a => { a.hidden = a.dataset.piece !== piece; });
  const d = state.data = await load(piece);
  if (state.piece !== piece) return;                 /* switched again while loading */
  audio.src = `audio/${piece}.mp3`;
  seek.max = d.duration; seek.value = 0; nowEl.textContent = '0:00'; durEl.textContent = fmt(d.duration); barEl.textContent = '';
  img.width = 1000; img.height = Math.round(1000 * d.ratio);
  $('#osPdf').href = `scores/${piece}/${piece}.pdf`;
  $$(`.os-piece[data-piece="${piece}"] .os-cue`).forEach(b => { b.textContent = fmt(d.bars[b.dataset.bar - 1][0]); b.title = 'Bar ' + b.dataset.bar; });
  setFollow(true);
  showPage(d.bars[0][1]);
  document.title = `${COPY.t(piece + '.title')} · Overscored: Andreas Braun`;
  if (push) history.replaceState(null, '', '?piece=' + piece + location.hash);
}

/* ---------- wiring ---------- */
$$('.os-tabs a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); select(a.dataset.piece, true); }));
playBtn.addEventListener('click', () => { audio.paused ? audio.play().catch(() => {}) : audio.pause(); });
audio.addEventListener('play', () => { playBtn.dataset.playing = ''; playBtn.setAttribute('aria-label', 'Pause'); requestAnimationFrame(loop); });
['pause', 'ended'].forEach(ev => audio.addEventListener(ev, () => { delete playBtn.dataset.playing; playBtn.setAttribute('aria-label', 'Play'); }));
['timeupdate', 'seeked'].forEach(ev => audio.addEventListener(ev, tick));
audio.addEventListener('loadedmetadata', () => { if (isFinite(audio.duration)) { seek.max = audio.duration; durEl.textContent = fmt(audio.duration); } });
seek.addEventListener('input', () => { state.dragging = true; nowEl.textContent = fmt(+seek.value); });
seek.addEventListener('change', () => { state.dragging = false; seekTo(+seek.value, false); });
prevBtn.addEventListener('click', () => { setFollow(false); showPage(state.page - 1); });
nextBtn.addEventListener('click', () => { setFollow(false); showPage(state.page + 1); });
$('#osZoomOut').addEventListener('click', () => setZoom(state.zoom - 1));
$('#osZoomIn').addEventListener('click', () => setZoom(state.zoom + 1));
followBtn.addEventListener('click', () => setFollow(!state.follow));
/* looking around by hand switches following off, so the page does not fight the reader */
['wheel', 'touchmove'].forEach(ev => view.addEventListener(ev, () => { if (state.follow && !audio.paused) setFollow(false); }, { passive: true }));
pageEl.addEventListener('click', e => {
  if (!state.data) return;
  const r = pageEl.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const i = state.data.bars.findIndex(b => b[1] === state.page && fx >= b[2] && fx < b[4] && fy >= b[3] && fy <= b[5]);
  if (i >= 0) seekBar(i, !audio.paused);
});
document.addEventListener('click', e => {
  const cue = e.target.closest && e.target.closest('.os-cue');
  if (cue && state.data) { seekBar(cue.dataset.bar - 1, true); view.scrollIntoView({ block: 'nearest', behavior: smooth }); }
});
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || COPY.isEditing()) return;
  if (e.target.closest && e.target.closest('button, a, input, textarea, [contenteditable]')) return;
  e.preventDefault(); playBtn.click();
});
COPY.onChange(k => { if (state.piece && k === state.piece + '.title') document.title = `${COPY.t(k)} · Overscored: Andreas Braun`; });

pageEl.style.setProperty('--zoom', ZOOMS[state.zoom]);
await select(new URLSearchParams(location.search).get('piece') || PIECES[0], false);
setZoom(state.zoom);
