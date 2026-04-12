from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Section:
    name: str
    start_bar: int
    end_bar: int


def _bars_signature(bars: list[str]) -> str:
    return "|".join(bars)


def _normalize_chord(label: str) -> str:
    """
    Reduce chord labels to a stable signature for repetition detection.
    Examples:
      Cmaj7 -> C
      Cadd9 -> C
      G7 -> G
      Am7 -> Am
      Dsus2 -> D
    """
    s = (label or "").strip()
    if not s or s == "N":
        return "N"
    # Root + optional minor marker.
    import re

    m = re.match(r"^([A-G](?:#|b)?)(m?)", s)
    if not m:
        return s
    root = m.group(1)
    minor = m.group(2)
    return f"{root}{minor}"


def _fill_n(chords: list[str]) -> list[str]:
    out: list[str] = []
    last = "N"
    for c in chords:
        if c != "N":
            last = c
            out.append(c)
        else:
            out.append(last)
    return out


def detect_sections(bar_chords: list[str]) -> list[Section]:
    """
    Heuristic section detection used for display structuring (NOT for musical correctness).

    Goals:
    - Avoid exploding into "Bridge2/Outro11" style labels.
    - Provide a reasonable high-level structure for UI & later lyrics workflow:
      Intro / Verse / Chorus / Bridge / Outro.

    Algorithm (simple + stable):
    1) Intro: first 4 bars (or less).
    2) Split remaining bars into chunks of 8 bars (last chunk can be shorter).
    3) Mark chunks whose 8-bar signature occurs >=2 as "Chorus" candidates.
       Mark other chunks before the final chunk as "Verse".
    4) Any non-repeating chunk after the first Chorus becomes "Bridge".
    5) Outro: final chunk (remaining tail).
    """

    if not bar_chords:
        return []

    n = len(bar_chords)
    sections: list[Section] = []

    intro_end = min(4, n)
    if intro_end > 0:
        sections.append(Section(name="Intro", start_bar=0, end_bar=intro_end))

    # Normalize for repetition detection (more robust than raw chord labels).
    base = [_normalize_chord(c) for c in bar_chords]
    base = _fill_n(base)

    def _similarity(a: tuple[str, ...], b: tuple[str, ...]) -> float:
        if len(a) != len(b) or not a:
            return 0.0
        same = sum(1 for x, y in zip(a, b) if x == y)
        return same / float(len(a))

    def _find_repeating_window(L: int, threshold: float) -> tuple[tuple[str, ...] | None, int]:
        windows: list[tuple[str, ...]] = []
        starts: list[int] = []
        for i2 in range(intro_end, n - L + 1):
            w = tuple(base[i2 : i2 + L])
            # ignore very flat candidates (all same chord)
            if len(set(w)) <= 1:
                continue
            windows.append(w)
            starts.append(i2)
        if len(windows) < 2:
            return (None, 0)

        best_sig: tuple[str, ...] | None = None
        best_cnt = 0
        m = len(windows)
        for i2 in range(m):
            cnt = 1
            for j2 in range(i2 + 1, m):
                if _similarity(windows[i2], windows[j2]) >= threshold:
                    cnt += 1
            if cnt > best_cnt:
                best_cnt = cnt
                best_sig = windows[i2]
        if best_cnt >= 2:
            return (best_sig, L)
        return (None, 0)

    # Prefer an 8-bar chorus, fall back to 4-bar if needed.
    chorus_sig, chorus_len = _find_repeating_window(8, 0.75)
    if chorus_sig is None:
        chorus_sig, chorus_len = _find_repeating_window(4, 0.75)

    chunk_len = chorus_len if chorus_sig is not None else 8

    # Segment sequentially using chunk_len. Mark chunks matching chorus_sig as Chorus.
    i = intro_end
    seen_chorus = False
    while i < n:
        remaining = n - i
        if remaining <= chunk_len:
            sections.append(Section(name="Outro", start_bar=i, end_bar=n))
            break

        if chorus_sig is not None and tuple(base[i : i + chorus_len]) == chorus_sig:
            sections.append(Section(name="Chorus", start_bar=i, end_bar=i + chorus_len))
            seen_chorus = True
            i += chorus_len
            continue

        name = "Bridge" if seen_chorus else "Verse"
        sections.append(Section(name=name, start_bar=i, end_bar=i + chunk_len))
        i += chunk_len

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
