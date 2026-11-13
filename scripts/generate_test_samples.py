#!/usr/bin/env python3
"""Create clearly labelled, deterministic synthetic pitch-reference WAVs for testing Orfey."""
from __future__ import annotations

import hashlib
import json
import math
import struct
import wave
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "samples" / "audio"
RATE = 22050
SOURCE = "synthetic"
LICENSE = "CC BY 4.0"
AUTHOR = "Orfey · программный синтезатор"

SAMPLES = [
    {
        "id": "b6da3d08-c46d-4d6d-9e17-0b17e19b4001",
        "exerciseId": "one",
        "title": "Синтетический ориентир · Ля3",
        "description": "Тестовый устойчивый тон 220 Гц без вибрато. Синтезирован программно; это не запись певца и не педагогическая оценка.",
        "duration": 2.8,
        "segments": [(0.0, 2.8, 220.0, 220.0)],
    },
    {
        "id": "b6da3d08-c46d-4d6d-9e17-0b17e19b4002",
        "exerciseId": "step",
        "title": "Синтетический ориентир · До–Ре–До",
        "description": "Тестовая последовательность C4–D4–C4 с плавными короткими переходами. Синтезирована программно; это не голос человека.",
        "duration": 3.3,
        "segments": [(0.0, 1.05, 261.6256, 261.6256), (1.05, 2.10, 293.6648, 293.6648), (2.10, 3.3, 261.6256, 261.6256)],
    },
    {
        "id": "b6da3d08-c46d-4d6d-9e17-0b17e19b4003",
        "exerciseId": "range",
        "title": "Синтетический ориентир · ступени 110–440 Гц",
        "description": "Тестовая последовательность удерживаемых нот вверх и вниз (110–440 Гц). Синтезирована программно; показывает только высоту сигнала, не диапазон живого голоса.",
        "duration": 6.6,
        "segments": [(index * 0.6, (index + 1) * 0.6, freq, freq) for index, freq in enumerate([110.0, 146.83, 196.0, 261.63, 329.63, 440.0, 329.63, 261.63, 196.0, 146.83, 110.0])],
    },
]


def frequency_at(segments, t: float) -> float:
    for index, (start, end, f0, f1) in enumerate(segments):
        if start <= t < end or math.isclose(t, end) and end == segments[-1][1]:
            ratio = min(1.0, max(0.0, (t - start) / (end - start)))
            if f0 != f1:
                return f0 + (f1 - f0) * ratio
            glide = 0.045
            if index > 0 and t < start + glide:
                previous = segments[index - 1][3]
                return previous + (f0 - previous) * max(0.0, (t - start) / glide)
            if index + 1 < len(segments) and t > end - glide:
                following = segments[index + 1][2]
                return f0 + (following - f0) * min(1.0, (t - (end - glide)) / glide)
            return f0
    return segments[-1][3]


def synthesize(item: dict) -> bytes:
    count = round(item["duration"] * RATE)
    pcm = bytearray()
    phase = 0.0
    # Harmonic source with broad vowel-like formants. The timbre is deliberately synthetic.
    for index in range(count):
        t = index / RATE
        f0 = frequency_at(item["segments"], t)
        value = 0.0
        for harmonic in range(1, 18):
            freq = f0 * harmonic
            envelope = (
                0.95 * math.exp(-0.5 * ((freq - 850.0) / 300.0) ** 2)
                + 0.65 * math.exp(-0.5 * ((freq - 1450.0) / 450.0) ** 2)
                + 0.32 * math.exp(-0.5 * ((freq - 2600.0) / 700.0) ** 2)
            )
            value += (envelope / harmonic) * math.sin(phase * harmonic)
        phase += 2 * math.pi * f0 / RATE
        if phase > 2 * math.pi:
            phase %= 2 * math.pi
        fade = min(1.0, t / 0.025, (item["duration"] - t) / 0.040)
        value = max(-1.0, min(1.0, value * 0.22 * max(0.0, fade)))
        pcm.extend(struct.pack("<h", round(value * 32767)))
    # Canonical mono PCM-16 WAV; its exact bytes are hashed into the public manifest.
    import io
    stream = io.BytesIO()
    with wave.open(stream, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(bytes(pcm))
    return stream.getvalue()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    entries = []
    for item in SAMPLES:
        audio = synthesize(item)
        path = f"samples/audio/{item['id']}.wav"
        (ROOT / path).write_bytes(audio)
        entries.append({
            "id": item["id"],
            "exerciseId": item["exerciseId"],
            "title": item["title"],
            "description": item["description"],
            "recordedBy": AUTHOR,
            "sourceType": SOURCE,
            "path": path,
            "mimeType": "audio/wav",
            "sha256": hashlib.sha256(audio).hexdigest(),
            "sizeBytes": len(audio),
            "durationMs": round(item["duration"] * 1000),
            "license": LICENSE,
            "createdAt": created,
            "status": "approved",
        })
    catalog = {"schema": 1, "updatedAt": created, "samples": entries}
    (ROOT / "samples" / "manifest.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(entries)} synthetic test samples:")
    for entry in entries:
        print(f"- {entry['exerciseId']}: {entry['title']} ({entry['sizeBytes']} bytes, sha256 {entry['sha256'][:12]}…)")


if __name__ == "__main__":
    main()
