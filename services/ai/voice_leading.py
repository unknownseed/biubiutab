try:
    from .chord_shapes import chord_shapes_for_label
except ImportError:
    from chord_shapes import chord_shapes_for_label

def apply_voice_leading(chords: list[str]) -> list[str]:
    out = []
    n = len(chords)
    for i in range(n):
        c = chords[i]
        
        # Look ahead and behind
        prev_c = chords[i-1] if i > 0 else None
        next_c = chords[i+1] if i < n - 1 else None
        
        if c == "G" and prev_c == "C" and next_c == "Am":
            out.append("G/B")
        elif c == "G" and prev_c == "Am" and next_c == "F":
            out.append("G")
        elif c == "C" and prev_c == "F" and next_c == "Dm":
            out.append("C/E")
        elif c == "D" and prev_c == "G" and next_c == "Em":
            out.append("D/F#")
        elif c == "D" and prev_c == "Em" and next_c == "C":
            out.append("D")
        else:
            out.append(c)
            
    return out

def _shape_to_dict(frets: list[str]) -> dict[int, int]:
    chord_dict = {}
    for i, f in enumerate(frets):
        string_num = i + 1  # 1 to 6
        if f is None or str(f).lower() == 'x':
            chord_dict[string_num] = -1
        else:
            chord_dict[string_num] = int(f)
    return chord_dict

def _calculate_distance(shape1: dict[int, int], shape2: dict[int, int]) -> float:
    dist = 0.0
    for string_num in range(1, 7):
        f1 = shape1.get(string_num, -1)
        f2 = shape2.get(string_num, -1)
        
        if f1 == -1 and f2 == -1:
            continue
        elif f1 == -1 or f2 == -1:
            # Penalty for changing strings
            dist += 2.0
        else:
            # Fret distance
            dist += abs(f1 - f2)
            
    return dist

def optimize_voicings(chord_sequence: list[dict]) -> list[dict]:
    """
    Given a list of chord dicts [{"chord": "C", ...}], 
    returns the list with an added "voicing" key containing the best fingering dict.
    """
    if not chord_sequence:
        return []
        
    prev_shape_dict = None
    
    for item in chord_sequence:
        chord_name = item.get("chord", "N")
        candidates = chord_shapes_for_label(chord_name, limit=5)
        
        if not candidates:
            # Fallback empty shape
            item["voicing"] = {1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1}
            continue
            
        candidate_dicts = [_shape_to_dict(c.frets_high_to_low) for c in candidates]
        
        if not prev_shape_dict:
            # First chord: prefer the first (most standard) open chord
            best_dict = candidate_dicts[0]
        else:
            # Find the candidate with minimum distance to the previous shape
            best_dict = min(candidate_dicts, key=lambda c: _calculate_distance(prev_shape_dict, c))
            
        item["voicing"] = best_dict
        prev_shape_dict = best_dict
        
    return chord_sequence
