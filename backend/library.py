"""Kind Library metadata extractor.

Parses the inline JS (var SUBJECTS, var SECTIONS, var FILES, var LINKS,
var PAGE_COUNT) from the data index.html and exposes the result as JSON.

Run directly to dump the JSON to stdout:
    python3 library.py [path/to/index.html]
"""

import json
import os
import re
import sys
from urllib.parse import unquote

DEFAULT_DATA_HTML = os.path.expanduser(
    "~/workspace/kind-library-v2/data/index.html"
)


class JSParser:
    """Tiny recursive-descent parser for JS object/array/string/number
    literals. Handles single/double quoted strings with backslash escapes,
    // line comments, and unquoted identifier keys."""

    def __init__(self, text, pos):
        self.text = text
        self.pos = pos

    def skip(self):
        t = self.text
        while self.pos < len(t):
            c = t[self.pos]
            if c in " \t\r\n":
                self.pos += 1
            elif c == "/" and t[self.pos + 1:self.pos + 2] == "/":
                while self.pos < len(t) and t[self.pos] != "\n":
                    self.pos += 1
            else:
                break

    def peek(self):
        self.skip()
        return self.text[self.pos] if self.pos < len(self.text) else ""

    def parse_value(self):
        c = self.peek()
        if c == "{":
            return self.parse_object()
        if c == "[":
            return self.parse_array()
        if c in ("'", '"'):
            return self.parse_string()
        if c == "-" or c.isdigit():
            return self.parse_number()
        if self.text.startswith("true", self.pos):
            self.pos += 4
            return True
        if self.text.startswith("false", self.pos):
            self.pos += 5
            return False
        if self.text.startswith("null", self.pos):
            self.pos += 4
            return None
        raise ValueError("unexpected token at %d: %r" % (self.pos, self.text[self.pos:self.pos + 20]))

    def parse_string(self):
        t = self.text
        quote = t[self.pos]
        self.pos += 1
        out = []
        while True:
            c = t[self.pos]
            self.pos += 1
            if c == "\\":
                esc = t[self.pos]
                self.pos += 1
                out.append({"n": "\n", "t": "\t", "r": "\r"}.get(esc, esc))
            elif c == quote:
                return "".join(out)
            else:
                out.append(c)

    def parse_number(self):
        m = re.match(r"-?\d+(\.\d+)?", self.text[self.pos:])
        self.pos += m.end()
        s = m.group(0)
        return float(s) if "." in s else int(s)

    def parse_key(self):
        self.skip()
        t = self.text
        if t[self.pos] in ("'", '"'):
            return self.parse_string()
        m = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", t[self.pos:])
        if not m:
            raise ValueError("bad key at %d" % self.pos)
        self.pos += m.end()
        return m.group(0)

    def parse_object(self):
        self.pos += 1  # {
        obj = {}
        while True:
            if self.peek() == "}":
                self.pos += 1
                return obj
            key = self.parse_key()
            self.skip()
            assert self.text[self.pos] == ":", "expected : at %d" % self.pos
            self.pos += 1
            obj[key] = self.parse_value()
            self.skip()
            if self.text[self.pos] == ",":
                self.pos += 1

    def parse_array(self):
        self.pos += 1  # [
        arr = []
        while True:
            if self.peek() == "]":
                self.pos += 1
                return arr
            arr.append(self.parse_value())
            self.skip()
            if self.text[self.pos] == ",":
                self.pos += 1


def extract_var(html, name):
    """Parse and return the value of `var <name> = <expr>;` from html."""
    m = re.search(r"var\s+%s\s*=\s*" % re.escape(name), html)
    if not m:
        raise ValueError("var %s not found" % name)
    return JSParser(html, m.end()).parse_value()


def load_library(html_path=None):
    """Return the library dict consumed by the /api/library endpoint."""
    html_path = html_path or os.environ.get("KINDLIB_DATA_HTML", DEFAULT_DATA_HTML)
    with open(html_path, encoding="utf-8") as fh:
        html = fh.read()

    subjects = extract_var(html, "SUBJECTS")
    sections = extract_var(html, "SECTIONS")
    files = extract_var(html, "FILES")
    links = extract_var(html, "LINKS")
    page_count = extract_var(html, "PAGE_COUNT")

    def basename(p):
        return p.rsplit("/", 1)[-1]

    return {
        "subjects": [
            {"id": sid, "name": s.get("name", ""), "full": s.get("full", ""),
             "cls": s.get("cls", "")}
            for sid, s in subjects.items()
        ],
        "sections": [
            {"id": cid, "label": c.get("label", ""), "order": c.get("order", 99)}
            for cid, c in sorted(sections.items(),
                                 key=lambda kv: kv[1].get("order", 99))
        ],
        "files": [
            {
                "subj": e.get("subj", ""),
                "title": e.get("t", ""),
                "desc": e.get("d", ""),
                "section": e.get("c", ""),
                # NOTE: the source HTML's `file` field holds a wrong short name for
                # some entries (e.g. 'Tut 3.pdf' vs the real
                # 'Tut 3  Inf Length Conv.pdf'), so the true filename is always
                # derived from `f` (the asset path), URL-decoded.
                "file": unquote(basename(e.get("f", ""))),
                "size": e.get("s", ""),
                "url": e.get("f", ""),
                "pages": page_count.get(e.get("f", "")),
            }
            for e in files
        ],
        "links": [
            {
                "title": e.get("t", ""),
                "desc": e.get("d", ""),
                "url": e.get("u", ""),
                "group": e.get("subj", ""),
                "kind": e.get("kind", ""),
            }
            for e in links
        ],
    }


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(load_library(path), ensure_ascii=False))
