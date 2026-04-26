import json
import math
import os
import sys
from pathlib import Path
import guitarpro

def load_manifest(song_slug: str):
    """
    Load the manifest.json for a given song.
    """
    base_dir = Path(f"apps/web/songs/{song_slug}")
    if not base_dir.exists():
        # Try finding it relative to the script if running from services/ai
        base_dir = Path(f"../../apps/web/songs/{song_slug}")
    
    manifest_path = base_dir / "manifest.json"
    if not manifest_path.exists():
        print(f"Error: manifest.json not found at {manifest_path}")
        return None
        
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if data else {"bpm": 80}
    except Exception as e:
        print(f"Error parsing manifest.json: {e}")
        return {"bpm": 80}

def _copy_track_settings(src_track, dest_track):
    """
    Helper to copy basic track settings like color, name, instrument.
    """
    dest_track.name = src_track.name
    dest_track.color = src_track.color
    dest_track.channel = src_track.channel
    # Copy string tunings
    dest_track.strings = []
    for s in src_track.strings:
        new_string = guitarpro.models.GuitarString(s.number, s.value)
        dest_track.strings.append(new_string)

def generate_gp5_variant(base_gp5_path: str, output_path: str, tempo: float = None, chords=None, keep_bars=None):
    """
    Generate a variant GP5 file based on the original base.gp5.
    - tempo: Override the BPM.
    - chords: Only keep specific chords (not implemented fully in this mock, but placeholder).
    - keep_bars: List of bar indices (1-based) to keep. If None, keep all.
    """
    if not os.path.exists(base_gp5_path):
        print(f"Warning: Base GP5 file not found at {base_gp5_path}. Creating empty mock GP5.")
        # Create a blank GP5 just so the file exists for testing
        blank = guitarpro.models.Song()
        track = guitarpro.models.Track(blank)
        blank.tracks.append(track)
        measure_header = guitarpro.models.MeasureHeader()
        measure = guitarpro.models.Measure(track, measure_header)
        track.measures.append(measure)
        guitarpro.write(blank, output_path)
        return
        
    try:
        song = guitarpro.parse(base_gp5_path)
        
        # Override tempo if provided
        if tempo:
            song.tempo = int(tempo)
            
        # Filter bars if specified
        if keep_bars:
            for track in song.tracks:
                new_measures = []
                for idx, measure in enumerate(track.measures):
                    # Measure indices are 1-based in our keep_bars logic
                    if (idx + 1) in keep_bars:
                        new_measures.append(measure)
                track.measures = new_measures
                
        # Write the output
        guitarpro.write(song, output_path)
        print(f"Generated {output_path}")
    except Exception as e:
        print(f"Failed to generate {output_path}: {e}")

