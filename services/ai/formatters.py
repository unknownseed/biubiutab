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


def build_display_sections_and_arrangement(sections: list[SectionOut]) -> tuple[list[SectionOut], str]:
    """
    Future-proof for lyrics:
    - We DO NOT use repeat symbols (\ro/\rc/\ae), because lyrics would become ambiguous.
    - Instead, we dedupe repeated sections (Intro/Verse/Chorus/Bridge/Outro) so each unique
      section is shown once in the sheet.
    - We output the play order as plain text (arrangement) for the user to follow.

    "Strict" dedupe rule:
    - sections are considered the same if their per-bar chord sequence is identical.
    """

    if not sections:
        return ([], "")

    # Keep the arrangement (play order) as a sequence of base section names.
    order: list[str] = [(s.name.strip() or "Section") for s in sections]

    # Dedupe for display: show each base section only once (lyrics-friendly),
    # taking the first occurrence as the canonical content.
    seen_names: set[str] = set()
    display_sections: list[SectionOut] = []
    for s in sections:
        base = s.name.strip() or "Section"
        if base in seen_names:
            continue
        seen_names.add(base)
        display_sections.append(
            SectionOut(
                name=base,
                start_bar=s.start_bar,
                end_bar=s.end_bar,
                chords=s.chords,
            )
        )

    # Compact consecutive duplicates in the order: Verse → Verse → Verse becomes Verse×3.
    compact: list[str] = []
    for name in order:
        if not compact:
            compact.append(name)
            continue
        last = compact[-1]
        if last == name:
            # upgrade to ×2 / increment
            if "×" in last:
                base_name, cnt = last.split("×", 1)
                try:
                    compact[-1] = f"{base_name}×{int(cnt) + 1}"
                except Exception:
                    compact[-1] = f"{name}×2"
            else:
                compact[-1] = f"{name}×2"
        else:
            compact.append(name)

    arrangement = "演奏顺序：" + " → ".join(compact)
    return display_sections, arrangement


def _key_to_do_text(key: str) -> str:
    """
    Convert 'C Major' / 'A Minor' into jianpu style '1=C（C大调）' / '1=A（A小调）'.
    """
    k = (key or "").strip()
    if not k:
        return ""
    parts = k.split()
    if not parts:
        return ""
    tonic = parts[0]
    mode = parts[1].lower() if len(parts) > 1 else ""
    if mode == "minor":
        return f"1={tonic}（{tonic}小调）"
    return f"1={tonic}（{tonic}大调）"


def _fallback_chord_from_key(key: str) -> str:
    """
    If chord detection is uncertain ('N'), we show a playable default:
    - Use tonic chord from detected key: C Major -> C, A Minor -> Am.
    """
    k = (key or "").strip()
    if not k:
        return "C"
    parts = k.split()
    tonic = parts[0] if parts else "C"
    mode = parts[1].lower() if len(parts) > 1 else ""
    return f"{tonic}m" if mode == "minor" else tonic


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


def _slice_lyrics_beats(lyrics_beats: list[str | None], start: int, length: int) -> list[str | None]:
    out: list[str | None] = []
    for i in range(length):
        idx = start + i
        if 0 <= idx < len(lyrics_beats):
            out.append(lyrics_beats[idx])
        else:
            out.append(None)
    return out


