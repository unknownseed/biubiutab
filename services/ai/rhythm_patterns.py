from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Literal


from chord_shapes import chord_shape_for_label

StrumDir = Literal["d", "u"]


@dataclass(frozen=True)
class RhythmToken:
    kind: Literal["strum", "rest"]
    duration: int
    direction: StrumDir | None = None
    note_override: str | None = None


@dataclass(frozen=True)
class RhythmPattern:
    notation: str
    tokens: list[RhythmToken]
    bpm_range: tuple[int, int]
    description: str
    is_arpeggio: bool = False


STRUMMING_PATTERNS: dict[str, RhythmPattern] = {
    "fingerpick_8th": RhythmPattern(
        notation="P i m a (8th)",
        tokens=[
            RhythmToken("strum", 8, "d", note_override="bass"), # Bass (T, p)
            RhythmToken("strum", 8, "u", note_override="str_3"), # G (i)
            RhythmToken("strum", 8, "d", note_override="str_2"), # B (m)
            RhythmToken("strum", 8, "u", note_override="str_1"), # e (a)
            RhythmToken("strum", 8, "d", note_override="str_3"), # G (i)
            RhythmToken("strum", 8, "u", note_override="str_2"), # B (m)
            RhythmToken("strum", 8, "d", note_override="str_3"), # G (i)
            RhythmToken("strum", 8, "u", note_override="str_2"), # B (m)
        ],
        bpm_range=(50, 110),
        description="低能量：用更平稳的 8 分分解拨弦",
        is_arpeggio=True,
    ),
    "fingerpick_4th": RhythmPattern(
        notation="P i m a (4th)",
        tokens=[
            RhythmToken("strum", 4, "d", note_override="bass"), # Bass
            RhythmToken("strum", 4, "u", note_override="str_3"), # G
            RhythmToken("strum", 4, "d", note_override="str_2"), # B
            RhythmToken("strum", 4, "u", note_override="str_1"), # e
        ],
        bpm_range=(100, 160),
        description="极低能量：4分分解拨弦",
        is_arpeggio=True,
    ),
    "fingerpick_16th": RhythmPattern(
        notation="P i m a (16th)",
        tokens=[
            RhythmToken("strum", 16, "d", note_override="bass"),
            RhythmToken("strum", 16, "u", note_override="str_3"),
            RhythmToken("strum", 16, "d", note_override="str_2"),
            RhythmToken("strum", 16, "u", note_override="str_1"),
            RhythmToken("strum", 16, "d", note_override="bass"),
            RhythmToken("strum", 16, "u", note_override="str_3"),
            RhythmToken("strum", 16, "d", note_override="str_2"),
            RhythmToken("strum", 16, "u", note_override="str_1"),
            RhythmToken("strum", 16, "d", note_override="bass"),
            RhythmToken("strum", 16, "u", note_override="str_3"),
            RhythmToken("strum", 16, "d", note_override="str_2"),
            RhythmToken("strum", 16, "u", note_override="str_1"),
            RhythmToken("strum", 16, "d", note_override="bass"),
            RhythmToken("strum", 16, "u", note_override="str_3"),
            RhythmToken("strum", 16, "d", note_override="str_2"),
            RhythmToken("strum", 16, "u", note_override="str_1"),
        ],
        bpm_range=(60, 90),
        description="中低能量：慢歌 16 分分解拨弦",
        is_arpeggio=True,
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
    "folk_16th": RhythmPattern(
        notation="D - D U - U D U (16th)",
        tokens=[
            RhythmToken("strum", 16, "d"),
            RhythmToken("rest", 16),
            RhythmToken("strum", 16, "d"),
            RhythmToken("strum", 16, "u"),
            RhythmToken("rest", 16),
            RhythmToken("strum", 16, "u"),
            RhythmToken("strum", 16, "d"),
            RhythmToken("strum", 16, "u"),
            
            RhythmToken("strum", 16, "d"),
            RhythmToken("rest", 16),
            RhythmToken("strum", 16, "d"),
            RhythmToken("strum", 16, "u"),
            RhythmToken("rest", 16),
            RhythmToken("strum", 16, "u"),
            RhythmToken("strum", 16, "d"),
            RhythmToken("strum", 16, "u"),
        ],
        bpm_range=(60, 95),
        description="慢歌 16 分民谣扫弦",
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


def select_pattern(bpm: int, energy: float | None = None, section_name: str = "") -> RhythmPattern:
    """
    Step 8A: 根据 BPM + percussive 能量（0~1）以及段落名称选择节奏型。
    
    - energy 越低：更像分解/轻触（fingerpick_8th）
    - energy 中等：标准民谣扫弦（folk_basic / soul）
    - energy 高：更密集或更直接（pop_16th）
    """
    name_lower = section_name.lower()
    
    if energy is None:
        energy = 0.4 # Default moderate energy
        
    e = max(0.0, min(1.0, float(energy)))

    # Bias energy based on section
    if "chorus" in name_lower or "hook" in name_lower:
        e = min(1.0, e + 0.3)
    elif "verse" in name_lower:
        e = max(0.0, e - 0.1)
    elif "outro" in name_lower or "ending" in name_lower:
        e = max(0.0, e - 0.3)
    elif "bridge" in name_lower:
        e = min(1.0, e + 0.15)
    elif "intro" in name_lower:
        e = max(0.0, e - 0.2)

    # Heuristics (tuned for MVP; can be refined later with more signals):
    low = float(os.environ.get("RHYTHM_ENERGY_LOW") or "0.25")
    high = float(os.environ.get("RHYTHM_ENERGY_HIGH") or "0.55")
    # Ensure sane ordering
    low = max(0.0, min(1.0, low))
    high = max(low, min(1.0, high))

    if e < low:
        if bpm >= 110:
            return STRUMMING_PATTERNS["fingerpick_4th"]
        elif bpm < 85:
            return STRUMMING_PATTERNS["fingerpick_16th"]
        return STRUMMING_PATTERNS["fingerpick_8th"]
    if e < high:
        # Moderate groove: prefer folk; if bpm mid-range, soul can feel better.
        if bpm < 90:
            return STRUMMING_PATTERNS["folk_16th"]
        if 90 <= bpm <= 110:
            return STRUMMING_PATTERNS["soul"]
        return STRUMMING_PATTERNS["folk_basic"]
    # High energy: dense
    if bpm >= 105:
        return STRUMMING_PATTERNS["pop_16th"]
    if bpm < 90:
        return STRUMMING_PATTERNS["folk_16th"]
    return STRUMMING_PATTERNS["folk_basic"]


def _resolve_arpeggio_note(chord_label: str, pattern_str: str) -> str:
    shape = chord_shape_for_label(chord_label)
    if not shape:
        return "0.1" # fallback if chord unknown
        
    frets = shape.frets_high_to_low
    # strings: 1=e, 2=B, 3=G, 4=D, 5=A, 6=E
    # frets indices: 0=e, 1=B, 2=G, 3=D, 4=A, 5=E
    
    # Find bass string (highest index that is not 'x')
    bass_idx = 5
    while bass_idx >= 0 and frets[bass_idx] == "x":
        bass_idx -= 1
        
    bass_str = bass_idx + 1
    bass_fret = frets[bass_idx]
    
    if pattern_str == "bass":
        return f"{bass_fret}.{bass_str}"
    
    # other strings: "str_3" -> string 3 -> index 2
    if pattern_str.startswith("str_"):
        s = int(pattern_str.split("_")[1])
        f = frets[s - 1]
        if f == "x":
            return f"0.{s}" # fallback to open if muted
        return f"{f}.{s}"
        
    return "0.1"

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
        effects: list[str] = []
        if not getattr(pattern, "is_arpeggio", False):
            effects.append("slashed")

        if label and first_strum:
            effects.append(f'txt "{_escape_str(label)}"')
            
        # NOTE: Pick stroke hints and jianpu are removed per user request.
        # We only output the actual lyrics if present.
        esc_text = _escape_str(pending_text) if pending_text else ""
        if esc_text:
            effects.append(f'lyrics "{esc_text}"')
        
        pending_lyric = None
        pending_text = None

        if show_chord_name and first_strum:
            effects.append(f'ch "{_escape_str(chord)}"')
            
        if getattr(pattern, "is_arpeggio", False) and t.note_override:
            note_str = _resolve_arpeggio_note(chord, t.note_override)
        else:
            note_str = "0.1"
            
        parts.append(f'{note_str} {{ {" ".join(effects)} }}' if effects else note_str)
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
