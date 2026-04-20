from pattern_engine import transplant_pattern

res = transplant_pattern('b30d4706', [{"chord":"F#m7b5","duration_beats":16}])

print('lead beats', len(res['lead_beats']))
for i,b in enumerate(res['lead_beats'][:200]):
    if b.get('notes'):
        print('first lead note beat', i, b)
        break
else:
    print('no lead notes in first 200')
