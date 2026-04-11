from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass(frozen=True)
class NoteEvent:
    start_sec: float
    end_sec: float
    pitch: int
    velocity: int


_NOTE_TO_PC: dict[str, int] = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}

_MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]


def detect_melody(audio_path: str) -> list[NoteEvent]:
    from basic_pitch.inference import predict

    _, midi_data, _ = predict(
        audio_path,
        minimum_frequency=70.0,
        maximum_frequency=1500.0,
        minimum_note_length=80.0,
    )
    events: list[NoteEvent] = []
    for inst in midi_data.instruments:
        for n in inst.notes:
            events.append(
                NoteEvent(
                    start_sec=float(n.start),
                    end_sec=float(n.end),
                    pitch=int(n.pitch),
                    velocity=int(getattr(n, "velocity", 0)),
                )
            )
    return events


def make_beat_grid(tempo_bpm: int, duration_sec: float, beats_needed: int) -> np.ndarray:
    beat_sec = 60.0 / float(max(1, tempo_bpm))
    total = max(beats_needed + 1, int(duration_sec / beat_sec) + 2)
    t = np.arange(total, dtype=np.float32) * float(beat_sec)
    t[-1] = max(float(t[-1]), float(duration_sec))
    return t


def _parse_key(key: str) -> Optional[tuple[int, str]]:
    s = key.strip()
    if not s:
        return None
    parts = s.split()
    if not parts:
        return None
    root = parts[0]
    mode = parts[1].lower() if len(parts) > 1 else "major"
    pc = _NOTE_TO_PC.get(root)
    if pc is None:
        return None
    if "minor" in mode:
        return pc, "minor"
    return pc, "major"


def _pc_to_jianpu(pc: int, tonic_pc: int, mode: str) -> str:
    scale = _MAJOR_SCALE if mode == "major" else _MINOR_SCALE
    best = (99, 0, 1)
    for degree, interval in enumerate(scale, start=1):
        target = (tonic_pc + interval) % 12
        diff = (pc - target) % 12
        if diff > 6:
            diff -= 12
        cand = (abs(diff), diff, degree)
        if cand < best:
            best = cand
    _, diff, degree = best
    if diff == 0:
        return str(degree)
    if diff == 1:
        return f"#{degree}"
    if diff == -1:
        return f"b{degree}"
    return str(degree)


def melody_to_jianpu(
    melody: list[NoteEvent],
    beat_times: np.ndarray,
    key: str,
    beats: int,
) -> list[str]:
    parsed = _parse_key(key) or (0, "major")
    tonic_pc, mode = parsed

    events = sorted(melody, key=lambda n: (n.start_sec, n.pitch))
    out: list[str] = []

    for i in range(beats):
        t0 = float(beat_times[i])
        t1 = float(beat_times[i + 1])
        best_score = -1.0
        best_pitch: Optional[int] = None
        for n in events:
            if n.end_sec <= t0:
                continue
            if n.start_sec >= t1:
                break
            overlap = max(0.0, min(n.end_sec, t1) - max(n.start_sec, t0))
            if overlap <= 0:
                continue
            score = overlap + (float(n.velocity) / 127.0) * 0.05
            if score > best_score:
                best_score = score
                best_pitch = n.pitch
        if best_pitch is None:
            out.append("-")
        else:
            out.append(_pc_to_jianpu(best_pitch % 12, tonic_pc, mode))
    return out

