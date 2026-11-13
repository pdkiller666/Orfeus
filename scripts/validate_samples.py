#!/usr/bin/env python3
"""Validate the published teacher-audio manifest and file hashes."""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "samples" / "manifest.json"
ALLOWED = {"range", "one", "step", "fal", "dyn", "pop", "vib", "belt", "tw", "grit", "mel", "sub", "game", "vib2", "fal2", "tw2", "belt2", "mel2", "sub2"}

def fail(message):
    print(f"sample catalog invalid: {message}", file=sys.stderr)
    raise SystemExit(1)

try:
    catalog = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
except Exception as exc:
    fail(f"cannot read samples/manifest.json: {exc}")
if not isinstance(catalog, dict) or catalog.get("schema") != 1 or not isinstance(catalog.get("samples"), list):
    fail("expected schema=1 and a samples array")
if len(catalog["samples"]) > 100:
    fail("too many entries")
seen = set()
for item in catalog["samples"]:
    if not isinstance(item, dict): fail("entry must be an object")
    sample_id = item.get("id")
    if not isinstance(sample_id, str) or not re.fullmatch(r"[a-f0-9-]{36}", sample_id): fail("invalid UUID")
    if sample_id in seen: fail(f"duplicate id {sample_id}")
    seen.add(sample_id)
    if item.get("status") != "approved": fail(f"{sample_id}: non-approved samples must not be in the public manifest")
    if item.get("exerciseId") not in ALLOWED: fail(f"{sample_id}: unknown exercise id")
    source_type = item.get("sourceType")
    if source_type not in {"teacher", "synthetic"}: fail(f"{sample_id}: invalid source type")
    if item.get("mimeType") != "audio/wav" or item.get("license") != "CC BY 4.0": fail(f"{sample_id}: unexpected format or license")
    if not isinstance(item.get("title"), str) or not 3 <= len(item["title"]) <= 80: fail(f"{sample_id}: invalid title")
    if not isinstance(item.get("description"), str) or len(item["description"]) > 500: fail(f"{sample_id}: invalid description")
    if not isinstance(item.get("recordedBy"), str) or not 2 <= len(item["recordedBy"]) <= 60: fail(f"{sample_id}: invalid attribution")
    if not isinstance(item.get("durationMs"), int) or not 500 <= item["durationMs"] <= 30000: fail(f"{sample_id}: invalid duration")
    rel = item.get("path")
    if rel != f"samples/audio/{sample_id}.wav": fail(f"{sample_id}: invalid asset path")
    path = ROOT / rel
    if not path.is_file() or path.is_symlink(): fail(f"{sample_id}: audio file missing or is a symlink")
    data = path.read_bytes()
    if not 44 <= len(data) <= 5 * 1024 * 1024: fail(f"{sample_id}: file size outside limits")
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE": fail(f"{sample_id}: invalid WAV header")
    if len(data) < 44 or int.from_bytes(data[4:8], "little") != len(data) - 8 or int.from_bytes(data[16:20], "little") != 16:
        fail(f"{sample_id}: invalid RIFF or format chunk size")
    if data[20:22] != b"\x01\x00" or data[22:24] != b"\x01\x00" or data[34:36] != b"\x10\x00":
        fail(f"{sample_id}: expected mono PCM-16 WAV")
    sample_rate = int.from_bytes(data[24:28], "little")
    if not 8000 <= sample_rate <= 96000 or int.from_bytes(data[40:44], "little") != len(data) - 44:
        fail(f"{sample_id}: invalid WAV rate or data length")
    decoded_ms = int((len(data) - 44) / 2 / sample_rate * 1000)
    if abs(decoded_ms - item["durationMs"]) > 100: fail(f"{sample_id}: duration mismatch")
    if item.get("sizeBytes") != len(data): fail(f"{sample_id}: size mismatch")
    digest = hashlib.sha256(data).hexdigest()
    if item.get("sha256") != digest: fail(f"{sample_id}: SHA-256 mismatch")
print(f"sample catalog valid: {len(seen)} approved sample(s)")
