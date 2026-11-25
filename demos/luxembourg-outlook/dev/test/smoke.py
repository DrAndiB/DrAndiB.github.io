import os
URL = 'file://' + os.path.abspath('dist/index.html')
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(600)
    pg.evaluate("""() => { const L = window.__lux; for (const f of ['people','money','trade','public']) for (const l of ['gr','eu','world']) { L.setFlow(f); L.setLevel(l); }
      for (const c of document.querySelectorAll('.sc')) { L.setScenario(c.dataset.id, true, {k: 2, year: 2027, dir: -1}); }
      L.setYear(2046); document.querySelectorAll('.chips button').forEach(b => b.click()); }""")
    pg.wait_for_timeout(900)
    bad = pg.evaluate("() => Object.entries(window.__lux.scen.det).filter(([k, a]) => a.some(x => !Number.isFinite(x))).map(([k]) => k)")
    print('all 20 at 200%: non-finite series', bad, '| GDP 2046 vs base %', pg.evaluate("() => ((window.__lux.scen.det.gdp[21]/window.__lux.base.det.gdp[21]-1)*100).toFixed(1)"))
    for i in range(7):
        pg.evaluate(f"() => window.__lux.tour({i})"); pg.wait_for_timeout(250)
        print('tour', i + 1, '|', pg.inner_text('#storyBody')[:150])
    pg.evaluate("() => window.__lux.tour(-1)")
    pg.goto(URL + '#edit'); pg.wait_for_timeout(700)
    print('edit bar present:', pg.locator('.ce-bar').count(), '| editable texts:', pg.locator('[data-copy][contenteditable]').count())
    print('errors:', errs[:6]); b.close()
