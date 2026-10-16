#!/usr/bin/env python3
"""Bundle the game into ONE self-contained HTML file (dist/kopigolf.html).

You don't need this to host the game: index.html + styles.css + src/ work as-is on any static
host (GitHub Pages, Netlify, Cloudflare Pages). The single file is handy for sharing a quick
preview link or sending the game as one attachment.

Usage:  python3 build.py            -> dist/kopigolf.html  (full page)
        python3 build.py --fragment -> dist/kopigolf.fragment.html (body-only, for embedding)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"

# Dependency order: every module appears after the modules it imports.
MODULES = [
    "src/config.js",
    "src/state.js",
    "src/courses/pack01.js",
    "src/courses/catalog.js",
    "src/world/materials.js",
    "src/world/palm.js",
    "src/world/builder.js",
    "src/entities/ball.js",
    "src/entities/club.js",
    "src/scene.js",
    "src/hud.js",
    "src/main.js",
]

LOCAL_IMPORT = re.compile(r"^import\s.+\sfrom\s+['\"](\.{1,2}/[^'\"]+|three)['\"];\s*$", re.M)
EXPORT = re.compile(r"^export\s+(?=(const|let|function|class)\b)", re.M)


def bundle_js() -> str:
    parts = [f"import * as THREE from '{THREE_URL}';"]
    for rel in MODULES:
        src = (ROOT / rel).read_text()
        src = LOCAL_IMPORT.sub("", src)
        src = EXPORT.sub("", src)
        if re.search(r"^\s*(import|export)\s", src, re.M):
            sys.exit(f"build: unhandled import/export left in {rel}")
        parts.append(f"// ---- {rel} ----\n{src.strip()}")
    return "\n\n".join(parts)


def main() -> None:
    fragment = "--fragment" in sys.argv
    html = (ROOT / "index.html").read_text()
    body = html.split("<!-- BODY START -->")[1].split("<!-- BODY END -->")[0].strip()
    css = (ROOT / "styles.css").read_text()
    js = bundle_js()
    fonts = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;700;800&family=Lilita+One&display=swap">'
    )

    if fragment:
        out = (
            '<title>KopiGolf</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            f"{fonts}\n<style>\n{css}</style>\n{body}\n<script type=\"module\">\n{js}\n</script>\n"
        )
        name = "kopigolf.fragment.html"
    else:
        head = html.split("<head>")[1].split('<link rel="preconnect"')[0]
        out = (
            f'<!doctype html>\n<html lang="en">\n<head>{head}{fonts}\n<style>\n{css}</style>\n</head>\n<body>\n'
            f"{body}\n<script type=\"module\">\n{js}\n</script>\n</body>\n</html>\n"
        )
        name = "kopigolf.html"

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    (dist / name).write_text(out)
    (dist / "bundle.check.mjs").write_text(js)  # for `node --check`
    print(f"build: wrote dist/{name} ({len(out) // 1024} KB)")


if __name__ == "__main__":
    main()
