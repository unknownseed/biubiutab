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
b1.duration.value = guitarpro.Duration.whole
b1.status = guitarpro.BeatStatus.normal
m1.voices[0].beats.append(b1)

n1 = guitarpro.Note(b1)
n1.value = 0
n1.string = 1
b1.notes.append(n1)

# In previous tests, we successfully generated GP5 binaries. What changed?
# Oh! In gp_generator.py we use: 
# beat.duration.value = 1 # whole
# wait... if t.duration == 4: beat.duration.value = guitarpro.Duration.quarter
# Wait, guitarpro.Duration.quarter is NOT an integer! It's a value? Let's check pyguitarpro's source.
