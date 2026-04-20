import librosa
import numpy as np

def extract_rhythm_motif(accompaniment_path: str, beat_times: list[float], ts_num: int = 4) -> list[dict] | None:
    """
    Extracts the dominant rhythmic skeleton from the first 4 bars of the audio.
    Returns a template_beats array, or None if extraction fails.
    """
    try:
        y, sr = librosa.load(accompaniment_path, sr=22050)
    except Exception as e:
        print(f"Motif extraction failed to load audio: {e}")
        return None
        
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, backtrack=True)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    
    if len(beat_times) < ts_num * 4:
        return None
        
    pattern_length = ts_num * 2 # 8th note grid
    rhythm_histogram = np.zeros(pattern_length)
    
    for bar in range(4):
        start_beat_idx = bar * ts_num
        if start_beat_idx + ts_num >= len(beat_times):
            break
            
        bar_start_time = beat_times[start_beat_idx]
        bar_end_time = beat_times[start_beat_idx + ts_num] if start_beat_idx + ts_num < len(beat_times) else beat_times[-1]
        
        bar_onsets = [t for t in onset_times if bar_start_time <= t < bar_end_time]
        bar_duration = bar_end_time - bar_start_time
        if bar_duration <= 0:
            continue
            
        grid_step = bar_duration / pattern_length
        
        for t in bar_onsets:
            relative_t = t - bar_start_time
            grid_idx = int(round(relative_t / grid_step))
            if 0 <= grid_idx < pattern_length:
                rhythm_histogram[grid_idx] += 1
                
    # Threshold: if onset occurs in at least 2 out of 4 bars
    active_grid = rhythm_histogram >= 1.5
    
    # Check if the extracted rhythm is too dense or too sparse
    active_count = np.sum(active_grid)
    if active_count < 2 or active_count > pattern_length - 1:
        return None # Fallback to standard templates
        
    template_beats = []
    for i in range(pattern_length):
        is_active = active_grid[i]
        
        beat_dict = {
            "duration": 8,
            "velocity": 85
        }
        
        if is_active:
            if i == 0 or i == pattern_length / 2:
                # Bass note
                beat_dict["notes"] = [{"string": 5, "fret": 0}]
            else:
                # Strum
                beat_dict["notes"] = [{"string": 1, "fret": 0}, {"string": 2, "fret": 0}, {"string": 3, "fret": 0}]
        else:
            beat_dict["notes"] = []
            
        template_beats.append(beat_dict)
        
    return template_beats
