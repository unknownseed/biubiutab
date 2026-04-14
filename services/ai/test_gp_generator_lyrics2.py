import guitarpro

s = guitarpro.Song()
t = guitarpro.Track(s)
s.tracks.append(t)
h1 = guitarpro.MeasureHeader()
h1.number = 1
h1.start = 0
h1.timeSignature.numerator = 4
h1.timeSignature.denominator.value = 4
s.measureHeaders.append(h1)
m1 = guitarpro.Measure(t, h1)
t.measures.append(m1)

b1 = guitarpro.Beat(m1.voices[0])
b1.duration.value = 1
b1.status = guitarpro.BeatStatus.normal
n1 = guitarpro.Note(b1)
n1.value = 0
n1.string = 1
b1.notes.append(n1)
m1.voices[0].beats.append(b1)

# Set on TRACK
t.lyrics = guitarpro.Lyrics()
t.lyrics.lines[0].startingMeasure = 1
t.lyrics.lines[0].lyrics = "A B C D"

guitarpro.write(s, "../../apps/web/public/test_track_lyrics.gp5")

# Set on SONG
s2 = guitarpro.Song()
t2 = guitarpro.Track(s2)
s2.tracks.append(t2)
h2 = guitarpro.MeasureHeader()
h2.number = 1
h2.start = 0
h2.timeSignature.numerator = 4
h2.timeSignature.denominator.value = 4
s2.measureHeaders.append(h2)
m2 = guitarpro.Measure(t2, h2)
t2.measures.append(m2)

b2 = guitarpro.Beat(m2.voices[0])
b2.duration.value = 1
b2.status = guitarpro.BeatStatus.normal
n2 = guitarpro.Note(b2)
n2.value = 0
n2.string = 1
b2.notes.append(n2)
m2.voices[0].beats.append(b2)

s2.lyrics = guitarpro.Lyrics()
s2.lyrics.trackChoice = 0
s2.lyrics.lines[0].startingMeasure = 1
s2.lyrics.lines[0].lyrics = "A B C D"

guitarpro.write(s2, "../../apps/web/public/test_song_lyrics.gp5")
