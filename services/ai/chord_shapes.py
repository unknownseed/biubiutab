from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ChordShape:
    name: str
    frets_high_to_low: list[str]


_SHAPES: dict[str, ChordShape] = {
    "C": ChordShape("C", ["0", "1", "0", "2", "3", "x"]),
    "C7": ChordShape("C7", ["0", "1", "3", "2", "3", "x"]),
    "Cmaj7": ChordShape("Cmaj7", ["0", "0", "0", "2", "3", "x"]),
    "Csus2": ChordShape("Csus2", ["3", "3", "0", "0", "3", "x"]),
    "Csus4": ChordShape("Csus4", ["1", "1", "0", "3", "3", "x"]),
    "Cadd9": ChordShape("Cadd9", ["3", "3", "0", "2", "3", "x"]),
    "Cm": ChordShape("Cm", ["3", "4", "5", "5", "3", "3"]),
    "D": ChordShape("D", ["2", "3", "2", "0", "x", "x"]),
    "D7": ChordShape("D7", ["2", "1", "2", "0", "x", "x"]),
    "Dmaj7": ChordShape("Dmaj7", ["2", "2", "2", "0", "x", "x"]),
    "Dsus2": ChordShape("Dsus2", ["0", "3", "2", "0", "x", "x"]),
    "Dsus4": ChordShape("Dsus4", ["3", "3", "2", "0", "x", "x"]),
    "Dadd9": ChordShape("Dadd9", ["0", "3", "2", "0", "x", "x"]),
    "Dm": ChordShape("Dm", ["1", "3", "2", "0", "x", "x"]),
    "Dm7": ChordShape("Dm7", ["1", "1", "2", "0", "x", "x"]),
    "E": ChordShape("E", ["0", "0", "1", "2", "2", "0"]),
    "E7": ChordShape("E7", ["0", "0", "1", "0", "2", "0"]),
    "Emaj7": ChordShape("Emaj7", ["0", "0", "1", "1", "2", "0"]),
    "Em7": ChordShape("Em7", ["0", "3", "0", "2", "2", "0"]),
    "Em": ChordShape("Em", ["0", "0", "0", "2", "2", "0"]),
    "F": ChordShape("F", ["1", "1", "2", "3", "3", "1"]),
    "Fmaj7": ChordShape("Fmaj7", ["0", "1", "2", "2", "x", "1"]),
    "Fm": ChordShape("Fm", ["1", "1", "1", "3", "3", "1"]),
    "G": ChordShape("G", ["3", "0", "0", "0", "2", "3"]),
    "G7": ChordShape("G7", ["1", "0", "0", "0", "2", "3"]),
    "Gmaj7": ChordShape("Gmaj7", ["2", "0", "0", "0", "2", "3"]),
    "Gsus2": ChordShape("Gsus2", ["3", "3", "0", "0", "0", "3"]),
    "Gsus4": ChordShape("Gsus4", ["3", "1", "0", "0", "3", "3"]),
    "Gadd9": ChordShape("Gadd9", ["3", "3", "2", "0", "x", "3"]),
    "A": ChordShape("A", ["0", "2", "2", "2", "0", "x"]),
    "A7": ChordShape("A7", ["0", "2", "0", "2", "0", "x"]),
    "Amaj7": ChordShape("Amaj7", ["0", "2", "1", "2", "0", "x"]),
    "Asus2": ChordShape("Asus2", ["0", "0", "2", "2", "0", "x"]),
    "Asus4": ChordShape("Asus4", ["0", "3", "2", "2", "0", "x"]),
    "Am": ChordShape("Am", ["0", "1", "2", "2", "0", "x"]),
    "Am7": ChordShape("Am7", ["0", "1", "0", "2", "0", "x"]),
    "B": ChordShape("B", ["2", "4", "4", "4", "2", "x"]),
    "Bm": ChordShape("Bm", ["2", "3", "4", "4", "2", "x"]),
}


_NOTE_TO_PC: dict[str, int] = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}

_STANDARD_TUNING_OPEN_MIDI_HIGH_TO_LOW = [64, 59, 55, 50, 45, 40]

_QUALITY_INTERVALS: list[tuple[str, list[int]]] = [
    ("maj7", [0, 4, 7, 11]),
    ("m7", [0, 3, 7, 10]),
    ("add9", [0, 2, 4, 7]),
    ("sus2", [0, 2, 7]),
    ("sus4", [0, 5, 7]),
    ("dim", [0, 3, 6]),
    ("aug", [0, 4, 8]),
    ("7", [0, 4, 7, 10]),
    ("m", [0, 3, 7]),
    ("", [0, 4, 7]),
]


