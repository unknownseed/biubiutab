from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Section:
    name: str
    start_bar: int
    end_bar: int


def _bars_signature(bars: list[str]) -> str:
    return "|".join(bars)


def detect_sections(bar_chords: list[str]) -> list[Section]:
    if not bar_chords:
        return []

    n = len(bar_chords)
    sections: list[Section] = []

    intro_len = min(4, n)
    sections.append(Section(name="Intro", start_bar=0, end_bar=intro_len))

    i = intro_len
    last_main = "Chorus"
    while i < n:
        remaining = n - i
        window = min(8, remaining)

        sig4 = _bars_signature(bar_chords[i : i + min(4, remaining)])
        found_repeat = False
        for j in range(i + 4, n - 3):
            if _bars_signature(bar_chords[j : j + 4]) == sig4:
                found_repeat = True
                break

        if found_repeat:
            name = "Verse" if last_main != "Verse" else "Chorus"
            last_main = name
            length = min(8, remaining)
        else:
            name = "Bridge" if last_main != "Bridge" else "Outro"
            last_main = name
            length = min(4, remaining)

        sections.append(Section(name=name, start_bar=i, end_bar=min(i + length, n)))
        i += length

    return _merge_adjacent(sections)


def _merge_adjacent(sections: list[Section]) -> list[Section]:
    if not sections:
        return []
    merged: list[Section] = [sections[0]]
    for s in sections[1:]:
        last = merged[-1]
        if s.name == last.name and s.start_bar == last.end_bar:
            merged[-1] = Section(name=last.name, start_bar=last.start_bar, end_bar=s.end_bar)
        else:
            merged.append(s)
    return merged

