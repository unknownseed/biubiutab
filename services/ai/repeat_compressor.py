from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class BarLine:
    """
    Represents a single alphaTex bar (measure) line.

    `raw` must include the trailing '|' bar separator.
    """

    raw: str


_TXT_RE = re.compile(r'\btxt\s+"([^"\\]|\\.)*"')
_LYRICS_RE = re.compile(r'\blyrics\s+"([^"\\]|\\.)*"')
_WS_RE = re.compile(r"\s+")


def _normalize_for_repeat(raw: str) -> str:
    """
    Normalize a bar line for strict repeat comparison.

    We intentionally ignore:
    - section labels: txt "..."
    - jianpu digits: lyrics "..." (melody often differs on repeated harmony)

    Everything else (chords, rhythm, slash markers, stroke directions) must match exactly.
    """

    s = _TXT_RE.sub("", raw)
    s = _LYRICS_RE.sub("", s)
    s = _WS_RE.sub(" ", s).strip()
    return s


def _prefix_bar(raw: str, prefix: str) -> str:
    prefix = prefix.strip()
    if not prefix:
        return raw
    return f"{prefix} {raw.lstrip()}"


def compress_adjacent_repeats(
    bars: list[BarLine],
    *,
    min_len: int = 4,
    max_len: int = 16,
    max_repeats: int = 8,
) -> list[BarLine]:
    """
    Compress adjacent repeated blocks using alphaTex repeat markers:
      - \\ro (repeat open) on the first bar of the block
      - \\rc N (repeat close) on the last bar of the block

    Strict matching:
      - Compare the normalized alphaTex bar line (ignoring only txt labels).
    """

    if not bars:
        return []

    n = len(bars)
    normalized = [_normalize_for_repeat(b.raw) for b in bars]

    out: list[BarLine] = []
    i = 0
    while i < n:
        best_len = 0
        best_repeats = 1

        # Prefer longer blocks to maximize compression.
        for length in range(min(max_len, (n - i) // 2), min_len - 1, -1):
            # Count how many times the block repeats consecutively.
            repeats = 1
            while (
                repeats < max_repeats
                and i + (repeats + 1) * length <= n
                and normalized[i : i + length] == normalized[i + repeats * length : i + (repeats + 1) * length]
            ):
                repeats += 1

            if repeats > 1:
                best_len = length
                best_repeats = repeats
                break

        if best_len > 0 and best_repeats > 1:
            block = bars[i : i + best_len]
            block_out: list[BarLine] = []
            for j, b in enumerate(block):
                raw = b.raw
                if j == 0:
                    raw = _prefix_bar(raw, r"\ro")
                if j == best_len - 1:
                    raw = _prefix_bar(raw, rf"\rc {best_repeats}")
                block_out.append(BarLine(raw=raw))
            out.extend(block_out)
            i += best_len * best_repeats
            continue

        out.append(bars[i])
        i += 1

    return out