_E_PC = _NOTE_TO_PC["E"]
_A_PC = _NOTE_TO_PC["A"]


def _score_shape(frets: list[str]) -> tuple[int, int, int, int]:
    vals = [int(f) for f in frets if f not in ("x",)]
    non_zero = [v for v in vals if v > 0]
    if not vals:
        return (999, 999, 999, 999)
    max_f = max(vals)
    span = (max(non_zero) - min(non_zero)) if non_zero else 0
    mute = sum(1 for f in frets if f == "x")
    return (span, mute, max_f, sum(vals))


def _e_shape(root_pc: int, quality: str) -> Optional[list[str]]:
    b = (root_pc - _E_PC) % 12
    if quality == "":
        return [str(b), str(b), str(b + 1), str(b + 2), str(b + 2), str(b)]
    if quality == "m":
        return [str(b), str(b), str(b), str(b + 2), str(b + 2), str(b)]
    if quality == "7":
        return [str(b), str(b), str(b + 1), str(b), str(b + 2), str(b)]
    if quality == "maj7":
        return [str(b), str(b), str(b + 1), str(b + 1), str(b + 2), str(b)]
    if quality == "m7":
        return [str(b), str(b), str(b), str(b), str(b + 2), str(b)]
    return None


def _a_shape(root_pc: int, quality: str) -> Optional[list[str]]:
    b = (root_pc - _A_PC) % 12
    if quality == "":
        return [str(b), str(b + 2), str(b + 2), str(b + 2), str(b), "x"]
    if quality == "m":
        return [str(b), str(b + 1), str(b + 2), str(b + 2), str(b), "x"]
    if quality == "7":
        return [str(b), str(b + 2), str(b), str(b + 2), str(b), "x"]
    if quality == "maj7":
        return [str(b), str(b + 2), str(b + 1), str(b + 2), str(b), "x"]
    if quality == "m7":
        return [str(b), str(b + 1), str(b), str(b + 2), str(b), "x"]
    return None


def chord_shape_for_label(label: str) -> Optional[ChordShape]:
    key = label.strip()
    if not key or key == "N":
        return None
    direct = _SHAPES.get(key)
    if direct:
        return direct

    parsed = _parse_chord_label(key)
    if not parsed:
        return None
    root_pc, suffix, pcs = parsed
    compact = _generate_compact_shape(root_pc, pcs, span_max=3, max_fret=12, min_strings=3)
    if compact:
        return ChordShape(name=key, frets_high_to_low=compact)

    if suffix in {"", "m", "7", "maj7", "m7"}:
        e = _e_shape(root_pc, suffix)
        a = _a_shape(root_pc, suffix)
        candidates = [c for c in [e, a] if c]
        if candidates:
            best = min(candidates, key=_score_shape)
            return ChordShape(name=key, frets_high_to_low=best)
    return None


def _parse_chord_label(label: str) -> Optional[tuple[int, str, set[int]]]:
    s = label.strip()
    if not s:
        return None

    root = s[0].upper()
    rest = s[1:]
    if rest[:1] in ("#", "b"):
        root += rest[0]
        rest = rest[1:]

    root_pc = _NOTE_TO_PC.get(root)
    if root_pc is None:
        return None

    suffix = rest.strip()
    for q, intervals in _QUALITY_INTERVALS:
        if suffix == q:
            pcs = {(root_pc + i) % 12 for i in intervals}
            return root_pc, suffix, pcs
    return None


