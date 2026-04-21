import json
import os
import glob
import sys

def detect_technique(pattern_data):
    """
    Auto-detect if a pattern is 'strum' or 'arpeggio' based on polyphony.
    Arpeggios typically have 1 note per beat, strums have 3-6 notes per beat.
    """
    if pattern_data.get("is_arpeggio", False):
        return "arpeggio"
    
    if "layers" not in pattern_data or "rhythm" not in pattern_data["layers"]:
        return "strum" # fallback
        
    rhythm_layer = pattern_data["layers"]["rhythm"]
    polyphony_counts = []
    
    if isinstance(rhythm_layer, list):
        beats = rhythm_layer
        for beat in beats:
            if "notes" in beat and len(beat["notes"]) > 0:
                polyphony_counts.append(len(beat["notes"]))
    elif isinstance(rhythm_layer, dict):
        for section_name, beats in rhythm_layer.items():
            for beat in beats:
                if "notes" in beat and len(beat["notes"]) > 0:
                    polyphony_counts.append(len(beat["notes"]))
            
    if not polyphony_counts:
        return "strum"
        
    avg_polyphony = sum(polyphony_counts) / len(polyphony_counts)
    max_polyphony = max(polyphony_counts)
    
    if avg_polyphony <= 1.8 and max_polyphony <= 4:
        return "arpeggio"
    else:
        return "strum"

def tag_single_pattern(filepath):
    """
    Tag a single pattern file and return its detected technique.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        tech = detect_technique(data)
        
        # Only rewrite if it's missing or wrong
        if data.get("technique") != tech:
            data["technique"] = tech
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
                
        return tech
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return "strum" # safe fallback

def update_index_with_new_patterns():
    """
    Scans the patterns directory, tags any untagged/new patterns,
    and updates the index.json automatically.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    patterns_dir = os.path.join(current_dir, "pattern_library", "patterns")
    index_path = os.path.join(current_dir, "pattern_library", "index.json")
    
    # 1. Load existing index
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
    else:
        index_data = []
        
    # Build a lookup map of what's already in the index
    indexed_patterns = {entry["id"]: entry for entry in index_data}
    
    # 2. Find all json files in the patterns folder
    pattern_files = glob.glob(os.path.join(patterns_dir, "*.json"))
    
    new_count = 0
    updated_count = 0
    
    for p_file in pattern_files:
        pattern_id = os.path.basename(p_file).replace(".json", "")
        
        # Auto-detect and tag the actual JSON file
        tech = tag_single_pattern(p_file)
        
        # 3. If it's a completely new pattern (not in index)
        if pattern_id not in indexed_patterns:
            print(f"[New] Added {pattern_id} ({tech}) to index")
            
            # Read its basic metadata to build the index entry
            with open(p_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            new_entry = {
                "id": pattern_id,
                "bpm": data.get("meta", {}).get("bpm", 120),
                "time_signature": data.get("meta", {}).get("time_signature", "4/4"),
                "is_dual": data.get("is_dual", False),
                "source": data.get("meta", {}).get("source_file", ""),
                "technique": tech
            }
            index_data.append(new_entry)
            indexed_patterns[pattern_id] = new_entry
            new_count += 1
            
        # 4. If it's already in the index but missing the technique tag
        elif "technique" not in indexed_patterns[pattern_id] or indexed_patterns[pattern_id]["technique"] != tech:
            indexed_patterns[pattern_id]["technique"] = tech
            updated_count += 1
            
    # 5. Save the updated index back to disk
    if new_count > 0 or updated_count > 0:
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2)
        print(f"Index updated! Added {new_count} new patterns, updated {updated_count} existing tags.")
    else:
        print("Everything is up to date. No new patterns found.")

if __name__ == "__main__":
    print("Running Pattern Tagger & Indexer...")
    update_index_with_new_patterns()
