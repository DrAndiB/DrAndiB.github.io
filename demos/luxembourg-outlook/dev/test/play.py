import os
URL = 'file://' + os.path.abspath('dist/index.html')
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(600)
    pg.click('#btnPlay'); pg.wait_for_timeout(1300)
    print('mid-play year', pg.evaluate("() => window.__lux.state.year.toFixed(2)"), '| label', pg.inner_text('#yearOut'), '| card', pg.inner_text('.card[data-card=income] .val'))
    pg.click('#btnPlay'); pg.wait_for_timeout(200)
    print('paused year', pg.evaluate("() => window.__lux.state.year"))
    pg.click('#btnPlay'); pg.wait_for_timeout(11000)
    print('end year', pg.evaluate("() => window.__lux.state.year"), '| playing', pg.evaluate("() => window.__lux.state.playing"))
    print('errors:', errs[:5]); b.close()
