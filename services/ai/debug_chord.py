import io, guitarpro
from gp_generator import _add_chord_to_beat

b = guitarpro.Beat(None)
_add_chord_to_beat(b, "C")
print(b.text)
print(b.effect.chord.name)
