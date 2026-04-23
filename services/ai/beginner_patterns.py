import json
import os

# Load patterns from JSON
PATTERNS_FILE = os.path.join(os.path.dirname(__file__), "beginner_patterns.json")
try:
    with open(PATTERNS_FILE, "r", encoding="utf-8") as f:
        BEGINNER_CONFIG = json.load(f)
except Exception as e:
    print(f"[Warning] Failed to load beginner_patterns.json: {e}")
    BEGINNER_CONFIG = {}

def generate_beginner_beats(level: int, section_name: str, chords: list, ts_num: int, is_strum: bool = False) -> list:
    """
    Generates simplified rhythm beats for beginners based on the level.
    Reads patterns from beginner_patterns.json.
    """
    beats = []
    
    level_str = str(level)
    if level_str not in BEGINNER_CONFIG:
        level_str = "1" # fallback
        
    pattern_type = "strum" if is_strum else "arpeggio"
    pattern = BEGINNER_CONFIG.get(level_str, {}).get(pattern_type, [])
    
    if not pattern:
        return []
        
    for chord_idx, chord_info in enumerate(chords):
        chord_name = chord_info.get("chord", "C")
        voicing = chord_info.get("voicing", {})
        if not voicing:
            voicing = {5: 0} # Fallback
            
        bass_string = 5
        for s in [6, 5, 4]:
            if voicing.get(s, -1) >= 0:
                bass_string = s
                break
                
        strum_strings = []
        for s in [1, 2, 3, 4]: # limit strum to top 4 strings for cleaner sound
            if voicing.get(s, -1) >= 0:
                strum_strings.append({"string": s, "fret": voicing[s]})
        
        if not strum_strings: # fallback if none found
            strum_strings = [{"string": 3, "fret": voicing.get(3, 0)}]
            
        total_ticks_needed = ts_num * 960
        current_ticks = 0
        pattern_idx = 0
        
        beat_in_measure = 0
        
        while current_ticks < total_ticks_needed:
            step = pattern[pattern_idx % len(pattern)]
            duration_val = step.get("duration", 4)
            ticks = int(960 * 4 / duration_val)
            
            if current_ticks + ticks > total_ticks_needed:
                # Truncate if it exceeds the measure
                break
                
            notes = []
            for play_item in step.get("play", []):
                if play_item == "rest":
                    continue
                elif play_item == "strum":
                    notes.extend([dict(n) for n in strum_strings])
                elif play_item == "tied_strum":
                    notes.extend([{"string": n["string"], "fret": n["fret"], "tie": True} for n in strum_strings])
                elif play_item == "bass":
                    notes.append({"string": bass_string, "fret": voicing.get(bass_string, 0)})
                elif play_item == "bass_alt":
                    s1 = 4 if voicing.get(4, -1) >= 0 else bass_string
                    notes.append({"string": s1, "fret": voicing.get(s1, 0)})
                else:
                    # Specific string like "1", "2", "3"
                    try:
                        s_num = int(play_item)
                        if voicing.get(s_num, -1) >= 0:
                            notes.append({"string": s_num, "fret": voicing[s_num]})
                        else:
                            # Fallback if string is muted
                            notes.append({"string": 3, "fret": voicing.get(3, 0)})
                    except ValueError:
                        pass
                        
            # --- 解析音符级别的吉他技巧 (Note Effects) ---
            if "effects" in step and isinstance(step["effects"], dict):
                eff = step["effects"]
                for n in notes:
                    if eff.get("hammer"): n["hammer"] = True
                    if eff.get("pull"): n["pull"] = True
                    if eff.get("slide"): n["slide"] = True
                    if eff.get("vibrato"): n["vibrato"] = True
                    if eff.get("ghost"): n["ghost"] = True
                    if eff.get("let_ring"): n["let_ring"] = True
                        
            beat_dict = {
                "duration": duration_val,
                "notes": notes,
                "velocity": step.get("velocity", 85)
            }
            
            if beat_in_measure == 0:
                beat_dict["chord_name"] = chord_name
                beat_dict["voicing"] = voicing
                
            # --- 解析节拍级别的吉他技巧 (Beat Effects) ---
            beat_effects = {}
            if "strum" in step and step["strum"]:
                beat_effects[f"strum_{step['strum']}"] = True
                
            if beat_effects:
                beat_dict["effects"] = beat_effects
                
            beats.append(beat_dict)
            
            current_ticks += ticks
            pattern_idx += 1
            beat_in_measure += 1
            
    return beats