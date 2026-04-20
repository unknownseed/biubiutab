import json
from pattern_engine import load_library, transplant_pattern
from gp_generator import _build_gp5_from_beats

load_library()
tid = 'f5b60e18'
chords = [{"chord":"C","duration_beats":4},{"chord":"Am","duration_beats":4}]
res = transplant_pattern(tid, chords)

print('rhythm first beat:', res['rhythm_beats'][0])
print('lead first beat:', res['lead_beats'][0])

