import json
from pattern_engine import load_library, transplant_pattern
from gp_generator import _build_gp5_from_beats

load_library()
tid = 'b30d4706'
chords = [{"chord":"C","duration_beats":4},{"chord":"Am","duration_beats":4}]
res = transplant_pattern(tid, chords)

print('is_dual:', res['is_dual'])
print('rhythm first 2 beats:', res['rhythm_beats'][:2])
print('lead first 2 beats:', res['lead_beats'][:2])

song = _build_gp5_from_beats(res['rhythm_beats'], res['lead_beats'], res['is_dual'], 112, 'Test', 4, 4)
print('tracks count:', len(song.tracks))
for i, t in enumerate(song.tracks):
    print(f'Track {i}: {t.name}')
    for m_idx, m in enumerate(t.measures[:2]):
        print(f'  Measure {m_idx}:')
        for b_idx, b in enumerate(m.voices[0].beats[:4]):
            notes = [(n.string, n.value) for n in b.notes]
            print(f'    Beat {b_idx}: duration={b.duration.value}, notes={notes}, isRest={b.status}')
