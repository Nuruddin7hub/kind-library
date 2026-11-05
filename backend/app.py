"""Kind Library v3 — Flask backend serving the library API and built frontend."""
import json
import os
import re
import sys
from pathlib import Path
from flask import Flask, jsonify, send_from_directory, send_file

# import v2's library parser
sys.path.insert(0, str(Path(__file__).resolve().parent))
from library import load_library as parse_library

app = Flask(__name__)

BASE = Path(__file__).resolve().parent
FRONTEND_DIST = BASE.parent / "frontend" / "dist"

# v2 data index.html holds the library metadata (check both local and KS paths)
V2_DATA_HTML_CANDIDATES = [
    Path.home() / "workspace" / "kind-library-v2" / "data" / "index.html",
    Path.home() / "kind-library-v2" / "data" / "index.html",
]

def find_data_html():
    for p in V2_DATA_HTML_CANDIDATES:
        if p.exists():
            return p
    return None

_library_cache = None

def load_library():
    global _library_cache
    if _library_cache is not None:
        return _library_cache
    html_path = find_data_html()
    if html_path:
        try:
            _library_cache = parse_library(str(html_path))
        except Exception as e:
            print(f"library parse failed: {e}", flush=True)
            _library_cache = {"subjects": [], "files": []}
    else:
        _library_cache = {"subjects": [], "files": []}
    
    # Merge new files (FIS, Digital Electronics, etc.)
    new_files_path = BASE / "data" / "new_files.json"
    if new_files_path.exists():
        try:
            with open(new_files_path) as f:
                new_data = json.load(f)
                new_files = new_data.get('files', [])
                if 'files' not in _library_cache:
                    _library_cache['files'] = []
                _library_cache['files'].extend(new_files)
                # Add subjects if not present
                if 'subjects' not in _library_cache:
                    _library_cache['subjects'] = []
                existing_ids = {s.get('id') for s in _library_cache['subjects']}
                for subj_id, subj_name in [('fis', 'FIS'), ('digital', 'Digital Electronics')]:
                    if subj_id not in existing_ids:
                        _library_cache['subjects'].append({
                            'id': subj_id,
                            'name': subj_name,
                        })
                        existing_ids.add(subj_id)
                print(f"merged {len(new_files)} new files", flush=True)
        except Exception as e:
            print(f"new files merge failed: {e}", flush=True)
    
    return _library_cache


@app.route("/api/library")
def api_library():
    return jsonify(load_library())


@app.route("/api/health")
def api_health():
    return jsonify({"status": "ok", "version": "v3"})


# ---- full-text search (ChatGPT critique round C, 2026-11-01) ----
_text_index = None
_text_index_error = None

def load_text_index():
    global _text_index, _text_index_error
    if _text_index is not None or _text_index_error is not None:
        return _text_index
    idx_path = BASE / "data" / "text_index.json"
    try:
        with open(idx_path) as f:
            _text_index = json.load(f).get("docs", [])
        print(f"text index loaded: {len(_text_index)} docs", flush=True)
    except Exception as e:
        _text_index_error = str(e)
        print(f"text index load failed: {e}", flush=True)
        _text_index = []
    return _text_index


def make_excerpt(page_text, q, radius=90):
    low = page_text.lower()
    i = low.find(q)
    if i < 0:
        return ""
    start = max(0, i - radius)
    end = min(len(page_text), i + len(q) + radius)
    snippet = re.sub(r"\s+", " ", page_text[start:end]).strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(page_text):
        snippet = snippet + "…"
    return snippet


@app.route("/api/search")
def api_search():
    from flask import request
    q = (request.args.get("q") or "").strip().lower()
    if len(q) < 2:
        return jsonify({"results": []})
    docs = load_text_index()
    results = []
    for d in docs:
        title_low = (d.get("title") or "").lower()
        score = 0
        kind = None
        page = 0
        excerpt = ""
        # title match — strongest
        title_matched = q in title_low
        if title_matched:
            score += 10
            kind = "title"
        # subject/section match
        subj_name = {s.get("id"): s.get("name", "") for s in load_library().get("subjects", [])}
        meta = f"{subj_name.get(d.get('subj'), '')} {d.get('section', '')}".lower()
        subject_matched = q in meta and len(q) > 2
        if subject_matched:
            score += 4
        # full-text match — rank pages by hit count; return ALL matching
        # pages as passages (rank order) so the mobile FIND panel can
        # truthfully report per-page hits and jump to every match.
        # (Previously top 2 only — FIND could then wrongly claim "0 hits"
        # on a page whose matches ranked 3rd+.) Other consumers only read
        # passages[0] (best page), so this changes no other surface.
        page_hits = []
        for pi, ptext in enumerate(d.get("text", [])):
            low = ptext.lower()
            hits = low.count(q)
            if hits:
                page_hits.append((pi, hits))
        page_hits.sort(key=lambda x: -x[1])
        text_total = sum(h for _, h in page_hits)
        passages = [
            {"page_number": pi + 1,
             "snippet": make_excerpt(d["text"][pi], q),
             "match_count": hits}
            for pi, hits in page_hits
        ]
        match_kinds = []
        if title_matched:
            match_kinds.append("title")
        if subject_matched:
            match_kinds.append("subject")
        if page_hits:
            match_kinds.append("text")
        match_count = text_total + (1 if title_matched else 0) + (1 if subject_matched else 0)
        if page_hits:
            best_page = page_hits[0][0]
            score += min(page_hits[0][1], 8)
            if kind is None:
                kind = "text"
            page = best_page + 1
            excerpt = make_excerpt(d["text"][best_page], q)
        if score > 0:
            results.append({
                "key": d["key"],
                "title": d["title"],
                "subj": d["subj"],
                "section": d["section"],
                "file": d.get("file"),
                "pages": d.get("pages", 0),
                "kind": kind or "title",
                "page": page,
                "excerpt": excerpt,
                "match_count": match_count,
                "match_kinds": match_kinds,
                "passages": passages,
                "score": score,
            })
    results.sort(key=lambda r: (-r["score"], r["title"]))
    for r in results:
        r.pop("score", None)
    return jsonify({"results": results[:16]})


@app.route("/assets/<path:path>")
def serve_assets(path):
    # hashed bundles + fonts: cache for a year (filename changes on rebuild)
    # page images: cache for a day
    assets_dir = BASE / "assets"
    full = assets_dir / path
    if full.is_file():
        resp = send_from_directory(str(assets_dir), path)
        resp.headers["Cache-Control"] = "public, max-age=86400"
        return resp
    # fall through to frontend dist for bundled JS/CSS/fonts
    full = FRONTEND_DIST / "assets" / path
    if full.is_file():
        resp = send_from_directory(str(FRONTEND_DIST / "assets"), path)
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return resp
    return jsonify({"error": "not found"}), 404


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if FRONTEND_DIST.exists():
        full = FRONTEND_DIST / path
        if path and full.is_file():
            return send_from_directory(str(FRONTEND_DIST), path)
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            # never cache index.html — it references hashed bundles,
            # so a fresh copy always picks up the latest build
            resp = send_file(str(index))
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return resp
    return jsonify({"error": "frontend not built — run npm run build"}), 503


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", "5098"))
    app.run(host="127.0.0.1", port=port, debug=False)