def write_module_json(module_name: str, manifest: dict, out_dir: Path):
    """
    Generate the corresponding JSON data file for the frontend module.
    """
    slug = manifest.get('slug', out_dir.name)
    
    if module_name == "warmup":
        data = {
            "module": "warmup",
            "description": "预习模块：手指热身与基础元素拆解，熟悉歌曲的核心和弦与基础节奏。",
            "chord_switches": [
                {
                    "title": "核心和弦转换",
                    "gp5_url": f"/gp5/{slug}/warmup.gp5",
                    "tempo": 50,
                    "loop_bars": [1, 2]
                }
            ],
            "rhythm_patterns": [
                {
                    "name": "基础节奏预习",
                    "gp5_url": f"/gp5/{slug}/warmup.gp5",
                    "tempo": 60
                }
            ],
            "challenges": manifest.get('challenges', [])
        }
    elif module_name == "basic":
        sections = []
        for sec in manifest.get('structure', []):
            sections.append({
                "name": sec.get("name"),
                "label": f"{sec.get('name')} 慢速跟弹",
                "gp5_url": f"/gp5/{slug}/basic.gp5",
                "loop_bars": [sec.get("start_bar"), sec.get("end_bar")],
                "tempo": math.floor(manifest.get('bpm', 80) * 0.75),
                "tips": f"注意 {sec.get('name')} 段落的节奏稳定。",
                "demo_video": sec.get("demo_video")
            })
            
        data = {
            "module": "basic",
            "description": "基础模块：分段慢速跟弹，完整弹奏全曲的简化版。",
            "sections": sections
        }
    elif module_name == "advanced":
        challenges = []
        for ch in manifest.get('challenges', []):
            challenges.append({
                "title": ch.get("title"),
                "gp5_url": f"/gp5/{slug}/advanced.gp5",
                "loop_bars": ch.get("bar_range"),
                "tempo": math.floor(manifest.get('bpm', 80) * 0.8),
                "tips": f"攻克难点：{ch.get('title')}",
                "demo_video": ch.get("demo_video")
            })
            
        data = {
            "module": "advanced",
            "description": "进阶模块：原速全曲练习，强化技术难点。",
            "full_song": {
                "gp5_url": f"/gp5/{slug}/advanced.gp5",
                "tempo": manifest.get('bpm', 80),
                "demo_video": manifest.get('source_files', {}).get('full_video')
            },
            "challenges": challenges
        }
    elif module_name == "solo":
        data = {
            "module": "solo",
            "description": "Solo 创作模块：即兴演奏，根据和弦进行自由发挥。",
            "backing": {
                "gp5_url": f"/gp5/{slug}/solo.gp5",
                "loop_bars": [1, 8],
                "bpm": manifest.get('bpm', 80),
                "style": "folk"
            },
            "scales": manifest.get('scale_suggestions', {
                "primary": "A minor pentatonic"
            }),
            "chord_tones": manifest.get('core_chords', [])
        }
    else:
        data = {}

    out_file = out_dir / f"{module_name}.json"
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Generated {out_file}")

def generate_lessons(song_slug: str):
    print(f"Starting lesson generation for: {song_slug}")
    manifest = load_manifest(song_slug)
    if not manifest:
        print("Empty or invalid manifest.")
        sys.exit(1)
        
    bpm = manifest.get("bpm", 80)
    
    # Setup directories
    base_dir = Path(f"apps/web/songs/{song_slug}")
    if not base_dir.exists():
        base_dir = Path(f"../../apps/web/songs/{song_slug}")
        
    gp5_dir = Path(f"apps/web/public/gp5/{song_slug}")
    if not str(gp5_dir.parent.parent).endswith("public"):
        gp5_dir = Path(f"../../apps/web/public/gp5/{song_slug}")
    gp5_dir.mkdir(parents=True, exist_ok=True)
    
    base_gp5 = base_dir / manifest.get("source_files", {}).get("base_gp5", "base.gp5")
    
    print(f"Base GP5 Path: {base_gp5}")
    print(f"Output Directory: {gp5_dir}")
    
    # 1. Generate Warmup GP5 (Simplified, Slow)
    generate_gp5_variant(
        str(base_gp5), 
        str(gp5_dir / "warmup.gp5"), 
        tempo=math.floor(bpm * 0.6)
    )
    
    # 2. Generate Basic GP5 (Full but standard speed - frontend will slow it down or we set it to 0.75x)
    generate_gp5_variant(
        str(base_gp5), 
        str(gp5_dir / "basic.gp5"), 
        tempo=math.floor(bpm * 0.75)
    )
    
    # 3. Generate Advanced GP5 (Full speed)
    generate_gp5_variant(
        str(base_gp5), 
        str(gp5_dir / "advanced.gp5"), 
        tempo=bpm
    )
    
    # 4. Generate Solo GP5 (Backing track only - in real logic we'd mute lead tracks)
    generate_gp5_variant(
        str(base_gp5), 
        str(gp5_dir / "solo.gp5"), 
        tempo=bpm
    )
    
    # 5. Generate JSON Modules
    for mod in ["warmup", "basic", "advanced", "solo"]:
        write_module_json(mod, manifest, base_dir)
        
    print(f"Successfully finished generating lessons for: {song_slug}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_lessons.py <song_slug>")
        sys.exit(1)
        
    slug = sys.argv[1]
    generate_lessons(slug)
