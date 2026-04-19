import os
import json
from .chord_shapes import _SHAPES

LIBRARY_DIR = os.path.join(os.path.dirname(__file__), "pattern_library")
_INDEX_CACHE = None

# Dynamically construct CHORD_SHAPES from existing chord_shapes
CHORD_SHAPES = {}
for name, shape in _SHAPES.items():
    frets = shape.frets_high_to_low
    chord_dict = {}
    for i, f in enumerate(frets):
        string_num = i + 1  # 1 to 6
        if f is None or str(f).lower() == 'x':
            chord_dict[string_num] = -1
        else:
            chord_dict[string_num] = int(f)
    CHORD_SHAPES[name] = chord_dict

def load_library():
    """
    启动时调用一次，将 index.json 加载到内存。
    """
    global _INDEX_CACHE
    index_path = os.path.join(LIBRARY_DIR, "index.json")
    
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            _INDEX_CACHE = json.load(f)
    except Exception:
        _INDEX_CACHE = []
                
    print(f"[pattern_engine] 已加载 {len(_INDEX_CACHE)} 个节奏模板")

def find_best_pattern(bpm, section_energy=0.5):
    """
    根据歌曲的 BPM 和段落能量，找到最匹配的模板。
    """
    if not _INDEX_CACHE:
        load_library()
        
    best_id = None
    best_score = -999
    
    for entry in _INDEX_CACHE:
        template_bpm = entry.get("bpm", 120)
        
        # 核心评分：BPM 越接近，分数越高
        bpm_diff = abs(template_bpm - bpm)
        score = 100 - bpm_diff  # BPM 差 1 扣 1 分
        
        # BPM 差距超过 30 的，严重惩罚
        if bpm_diff > 30:
            score -= 50
            
        if score > best_score:
            best_score = score
            best_id = entry["id"]
            
    # 如果最佳分数太低，返回 None（降级到原有逻辑）
    if best_score < 50:
        return None
        
    return best_id

def transplant_pattern(template_id, chord_sequence):
    """
    将模板的节奏骨架移植到用户的和弦序列上。
    """
    pattern_path = os.path.join(LIBRARY_DIR, "patterns", f"{template_id}.json")
    with open(pattern_path, 'r', encoding='utf-8') as f:
        template = json.load(f)
        
    # 移植 Rhythm 层（永远执行）
    rhythm_template = template.get("layers", {}).get("rhythm", [])
    rhythm_beats = _do_transplant(rhythm_template, chord_sequence)
    
    # 移植 Lead 层（如果有）
    lead_beats = []
    if template.get("layers", {}).get("lead"):
        lead_template = template["layers"]["lead"]
        lead_beats = _do_transplant(lead_template, chord_sequence)
        
    return {
        "rhythm_beats": rhythm_beats,
        "lead_beats": lead_beats,
        "is_dual": template.get("is_dual", False)
    }

def _do_transplant(template_beats, chord_sequence):
    if not template_beats:
        return []
        
    result = []
    template_length = len(template_beats)
    beat_index = 0
    
    for chord_info in chord_sequence:
        chord_name = chord_info.get("chord", "C")
        duration = chord_info.get("duration_beats", 4)
        
        target_shape = CHORD_SHAPES.get(chord_name)
        
        if not target_shape:
            # 未知和弦：生成简单的根音
            for _ in range(duration * 2):
                result.append({
                    "duration": 8,
                    "notes": [{"string": 5, "fret": 0}],
                    "velocity": 80
                })
            continue
            
        beats_needed = duration * 2
        
        for i in range(beats_needed):
            t_beat = template_beats[beat_index % template_length]
            beat_index += 1
            
            new_notes = []
            for t_note in t_beat.get("notes", []):
                string_num = t_note["string"]
                target_fret = target_shape.get(string_num, -1)
                
                if target_fret < 0:
                    continue
                    
                new_notes.append({
                    "string": string_num,
                    "fret": target_fret
                })
                
            if not new_notes:
                for s in [5, 6, 4]:
                    if target_shape.get(s, -1) >= 0:
                        new_notes.append({"string": s, "fret": target_shape[s]})
                        break
                        
            result.append({
                "duration": t_beat.get("duration", 8),
                "notes": new_notes,
                "velocity": t_beat.get("velocity", 85)
            })
            
    return result
