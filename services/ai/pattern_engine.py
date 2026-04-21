import os
import json
try:
    from .chord_shapes import _SHAPES
except ImportError:
    from chord_shapes import _SHAPES

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

def find_best_pattern(bpm, section_energy=0.5, technique=None):
    """
    根据歌曲的 BPM、段落能量和指定的演奏手法 (arpeggio/strum)，找到最匹配的模板。
    """
    if not _INDEX_CACHE:
        load_library()
        
    best_id = None
    best_score = -999
    
    for entry in _INDEX_CACHE:
        # 如果指定了演奏手法，强制过滤
        if technique and entry.get("technique") and entry.get("technique") != technique:
            continue
            
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

def transplant_pattern(template_id_or_dict, chord_sequence):
    """
    将模板的节奏骨架移植到用户的和弦序列上。
    template_id_or_dict 可以是模板的文件名（如 "pop_01"），
    也可以是直接提取出的 Motif 模板字典。
    """
    if isinstance(template_id_or_dict, str):
        pattern_path = os.path.join(LIBRARY_DIR, "patterns", f"{template_id_or_dict}.json")
        with open(pattern_path, 'r', encoding='utf-8') as f:
            template = json.load(f)
    else:
        template = template_id_or_dict
        
    # 移植 Rhythm 层（永远执行）
    rhythm_template = template.get("layers", {}).get("rhythm", [])
    rhythm_beats = _do_transplant(rhythm_template, chord_sequence, is_lead=False)
    
    # 移植 Lead 层（如果有）
    lead_beats = []
    if template.get("layers", {}).get("lead"):
        lead_template = template["layers"]["lead"]
        lead_beats = _do_transplant(lead_template, chord_sequence, is_lead=True)
        
    return {
        "rhythm_beats": rhythm_beats,
        "lead_beats": lead_beats,
        "is_dual": template.get("is_dual", False)
    }

def _do_transplant(template_beats, chord_sequence, is_lead=False):
    if not template_beats:
        return []
        
    result = []
    template_length = len(template_beats)
    beat_index = 0
    
    for chord_info in chord_sequence:
        chord_name = chord_info.get("chord", "C")
        duration = chord_info.get("duration_beats", 4)
        
        # 优先使用经过优化（voice leading）计算出来的具体把位，如果没有则兜底拿全局 CHORD_SHAPES
        target_shape = None
        if not is_lead:
            target_shape = chord_info.get("voicing") or CHORD_SHAPES.get(chord_name)
        
        if (not target_shape) and (not is_lead):
            # 未知和弦：生成简单的根音
            for i in range(duration * 2):
                beat_dict = {
                    "duration": 8,
                    "notes": [{"string": 5, "fret": 0}],
                    "velocity": 80
                }
                if i == 0:
                    beat_dict["chord_name"] = chord_name
                    beat_dict["voicing"] = target_shape
                result.append(beat_dict)
            continue
            
        target_ticks = duration * 960
        current_ticks = 0
        is_first_beat_of_chord = True
        
        # 兼容字典格式的模板（有些旧模板可能是一个字典而不是数组）
        if isinstance(template_beats, dict):
            # 定义音乐段落的合理先后顺序
            order_map = {
                "intro": 0,
                "verse": 1,
                "pre_chorus": 2,
                "pre-chorus": 2,
                "chorus": 3,
                "bridge": 4,
                "outro": 5
            }
            
            def get_order(k):
                k_lower = k.lower()
                for key_name, score in order_map.items():
                    if key_name in k_lower:
                        return score
                return 99 # 未知段落放在最后

            t_keys = sorted(list(template_beats.keys()), key=get_order)
            if not t_keys:
                continue
            
            # 为了最简单的兼容，我们直接把所有段落的 beats 拍平合并成一个长数组
            flat_beats = []
            for k in t_keys:
                flat_beats.extend(template_beats[k])
                
            if not flat_beats:
                continue
                
            template_length = len(flat_beats)
            def get_t_beat(idx):
                return flat_beats[idx % template_length]
        else:
            template_length = len(template_beats)
            def get_t_beat(idx):
                return template_beats[idx % template_length]
        
        while current_ticks < target_ticks:
            t_beat = get_t_beat(beat_index)
            beat_index += 1
            
            beat_duration = t_beat.get("duration", 8)
            beat_ticks = int(960 * 4 / beat_duration)
            
            # 如果加上这个音符超过了目标长度，我们就只取能放得下的部分
            if current_ticks + beat_ticks > target_ticks:
                remaining_ticks = target_ticks - current_ticks
                if remaining_ticks <= 0:
                    break
                
                # 把剩下的 ticks 拆分成合法的 duration 填进去
                # 贪心算法：每次填入最大的合法 duration
                while remaining_ticks > 0:
                    # 允许的 ticks (960*4/d): 3840(1), 1920(2), 960(4), 480(8), 240(16), 120(32), 60(64)
                    for allowed_duration in [1, 2, 4, 8, 16, 32, 64]:
                        allowed_ticks = int(960 * 4 / allowed_duration)
                        if allowed_ticks <= remaining_ticks:
                            beat_dict = {
                                "duration": allowed_duration,
                                "notes": [], # 超过部分的截断直接用休止符填补，最安全
                                "velocity": 80
                            }
                            if is_first_beat_of_chord:
                                beat_dict["chord_name"] = chord_name
                                beat_dict["voicing"] = target_shape
                                is_first_beat_of_chord = False
                            result.append(beat_dict)
                            remaining_ticks -= allowed_ticks
                            current_ticks += allowed_ticks
                            break
                break
            
            new_notes = []
            for t_note in t_beat.get("notes", []):
                string_num = t_note["string"]
                
                if is_lead:
                    # 主音轨道：直接保留原有的品位，不套用和弦指法
                    new_notes.append({
                        "string": string_num,
                        "fret": t_note["fret"]
                    })
                else:
                    target_fret = target_shape.get(string_num, -1)
                    if target_fret < 0:
                        continue
                        
                    new_notes.append({
                        "string": string_num,
                        "fret": target_fret
                    })
                
            if not new_notes and not is_lead:
                for s in [5, 6, 4]:
                    if target_shape.get(s, -1) >= 0:
                        new_notes.append({"string": s, "fret": target_shape[s]})
                        break
                        
            beat_dict = {
                "duration": beat_duration,
                "notes": new_notes,
                "velocity": t_beat.get("velocity", 85)
            }
            if is_first_beat_of_chord:
                beat_dict["chord_name"] = chord_name
                beat_dict["voicing"] = target_shape
                is_first_beat_of_chord = False
            result.append(beat_dict)
            
            current_ticks += beat_ticks
            
    return result
