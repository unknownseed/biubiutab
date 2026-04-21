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
        
    # Polyphony via CQT (improved with dB thresholding to ignore noise/reverb)
    try:
        # 1. Optionally do HPSS to reduce percussion interference on polyphony
        y_harm, _ = librosa.effects.hpss(segment)
        
        C = np.abs(librosa.cqt(y_harm, sr=sr))
        C_db = librosa.amplitude_to_db(C, ref=np.max)
        
        # 2. Use a relative dB threshold (-35 dB is a good empirical value)
        # Anything louder than max - 35dB is considered an "active frequency band"
        thr_db = -35
        active = (C_db > thr_db).astype(np.int32)
        
        # 3. Sum along frequency axis to get polyphony per frame, then take median
        active_notes_per_frame = np.sum(active, axis=0)
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
            
            # Print debug info so you can see what the detector is "hearing"
            print(f"[{source}] polyphony: {polyphony:.1f}, clustering: {clustering:.2f}, peaks: {energy_profile['peak_count']}")
            
            # Classification rules based on both Polyphony and Clustering
            # 1. High clustering + high polyphony -> Definitely Strumming
            if clustering > 0.4 and polyphony >= 3.0:
                return "strum"
            # 2. Low clustering + lots of peaks -> Arpeggio
            elif clustering < 0.3 and energy_profile["peak_count"] >= 2:
                return "arpeggio"
            # 3. Low polyphony (melody/riffs) -> We'll map to arpeggio for now (or a dedicated melody pattern later)
            elif polyphony < 2.5:
                return "arpeggio"
            # 4. Fallback default
            else:
                return "strum"
                
        except Exception as e:
            # If loading/processing fails, fallback to next source
            print(f"Error detecting technique on {source}: {e}")
            continue
            
    # Default fallback
    return "strum"
