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
    "src/courses/biomes.js",
    "src/courses/pitches.js",
    "src/courses/obstacles.js",
    "src/courses/generate.js",
    "src/courses/practice.js",
    "src/courses/tour.js",
    "src/courses/catalog.js",
    "src/physics/terrain.js",
    "src/physics/course.js",
    "src/physics/collide.js",
    "src/physics/ball.js",
    "src/avatar/looks.js",
    "src/avatar/avatar.js",
    "src/world/materials.js",
    "src/world/palm.js",
    "src/world/trees.js",
    "src/world/skyline.js",
    "src/world/landmarks.js",
    "src/world/obstacles.js",
    "src/world/landscape.js",
    "src/world/builder.js",
    "src/entities/clubDesigns.js",
    "src/entities/ball.js",
    "src/entities/clubHeads.js",
    "src/entities/club.js",
    "src/scene.js",
    "src/input/swing.js",
    "src/game/controller.js",
    "src/game/match.js",
    "src/ui/clubArt.js",
    "src/hud.js",
    "src/ui/home.js",
    "src/ui/locker.js",
    "src/ui/tour.js",
    "src/ui/match.js",
    "src/main.js",
]

THREE_IMPORT = re.compile(r"^import \* as THREE from ['\"]three['\"];\s*$", re.M)
LOCAL_IMPORT = re.compile(r"^import \{([^}]*)\} from ['\"](\.{1,2}/[^'\"]+)['\"];\s*$", re.M)
EXPORT = re.compile(r"^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)", re.M)


def module_var(rel: str) -> str:
    return "__m_" + re.sub(r"[^A-Za-z0-9]", "_", rel[len("src/"):-len(".js")])


def bundle_js() -> str:
    """Each module becomes its own scope (an IIFE) that returns its exports, so helper names
    like PI or DEG in different files never collide."""
    parts = [f"import * as THREE from '{THREE_URL}';"]
    for rel in MODULES:
        src = (ROOT / rel).read_text()
        src = THREE_IMPORT.sub("", src)

        def resolve(match):
            names = match.group(1)
            target = (pathlib.PurePosixPath(rel).parent / match.group(2)).as_posix()
            target = str(pathlib.PurePosixPath(*[p for p in pathlib.PurePosixPath(target).parts]))
            # normalise ../
            stack = []
            for piece in target.split("/"):
                if piece == "..":
                    stack.pop()
                elif piece != ".":
                    stack.append(piece)
            target = "/".join(stack)
            if target not in MODULES or MODULES.index(target) > MODULES.index(rel):
                sys.exit(f"build: {rel} imports {target}, which is not in MODULES or is listed after it")
            return f"const {{{names}}} = {module_var(target)};"

        src = LOCAL_IMPORT.sub(resolve, src)
        exports = [m.group(2) for m in EXPORT.finditer(src)]
        src = EXPORT.sub(lambda m: f"{m.group(1)} {m.group(2)}", src)
        if re.search(r"^\s*(import|export)\s", src, re.M):
            sys.exit(f"build: unhandled import/export left in {rel}")
        parts.append(f"// ---- {rel} ----\nconst {module_var(rel)} = (() => {{\n{src.strip()}\nreturn {{ {', '.join(exports)} }};\n}})();")
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
