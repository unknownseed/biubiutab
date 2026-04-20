import json
with open('/Users/unknownseed/Developer/biubiutab/services/ai/pattern_library/patterns/f5b60e18.json') as f:
    d = json.load(f)
print('rhythm keys:', sorted(list(d['layers']['rhythm'].keys())))
print('lead keys:', sorted(list(d['layers']['lead'].keys())))
