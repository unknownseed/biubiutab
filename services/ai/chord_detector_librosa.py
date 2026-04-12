"""
旧版和弦检测器（librosa + chroma 模板匹配）

用途：
- 回归/对比测试（与 madmom 结果对齐）
- 当 madmom 不可用（或部署环境不支持编译）时作为 fallback
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import librosa
import numpy as np


PitchClassName = Literal["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_PITCH_CLASSES: list[str] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass(frozen=True)
class ChordEvent:
    start_sec: float
    end_sec: float
    chord: str


@dataclass(frozen=True)
class AudioAnalysis:
    title: str
    tempo_bpm: int
    time_signature: str
    key: str
    bar_chords: list[str]
    beat_times: np.ndarray
    duration_sec: float


def _safe_int_bpm(x: float) -> int:
    if not isinstance(x, (float, int)) or x != x:
        return 120
    v = int(round(float(x)))
    if v < 50:
        return 50
    if v > 220:
        return 220
    if v > 120 and 60 <= (v // 2) <= 120:
        return v // 2
    if v < 60 and 60 <= (v * 2) <= 160:
        return v * 2
    return v


def detect_tempo(y: np.ndarray, sr: int) -> tuple[int, np.ndarray]:
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beats, sr=sr)
    return _safe_int_bpm(float(tempo)), beat_times


def _major_template() -> np.ndarray:
    t = np.zeros(12, dtype=np.float32)
    t[[0, 4, 7]] = 1.0
    return t


def _minor_template() -> np.ndarray:
    t = np.zeros(12, dtype=np.float32)
    t[[0, 3, 7]] = 1.0
    return t


def _normalize(v: np.ndarray) -> np.ndarray:
    s = float(np.linalg.norm(v) + 1e-9)
    return (v / s).astype(np.float32)


def detect_key_from_chroma(chroma_mean: np.ndarray) -> str:
    chroma = _normalize(chroma_mean.astype(np.float32))

    major_profile = _normalize(
        np.asarray([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=np.float32)
    )
    minor_profile = _normalize(
        np.asarray([6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17], dtype=np.float32)
    )

    best_score = -1.0
    best_key = "C Major"
    for root in range(12):
        maj_rot = np.roll(major_profile, root)
        min_rot = np.roll(minor_profile, root)
        maj_score = float(np.dot(chroma, maj_rot))
        min_score = float(np.dot(chroma, min_rot))
        if maj_score > best_score:
            best_score = maj_score
            best_key = f"{_PITCH_CLASSES[root]} Major"
        if min_score > best_score:
            best_score = min_score
            best_key = f"{_PITCH_CLASSES[root]} Minor"
    return best_key


_CHORD_QUALITIES: list[tuple[str, list[int], float]] = [
    ("", [0, 4, 7], 0.0),
    ("m", [0, 3, 7], 0.0),
    ("7", [0, 4, 7, 10], 0.03),
    ("maj7", [0, 4, 7, 11], 0.03),
    ("m7", [0, 3, 7, 10], 0.03),
    ("sus2", [0, 2, 7], 0.02),
    ("sus4", [0, 5, 7], 0.02),
    ("dim", [0, 3, 6], 0.02),
    ("aug", [0, 4, 8], 0.02),
    ("add9", [0, 2, 4, 7], 0.05),
]


def _build_quality_templates() -> list[tuple[str, np.ndarray, float]]:
    out: list[tuple[str, np.ndarray, float]] = []
    for suffix, intervals, penalty in _CHORD_QUALITIES:
        t = np.zeros(12, dtype=np.float32)
        for i in intervals:
            t[i % 12] = 1.0
        out.append((suffix, _normalize(t), penalty))
    return out


_QUALITY_TEMPLATES = _build_quality_templates()


def _label(root: int, suffix: str) -> str:
    n = _PITCH_CLASSES[root]
    return n if suffix == "" else f"{n}{suffix}"


def detect_chords(
    y: np.ndarray,
    sr: int,
    beat_times: np.ndarray,
    beats_per_bar: int = 4,
    chroma_hop_length: int = 512,
) -> list[ChordEvent]:
    if beat_times.size < 2:
        return []

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=chroma_hop_length)
    frame_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=chroma_hop_length)

    events: list[ChordEvent] = []
    beat_count = beat_times.size
    bar_count = (beat_count - 1) // beats_per_bar
    if bar_count < 1:
        bar_count = 1

    for bar in range(bar_count):
        start_beat = bar * beats_per_bar
        end_beat = min(start_beat + beats_per_bar, beat_count - 1)
        start_t = float(beat_times[start_beat])
        end_t = float(beat_times[end_beat])
        if end_t <= start_t:
            continue

        idx = np.where((frame_times >= start_t) & (frame_times < end_t))[0]
        if idx.size == 0:
            continue

        bar_chroma = np.mean(chroma[:, idx], axis=1)
        bar_chroma = _normalize(bar_chroma)

        best_score = -1.0
        best_label = "N"
        for root in range(12):
            for suffix, template, penalty in _QUALITY_TEMPLATES:
                score = float(np.dot(bar_chroma, np.roll(template, root))) - penalty
                if score > best_score:
                    best_score = score
                    best_label = _label(root, suffix)

        if best_score < 0.25:
            best_label = "N"

        events.append(ChordEvent(start_sec=start_t, end_sec=end_t, chord=best_label))

    return events


def analyze_audio(audio_path: str, title: str) -> AudioAnalysis:
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    duration_sec = float(librosa.get_duration(y=y, sr=sr))
    tempo_bpm, beat_times = detect_tempo(y, sr)

    if beat_times.size < 2:
        beat_times = np.asarray([0.0, float(librosa.get_duration(y=y, sr=sr))], dtype=np.float32)

    chords = detect_chords(y, sr, beat_times, beats_per_bar=4)
    bar_chords = [c.chord for c in chords]

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key = detect_key_from_chroma(np.mean(chroma, axis=1))

    return AudioAnalysis(
        title=title,
        tempo_bpm=tempo_bpm,
        time_signature="4/4",
        key=key,
        bar_chords=bar_chords,
        beat_times=beat_times,
        duration_sec=duration_sec,
    )

