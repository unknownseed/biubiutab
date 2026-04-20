import os, json
p = '/Users/unknownseed/Developer/biubiutab/services/ai/pattern_library/patterns'
files = os.listdir(p)
if files:
    with open(os.path.join(p, files[0])) as f:
        print(json.dumps(json.load(f), indent=2)[:500])
