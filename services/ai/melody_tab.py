from __future__ import annotations

"""
Step 7B (MVP): 生成主旋律谱 (Melody Tab)

输入：
- note_events: 来自 Basic Pitch / torchcrepe 统一后的 note events（start/end/pitch/velocity）
- lyrics_segments: 来自 faster-whisper 的 segments（start/end/text）

输出：
- aligned_melody: note 与歌词粗对齐（逐字/逐拍的 MVP）
- bar_lines: alphaTex 的 tab 小节行（以 8 分网格量化）

设计目标：
- 单旋律：每个时间槽最多 1 个音符
- 单弦优先：优先 1 弦（高音 E），不行则 2 弦，尽量低把位（<=12 品）
- 可读性优先：先实现可用的 MVP，对齐/把位策略后续可迭代
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass(frozen=True)
class Note:
    start_sec: float
    end_sec: float
    pitch: int
    velocity: int = 0


@dataclass(frozen=True)
class AlignedNote(Note):
    lyric: str | None = None


_STANDARD_TUNING_MIDI = {
    6: 40,  # E2
    5: 45,  # A2
    4: 50,  # D3
    3: 55,  # G3
    2: 59,  # B3
    1: 64,  # E4
}


def _escape_str(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace('"', '\\"')


def _parse_time_signature(ts: str) -> int:
    try:
        num = int((ts or "4/4").split("/", 1)[0])
        return max(1, min(12, num))
    except Exception:
        return 4


def _split_zh_chars(text: str) -> list[str]:
    # MVP: 去掉空白；标点保留会影响映射，这里先移除常见标点
    s = (text or "").strip()
    if not s:
        return []
    for ch in ["，", "。", "！", "？", "、", "：", "；", ",", ".", "!", "?", ":", ";", "…", "-", "—", "(", ")", "（", "）"]:
        s = s.replace(ch, " ")
    s = "".join(s.split())
    return list(s)


def align_melody_to_lyrics(note_events: list[dict[str, Any]], lyrics_segments: list[dict[str, Any]], language: str = "zh") -> list[dict[str, Any]]:
    """
    MVP 粗对齐：
    - 对每个 whisper segment，取落在时间窗内的 note_events（按 start_sec）
    - 中文：按字符切分，把字符按顺序分配到音符上（音符少则把剩余字符合并到最后一个音符）
    """
    notes = [
        AlignedNote(
            start_sec=float(n.get("start_sec", 0.0)),
            end_sec=float(n.get("end_sec", 0.0)),
            pitch=int(n.get("pitch", 0)),
            velocity=int(n.get("velocity", 0) or 0),
            lyric=None,
        )
        for n in (note_events or [])
        if n is not None
    ]
    notes = [n for n in notes if n.end_sec > n.start_sec and 0 <= n.pitch <= 127]
    notes.sort(key=lambda n: (n.start_sec, n.pitch))

    aligned: list[AlignedNote] = []
    idx = 0
    for seg in lyrics_segments or []:
        t0 = float(seg.get("start", seg.get("start_sec", 0.0)) or 0.0)
        t1 = float(seg.get("end", seg.get("end_sec", 0.0)) or 0.0)
        txt = str(seg.get("text") or "").strip()
        if t1 <= t0 or not txt:
            continue

        seg_notes: list[AlignedNote] = []
        while idx < len(notes) and notes[idx].end_sec <= t0:
            idx += 1
        j = idx
        while j < len(notes) and notes[j].start_sec < t1:
            seg_notes.append(notes[j])
            j += 1
        idx = j

        if not seg_notes:
            continue

        if (language or "zh").startswith("zh"):
            chars = _split_zh_chars(txt)
            if not chars:
                aligned.extend(seg_notes)
                continue
            # map chars -> notes
            for k, n in enumerate(seg_notes):
                if k < len(chars):
                    seg_notes[k] = AlignedNote(**{**n.__dict__, "lyric": chars[k]})
                else:
                    seg_notes[k] = AlignedNote(**{**n.__dict__, "lyric": None})
            if len(chars) > len(seg_notes):
                # merge remaining chars into last note
                last = seg_notes[-1]
                merged = (last.lyric or "") + "".join(chars[len(seg_notes) :])
                seg_notes[-1] = AlignedNote(**{**last.__dict__, "lyric": merged})
            aligned.extend(seg_notes)
        else:
            # non-zh: naive word split
            words = txt.split()
            for k, n in enumerate(seg_notes):
                seg_notes[k] = AlignedNote(**{**n.__dict__, "lyric": words[k] if k < len(words) else None})
            aligned.extend(seg_notes)

    return [a.__dict__ for a in aligned]


def _pick_single_string_for_notes(notes: list[AlignedNote], max_fret: int = 12) -> int:
    """
    Choose a single string that can cover the most notes within [0,max_fret].
    Prefer high strings for melody readability.
    """
    scores: dict[int, tuple[int, int]] = {}
    for string in [1, 2, 3, 4, 5, 6]:
        open_pitch = _STANDARD_TUNING_MIDI[string]
        ok = 0
        penalty = 0
        for n in notes:
            fret = n.pitch - open_pitch
            if 0 <= fret <= max_fret:
                ok += 1
                penalty += fret  # lower is better
        scores[string] = (ok, -penalty)
    # maximize ok, then minimize penalty, then prefer string 1,2
    best = sorted(scores.items(), key=lambda kv: (kv[1][0], kv[1][1], -1 if kv[0] == 1 else -2 if kv[0] == 2 else -kv[0]), reverse=True)[0][0]
    return best


def convert_aligned_melody_to_tab_bars(
    aligned_melody: list[dict[str, Any]],
    *,
    tempo_bpm: int,
    time_signature: str,
    bars: int,
    slot: int = 8,  # 8 -> eighth-note grid, 16 -> sixteenth grid
    max_fret: int = 12,
) -> dict[int, str]:
    """
    Convert aligned melody to alphaTex bar lines on a fixed grid.
    Returns {bar_index: ':8 ... |'} lines.
    """
    beats_per_bar = _parse_time_signature(time_signature)
    beat_sec = 60.0 / float(max(1, tempo_bpm))

    notes = [
        AlignedNote(
            start_sec=float(n.get("start_sec", 0.0)),
            end_sec=float(n.get("end_sec", 0.0)),
            pitch=int(n.get("pitch", 0)),
            velocity=int(n.get("velocity", 0) or 0),
            lyric=(str(n.get("lyric")) if n.get("lyric") else None),
        )
        for n in aligned_melody or []
    ]
    notes = [n for n in notes if n.end_sec > n.start_sec and 0 <= n.pitch <= 127]
    notes.sort(key=lambda n: (n.start_sec, n.pitch))

    chosen_string = _pick_single_string_for_notes(notes, max_fret=max_fret)
    open_pitch = _STANDARD_TUNING_MIDI[chosen_string]

    slots_per_beat = 2 if slot == 8 else 4
    slots_per_bar = beats_per_bar * slots_per_beat
    slot_sec = beat_sec / float(slots_per_beat)

    out: dict[int, str] = {}
    idx = 0
    for bar in range(bars):
        bar_start = bar * beats_per_bar * beat_sec
        tokens: list[str] = []
        for s in range(slots_per_bar):
            t0 = bar_start + s * slot_sec
            t1 = t0 + slot_sec

            # pick best note in window
            best: Optional[AlignedNote] = None
            while idx < len(notes) and notes[idx].end_sec <= t0:
                idx += 1
            j = idx
            best_score = -1.0
            while j < len(notes) and notes[j].start_sec < t1:
                n = notes[j]
                overlap = max(0.0, min(n.end_sec, t1) - max(n.start_sec, t0))
                if overlap > 0 and overlap > best_score:
                    fret = n.pitch - open_pitch
                    if 0 <= fret <= max_fret:
                        best = n
                        best_score = overlap
                j += 1

            if best is None:
                tokens.append("r")
                continue

            fret = best.pitch - open_pitch
            if fret < 0 or fret > max_fret:
                tokens.append("r")
                continue

            effects: list[str] = []
            if best.lyric:
                effects.append(f'lyrics "{_escape_str(best.lyric)}"')
            tok = f"{int(fret)}.{chosen_string}"
            tokens.append(f"{tok} {{ {' '.join(effects)} }}" if effects else tok)

        prefix = f":{slot} "
        out[bar] = prefix + " ".join(tokens) + " |"
    return out


def build_vocal_melody_track_alphatex(
    *,
    tempo_bpm: int,
    time_signature: str,
    bars: int,
    bar_lines: dict[int, str],
) -> str:
    """
    Build a standalone alphaTex track that renders the vocal melody as tabs.
    """
    parts: list[str] = []
    parts.append('\\track "Vocal Melody"')
    parts.append("\\staff {tabs}")
    parts.append("\\tuning (E4 B3 G3 D3 A2 E2)")
    parts.append(f"\\tempo {int(tempo_bpm)}")
    if time_signature:
        parts.append(f"\\ts ({time_signature.replace('/', ' ')})")
    parts.append("\\defaultSystemsLayout 4")
    parts.append("")

    for b in range(bars):
        parts.append(bar_lines.get(b, ":8 " + " ".join(["r"] * (_parse_time_signature(time_signature) * 2)) + " |"))
    parts.append("")
    return "\n".join(parts).strip() + "\n"

