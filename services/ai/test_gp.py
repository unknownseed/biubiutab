import guitarpro
song = guitarpro.Song()
print("Initial tracks:", len(song.tracks))
lead_track = guitarpro.Track(song)
print("After Track(song):", len(song.tracks))
song.tracks.append(lead_track)
print("After append:", len(song.tracks))
