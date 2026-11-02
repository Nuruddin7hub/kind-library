#!/usr/bin/env python3
"""Build a per-page text index of all library PDFs for full-text search.

Reads the library metadata the same way app.py does (v2 index.html + new_files.json),
extracts text per page with pdftotext, and writes backend/data/text_index.json:

{
  "docs": [
    {"key": "subj::section::file", "subj": "em2", "title": "...",
     "section": "lectures", "file": "...", "pages": 37,
     "text": ["page 1 text...", "page 2 text...", ...]}
  ]
}

Per-page text is truncated to keep the file manageable; page 1-N full text is
kept (lecture slides are mostly sparse text).
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))

from library import load_library as parse_library  # noqa: E402

PDFS_DIR = BASE / "assets" / "pdfs"
OUT_PATH = BASE / "data" / "text_index.json"
MAX_PAGES = 120          # extract up to N pages per doc
PAGE_CHAR_LIMIT = 4000   # truncate pathological pages (scanned OCR)
DOC_CHAR_LIMIT = 60000   # truncate pathological docs


def file_key(subj, section, file):
    return f"{subj}::{section}::{file}"


def load_library():
    lib = None
    for cand in [
        Path.home() / "workspace" / "kind-library-v2" / "data" / "index.html",
        Path.home() / "kind-library-v2" / "data" / "index.html",
    ]:
        if cand.exists():
            lib = parse_library(str(cand))
            break
    if not lib:
        lib = {"subjects": [], "files": []}
    new_files_path = BASE / "data" / "new_files.json"
    if new_files_path.exists():
        with open(new_files_path) as f:
            lib["files"].extend(json.load(f).get("files", []))
    return lib


def clean(text):
    # collapse whitespace, drop control chars
    text = re.sub(r"[ \t\x00-\x08\x0b\x0c\x0e-\x1f]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pages(pdf_path):
    """Return list of page texts via pdftotext."""
    try:
        out = subprocess.run(
            ["pdftotext", "-layout", "-f", "1", "-l", str(MAX_PAGES),
             str(pdf_path), "-"],
            capture_output=True, timeout=120,
        )
    except Exception as e:
        print(f"  pdftotext failed: {e}", flush=True)
        return []
    if out.returncode != 0:
        print(f"  pdftotext rc={out.returncode}", flush=True)
        return []
    text = out.stdout.decode("utf-8", errors="replace")
    # pdftotext -layout separates pages with form feeds
    pages = [clean(p) for p in text.split("\f")]
    pages = [p[:PAGE_CHAR_LIMIT] for p in pages if p]
    return pages


def main():
    lib = load_library()
    files = lib["files"]
    print(f"{len(files)} docs in library", flush=True)
    docs = []
    total_chars = 0
    for i, f in enumerate(files):
        subj, section, name = f["subj"], f["section"], f["file"]
        pdf = PDFS_DIR / subj / name
        key = file_key(subj, section, name)
        print(f"[{i+1}/{len(files)}] {name}", flush=True)
        pages = extract_pages(pdf) if pdf.exists() else []
        if not pdf.exists():
            print("  MISSING PDF", flush=True)
        joined_len = sum(len(p) for p in pages)
        if joined_len > DOC_CHAR_LIMIT:
            # trim from the end (keep early pages, drop tail)
            kept, acc = [], 0
            for p in pages:
                if acc + len(p) > DOC_CHAR_LIMIT:
                    break
                kept.append(p)
                acc += len(p)
            pages = kept
        total_chars += sum(len(p) for p in pages)
        docs.append({
            "key": key,
            "subj": subj,
            "title": f.get("title", name),
            "section": section,
            "file": name,
            "pages": f.get("pages", len(pages)),
            "text": pages,
        })
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump({"docs": docs}, f)
    size_mb = OUT_PATH.stat().st_size / 1e6
    print(f"wrote {OUT_PATH}: {len(docs)} docs, {total_chars} chars, {size_mb:.1f} MB", flush=True)


if __name__ == "__main__":
    main()
