import json
with open('/Users/unknownseed/Developer/biubiutab/services/ai/pattern_library/patterns/f5b60e18.json') as f:
    d = json.load(f)
print('raw rhythm verse first:', d['layers']['rhythm']['verse'][0])
print('raw lead verse first:', d['layers']['lead']['verse'][0])
