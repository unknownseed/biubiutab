from __future__ import annotations

"""
Intro 转写（MVP）

目标：
- 仅覆盖歌曲开头 N 小节（默认 8 小节）
- 优先从 basic-pitch 的音符事件“听出来”生成真实 TAB 音符
- 如果转写质量不足（音符太少/太乱），则基于当前和弦生成分解和弦琶音作为回退

说明：
- 这里的“听不出来”并不是严格的模型置信度，而是基于“每小节能落到网格的音符数量”
  进行一个可控的启发式判断，保证可用性优先。
"""

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

from chord_shapes import chord_shape_for_label
from melody_detector import NoteEvent


_STANDARD_TUNING_MIDI = {
    6: 40,  # E2
    5: 45,  # A2
    4: 50,  # D3
    3: 55,  # G3
    2: 59,  # B3
    1: 64,  # E4
}


@dataclass(frozen=True)
class TabNote:
    string: int  # 1..6 (1=high E)
    fret: int


def _parse_time_signature(time_signature: str) -> int:
    try:
        num = int((time_signature or "4/4").split("/", 1)[0])
        return max(1, min(12, num))
    except Exception:
        return 4


def _choose_position(pitch: int, prev: Optional[TabNote]) -> Optional[TabNote]:
    candidates: list[TabNote] = []
    for string, open_pitch in _STANDARD_TUNING_MIDI.items():
        fret = pitch - open_pitch
        if 0 <= fret <= 12:
            candidates.append(TabNote(string=string, fret=int(fret)))
    if not candidates:
        return None

    if prev is None:
        # prefer lower frets & middle strings
        candidates.sort(key=lambda n: (n.fret, abs(n.string - 3.5)))
        return candidates[0]

    candidates.sort(key=lambda n: (abs(n.fret - prev.fret) + abs(n.string - prev.string) * 0.5, n.fret))
    return candidates[0]


def _best_note_for_window(events: list[NoteEvent], t0: float, t1: float) -> Optional[NoteEvent]:
    best_score = -1.0
    best: Optional[NoteEvent] = None
    for n in events:
        if n.end_sec <= t0:
            continue
        if n.start_sec >= t1:
            break
        overlap = max(0.0, min(n.end_sec, t1) - max(n.start_sec, t0))
        if overlap <= 0:
            continue
        score = overlap + (float(n.velocity) / 127.0) * 0.05 + (n.pitch / 127.0) * 0.01
        if score > best_score:
            best_score = score
            best = n
    return best


def _render_bar_tokens_8th(
    events: list[NoteEvent],
    bar_start: float,
    beat_sec: float,
    beats_per_bar: int,
    chord_name: str,
) -> tuple[str, int]:
    """
    Render a single bar as 8th-note tokens.
    Returns: (alphatex_bar_line, note_count)
    """
    tokens: list[str] = []
    prev_pos: Optional[TabNote] = None
    note_count = 0

    # 8th grid => 2 slots per beat
    slots = beats_per_bar * 2
    for i in range(slots):
        t0 = bar_start + i * (beat_sec / 2.0)
        t1 = bar_start + (i + 1) * (beat_sec / 2.0)
        n = _best_note_for_window(events, t0, t1)
        if n is None:
            tokens.append("r")
            continue
        pos = _choose_position(n.pitch, prev_pos)
        if pos is None:
            tokens.append("r")
            continue
        prev_pos = pos
        note_count += 1

        if i == 0 and chord_name and chord_name != "N":
            tokens.append(f'{pos.fret}.{pos.string} {{ ch "{_escape(chord_name)}" }}')
        else:
            tokens.append(f"{pos.fret}.{pos.string}")

    return (":8 " + " ".join(tokens) + " |", note_count)


def _escape(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace('"', '\\"')


def _arpeggio_bar_from_chord(chord: str, beats_per_bar: int) -> str:
    """
    Fallback: use chord fingering to generate a simple 8th-note arpeggio.
    """
    shape = chord_shape_for_label(chord) if chord and chord != "N" else None
    # Default to a "hold" on a safe middle string if no shape.
    if not shape:
        return f':8 0.3 {{ ch "{_escape(chord or "N")}" }} ' + " ".join(["r"] * (beats_per_bar * 2 - 1)) + " |"

    frets_high_to_low = shape.frets_high_to_low  # len=6, highE..lowE
    # Convert to (string,fret) pairs, prefer bass->treble for arpeggio
    available: list[TabNote] = []
    for i, f in enumerate(frets_high_to_low, start=1):
        string = i  # 1..6 (1=high E)
        if f == "x":
            continue
        try:
            fret = int(f)
        except Exception:
            continue
        available.append(TabNote(string=string, fret=fret))

    if not available:
        return f':8 0.3 {{ ch "{_escape(chord)}" }} ' + " ".join(["r"] * (beats_per_bar * 2 - 1)) + " |"

    # Arpeggio string order (bass-ish -> treble-ish), then bounce back.
    # We try to use strings 6..2 if present; otherwise whatever is available.
    preferred_order = [6, 5, 4, 3, 2, 3, 4, 5]
    # Build lookup
    by_string = {n.string: n for n in available}
    seq: list[TabNote] = []
    for s in preferred_order:
        if s in by_string:
            seq.append(by_string[s])
    if not seq:
        seq = available

    # Ensure length matches 8th slots
    slots = beats_per_bar * 2
    out_notes = [seq[i % len(seq)] for i in range(slots)]
    tokens: list[str] = []
    for i, pos in enumerate(out_notes):
        if i == 0:
            tokens.append(f'{pos.fret}.{pos.string} {{ ch "{_escape(chord)}" }}')
        else:
            tokens.append(f"{pos.fret}.{pos.string}")
    return ":8 " + " ".join(tokens) + " |"


def build_intro_bar_overrides(
    melody: list[NoteEvent],
    tempo_bpm: int,
    duration_sec: float,
    time_signature: str,
    bar_chords: list[str],
    *,
    bars: int = 8,
    min_notes_per_bar: int = 2,
) -> Dict[int, str]:
    """
    Returns a map of {bar_index: alphatex_bar_line} for the first `bars` bars.
    """
    beats_per_bar = _parse_time_signature(time_signature)
    beat_sec = 60.0 / float(max(1, tempo_bpm))
    end_time = min(float(duration_sec), float(bars) * beats_per_bar * beat_sec)

    events = sorted([n for n in melody if n.start_sec < end_time], key=lambda n: (n.start_sec, n.pitch))

    overrides: Dict[int, str] = {}
    for bar in range(min(bars, max(0, len(bar_chords)) or bars)):
        chord = bar_chords[bar] if 0 <= bar < len(bar_chords) else "N"
        bar_start = float(bar) * beats_per_bar * beat_sec
        line, note_count = _render_bar_tokens_8th(events, bar_start, beat_sec, beats_per_bar, chord)
        if note_count < min_notes_per_bar:
            line = _arpeggio_bar_from_chord(chord, beats_per_bar)
        overrides[bar] = line
    return overrides

