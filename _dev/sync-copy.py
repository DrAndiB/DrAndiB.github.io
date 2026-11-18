"""Fill a demo page's [data-copy] elements from its copy.json, so the static HTML matches the text file.

Usage: python _dev/sync-copy.py demos/ai-gigafactory
"""
import html, json, re, sys
from pathlib import Path

def md(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', s)
    return re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)

folder = Path(sys.argv[1])
copy = json.loads((folder / "copy.json").read_text(encoding="utf-8"))
page = folder / "index.html"
src = page.read_text(encoding="utf-8")
missing = set()
def fill(m):
    key = m.group(3)
    if key not in copy:
        missing.add(key); return m.group(0)
    return m.group(1) + md(copy[key]) + m.group(4)
out = re.sub(r'(<(\w+)\b[^>]*\bdata-copy="([^"]+)"[^>]*>)(?:.*?)(</\2>)', fill, src, flags=re.S)
page.write_text(out, encoding="utf-8")
print("filled", len(re.findall(r'data-copy="', out)), "elements", "| missing:", sorted(missing) or "none")
