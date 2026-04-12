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
    jianpu_beats: list[str] | None = None,
    lyrics_beats: list[str | None] | None = None,
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
    pending_chord = chord_name if chord_name and chord_name != "N" else None

    pending_lyric: str | None = None
    pending_text: str | None = None

    for i in range(slots):
        t0 = bar_start + i * (beat_sec / 2.0)
        t1 = bar_start + (i + 1) * (beat_sec / 2.0)
        n = _best_note_for_window(events, t0, t1)
        
        pos = None
        if n is not None:
            pos = _choose_position(n.pitch, prev_pos)

        if i % 2 == 0:
            beat_idx = i // 2
            if jianpu_beats and 0 <= beat_idx < len(jianpu_beats):
                l = jianpu_beats[beat_idx]
                if l and l != "-":
                    if pending_lyric:
                        pending_lyric += f" {l}"
                    else:
                        pending_lyric = l
            if lyrics_beats and 0 <= beat_idx < len(lyrics_beats):
                txt = lyrics_beats[beat_idx]
                if txt:
                    if pending_text:
                        pending_text += f" {txt}"
                    else:
                        pending_text = txt

        if pos is None:
            tokens.append("r")
            continue

        prev_pos = pos
        note_count += 1
        base_token = f"{pos.fret}.{pos.string}"

        effects = []
        if pending_chord:
            effects.append(f'ch "{_escape(pending_chord)}"')
            pending_chord = None

        esc_lyric = _escape(pending_lyric) if pending_lyric else ""
        if esc_lyric:
            effects.append(f'lyrics "{esc_lyric}"')
        pending_lyric = None

        esc_text = _escape(pending_text) if pending_text else ""
        if esc_text:
            if not esc_lyric:
                effects.append('lyrics "\xa0"')
            effects.append('lyrics 1 "\xa0"')
            effects.append(f'lyrics 2 "{esc_text}"')
        pending_text = None

        if effects:
            tokens.append(f"{base_token} {{ {' '.join(effects)} }}")
        else:
            tokens.append(base_token)

    return (":8 " + " ".join(tokens) + " |", note_count)


def _escape(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\r", " ").replace("\n", " ").strip()


def _arpeggio_bar_from_chord(
    chord: str,
    beats_per_bar: int,
    jianpu_beats: list[str] | None = None,
    lyrics_beats: list[str | None] | None = None,
) -> str:
    """
    Fallback: use chord fingering to generate a simple 8th-note arpeggio.
    """
    shape = chord_shape_for_label(chord) if chord and chord != "N" else None
    
    available: list[TabNote] = []
    if shape:
        frets_high_to_low = shape.frets_high_to_low  # len=6, highE..lowE
        for i, f in enumerate(frets_high_to_low, start=1):
            string = i
            if f != "x":
                try:
                    available.append(TabNote(string=string, fret=int(f)))
                except Exception:
                    pass

    seq: list[TabNote] = []
    if available:
        preferred_order = [6, 5, 4, 3, 2, 3, 4, 5]
        by_string = {n.string: n for n in available}
        for s in preferred_order:
            if s in by_string:
                seq.append(by_string[s])
        if not seq:
            seq = available
    else:
        # Default to a "hold" on a safe middle string if no shape.
        seq = [TabNote(string=3, fret=0)]
        available = []

    slots = beats_per_bar * 2
    out_notes = [seq[i % len(seq)] for i in range(slots)]
    if not available:
        # if we fallback to the default hold, we only play the first note
        out_notes = [seq[0]] + [None] * (slots - 1)

    tokens: list[str] = []
    pending_chord = chord if chord and chord != "N" else None
    pending_lyric: str | None = None
    pending_text: str | None = None

    for i, pos in enumerate(out_notes):
        if i % 2 == 0:
            beat_idx = i // 2
            if jianpu_beats and 0 <= beat_idx < len(jianpu_beats):
                l = jianpu_beats[beat_idx]
                if l and l != "-":
                    if pending_lyric:
                        pending_lyric += f" {l}"
                    else:
                        pending_lyric = l
            if lyrics_beats and 0 <= beat_idx < len(lyrics_beats):
                txt = lyrics_beats[beat_idx]
                if txt:
                    if pending_text:
                        pending_text += f" {txt}"
                    else:
                        pending_text = txt

        if pos is None:
            tokens.append("r")
            continue

        base_token = f"{pos.fret}.{pos.string}"
            
        effects = []
        if pending_chord:
            effects.append(f'ch "{_escape(pending_chord)}"')
            pending_chord = None

        esc_lyric = _escape(pending_lyric) if pending_lyric else ""
        if esc_lyric:
            effects.append(f'lyrics "{esc_lyric}"')
        pending_lyric = None

        esc_text = _escape(pending_text) if pending_text else ""
        if esc_text:
            if not esc_lyric:
                effects.append('lyrics "\xa0"')
            effects.append('lyrics 1 "\xa0"')
            effects.append(f'lyrics 2 "{esc_text}"')
        pending_text = None

        if effects:
            tokens.append(f"{base_token} {{ {' '.join(effects)} }}")
        else:
            tokens.append(base_token)

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
    jianpu_beats: list[str] | None = None,
    lyrics_beats: list[str | None] | None = None,
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
        
        j_beats = None
        if jianpu_beats:
            j_beats = jianpu_beats[bar * beats_per_bar : (bar + 1) * beats_per_bar]
        l_beats = None
        if lyrics_beats:
            l_beats = lyrics_beats[bar * beats_per_bar : (bar + 1) * beats_per_bar]

        line, note_count = _render_bar_tokens_8th(events, bar_start, beat_sec, beats_per_bar, chord, j_beats, l_beats)
        if note_count < min_notes_per_bar:
            line = _arpeggio_bar_from_chord(chord, beats_per_bar, j_beats, l_beats)
        overrides[bar] = line
    return overrides

