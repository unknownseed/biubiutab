import librosa
import numpy as np
import os

def _calc_clustering_polyphony_and_energy(segment, sr):
    """
    Helper function to calculate the metrics.
    """
    if len(segment) == 0:
        return 0.0, 0.0, {"variance": 0.0, "peak_count": 0}
        
    # Energy Profile
    rms = librosa.feature.rms(y=segment)[0]
    variance = float(np.var(rms))
    
    # Simple peak counting
    threshold = np.mean(rms) * 1.2
    peaks = 0
    in_peak = False
    for val in rms:
        if val > threshold:
            if not in_peak:
                peaks += 1
                in_peak = True
        else:
            in_peak = False
            
    energy_profile = {"variance": variance, "peak_count": peaks}
    
    # Onset Clustering
    onsets = librosa.onset.onset_detect(y=segment, sr=sr, units='time')
    clustering = 0.0
    if len(onsets) >= 2:
        intervals = np.diff(onsets)
        short_intervals = np.sum(intervals < 0.05) # less than 50ms
        clustering = short_intervals / len(intervals)
        
    # Polyphony via CQT
    try:
        C = np.abs(librosa.cqt(segment, sr=sr))
        threshold_cqt = np.mean(C) * 2
        active_notes_per_frame = np.sum(C > threshold_cqt, axis=0)
        polyphony = float(np.median(active_notes_per_frame))
    except Exception:
        polyphony = 1.0
        
    return clustering, polyphony, energy_profile

def detect_playing_technique(stems_paths: dict, start_time: float, end_time: float) -> str:
    """
    Detect playing technique (arpeggio, strum, or rest) for a specific section.
    Fallback logic: guitar -> piano -> other.
    """
    sources_to_try = ["guitar", "piano", "other", "no_vocals"]
    
    for source in sources_to_try:
        audio_path = stems_paths.get(source)
        if not audio_path or not os.path.exists(audio_path):
            continue
            
        try:
            # We only load the exact segment to save memory/time
            offset = start_time
            duration = end_time - start_time
            if duration <= 0:
                continue
                
            y, sr = librosa.load(audio_path, sr=22050, offset=offset, duration=duration)
            
            # Check if this stem has any actual energy (is not silent)
            rms = librosa.feature.rms(y=y)[0]
            variance = np.var(rms)
            
            # If the source is effectively silent, move to the next fallback source
            if variance < 0.0001 and source != "other" and source != "no_vocals":
                continue
                
            # If we are using a fallback source (other/no_vocals), we might just default to 'strum' 
            # or do the same calculation. Let's do the calculation for all.
            clustering, polyphony, energy_profile = _calc_clustering_polyphony_and_energy(y, sr)
            
            # Classification rules
            if clustering > 0.4 and polyphony > 2.5:
                return "strum"
            elif polyphony < 2.5 and energy_profile["peak_count"] >= 2:
                return "arpeggio"
            elif clustering < 0.3:
                return "arpeggio"
            else:
                return "strum"
                
        except Exception as e:
            # If loading/processing fails, fallback to next source
            print(f"Error detecting technique on {source}: {e}")
            continue
            
    # Default fallback
    return "strum"
