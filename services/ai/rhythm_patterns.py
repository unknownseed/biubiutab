from __future__ import annotations

from dataclasses import dataclass
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


def select_pattern(bpm: int) -> RhythmPattern:
    for p in STRUMMING_PATTERNS.values():
        lo, hi = p.bpm_range
        if lo <= bpm <= hi:
            return p
    return STRUMMING_PATTERNS["folk_basic"]


def pattern_to_alphatex(
    pattern: RhythmPattern,
    chord: str,
    show_chord_name: bool,
    label: str | None = None,
    jianpu_beats: list[str] | None = None,
) -> str:
    parts: list[str] = []
    current_duration: int | None = None

    first_strum = True
    pos16 = 0
    for t in pattern.tokens:
        if current_duration != t.duration:
            parts.append(f":{t.duration}")
            current_duration = t.duration

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
        if jianpu_beats and pos16 % 4 == 0:
            beat_idx = pos16 // 4
            if 0 <= beat_idx < len(jianpu_beats):
                # Avoid emitting placeholder lyrics (e.g. "-"), which adds lots of
                # text layout work and may trigger alphaTab edge-case bugs.
                lyric = jianpu_beats[beat_idx]
                if lyric and lyric != "-":
                    effects.append(f'lyrics "{_escape_str(lyric)}"')
        if show_chord_name and first_strum:
            effects.append(f'ch "{_escape_str(chord)}"')
        if t.direction == "d":
            effects.append("sd")
        else:
            effects.append("su")
        parts.append(f'0.1 {{ {" ".join(effects)} }}' if effects else "0.1")
        first_strum = False
        pos16 += _duration_to_16th(t.duration)

    parts.append("|")
    return " ".join(parts)


def _escape_str(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


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
