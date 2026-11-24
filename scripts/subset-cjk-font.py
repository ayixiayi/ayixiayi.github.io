#!/usr/bin/env python3
"""
Build-time CJK font subsetter for Noto Serif SC.

Scans all site source, content, data, and test fixture files for used characters,
subsets only the matching @fontsource/noto-serif-sc WOFF2 slices, and merges them
into a single compact WOFF2 at src/assets/fonts/noto-serif-sc-subset.woff2.
"""

from __future__ import annotations

import glob
import hashlib
import os
import re
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_PKG = ROOT / "node_modules" / "@fontsource" / "noto-serif-sc"
CSS_PATH = FONT_PKG / "400.css"
FILES_DIR = FONT_PKG / "files"
OUT_DIR = ROOT / "src" / "assets" / "fonts"
OUT_FONT = OUT_DIR / "noto-serif-sc-subset.woff2"
HASH_FILE = OUT_DIR / ".noto-serif-sc-subset.sha256"

SCAN_PATTERNS = [
    "src/**/*.astro",
    "src/**/*.ts",
    "src/**/*.md",
    "src/**/*.mdx",
    "src/**/*.json",
    "tests/fixtures/**/*.md",
]

# Always keep common display ASCII + punctuation so dynamic UI text never misses glyphs.
BASE_ASCII = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    " .,!?:;/-_+*=()[]{}<>\"'@#%&|~`\\^"
    "·—…「」『』《》【】（）“”‘’、。，！？：；"
)
SCRIPT_VERSION = "v1"


def collect_codepoints() -> list[int]:
    chars: set[str] = set(BASE_ASCII)
    for pattern in SCAN_PATTERNS:
        for file_path in glob.glob(str(ROOT / pattern), recursive=True):
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as fp:
                    chars.update(fp.read())
            except OSError:
                continue
    needed = sorted(
        ord(c)
        for c in chars
        if ord(c) >= 0x20 and (ord(c) > 0x7E or c in BASE_ASCII)
    )
    return needed


def compute_fingerprint(codepoints: list[int]) -> str:
    h = hashlib.sha256()
    h.update(SCRIPT_VERSION.encode("utf-8"))
    h.update(b"\0")
    h.update(",".join(f"{cp:x}" for cp in codepoints).encode("ascii"))
    stat = CSS_PATH.stat()
    h.update(f"\0{stat.st_size}:{int(stat.st_mtime)}".encode("ascii"))
    return h.hexdigest()


def parse_slices(needed: list[int]) -> list[tuple[str, list[int]]]:
    css = CSS_PATH.read_text(encoding="utf-8")
    slices: list[tuple[str, list[int]]] = []
    for match in re.finditer(r"@font-face\s*\{([^}]*)\}", css):
        rule = match.group(1)
        file_match = re.search(r"url\(\./files/([^)]+\.woff2)\)", rule)
        range_match = re.search(r"unicode-range:\s*([^;]+);", rule)
        if not file_match or not range_match:
            continue
        ranges: list[tuple[int, int]] = []
        for part in range_match.group(1).split(","):
            bounds = part.strip()[2:].split("-")
            lo = int(bounds[0], 16)
            hi = int(bounds[1], 16) if len(bounds) > 1 else lo
            ranges.append((lo, hi))
        hit = [cp for cp in needed if any(lo <= cp <= hi for lo, hi in ranges)]
        if hit:
            slices.append((file_match.group(1), hit))
    return slices


def main() -> int:
    force = "--force" in sys.argv[1:]
    if not CSS_PATH.exists():
        print(
            f"Error: {CSS_PATH} not found. Run `npm ci` first.",
            file=sys.stderr,
        )
        return 1

    t0 = time.monotonic()
    needed = collect_codepoints()
    fingerprint = compute_fingerprint(needed)

    if not force and OUT_FONT.exists() and HASH_FILE.exists():
        if HASH_FILE.read_text(encoding="utf-8").strip() == fingerprint:
            print(
                f"CJK font subset up-to-date ({OUT_FONT.stat().st_size / 1024:.1f} KB, {len(needed)} chars)."
            )
            return 0

    try:
        from fontTools.merge import Merger
        from fontTools.subset import Options, Subsetter
        from fontTools.ttLib import TTFont
    except ImportError as exc:
        print(
            "Error: fontTools (and brotli) are required to build the CJK font subset.\n"
            "Install via: sudo apt-get install -y python3-fonttools python3-brotli "
            "(or pip install fonttools brotli).\n"
            f"Details: {exc}",
            file=sys.stderr,
        )
        return 1

    slices = parse_slices(needed)
    if not slices:
        print("Error: no matching Noto Serif SC slices found.", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        sub_paths: list[str] = []
        for idx, (filename, hit) in enumerate(slices):
            font = TTFont(FILES_DIR / filename)
            opts = Options()
            opts.hinting = False
            opts.layout_features = ["kern", "liga"]
            opts.desubroutinize = True
            subsetter = Subsetter(opts)
            subsetter.populate(unicodes=hit)
            subsetter.subset(font)
            font.flavor = None
            sub_path = os.path.join(tmp_dir, f"slice_{idx}.ttf")
            font.save(sub_path)
            sub_paths.append(sub_path)

        merged = Merger().merge(sub_paths)
        merged.flavor = "woff2"
        tmp_out = OUT_DIR / f".noto-serif-sc-subset.{os.getpid()}.tmp.woff2"
        try:
            merged.save(tmp_out)
            os.replace(tmp_out, OUT_FONT)
        finally:
            if tmp_out.exists():
                tmp_out.unlink()

    HASH_FILE.write_text(fingerprint + "\n", encoding="utf-8")
    elapsed = time.monotonic() - t0
    size_kb = OUT_FONT.stat().st_size / 1024
    print(
        f"Generated {OUT_FONT.relative_to(ROOT)} ({size_kb:.1f} KB, "
        f"{len(needed)} chars across {len(slices)} slices in {elapsed:.2f}s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
