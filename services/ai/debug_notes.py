import json
from pattern_engine import transplant_pattern

chords = [
    {"chord": "C",  "duration_beats": 4},
    {"chord": "Am", "duration_beats": 4},
]

result = transplant_pattern("a1b2c3d4", chords)
print("Rhythm beats:")
for b in result["rhythm_beats"]:
    print(b)
