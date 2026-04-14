from gp_generator import generate_gp5_binary
from formatters import SectionOut, ChordAt

s1 = SectionOut(
    name="Intro",
    start_bar=0,
    end_bar=2,
    chords=[ChordAt(chord="C", bar=0, beat=0), ChordAt(chord="G", bar=1, beat=0)]
)

b_bytes = generate_gp5_binary(
    title="Test",
    tempo=120,
    time_signature="4/4",
    key="C",
    sections=[s1],
    lyrics_beats=["A", "B", "C", "D", "E", "F", "G", "H"],
    rhythm_energy=0.5
)

with open("../../apps/web/public/test_beattext.gp5", "wb") as f:
    f.write(b_bytes)
