from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Literal


StrumDir = Literal["d", "u"]


@dataclass(frozen=True)
class RhythmToken:
    kind: Literal["strum", "rest"]
    duration: int
    direction: StrumDir | None = None


@dataclass(frozen=True)
class RhythmPattern:
    notation: str
    tokens: list[RhythmToken]
    bpm_range: tuple[int, int]
    description: str


STRUMMING_PATTERNS: dict[str, RhythmPattern] = {
    "fingerpick_8th": RhythmPattern(
        notation="P i m a (8th)",
        tokens=[
            # Render as slashed rhythm (tab staff) but pick-direction is not used;
            # the visual pattern is conveyed by the timing density.
            RhythmToken("strum", 8, "d"),
            RhythmToken("strum", 8, "u"),
            RhythmToken("strum", 8, "d"),
            RhythmToken("strum", 8, "u"),
            RhythmToken("strum", 8, "d"),
            RhythmToken("strum", 8, "u"),
            RhythmToken("strum", 8, "d"),
            RhythmToken("strum", 8, "u"),
        ],
        bpm_range=(50, 110),
        description="低能量：用更平稳的 8 分分解/拨弦密度（MVP）",
    ),
    "ballad": RhythmPattern(
        notation="D - D - D - D -",
        tokens=[
            RhythmToken("strum", 8, "d"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 8, "d"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 8, "d"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 8, "d"),
            RhythmToken("rest", 8),
        ],
        bpm_range=(50, 68),
        description="慢歌 8 分下扫（每拍一下）",
    ),
    "folk_basic": RhythmPattern(
        notation="D - D U - U D U",
        tokens=[
            RhythmToken("strum", 8, "d"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 8, "d"),
            RhythmToken("strum", 8, "u"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 8, "u"),
            RhythmToken("strum", 8, "d"),
            RhythmToken("strum", 8, "u"),
        ],
        bpm_range=(70, 120),
        description="万能八分民谣节奏",
    ),
    "pop_16th": RhythmPattern(
        notation="D U D U D U D U (16th)",
        tokens=[RhythmToken("strum", 16, "d"), RhythmToken("strum", 16, "u")] * 8,
        bpm_range=(90, 150),
        description="16 分密集扫弦",
    ),
    "soul": RhythmPattern(
        notation="D - DU U - DU",
        tokens=[
            RhythmToken("strum", 8, "d"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 16, "d"),
            RhythmToken("strum", 16, "u"),
            RhythmToken("strum", 8, "u"),
            RhythmToken("rest", 8),
            RhythmToken("strum", 16, "d"),
            RhythmToken("strum", 16, "u"),
        ],
        bpm_range=(80, 120),
        description="偏灵魂/流行的切分感",
    ),
}


def select_pattern(bpm: int, energy: float | None = None) -> RhythmPattern:
    """
    Step 8A: 根据 BPM + percussive 能量（0~1）选择节奏型。

    - energy 越低：更像分解/轻触（fingerpick_8th）
    - energy 中等：标准民谣扫弦（folk_basic / soul）
    - energy 高：更密集或更直接（pop_16th）
    """
    if energy is None:
        for p in STRUMMING_PATTERNS.values():
            lo, hi = p.bpm_range
            if lo <= bpm <= hi:
                return p
        return STRUMMING_PATTERNS["folk_basic"]

    e = max(0.0, min(1.0, float(energy)))

    # Heuristics (tuned for MVP; can be refined later with more signals):
    low = float(os.environ.get("RHYTHM_ENERGY_LOW") or "0.25")
    high = float(os.environ.get("RHYTHM_ENERGY_HIGH") or "0.55")
    # Ensure sane ordering
    low = max(0.0, min(1.0, low))
    high = max(low, min(1.0, high))

    if e < low:
        return STRUMMING_PATTERNS["fingerpick_8th"]
    if e < high:
        # Moderate groove: prefer folk; if bpm mid-range, soul can feel better.
        if 78 <= bpm <= 110:
            return STRUMMING_PATTERNS["soul"]
        return STRUMMING_PATTERNS["folk_basic"]
    # High energy: dense
    if bpm >= 105:
        return STRUMMING_PATTERNS["pop_16th"]
    return STRUMMING_PATTERNS["folk_basic"]


def pattern_to_alphatex(
    pattern: RhythmPattern,
    chord: str,
    show_chord_name: bool,
    label: str | None = None,
    jianpu_beats: list[str] | None = None,
    lyrics_beats: list[str | None] | None = None,
) -> str:
    parts: list[str] = []
    current_duration: int | None = None

    first_strum = True
    pos16 = 0
    pending_lyric: str | None = None
    pending_text: str | None = None

    for t in pattern.tokens:
        if current_duration != t.duration:
            parts.append(f":{t.duration}")
            current_duration = t.duration

        # Accumulate lyrics that fall on rests so we can attach them to the next note
        if pos16 % 4 == 0:
            beat_idx = pos16 // 4
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

        if t.kind == "rest":
            parts.append("r")
            pos16 += _duration_to_16th(t.duration)
            continue

        # NOTE:
        # We render to a tab staff (`\staff {tabs}`) but want "slash rhythm" style
        # strums. The `slashed` effect is required to make alphaTab render this as
        # rhythmic slashes rather than repeated open-string notes.
        #
        # If alphaTab crashes on some inputs (observed: bottomY undefined), the web
        # frontend will automatically retry with a more conservative alphaTex (by
        # stripping other text-related effects first).
        effects: list[str] = ["slashed"]
        if label and first_strum:
            effects.append(f'txt "{_escape_str(label)}"')
            
        esc_lyric = _escape_str(pending_lyric) if pending_lyric else ""
        if esc_lyric:
            effects.append(f'lyrics "{esc_lyric}"')
        pending_lyric = None

        has_lyrics_1 = False
        # Put strumming direction below chord diagrams by rendering it as a lyrics line.
        # We keep it ASCII to avoid font issues across platforms (Render/Linux).
        # alphaTex supports `lyrics <line> "<text>"` per beat.
        if t.direction == "d":
            effects.append('lyrics 1 "v"')
            has_lyrics_1 = True
        else:
            effects.append('lyrics 1 "^"')
            has_lyrics_1 = True

        esc_text = _escape_str(pending_text) if pending_text else ""
        if esc_text:
            if not esc_lyric:
                effects.append('lyrics "\xa0"')
            if not has_lyrics_1:
                effects.append('lyrics 1 "\xa0"')
            effects.append(f'lyrics 2 "{esc_text}"')
        pending_text = None

        if show_chord_name and first_strum:
            effects.append(f'ch "{_escape_str(chord)}"')
        parts.append(f'0.1 {{ {" ".join(effects)} }}' if effects else "0.1")
        first_strum = False
        pos16 += _duration_to_16th(t.duration)

    parts.append("|")
    return " ".join(parts)


def _escape_str(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\r", " ").replace("\n", " ").strip()


def _duration_to_16th(duration: int) -> int:
    if duration == 4:
        return 4
    if duration == 8:
        return 2
    if duration == 16:
        return 1
    if duration == 2:
        return 8
    if duration == 1:
        return 16
    return max(1, int(round(16 / float(duration))))
