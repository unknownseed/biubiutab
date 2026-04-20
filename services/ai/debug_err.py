import traceback
from pattern_engine import load_library, find_best_pattern, transplant_pattern
load_library()
tid = find_best_pattern(120)
print("Template:", tid)
try:
    transplant_pattern(tid, [{"chord": "C", "duration_beats": 4}])
    print("Transplant success")
except Exception as e:
    traceback.print_exc()
