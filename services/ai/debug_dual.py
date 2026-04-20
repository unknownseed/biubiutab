import json
import os
from pattern_engine import load_library, find_best_pattern, transplant_pattern
import guitarpro, io
from gp_generator import _build_gp5_from_beats

load_library()
tid = find_best_pattern(120)
print('best pattern for 120:', tid)

chords = [{"chord":"C","duration_beats":4},{"chord":"Am","duration_beats":4}]
res = transplant_pattern(tid, chords)

print('is_dual:', res['is_dual'])
print('rhythm first 2 beats:', res['rhythm_beats'][:2])
print('lead first 2 beats:', res['lead_beats'][:2])

song = _build_gp5_from_beats(res['rhythm_beats'], res['lead_beats'], res['is_dual'], 120, 'Test', 4, 4)
print('tracks count:', len(song.tracks))
for i, t in enumerate(song.tracks):
    print(f'Track {i}: {t.name}')
    for m_idx, m in enumerate(t.measures[:2]):
        print(f'  Measure {m_idx}:')
        for b_idx, b in enumerate(m.voices[0].beats[:4]):
            notes = [(n.string, n.value) for n in b.notes]
            print(f'    Beat {b_idx}: duration={b.duration.value}, notes={notes}, isRest={b.status}')
