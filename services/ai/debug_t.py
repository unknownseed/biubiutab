import json
with open('/Users/unknownseed/Developer/biubiutab/services/ai/pattern_library/patterns/1aff6193.json') as f:
    d = json.load(f)
    print(type(d['layers']['rhythm']))
    if isinstance(d['layers']['rhythm'], dict):
        keys = list(d['layers']['rhythm'].keys())[:2]
        for k in keys:
            print(k, d['layers']['rhythm'][k])
