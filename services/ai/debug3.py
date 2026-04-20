import guitarpro
from gp_generator import _build_gp5_from_beats
rb = [{'duration': 8, 'notes': [{'string': 5, 'fret': 3}], 'velocity': 95}]
song = _build_gp5_from_beats(rb, [], False, 120, 'Test', 4, 4)
print(song.tracks[0].measures)
