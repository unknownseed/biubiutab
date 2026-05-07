"""
和弦检测器（默认 madmom，保留 librosa 旧版作为回归/降级）

- 新版：madmom (DeepChroma + CRF) -> 更高准确度
- 旧版：librosa chroma 模板匹配 -> 作为 fallback（见 chord_detector_librosa.py）
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal, Optional

import librosa
import numpy as np

import chord_detector_librosa as _legacy

try:
    from chord_detector_madmom import detect_chords_madmom, simplify_chord_name

    _HAVE_MADMOM = True
except Exception:
    _HAVE_MADMOM = False


PitchClassName = Literal["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_PITCH_CLASSES: list[str] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass(frozen=True)
class ChordEvent:
    start_sec: float
    end_sec: float
    chord: str


@dataclass(frozen=False)
class AudioAnalysis:
    title: str
    tempo_bpm: int
    time_signature: str
    key: str
    bar_chords: list[str]
    bar_chords_sub: list[list[str]] | None
    beat_times: np.ndarray
    duration_sec: float


def _safe_int_bpm(x: float) -> int:
    return _legacy._safe_int_bpm(x)


def detect_tempo(y: np.ndarray, sr: int) -> tuple[int, np.ndarray]:
    return _legacy.detect_tempo(y, sr)


def _normalize(v: np.ndarray) -> np.ndarray:
    return _legacy._normalize(v)


def detect_key_from_chroma(chroma_mean: np.ndarray) -> str:
    return _legacy.detect_key_from_chroma(chroma_mean)


def _detect_chords_madmom_to_bars(audio_path: str, beat_times: np.ndarray, beats_per_bar: int) -> list[ChordEvent]:
    """
    Run madmom on the whole track (segment-level), then map to bar-level chords by bar midpoint.
    """
    segs = detect_chords_madmom(audio_path)
    if not segs or beat_times.size < 2:
        return []

    # Convert segments to arrays for fast lookup (start/end/label)
    seg_starts = [float(s["time"]) for s in segs]
    seg_ends = [float(s.get("end", float(s["time"]) + float(s.get("duration", 0.0)))) for s in segs]
    seg_labels = [simplify_chord_name(str(s["chord"])) for s in segs]

    # Precompute chroma for confidence estimation (single pass).
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    frame_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=512)
    conf_th = float(os.environ.get("CHORD_MIN_CONFIDENCE", "0.28"))
    quality_delta = float(os.environ.get("CHORD_QUALITY_DELTA", "0.03"))

    import math
    events: list[ChordEvent] = []
    beat_count = beat_times.size
    bar_count = math.ceil((beat_count - 1) / beats_per_bar)
    if bar_count < 1:
        bar_count = 1

    seg_idx = 0
    for bar in range(bar_count):
        start_beat = bar * beats_per_bar
        end_beat = min(start_beat + beats_per_bar, beat_count - 1)
        start_t = float(beat_times[start_beat])
        end_t = float(beat_times[end_beat])
        if end_t <= start_t:
            continue

        mid = (start_t + end_t) / 2.0
        while seg_idx + 1 < len(seg_starts) and seg_starts[seg_idx + 1] <= mid:
            seg_idx += 1
        # ensure segment covers mid (if gaps, advance)
        while seg_idx + 1 < len(seg_starts) and seg_ends[seg_idx] <= mid:
            seg_idx += 1

        chord = seg_labels[seg_idx] if 0 <= seg_idx < len(seg_labels) else "N"
        # madmom may output "N" / "NoChord" variants; normalize to "N"
        if chord.lower() in {"n", "no_chord", "nochord", "none"}:
            chord = "N"

        # Confidence gating + chord quality refinement (lyrics-friendly):
        # - refine triads to 7th chords if the chroma evidence is strong enough
        # - if confidence is below threshold, output 'N' to avoid incorrect chords.
        if chord != "N":
            try:
                chord, conf = _refine_and_score_bar_chord(chroma, frame_times, start_t, end_t, chord, quality_delta)
                if conf < conf_th:
                    chord = "N"
            except Exception:
                # On any failure, keep chord (do not block the pipeline).
                pass

        events.append(ChordEvent(start_sec=start_t, end_sec=end_t, chord=chord))

    return events


def _detect_chords_madmom_to_bar_subchords(audio_path: str, beat_times: np.ndarray, beats_per_bar: int, slices_per_bar: int = 2) -> list[list[ChordEvent]]:
    segs = detect_chords_madmom(audio_path)
    if not segs or beat_times.size < 2:
        return []

    seg_starts = [float(s["time"]) for s in segs]
    seg_ends = [float(s.get("end", float(s["time"]) + float(s.get("duration", 0.0)))) for s in segs]
    seg_labels = [simplify_chord_name(str(s["chord"])) for s in segs]

    y, sr = librosa.load(audio_path, sr=None, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    frame_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=512)
    conf_th = float(os.environ.get("CHORD_MIN_CONFIDENCE", "0.28"))
    quality_delta = float(os.environ.get("CHORD_QUALITY_DELTA", "0.03"))

    import math

    out: list[list[ChordEvent]] = []
    beat_count = beat_times.size
    bar_count = math.ceil((beat_count - 1) / beats_per_bar)
    if bar_count < 1:
        bar_count = 1

    seg_idx = 0
    half = max(1, beats_per_bar // max(1, slices_per_bar))

    for bar in range(bar_count):
        bar_events: list[ChordEvent] = []
        for si in range(slices_per_bar):
            start_beat = bar * beats_per_bar + si * half
            end_beat = min(start_beat + half, (bar + 1) * beats_per_bar, beat_count - 1)
            if start_beat >= beat_count - 1:
                continue
            start_t = float(beat_times[start_beat])
            end_t = float(beat_times[end_beat])
            if end_t <= start_t:
                continue

            mid = (start_t + end_t) / 2.0
            while seg_idx + 1 < len(seg_starts) and seg_starts[seg_idx + 1] <= mid:
                seg_idx += 1
            while seg_idx + 1 < len(seg_starts) and seg_ends[seg_idx] <= mid:
                seg_idx += 1

            chord = seg_labels[seg_idx] if 0 <= seg_idx < len(seg_labels) else "N"
            if chord.lower() in {"n", "no_chord", "nochord", "none"}:
                chord = "N"

            if chord != "N":
                try:
                    chord, conf = _refine_and_score_bar_chord(chroma, frame_times, start_t, end_t, chord, quality_delta)
                    if conf < conf_th:
                        chord = "N"
                except Exception:
                    pass

            bar_events.append(ChordEvent(start_sec=start_t, end_sec=end_t, chord=chord))

        out.append(bar_events)

    return out


def _detect_chords_madmom_bars_and_subchords(
    audio_path: str,
    y: np.ndarray,
    sr: int,
    beat_times: np.ndarray,
    *,
    beats_per_bar: int = 4,
    slices_per_bar: int = 2,
) -> tuple[list[ChordEvent], list[list[ChordEvent]]]:
    segs = detect_chords_madmom(audio_path)
    if not segs or beat_times.size < 2:
        return ([], [])

    seg_starts = [float(s["time"]) for s in segs]
    seg_ends = [float(s.get("end", float(s["time"]) + float(s.get("duration", 0.0)))) for s in segs]
    seg_labels = [simplify_chord_name(str(s["chord"])) for s in segs]

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    frame_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=512)
    conf_th = float(os.environ.get("CHORD_MIN_CONFIDENCE", "0.28"))
    quality_delta = float(os.environ.get("CHORD_QUALITY_DELTA", "0.03"))

    import bisect
    import math

    def _pick_label(start_t: float, end_t: float) -> str:
        if end_t <= start_t:
            return "N"
        mid = (start_t + end_t) / 2.0
        i = bisect.bisect_right(seg_starts, mid) - 1
        if i < 0:
            i = 0
        while i + 1 < len(seg_starts) and seg_ends[i] <= mid:
            i += 1
        chord = seg_labels[i] if 0 <= i < len(seg_labels) else "N"
        if chord.lower() in {"n", "no_chord", "nochord", "none"}:
            chord = "N"
        if chord != "N":
            try:
                chord, conf = _refine_and_score_bar_chord(chroma, frame_times, start_t, end_t, chord, quality_delta)
                if conf < conf_th:
                    chord = "N"
            except Exception:
                pass
        return chord

    beat_count = beat_times.size
    bar_count = math.ceil((beat_count - 1) / beats_per_bar)
    if bar_count < 1:
        bar_count = 1

    bar_events: list[ChordEvent] = []
    sub_events: list[list[ChordEvent]] = []

    half = max(1, beats_per_bar // max(1, slices_per_bar))

    for bar in range(bar_count):
        start_beat = bar * beats_per_bar
        end_beat = min(start_beat + beats_per_bar, beat_count - 1)
        start_t = float(beat_times[start_beat])
        end_t = float(beat_times[end_beat])
        if end_t > start_t:
            chord = _pick_label(start_t, end_t)
            bar_events.append(ChordEvent(start_sec=start_t, end_sec=end_t, chord=chord))

        bar_list: list[ChordEvent] = []
        for si in range(slices_per_bar):
            s0 = bar * beats_per_bar + si * half
            s1 = min(s0 + half, (bar + 1) * beats_per_bar, beat_count - 1)
            if s0 >= beat_count - 1:
                continue
            st = float(beat_times[s0])
            et = float(beat_times[s1])
            if et <= st:
                continue
            chord = _pick_label(st, et)
            bar_list.append(ChordEvent(start_sec=st, end_sec=et, chord=chord))
        sub_events.append(bar_list)

    return (bar_events, sub_events)


def _bar_chroma_slice(chroma: np.ndarray, frame_times: np.ndarray, start_t: float, end_t: float) -> np.ndarray | None:
    idx = np.where((frame_times >= start_t) & (frame_times < end_t))[0]
    if idx.size == 0:
        return None
    v = np.mean(chroma[:, idx], axis=1)
    return _normalize(v)


def _score_template(bar_chroma: np.ndarray, root_idx: int, intervals: list[int]) -> float:
    t = np.zeros(12, dtype=np.float32)
    for i in intervals:
        t[i % 12] = 1.0
    t = _normalize(t)
    return float(np.dot(bar_chroma, np.roll(t, root_idx)))


def _refine_and_score_bar_chord(
    chroma: np.ndarray,
    frame_times: np.ndarray,
    start_t: float,
    end_t: float,
    chord: str,
    quality_delta: float,
) -> tuple[str, float]:
    """
    Estimate confidence and (optionally) refine chord quality.

    Why:
    - madmom maj/min model mostly outputs triads (C / Cm).
    - Users want 7th chords (C7 / Cmaj7 / Cm7).
    - We refine only when evidence is strong, otherwise keep triad.

    Returns:
        (refined_chord, score)
    """
    bar_chroma = _bar_chroma_slice(chroma, frame_times, start_t, end_t)
    if bar_chroma is None:
        return chord, 0.0

    # Parse chord: "C" or "Cm"
    root = chord
    minor = False
    if chord.endswith("m") and len(chord) > 1:
        root = chord[:-1]
        minor = True
    if root not in _PITCH_CLASSES:
        return chord, 0.0
    root_idx = _PITCH_CLASSES.index(root)

    # Triad base score
    base_intervals = [0, 3, 7] if minor else [0, 4, 7]
    base_score = _score_template(bar_chroma, root_idx, base_intervals)

    best = (chord, base_score)

    # Candidate chord qualities to try.
    # NOTE: Per user request, we restrict the vocabulary to basic triads, 7th chords, and sus2
    # to cater to beginner/intermediate guitar players.
    # Advanced chords like add9, dim, aug, sus4 are intentionally excluded.
    candidates: list[tuple[str, list[int]]] = []

    # Common extensions
    if minor:
        candidates.append((f"{root}m7", [0, 3, 7, 10]))
    else:
        candidates.append((f"{root}7", [0, 4, 7, 10]))
        candidates.append((f"{root}maj7", [0, 4, 7, 11]))

    # Suspended chords (root-based)
    candidates.append((f"{root}sus2", [0, 2, 7]))

    for label, intervals in candidates:
        s = _score_template(bar_chroma, root_idx, intervals)
        if s >= best[1] + quality_delta:
            best = (label, s)

    return best


def detect_chords(
    y: np.ndarray,
    sr: int,
    beat_times: np.ndarray,
    beats_per_bar: int = 4,
    chroma_hop_length: int = 512,
    *,
    audio_path: Optional[str] = None,
) -> list[ChordEvent]:
    """
    Detect bar-level chords.

    Selection:
    - If CHORD_DETECTOR=librosa -> always use legacy
    - Else (default): use madmom if available AND audio_path is provided; fallback to legacy.
    """
    prefer = (os.environ.get("CHORD_DETECTOR") or "madmom").lower().strip()
    if prefer != "librosa" and _HAVE_MADMOM and audio_path:
        try:
            return _detect_chords_madmom_to_bars(audio_path, beat_times, beats_per_bar)
        except Exception:
            # fallback to legacy
            pass
    return _legacy.detect_chords(y, sr, beat_times, beats_per_bar=beats_per_bar, chroma_hop_length=chroma_hop_length)


def analyze_audio(audio_path: str, title: str) -> AudioAnalysis:
    return analyze_audio_multi(audio_path, title, tempo_path=audio_path, chord_path=audio_path, key_path=audio_path)


def analyze_audio_multi(
    audio_path: str,
    title: str,
    *,
    tempo_path: str | None = None,
    chord_path: str | None = None,
    key_path: str | None = None,
) -> AudioAnalysis:
    """
    Multi-input analysis:
    - tempo_path: best source for tempo / beat tracking (e.g., mix or percussive stem)
    - chord_path: best source for chord recognition (e.g., harmonic stem)
    - key_path: best source for key estimation (e.g., harmonic stem)

    Backward compatible: `analyze_audio()` calls this with all paths = audio_path.
    """
    from chord_simplifier import simplify_chord

    tempo_path = tempo_path or audio_path
    chord_path = chord_path or audio_path
    key_path = key_path or audio_path

    low_mem = (os.environ.get("AI_LOW_MEM") or os.environ.get("AI_LITE") or "").strip().lower() in {"1", "true", "yes", "y", "on"}
    max_sec = float(os.environ.get("AI_ANALYSIS_MAX_SEC", "90")) if low_mem else 0.0
    load_kwargs = {"sr": 22050, "mono": True, "duration": max_sec} if low_mem and max_sec > 0 else {"sr": None, "mono": True}

    # Tempo / beat grid
    y_tempo, sr_tempo = librosa.load(tempo_path, **load_kwargs)
    try:
        duration_sec = float(librosa.get_duration(path=tempo_path))
    except Exception:
        duration_sec = float(librosa.get_duration(y=y_tempo, sr=sr_tempo))
    tempo_bpm, beat_times = detect_tempo(y_tempo, sr_tempo)
    if beat_times.size < 2:
        beat_times = np.asarray([0.0, float(duration_sec)], dtype=np.float32)
    else:
        # Extrapolate beat_times to cover the entire audio duration
        avg_interval = (beat_times[-1] - beat_times[0]) / max(1, len(beat_times) - 1)
        
        # Extrapolate backwards to 0.0
        front_beats = []
        curr = beat_times[0] - avg_interval
        while curr > 0.0:
            front_beats.append(curr)
            curr -= avg_interval
        front_beats.reverse()
        
        # Extrapolate forwards to duration_sec
        back_beats = []
        curr = beat_times[-1] + avg_interval
        while curr < duration_sec:
            back_beats.append(curr)
            curr += avg_interval
            
        beat_times = np.concatenate([front_beats, beat_times, back_beats]).astype(np.float32)

    # Chords (prefer madmom via audio_path=chord_path)
    y_chord, sr_chord = librosa.load(chord_path, **load_kwargs)

    bar_chords_sub: list[list[str]] | None = None
    try:
        subdiv = int(os.environ.get("CHORD_BAR_SUBDIV", "2"))
    except Exception:
        subdiv = 2

    prefer = (os.environ.get("CHORD_DETECTOR") or "madmom").lower().strip()
    if prefer != "librosa" and _HAVE_MADMOM and chord_path and subdiv >= 2:
        try:
            bar_events, sub_events = _detect_chords_madmom_bars_and_subchords(
                chord_path,
                y_chord,
                sr_chord,
                beat_times,
                beats_per_bar=4,
                slices_per_bar=2,
            )
            bar_chords = [simplify_chord(c.chord, force_triads=False) for c in bar_events]
            tmp: list[list[str]] = []
            for i, evs in enumerate(sub_events):
                labels = [simplify_chord(e.chord, force_triads=False) for e in evs] if evs else []
                labels = [c for c in labels if c]
                if not labels:
                    labels = [bar_chords[i] if i < len(bar_chords) else "N"]
                if len(labels) >= 2:
                    a, b = labels[0], labels[1]
                    if a == "N" and b != "N":
                        labels = [b]
                    elif a != "N" and b == "N":
                        labels = [a]
                    elif a == b:
                        labels = [a]
                    else:
                        labels = [a, b]
                tmp.append(labels)
            bar_chords_sub = tmp
        except Exception:
            bar_chords_sub = None
    else:
        chords = detect_chords(y_chord, sr_chord, beat_times, beats_per_bar=4, audio_path=chord_path)
        bar_chords = [simplify_chord(c.chord, force_triads=False) for c in chords]
        if bar_chords_sub is None:
            bar_chords_sub = [[c] for c in bar_chords]

    # Key (from chroma of key_path)
    y_key, sr_key = librosa.load(key_path, **load_kwargs)
    chroma = librosa.feature.chroma_cqt(y=y_key, sr=sr_key)
    key = detect_key_from_chroma(np.mean(chroma, axis=1))

    return AudioAnalysis(
        title=title,
        tempo_bpm=tempo_bpm,
        time_signature="4/4",
        key=key,
        bar_chords=bar_chords,
        bar_chords_sub=bar_chords_sub,
        beat_times=beat_times,
        duration_sec=duration_sec,
    )
