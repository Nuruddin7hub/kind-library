#!/usr/bin/env python3
"""Local QA server for Kind Library v3 — serves frontend/dist + real /api endpoints
without Flask (not installed locally). Only for screenshot verification."""
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

BASE = Path(__file__).resolve().parent
DIST = BASE.parent / "frontend" / "dist"
sys.path.insert(0, str(BASE))
from library import load_library as parse_library  # noqa: E402

_lib = None
_idx = None

def get_library():
    global _lib
    if _lib is not None:
        return _lib
    for cand in [Path.home() / "workspace" / "kind-library-v2" / "data" / "index.html",
                 Path.home() / "kind-library-v2" / "data" / "index.html"]:
        if cand.exists():
            _lib = parse_library(str(cand))
            break
    else:
        _lib = {"subjects": [], "files": []}
    nf = BASE / "data" / "new_files.json"
    if nf.exists():
        _lib["files"].extend(json.load(open(nf)).get("files", []))
    return _lib

def get_index():
    global _idx
    if _idx is None:
        p = BASE / "data" / "text_index.json"
        _idx = json.load(open(p)).get("docs", []) if p.exists() else []
    return _idx

def make_excerpt(page_text, q, radius=90):
    low = page_text.lower()
    i = low.find(q)
    if i < 0:
        return ""
    start, end = max(0, i - radius), min(len(page_text), i + len(q) + radius)
    s = re.sub(r"\s+", " ", page_text[start:end]).strip()
    return ("…" if start > 0 else "") + s + ("…" if end < len(page_text) else "")

def search(q):
    docs = get_index()
    results = []
    for d in docs:
        title_low = (d.get("title") or "").lower()
        score, kind, page, excerpt = 0, None, 0, ""
        if q in title_low:
            score += 10
            kind = "title"
        for pi, ptext in enumerate(d.get("text", [])):
            hits = ptext.lower().count(q)
            if hits:
                if hits > score - (10 if kind == "title" else 0) and kind != "title":
                    pass
        best_page, best_hits = -1, 0
        for pi, ptext in enumerate(d.get("text", [])):
            h = ptext.lower().count(q)
            if h > best_hits:
                best_hits, best_page = h, pi
        if best_page >= 0:
            score += min(best_hits, 8)
            if kind is None:
                kind = "text"
                page = best_page + 1
                excerpt = make_excerpt(d["text"][best_page], q)
        if score > 0:
            results.append({"key": d["key"], "title": d["title"], "subj": d["subj"],
                            "section": d["section"], "pages": d.get("pages", 0),
                            "kind": kind or "title", "page": page, "excerpt": excerpt,
                            "_s": score})
    results.sort(key=lambda r: (-r["_s"], r["title"]))
    for r in results:
        r.pop("_s", None)
    return results[:16]

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        if path == "/api/library":
            return self.send_json(get_library())
        if path == "/api/search":
            q = (parse_qs(u.query).get("q", [""])[0] or "").strip().lower()
            if len(q) < 2:
                return self.send_json({"results": []})
            return self.send_json({"results": search(q)})
        if path.startswith("/assets/"):
            f = BASE / "assets" / unquote(path[len("/assets/"):])
            if f.is_file():
                return self.send_file(f)
            f = DIST / "assets" / unquote(path[len("/assets/"):])
            if f.is_file():
                return self.send_file(f)
            return self.send_json({"error": "not found"}, 404)
        f = DIST / unquote(path.lstrip("/"))
        if path != "/" and f.is_file():
            return self.send_file(f)
        return self.send_file(DIST / "index.html")
    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def send_file(self, f):
        body = f.read_bytes()
        ct = "text/html"
        if f.suffix == ".js": ct = "text/javascript"
        elif f.suffix == ".css": ct = "text/css"
        elif f.suffix == ".jpg": ct = "image/jpeg"
        elif f.suffix == ".woff": ct = "font/woff"
        elif f.suffix == ".woff2": ct = "font/woff2"
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5099
    HTTPServer(("127.0.0.1", port), H).serve_forever()