def sections_to_alphatex(
    title: str,
    tempo: int,
    time_signature: str,
    key: str,
    sections: list[SectionOut],
    jianpu: list[str] | None = None,
    lyrics_beats: list[str | None] | None = None,
    bar_overrides: dict[int, str] | None = None,
    extra_tracks: str | None = None,
    rhythm_energy: float | None = None,
) -> str:
    parts: list[str] = []
    parts.append(f'\\title "{title}"')
    do_text = _key_to_do_text(key)
    if do_text:
        parts.append(f'\\subtitle "{do_text}"')
    parts.append('\\track "Guitar"')
    parts.append("\\staff {tabs}")
    parts.append("\\tuning (E4 B3 G3 D3 A2 E2)")
    parts.append(f"\\tempo {tempo}")
    if time_signature:
        parts.append(f"\\ts ({time_signature.replace('/', ' ')})")
    # Display preference:
    # - 4 bars per system (line), which makes it easy to paginate as 5 systems/page (20 bars).
    parts.append("\\defaultSystemsLayout 4")
    # Show chord diagrams inline with bars instead of a big list on the first page.
    # (The viewer further disables "on top" rendering via settings.)
    parts.append("\\chordDiagramsInScore true")
    # NOTE:
    # We render jianpu via per-note `lyrics "..."` effects (see rhythm_patterns.py).
    # Emitting an additional global `\lyrics "..."` line can confuse alphaTab's
    # lyrics layout in some scenarios and trigger runtime rendering errors.
    parts.append("")

    # Chord diagrams to include:
    # - all detected chords (excluding N)
    # - plus a fallback tonic chord (used when uncertain bars are rendered as "hold previous")
    uniq: list[str] = []
    seen: set[str] = set()
    tonic_fallback = _fallback_chord_from_key(key)
    if tonic_fallback and tonic_fallback != "N":
        seen.add(tonic_fallback)
        uniq.append(tonic_fallback)
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
            # If the chord is played in higher positions, show the base fret number
            # next to the diagram via `firstfret`.
            if first >= 5:
                props.append(f"firstfret {first}")
            if first > 0 and sum(1 for x in frets_list if x == str(first)) >= 2 and "0" not in frets_list:
                props.append(f"barre {first}")
            # With our chord generator constraints, span should always be <= 3 (4-fret box).
            # Keep diagrams enabled.

        prop_text = f" {{{' '.join(props)}}}" if props else ""
        parts.append(f'\\chord ("{shape.name}" {frets}){prop_text}')
    if uniq:
        parts.append("")

    is_first_section = True
    # If a bar is 'N', we interpret it as "hold previous chord" for display,
    # and as a last resort (at the beginning) use the tonic chord from key.
    last_display_chord = tonic_fallback
    showed_initial_fallback = False
    for s in sections:
        # Generate the rhythm pattern for this specific section based on energy and name
        pattern = select_pattern(tempo, rhythm_energy, section_name=s.name)
        
        for idx, c in enumerate(s.chords):
            # Put section label onto the sheet as proper alphaTex section marker.
            # This shows above the staff at the start bar.
            section_prefix = ""
            if idx == 0:
                marker = _section_marker_letter(s.name)
                section_prefix = f'\\section "{_escape_section(marker)}" "{_escape_section(s.name)}" '
            jianpu_beats = _slice_jianpu(jianpu, c.bar * 4, 4) if jianpu else None
            actual_lyrics_beats = _slice_lyrics_beats(lyrics_beats, c.bar * 4, 4) if lyrics_beats else None
            chord = c.chord
            show_chord_name = True
            if chord == "N":
                # Hold previous chord for user playability.
                chord = last_display_chord or tonic_fallback
                # Only show the chord name on the first time we need the fallback.
                show_chord_name = not showed_initial_fallback
                showed_initial_fallback = True
            else:
                last_display_chord = chord
                showed_initial_fallback = False

            override = (bar_overrides or {}).get(c.bar)
            if override:
                # override already includes trailing "|" and is assumed to be a single bar line
                parts.append(section_prefix + override)
            else:
                line = pattern_to_alphatex(pattern, chord, show_chord_name, label=None, jianpu_beats=jianpu_beats, lyrics_beats=actual_lyrics_beats)
                parts.append(section_prefix + line)
        is_first_section = False
        parts.append("")

    # Optional: append extra track definitions (e.g., vocal melody tabs).
    # Caller is responsible for providing valid alphaTex.
    if extra_tracks and extra_tracks.strip():
        parts.append(extra_tracks.strip())
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


def _escape_section(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\r", " ").replace("\n", " ").strip()


def _section_marker_letter(name: str) -> str:
    n = (name or "").strip().lower()
    if n.startswith("intro"):
        return "I"
    if n.startswith("verse"):
        return "V"
    if n.startswith("chorus"):
        return "C"
    if n.startswith("bridge"):
        return "B"
    if n.startswith("outro"):
        return "O"
    return (name[:1] or "S").upper()
