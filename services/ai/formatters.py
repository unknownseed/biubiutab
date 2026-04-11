from __future__ import annotations

from dataclasses import dataclass

from chord_shapes import chord_shape_for_label


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


def sections_to_alphatex(title: str, tempo: int, time_signature: str, key: str, sections: list[SectionOut]) -> str:
    parts: list[str] = []
    parts.append(f'\\title "{title}"')
    parts.append('\\track "Guitar"')
    parts.append("\\staff {score}")
    parts.append("\\tuning (E4 B3 G3 D3 A2 E2)")
    parts.append(f"\\tempo {tempo}")
    if time_signature:
        parts.append(f"\\ts ({time_signature.replace('/', ' ')})")
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
        frets = " ".join(shape.frets_high_to_low)
        parts.append(f'\\chord ("{shape.name}" {frets})')
    if uniq:
        parts.append("")

    is_first_section = True
    for s in sections:
        bar = s.start_bar
        bar_beats: list[str] = []
        is_first_bar_in_section = True
        for c in s.chords:
            if c.bar != bar:
                parts.append(":4 " + " ".join(bar_beats) + " |")
                bar = c.bar
                label = ""
                if is_first_bar_in_section:
                    if is_first_section:
                        label = f' txt "{s.name} · Key: {key} · {time_signature}"'
                        is_first_section = False
                    else:
                        label = f' txt "{s.name}"'
                bar_beats = [f'r {{ch "{c.chord}"{label}}}', "r", "r", "r"]
                is_first_bar_in_section = False
            else:
                if not bar_beats:
                    label = ""
                    if is_first_bar_in_section:
                        if is_first_section:
                            label = f' txt "{s.name} · Key: {key} · {time_signature}"'
                            is_first_section = False
                        else:
                            label = f' txt "{s.name}"'
                    bar_beats = [f'r {{ch "{c.chord}"{label}}}', "r", "r", "r"]
                    is_first_bar_in_section = False
        if bar_beats:
            parts.append(":4 " + " ".join(bar_beats) + " |")
        parts.append("")

    return "\n".join(parts).strip() + "\n"
