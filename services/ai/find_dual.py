import json, os
p = '/Users/unknownseed/Developer/biubiutab/services/ai/pattern_library/patterns'
for f in os.listdir(p):
    if not f.endswith('.json'): continue
    with open(os.path.join(p,f)) as fp:
        try: d = json.load(fp)
        except: continue
        if d.get('is_dual'):
            l = d.get('layers',{}).get('lead',{})
            bpm = d.get('bpm') or d.get('meta', {}).get('bpm')
            if isinstance(l, dict):
                first_key = list(l.keys())[0] if l.keys() else None
                if first_key and l[first_key] and l[first_key][0].get('notes'):
                    print(f, bpm, 'dict lead notes')
            elif isinstance(l, list) and l and l[0].get('notes'):
                print(f, bpm, 'list lead notes')
