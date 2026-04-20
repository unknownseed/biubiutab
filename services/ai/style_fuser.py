import librosa
import numpy as np
import random

class StyleFuser:
    """
    Input: Generated beats + original accompaniment audio
    Output: Fine-tuned beats (velocity, timing, accent mapped to original audio)
    """
    
    def __init__(self, accompaniment_path: str, beat_times: list[float]):
        self.beat_times = beat_times
        try:
            self.y, self.sr = librosa.load(accompaniment_path, sr=22050)
            self.valid = True
            self.energy_curve = self._calc_energy_curve()
            self.accent_map = self._calc_accent_map()
        except Exception as e:
            print(f"StyleFuser init failed: {e}")
            self.valid = False
    
    def _calc_energy_curve(self) -> list[float]:
        rms = librosa.feature.rms(y=self.y, frame_length=2048, hop_length=512)[0]
        rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=self.sr, hop_length=512)
        
        max_rms = np.max(rms) if np.max(rms) > 0 else 1.0
        
        energy_per_beat = []
        for i in range(len(self.beat_times) - 1):
            t_start = self.beat_times[i]
            t_end = self.beat_times[i + 1]
            
            mask = (rms_times >= t_start) & (rms_times < t_end)
            if np.any(mask):
                beat_energy = np.mean(rms[mask]) / max_rms
            else:
                beat_energy = 0.5
            
            energy_per_beat.append(round(float(beat_energy), 3))
            
        # Append one last for the final beat
        energy_per_beat.append(energy_per_beat[-1] if energy_per_beat else 0.5)
        return energy_per_beat
    
    def _calc_accent_map(self) -> list[bool]:
        onset_frames = librosa.onset.onset_detect(
            y=self.y, sr=self.sr,
            backtrack=True,
            units='time'
        )
        
        accent_per_beat = []
        tolerance = 0.08
        
        for i in range(len(self.beat_times)):
            beat_time = self.beat_times[i]
            has_onset = any(abs(o - beat_time) < tolerance for o in onset_frames)
            accent_per_beat.append(has_onset)
            
        return accent_per_beat
        
    def fuse(self, transplanted_beats: list[dict], global_start_beat_idx: int) -> list[dict]:
        if not self.valid:
            # Still apply some basic humanization even if audio fails
            fused = []
            for beat in transplanted_beats:
                new_beat = {**beat}
                base_v = new_beat.get("velocity", 85)
                new_beat["velocity"] = max(40, min(127, base_v + random.randint(-4, 4)))
                fused.append(new_beat)
            return fused
            
        fused = []
        for i, beat in enumerate(transplanted_beats):
            new_beat = {**beat}
            
            # Since transplanted_beats can have sub-beats (like 8th or 16th notes), 
            # we approximate their position in the global grid.
            # Assuming transplanted_beats are mostly 8th notes (duration=8) in a 4/4 bar (duration=32),
            # 1 quarter note = 1 global beat = 8 in our duration scale.
            # Wait, `beat_times` is typically quarter notes (beats). 
            # `transplanted_beats` are sub-beats. Let's calculate the elapsed quarter notes.
            elapsed_quarter_notes = sum(b.get("duration", 8) for b in transplanted_beats[:i]) / 8.0
            
            global_idx = global_start_beat_idx + int(elapsed_quarter_notes)
            
            if global_idx < len(self.energy_curve):
                original_energy = self.energy_curve[global_idx]
                base_velocity = beat.get("velocity", 85)
                
                # Scale between 0.6 and 1.4 based on energy
                energy_factor = 0.6 + original_energy * 0.8
                new_velocity = int(base_velocity * energy_factor)
                
                # Humanization random offset
                velocity_offset = random.randint(-4, 4)
                new_velocity += velocity_offset
                
                new_velocity = max(40, min(127, new_velocity))
                new_beat["velocity"] = new_velocity
                
                if global_idx < len(self.accent_map) and self.accent_map[global_idx]:
                    # Only accent if this is on the beat (elapsed is close to integer)
                    if abs(elapsed_quarter_notes - round(elapsed_quarter_notes)) < 0.1:
                        new_beat["velocity"] = min(127, int(new_beat["velocity"] * 1.15))
                        if "effects" not in new_beat:
                            new_beat["effects"] = {}
                        new_beat["effects"]["accent"] = True
                    
            fused.append(new_beat)
            
        return fused
        
    def add_section_transition(self, prev_section_beats: list[dict], next_section_beats: list[dict], transition_duration_eighths: int = 4) -> list[dict]:
        """
        Smooth the velocity transition between two sections.
        transition_duration_eighths: number of 8th notes at the end of prev_section to fade.
        """
        if not prev_section_beats or not next_section_beats:
            return prev_section_beats
            
        next_avg_velocity = np.mean([b.get("velocity", 85) for b in next_section_beats[:4]])
        
        result = list(prev_section_beats)
        
        # Find indices for the last `transition_duration_eighths` durations
        total_duration = sum(b.get("duration", 8) for b in result)
        current_dur = 0
        fade_start_dur = total_duration - (transition_duration_eighths * 4) # 8 is quarter, 4 is 8th
        
        for i in range(len(result)):
            beat_dur = result[i].get("duration", 8)
            if current_dur >= fade_start_dur:
                progress = (current_dur - fade_start_dur) / max(1, (transition_duration_eighths * 4))
                progress = min(1.0, max(0.0, progress))
                
                current_v = result[i].get("velocity", 85)
                blended_v = int(current_v * (1 - progress * 0.5) + next_avg_velocity * (progress * 0.5))
                result[i] = {**result[i], "velocity": max(40, min(127, blended_v))}
                
            current_dur += beat_dur
            
        return result
