/* Page text from copy.json, plus an in-page text editor.
   Open the page with #edit at the end of the address to edit texts in place.
   "Copy changes" puts the edited texts on the clipboard as JSON, ready to paste back. */

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const mdToHtml = s => esc(s)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${u.replace(/"/g, '&quot;')}">${t}</a>`)
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');
function htmlToMd(node) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) out += n.nodeValue;
    else if (n.nodeName === 'EM' || n.nodeName === 'I') out += '*' + n.textContent + '*';
    else if (n.nodeName === 'A') out += `[${n.textContent}](${n.getAttribute('href') || ''})`;
    else if (n.nodeName === 'BR') out += ' ';
    else out += htmlToMd(n);
  }
  return out.replace(/ /g, ' ');
}

export async function setupCopy({ url, demo }) {
  const base = window.__COPY__ || await (await fetch(url, { cache: 'no-cache' })).json();
  const copy = { ...base };
  const listeners = [];
  const storeKey = 'copy-edit:' + demo;
  const keys = Object.keys(base).filter(k => !k.startsWith('_'));
  let editing = false, ui = null;

  const t = (key, vars) => {
    let s = copy[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  };
  const changed = () => keys.filter(k => copy[k] !== base[k]);
  const render = (key, skip) => {
    document.querySelectorAll(`[data-copy="${key}"]`).forEach(el => { if (el !== skip) el.innerHTML = mdToHtml(copy[key]); });
    listeners.forEach(f => f(key));
  };
  const set = (key, value, skip) => {
    copy[key] = value;
    render(key, skip);
    try { localStorage.setItem(storeKey, JSON.stringify(Object.fromEntries(changed().map(k => [k, copy[k]])))); } catch (e) {}
    if (ui) ui.refresh(key);
  };

  /* ---------- edit mode ---------- */
  const editable = el => !el.closest('button, nav, #veil, #callouts, .tag, .status');
  function enter() {
    if (editing) return; editing = true;
    try { const saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); for (const k in saved) if (k in base) { copy[k] = saved[k]; render(k); } } catch (e) {}
    document.documentElement.classList.add('copy-editing');
    document.querySelectorAll('[data-copy]').forEach(el => {
      if (!editable(el)) return;
      el.setAttribute('contenteditable', 'plaintext-only');
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
      el.spellcheck = true;
    });
    ui = buildUI();
  }
  function leave() {
    if (!editing) return; editing = false;
    document.documentElement.classList.remove('copy-editing');
    document.querySelectorAll('[data-copy][contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    ui.root.remove(); ui = null;
  }
  document.addEventListener('input', e => {
    const el = e.target.closest && e.target.closest('[data-copy][contenteditable]');
    if (el) set(el.dataset.copy, htmlToMd(el).replace(/\s+/g, ' ').trim(), el);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-copy][contenteditable]')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('paste', e => {
    const el = e.target.closest && e.target.closest('[data-copy][contenteditable]');
    if (!el) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' '));
  });

  function buildUI() {
    const root = document.createElement('div');
    root.className = 'ce-root';
    root.innerHTML = `
<style>
.copy-editing [data-copy][contenteditable]{outline:1px dashed var(--accent2,#4fd1ff);outline-offset:3px;border-radius:3px;cursor:text}
.copy-editing [data-copy][contenteditable]:focus{outline:2px solid var(--accent2,#4fd1ff)}
.copy-editing [data-copy][contenteditable].ce-changed{outline-color:var(--accent,#cf5f27)}
.ce-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:30;display:flex;gap:6px;align-items:center;padding:6px;border-radius:999px;background:#14181f;color:#e9eef5;font:500 12px/1 'IBM Plex Mono',ui-monospace,monospace;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.ce-bar b{font-weight:500;padding:0 10px 0 12px;white-space:nowrap}.ce-bar b i{font-style:normal;color:#ffb35c}
.ce-bar button{all:unset;cursor:pointer;padding:9px 13px;border-radius:999px;background:#262c36;white-space:nowrap}
.ce-bar button:hover{background:#333b48}.ce-bar button.primary{background:#ffb35c;color:#1a1206}
.ce-bar button:focus-visible{outline:2px solid #4fd1ff;outline-offset:2px}
.ce-panel{position:fixed;top:70px;right:16px;bottom:80px;width:min(400px,calc(100vw - 32px));z-index:29;overflow:auto;background:#14181f;color:#e9eef5;border-radius:14px;padding:6px 16px 16px;font:13px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.ce-panel[hidden]{display:none}
.ce-panel h3{font:500 11px/1 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#8eb4cf;margin:18px 0 8px}
.ce-panel label{display:block;margin:0 0 10px}
.ce-panel label span{display:flex;justify-content:space-between;font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#8a93a3;margin-bottom:4px}
.ce-panel label.ce-changed span{color:#ffb35c}
.ce-panel textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:34px;background:#0c0f14;color:#e9eef5;border:1px solid #2b3340;border-radius:8px;padding:7px 9px;font:13px/1.45 Inter,system-ui,sans-serif}
.ce-panel textarea:focus{outline:2px solid #4fd1ff;outline-offset:0;border-color:transparent}
.ce-panel .ce-revert{all:unset;cursor:pointer;color:#ffb35c}
.ce-panel .ce-revert[hidden]{display:none}
.ce-panel .ce-note{color:#8a93a3;font-size:12px;margin:12px 0 0}
.ce-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:31;background:#ffb35c;color:#1a1206;padding:9px 14px;border-radius:999px;font:500 12px/1 'IBM Plex Mono',monospace;opacity:0;transition:opacity .3s;pointer-events:none}
.ce-dialog{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}
.ce-dialog div{width:min(560px,calc(100vw - 32px));background:#14181f;color:#e9eef5;border-radius:14px;padding:18px;font:13px/1.5 Inter,system-ui,sans-serif}
.ce-dialog textarea{width:100%;box-sizing:border-box;height:260px;margin:10px 0;background:#0c0f14;color:#e9eef5;border:1px solid #2b3340;border-radius:8px;padding:9px;font:12px/1.45 'IBM Plex Mono',monospace}
.ce-dialog button{all:unset;cursor:pointer;padding:9px 13px;border-radius:999px;background:#ffb35c;color:#1a1206;font:500 12px/1 'IBM Plex Mono',monospace}
</style>
<div class="ce-bar" role="toolbar" aria-label="Text editing">
  <b>Editing text · <i class="ce-count">0 changes</i></b>
  <button class="ce-all" aria-expanded="false">All texts</button>
  <button class="ce-copy primary">Copy changes</button>
  <button class="ce-reset">Reset</button>
  <button class="ce-exit" aria-label="Leave edit mode">Done</button>
</div>
<div class="ce-panel" hidden></div>
<div class="ce-toast" role="status"></div>`;
    document.body.appendChild(root);
    const $ = s => root.querySelector(s);
    const panel = $('.ce-panel'), count = $('.ce-count'), toast = $('.ce-toast');
    const groupName = k => ({ hud: 'Controls', nav: 'Station menu', label: 'Labels in the scene' })[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
    let html = '<p class="ce-note">Click any text on the page to edit it in place, or edit everything here. *text* is italic, [text](url) is a link, {name} is filled in by the page.</p>';
    let group = '';
    for (const k of keys) {
      const g = k.split('.')[0];
      if (g !== group) { group = g; html += `<h3>${esc(groupName(g))}</h3>`; }
      html += `<label data-key="${k}"><span>${esc((k.split('.').slice(1).join(' · ') || k).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())}<button class="ce-revert" hidden title="Undo this change">↺ undo</button></span><textarea rows="${copy[k].length > 60 ? 3 : 1}"></textarea></label>`;
    }
    panel.innerHTML = html;
    const fields = {};
    panel.querySelectorAll('label[data-key]').forEach(l => {
      const k = l.dataset.key, ta = l.querySelector('textarea');
      fields[k] = l; ta.value = copy[k];
      ta.addEventListener('input', () => set(k, ta.value.replace(/\s+/g, ' ')));
      l.querySelector('.ce-revert').onclick = e => { e.preventDefault(); ta.value = base[k]; set(k, base[k]); };
    });
    const refresh = key => {
      const n = changed().length;
      count.textContent = n === 1 ? '1 change' : n + ' changes';
      const upd = k => {
        const l = fields[k]; if (!l) return;
        const ch = copy[k] !== base[k];
        l.classList.toggle('ce-changed', ch); l.querySelector('.ce-revert').hidden = !ch;
        const ta = l.querySelector('textarea'); if (document.activeElement !== ta) ta.value = copy[k];
        document.querySelectorAll(`[data-copy="${k}"][contenteditable]`).forEach(el => el.classList.toggle('ce-changed', ch));
      };
      key ? upd(key) : keys.forEach(upd);
    };
    refresh();
    const say = msg => { toast.textContent = msg; toast.style.opacity = 1; clearTimeout(say.t); say.t = setTimeout(() => toast.style.opacity = 0, 2600); };
    $('.ce-all').onclick = e => { panel.hidden = !panel.hidden; e.currentTarget.setAttribute('aria-expanded', !panel.hidden); };
    $('.ce-copy').onclick = async () => {
      const ch = changed();
      if (!ch.length) { say('No changes yet'); return; }
      const text = JSON.stringify({ demo, changes: Object.fromEntries(ch.map(k => [k, copy[k]])) }, null, 2);
      try { await navigator.clipboard.writeText(text); say(`Copied ${ch.length} change${ch.length > 1 ? 's' : ''}. Paste them to Claude.`); }
      catch (e) {
        const d = document.createElement('div'); d.className = 'ce-dialog';
        d.innerHTML = '<div><b>Copy these changes</b><br>Press Ctrl+C (or ⌘C), then paste them to Claude.<textarea readonly></textarea><button>Close</button></div>';
        d.querySelector('textarea').value = text; root.appendChild(d);
        const ta = d.querySelector('textarea'); ta.focus(); ta.select();
        d.querySelector('button').onclick = () => d.remove();
      }
    };
    let armed = 0;
    $('.ce-reset').onclick = e => {
      const btn = e.currentTarget, ch = changed();
      if (!ch.length) { say('Nothing to reset'); return; }
      if (Date.now() - armed > 3000) { armed = Date.now(); btn.textContent = `Discard ${ch.length}?`; setTimeout(() => btn.textContent = 'Reset', 3000); return; }
      ch.forEach(k => set(k, base[k])); btn.textContent = 'Reset'; armed = 0; say('Back to the published text');
    };
    $('.ce-exit').onclick = () => { history.replaceState(null, '', location.pathname + location.search); leave(); };
    return { root, refresh };
  }

  const check = () => (location.hash === '#edit' ? enter() : leave());
  addEventListener('hashchange', check);
  keys.forEach(k => render(k));
  check();
  return { t, onChange: f => listeners.push(f), isEditing: () => editing };
}