def _generate_shape_for_pitch_classes(root_pc: int, target_pcs: set[int], max_fret: int, min_notes: int) -> Optional[list[str]]:
    candidates: list[list[Optional[int]]] = []
    for open_midi in _STANDARD_TUNING_OPEN_MIDI_HIGH_TO_LOW:
        opts: list[Optional[int]] = [None]
        for f in range(0, max_fret + 1):
            pc = (open_midi + f) % 12
            if pc in target_pcs:
                opts.append(f)
        opts = sorted({o for o in opts if o is None or isinstance(o, int)}, key=lambda x: 99 if x is None else x)  # type: ignore[arg-type]
        candidates.append(opts[:7])

    best: Optional[tuple[float, list[str]]] = None

    bass_strings = [5, 4, 3]
    for bass in bass_strings:
        bass_open = _STANDARD_TUNING_OPEN_MIDI_HIGH_TO_LOW[bass]
        bass_frets = [f for f in candidates[bass] if f is not None and (bass_open + int(f)) % 12 == root_pc]
        bass_frets = sorted(bass_frets)[:3]
        for bass_fret in bass_frets:
            for s0 in candidates[0]:
                for s1 in candidates[1]:
                    for s2 in candidates[2]:
                        for s3 in candidates[3]:
                            for s4 in candidates[4]:
                                picks: list[Optional[int]] = [s0, s1, s2, s3, s4, None]
                                picks[bass] = bass_fret
                                frets = [p for p in picks if p is not None]
                                if len(frets) < min_notes:
                                    continue
                                played_pcs = set()
                                for idx, f in enumerate(picks):
                                    if f is None:
                                        continue
                                    pc = (_STANDARD_TUNING_OPEN_MIDI_HIGH_TO_LOW[idx] + int(f)) % 12
                                    played_pcs.add(pc)
                                if root_pc not in played_pcs:
                                    continue
                                if len(played_pcs) < 2:
                                    continue
                                span = max(frets) - min(frets)
                                if span > 5:
                                    continue
                                played_idx = [idx for idx, f in enumerate(picks) if f is not None]
                                first = min(played_idx)
                                last = max(played_idx)
                                holes = sum(1 for i in range(first, last + 1) if picks[i] is None)
                                if holes != 0:
                                    continue
                                mute_count = sum(1 for p in picks if p is None)
                                avg_fret = sum(int(f) for f in frets) / float(len(frets))
                                open_bonus = sum(1 for f in frets if int(f) == 0)
                                coverage_bonus = len(played_pcs)
                                score = span * 4.0 + avg_fret * 0.8 + mute_count * 0.6 - open_bonus * 0.25 - coverage_bonus * 0.4
                                out = [("x" if p is None else str(int(p))) for p in picks]
                                if best is None or score < best[0]:
                                    best = (score, out)

    if best:
        return best[1]
    return None


def _generate_compact_shape(root_pc: int, target_pcs: set[int], span_max: int, max_fret: int, min_strings: int) -> Optional[list[str]]:
    open_midis = _STANDARD_TUNING_OPEN_MIDI_HIGH_TO_LOW

    def pc_for(string_idx: int, fret: int) -> int:
        return (open_midis[string_idx] + fret) % 12

    best: Optional[tuple[tuple[int, int, int, int], list[str]]] = None

    for start in range(0, max_fret + 1):
        per_string: list[list[Optional[int]]] = []
        for si in range(6):
            opts: list[Optional[int]] = [None]
            if pc_for(si, 0) in target_pcs:
                opts.append(0)
            lo = 0 if start == 0 else start
            hi = min(max_fret, start + span_max)
            for f in range(lo, hi + 1):
                if pc_for(si, f) in target_pcs:
                    opts.append(f)
            uniq = []
            for o in opts:
                if o not in uniq:
                    uniq.append(o)
            per_string.append(uniq[:8])

        for s0 in per_string[0]:
            for s1 in per_string[1]:
                for s2 in per_string[2]:
                    for s3 in per_string[3]:
                        for s4 in per_string[4]:
                            for s5 in per_string[5]:
                                picks: list[Optional[int]] = [s0, s1, s2, s3, s4, s5]
                                played_idx = [i for i, f in enumerate(picks) if f is not None]
                                if not played_idx:
                                    continue
                                first_i = min(played_idx)
                                last_i = max(played_idx)
                                if any(picks[i] is None for i in range(first_i, last_i + 1)):
                                    continue

                                played_frets = [f for f in picks if f is not None]
                                if len(played_frets) < min_strings:
                                    continue
                                non_zero = [f for f in played_frets if int(f) > 0]
                                if non_zero:
                                    if max(non_zero) - min(non_zero) > span_max:
                                        continue

                                pcs_played = set()
                                for i, f in enumerate(picks):
                                    if f is None:
                                        continue
                                    pcs_played.add(pc_for(i, int(f)))
                                if root_pc not in pcs_played:
                                    continue
                                if len(pcs_played & target_pcs) < 2:
                                    continue

                                bass_ok = False
                                for si in range(5, -1, -1):
                                    f = picks[si]
                                    if f is None:
                                        continue
                                    bass_ok = pc_for(si, int(f)) == root_pc
                                    break

                                out = [("x" if f is None else str(int(f))) for f in picks]
                                score = _score_shape(out)
                                if not bass_ok:
                                    score = (score[0], score[1] + 2, score[2], score[3])
                                score = (score[0], score[1], score[2] + start, score[3])

                                if best is None or score < best[0]:
                                    best = (score, out)

    return best[1] if best else None
