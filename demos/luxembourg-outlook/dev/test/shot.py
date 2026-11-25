import sys, json
from playwright.sync_api import sync_playwright
steps = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for st in steps:
        pg = b.new_page(viewport={'width': st.get('w', 1440), 'height': st.get('h', 900)})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('file://./dist/index.html' + st.get('hash', ''))
        pg.wait_for_timeout(700)
        if st.get('js'): pg.evaluate(st['js'])
        pg.wait_for_timeout(st.get('wait', 1600))
        pg.screenshot(path='./test/' + st['name'] + '.png')
        print(st['name'], 'errors:', errs[:5])
        pg.close()
    b.close()
