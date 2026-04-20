import io
import guitarpro
from gp_generator import _build_gp5_from_beats

rhythm_beats = [
    {"duration": 8, "notes": [{"string": 5, "fret": 3}], "velocity": 95},
    {"duration": 8, "notes": [{"string": 3, "fret": 0}], "velocity": 80},
    {"duration": 4, "notes": [{"string": 2, "fret": 1}], "velocity": 75},
]
lead_beats = []

try:
    song = _build_gp5_from_beats(rhythm_beats, lead_beats, is_dual=False, bpm=120, title="Test", ts_num=4, ts_den=4)
    out = io.BytesIO()
    guitarpro.write(song, out)
    print("Generate success, size:", len(out.getvalue()))
except Exception as e:
    import traceback
    traceback.print_exc()
