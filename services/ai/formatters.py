from __future__ import annotations

from dataclasses import dataclass

from chord_shapes import chord_shape_for_label
from rhythm_patterns import RhythmPattern, pattern_to_alphatex, select_pattern


@dataclass(frozen=True)
class ChordAt:
    chord: str
    bar: int
    beat: int


@dataclass(frozen=True)
class SectionOut:
    name: str
    start_bar: int
    end_bar: int
    chords: list[ChordAt]


def sections_to_chordpro(title: str, key: str, tempo: int, sections: list[SectionOut]) -> str:
    lines: list[str] = []
    lines.append(f"{{title:{title}}}")
    lines.append(f"{{key:{key}}}")
    lines.append(f"{{tempo:{tempo}}}")
    lines.append("")
    for s in sections:
        lines.append(f"[{s.name}]")
        if not s.chords:
            lines.append("")
            continue
        bar = s.start_bar
        bar_chords: list[str] = []
        for c in s.chords:
            if c.bar != bar:
                lines.append(" | " + " | ".join(bar_chords) + " |")
                bar = c.bar
                bar_chords = [c.chord]
            else:
                bar_chords.append(c.chord)
        if bar_chords:
            lines.append(" | " + " | ".join(bar_chords) + " |")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def sections_to_alphatex(
    title: str,
    tempo: int,
    time_signature: str,
    key: str,
    sections: list[SectionOut],
    jianpu: list[str] | None = None,
) -> str:
    parts: list[str] = []
    parts.append(f'\\title "{title}"')
    parts.append('\\track "Guitar"')
    parts.append("\\staff {tabs}")
    parts.append("\\tuning (E4 B3 G3 D3 A2 E2)")
    parts.append(f"\\tempo {tempo}")
    if time_signature:
        parts.append(f"\\ts ({time_signature.replace('/', ' ')})")
    if jianpu:
        parts.append(f'\\lyrics "{_escape_lyrics(" ".join(jianpu[:64]))}"')
    parts.append("")

    uniq: list[str] = []
    seen: set[str] = set()
    for s in sections:
        for c in s.chords:
            if c.chord == "N":
                continue
            if c.chord not in seen:
                seen.add(c.chord)
                uniq.append(c.chord)
    for name in sorted(uniq):
        shape = chord_shape_for_label(name)
        if not shape:
            continue
        frets_list = shape.frets_high_to_low
        frets = " ".join(frets_list)
        props: list[str] = []

        numeric = [int(x) for x in frets_list if x != "x" and x != "0"]
        if numeric:
            first = min(numeric)
            highest = max(numeric)
            span = highest - first
            if highest > 5 and first > 0:
                props.append(f"firstfret {first}")
            if first > 0 and sum(1 for x in frets_list if x == str(first)) >= 2 and "0" not in frets_list:
                props.append(f"barre {first}")
            if span > 3:
                props.append("showdiagram false")

        prop_text = f" {{{' '.join(props)}}}" if props else ""
        parts.append(f'\\chord ("{shape.name}" {frets}){prop_text}')
    if uniq:
        parts.append("")

    pattern = select_pattern(tempo)

    is_first_section = True
    for s in sections:
        for idx, c in enumerate(s.chords):
            label: str | None = None
            if idx == 0:
                label = f"{s.name} · Key: {key} · {time_signature}" if is_first_section else s.name
            jianpu_beats = _slice_jianpu(jianpu, c.bar * 4, 4) if jianpu else None
            parts.append(_bar_to_alphatex(pattern, c.chord, label, jianpu_beats))
        is_first_section = False
        parts.append("")

    return "\n".join(parts).strip() + "\n"


def _escape_lyrics(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def _slice_jianpu(jianpu: list[str], start: int, length: int) -> list[str]:
    out: list[str] = []
    for i in range(length):
        idx = start + i
        if 0 <= idx < len(jianpu):
            out.append(jianpu[idx])
        else:
            out.append("-")
    return out


def _bar_to_alphatex(pattern: RhythmPattern, chord: str, label: str | None, jianpu_beats: list[str] | None) -> str:
    show_chord_name = chord != "N"
    return pattern_to_alphatex(pattern, chord, show_chord_name, label=label, jianpu_beats=jianpu_beats)
