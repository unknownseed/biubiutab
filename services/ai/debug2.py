import guitarpro
from gp_generator import _build_gp5_from_beats, _fill_track_measures
song = guitarpro.Song()
track = guitarpro.Track(song)
song.tracks.append(track)
rb = [{'duration': 8, 'notes': [{'string': 5, 'fret': 3}], 'velocity': 95}]
_fill_track_measures(song, track, rb, 4, 4)
print([vars(b) for b in track.measures[0].voices[0].beats])
