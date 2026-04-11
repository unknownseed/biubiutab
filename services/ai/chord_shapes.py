from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ChordShape:
    name: str
    frets_high_to_low: list[str]


_SHAPES: dict[str, ChordShape] = {
    "C": ChordShape("C", ["0", "1", "0", "2", "3", "x"]),
    "Cm": ChordShape("Cm", ["3", "4", "5", "5", "3", "3"]),
    "D": ChordShape("D", ["2", "3", "2", "0", "x", "x"]),
    "Dm": ChordShape("Dm", ["1", "3", "2", "0", "x", "x"]),
    "E": ChordShape("E", ["0", "0", "1", "2", "2", "0"]),
    "Em": ChordShape("Em", ["0", "0", "0", "2", "2", "0"]),
    "F": ChordShape("F", ["1", "1", "2", "3", "3", "1"]),
    "Fm": ChordShape("Fm", ["1", "1", "1", "3", "3", "1"]),
    "G": ChordShape("G", ["3", "0", "0", "0", "2", "3"]),
    "A": ChordShape("A", ["0", "2", "2", "2", "0", "x"]),
    "Am": ChordShape("Am", ["0", "1", "2", "2", "0", "x"]),
    "B": ChordShape("B", ["2", "4", "4", "4", "2", "x"]),
    "Bm": ChordShape("Bm", ["2", "3", "4", "4", "2", "x"]),
}


def chord_shape_for_label(label: str) -> Optional[ChordShape]:
    key = label.strip()
    if not key or key == "N":
        return None
    return _SHAPES.get(key)

