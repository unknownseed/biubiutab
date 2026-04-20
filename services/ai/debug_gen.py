import io, guitarpro
from gp_generator import generate_gp5_binary
class MockChord:
    def __init__(self, chord):
        self.chord = chord
class MockSection:
    def __init__(self, name, start_idx, end_idx, energy):
        self.name = name
        self.start_idx = start_idx
        self.end_idx = end_idx
        self.energy = energy
        self.chords = []

s = MockSection(name="Intro", start_idx=0, end_idx=4, energy=0.5)
s.chords = [MockChord("C"), MockChord("Am")]
sections = [s]

try:
    gp5_bytes = generate_gp5_binary(
        title="Test Song",
        tempo=120,
        time_signature="4/4",
        key="C",
        sections=sections,
        lyrics_beats=None,
        rhythm_energy=0.5
    )
    print("Success! Size:", len(gp5_bytes))
except Exception as e:
    import traceback
    traceback.print_exc()
