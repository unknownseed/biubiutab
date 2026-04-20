import json
with open('/Users/unknownseed/Developer/biubiutab/services/ai/pattern_library/patterns/f5b60e18.json') as f:
    d = json.load(f)
print('rhythm chorus first:', d['layers']['rhythm']['chorus'][0])
print('lead chorus first:', d['layers']['lead']['chorus'][0])
