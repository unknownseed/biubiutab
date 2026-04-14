import os
from services.ai.gp_generator import generate_gp5_binary
from services.ai.formatters import SectionOut, ChordAt

s1 = SectionOut(
    name="Intro",
    start_bar=0,
    end_bar=2,
    chords=[ChordAt(label="C", bar=0, beat=0), ChordAt(label="G", bar=1, beat=0)]
)

b = generate_gp5_binary(
    title="Test",
    tempo=120,
    time_signature="4/4",
    key="C",
    sections=[s1],
    lyrics_beats=["A", "B", "C", "D", "E", "F", "G", "H"],
    rhythm_energy=0.5
)

import guitarpro
import io
s = guitarpro.parse(io.BytesIO(b))
if s.lyrics:
    print("SONG LYRICS:", s.lyrics.lines[0].lyrics)
else:
    print("NO SONG LYRICS")
    
if s.tracks and s.tracks[0].lyrics:
    print("TRACK LYRICS:", s.tracks[0].lyrics.lines[0].lyrics)
else:
    print("NO TRACK LYRICS")

