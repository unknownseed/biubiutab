from __future__ import annotations
import io
import guitarpro
try:
    from .formatters import SectionOut, _fallback_chord_from_key, _slice_lyrics_beats
    from .chord_shapes import chord_shape_for_label
    from .rhythm_patterns import select_pattern, _resolve_arpeggio_note, RhythmPattern, RhythmToken
except ImportError:
    from formatters import SectionOut, _fallback_chord_from_key, _slice_lyrics_beats
    from chord_shapes import chord_shape_for_label
    from rhythm_patterns import select_pattern, _resolve_arpeggio_note, RhythmPattern, RhythmToken


def _gp_safe_text(s: str) -> str:
    t = (s or "").strip()
    if not t:
        return ""
    for enc in ("cp1252", "latin-1"):
        try:
            t.encode(enc)
            return t
        except UnicodeEncodeError:
            continue
    out = t.encode("cp1252", "ignore").decode("cp1252").strip()
    return out

def generate_gp5_binary(
    title: str,
    tempo: int,
    time_signature: str,
    key: str,
    sections: list[SectionOut],
    lyrics_beats: list[str | None] | None = None,
    rhythm_energy: float | None = None,
) -> bytes:
    song = guitarpro.Song()
    song.tracks.clear()
    song.measureHeaders.clear()
    song.title = _gp_safe_text(title) or "score"
    song.tempo = tempo

    track = guitarpro.Track(song)
    track.name = _gp_safe_text("Acoustic Guitar") or "Guitar"
    # standard tuning
    track.strings = [
        guitarpro.GuitarString(1, 64),
        guitarpro.GuitarString(2, 59),
        guitarpro.GuitarString(3, 55),
        guitarpro.GuitarString(4, 50),
        guitarpro.GuitarString(5, 45),
        guitarpro.GuitarString(6, 40)
    ]
    song.tracks.append(track)

    ts_num = 4
    ts_den = 4
    if time_signature:
        try:
            ts_num, ts_den = map(int, time_signature.split('/'))
        except ValueError:
            pass

    # We need to build measures. Each chord in s.chords corresponds to one measure
    # Wait, is that true? Let's check sections_to_alphatex.
    # It loops over `s.chords` and calls `pattern_to_alphatex`. 
    # One pattern = 1 bar.
    
    # Calculate ticks per measure based on time signature
    # In Guitar Pro, a quarter note is 960 ticks.
    measure_length_ticks = int(960 * 4 * ts_num / ts_den)
    current_start = 0

    measure_number = 1
    
    tonic_fallback = _fallback_chord_from_key(key)
    last_display_chord = tonic_fallback
    showed_initial_fallback = False
    
    for s in sections:
        pattern = select_pattern(tempo, rhythm_energy, section_name=s.name)
        
        for idx, c in enumerate(s.chords):
            # Setup MeasureHeader
            header = guitarpro.MeasureHeader()
            header.number = measure_number
            header.start = current_start
            header.timeSignature.numerator = ts_num
            header.timeSignature.denominator.value = ts_den
            
            if measure_number == 1:
                # In GP, tempo is in Song, and MixTableChange for changes. We set song.tempo earlier.
                pass

            # Section marker
            if idx == 0:
                marker = guitarpro.Marker()
                marker.title = _gp_safe_text(s.name) or ""
                marker.color = guitarpro.Color(255, 0, 0)
                header.marker = marker

            song.measureHeaders.append(header)
            measure = guitarpro.Measure(track, header)
            track.measures.append(measure)
            
            voice = measure.voices[0]

            actual_lyrics_beats = _slice_lyrics_beats(lyrics_beats, c.bar * ts_num, ts_num) if lyrics_beats else None

            chord = c.chord
            show_chord_name = True
            if chord == "N":
                chord = last_display_chord or tonic_fallback
                show_chord_name = not showed_initial_fallback
                showed_initial_fallback = True
            else:
                last_display_chord = chord
                showed_initial_fallback = False

            # Add chord diagram to the first beat if show_chord_name
            # But wait, beat is created per token. We will attach to the first token's beat.
            
            first_beat = True
            pos16 = 0
            
            for t in pattern.tokens:
                beat = guitarpro.Beat(voice)
                
                if t.duration == 4: beat.duration.value = 4
                elif t.duration == 8: beat.duration.value = 8
                elif t.duration == 16: beat.duration.value = 16
                elif t.duration == 2: beat.duration.value = 2
                elif t.duration == 1: beat.duration.value = 1
                else: beat.duration.value = 4

                txt = None
                if pos16 % 4 == 0:
                    beat_idx = pos16 // 4
                    if actual_lyrics_beats and 0 <= beat_idx < len(actual_lyrics_beats):
                        txt = actual_lyrics_beats[beat_idx]
                
                if first_beat and show_chord_name:
                    shape = chord_shape_for_label(chord)
                    if shape:
                        # Add chord diagram
                        gp_chord = guitarpro.Chord(length=6)
                        gp_chord.name = chord
                        
                        frets = shape.frets_high_to_low
                        
                        # Calculate firstFret
                        min_fret = 99
                        for f in frets:
                            if f is not None and str(f).lower() != "x" and int(f) > 0:
                                min_fret = min(min_fret, int(f))
                        if min_fret == 99:
                            min_fret = 1 # all open strings or muted
                        
                        # Set firstFret, usually 1 for open chords, or actual fret for barres
                        # Let's keep it simple: if the chord spans past fret 4, we might need to set firstFret
                        # But setting firstFret = 1 and using actual absolute frets is generally safe in GP if it fits in 4 frets.
                        # Wait, pyguitarpro expects firstFret to be a number. Default is None.
                        gp_chord.firstFret = min_fret if min_fret > 4 else 1

                        # In pyguitarpro, chord strings array usually maps index 0 -> string 1 (high E), up to length 6
                        gp_chord_strings = [-1] * 6
                        for string_idx, fret_str in enumerate(frets):
                            if string_idx < 6:
                                if fret_str is not None and str(fret_str).lower() != "x":
                                    gp_chord_strings[string_idx] = int(fret_str)
                                else:
                                    gp_chord_strings[string_idx] = -1
                        gp_chord.strings = gp_chord_strings
                        beat.effect.chord = gp_chord
                
                if t.kind == "rest":
                    beat.status = guitarpro.BeatStatus.rest
                else:
                    beat.status = guitarpro.BeatStatus.normal
                    
                    if getattr(pattern, "is_arpeggio", False) and t.note_override:
                        note_str = _resolve_arpeggio_note(chord, t.note_override)
                        fret_str, string_str = note_str.split(".")
                        if fret_str is not None and str(fret_str).lower() != "x":
                            note = guitarpro.Note(beat)
                            note.value = int(fret_str)
                            note.string = int(string_str) # 1-indexed, 1=high E
                            beat.notes.append(note)
                    else:
                        # Strum!
                        shape = chord_shape_for_label(chord)
                        if shape:
                            frets = shape.frets_high_to_low
                            for string_idx, fret_str in enumerate(frets):
                                if fret_str is not None and str(fret_str).lower() != "x":
                                    note = guitarpro.Note(beat)
                                    note.value = int(fret_str)
                                    note.string = string_idx + 1 # 1 to 6
                                    beat.notes.append(note)
                                    
                        # add stroke effect if it's a strum pattern?
                        # beat.effect.pickStroke = guitarpro.BeatStrokeDirection.down if t.direction == "d" else guitarpro.BeatStrokeDirection.up
                        
                    if txt:
                        clean_txt = str(txt).replace(" ", "_").replace("\xa0", "_").strip()
                        safe_txt = _gp_safe_text(clean_txt)
                        if safe_txt:
                            beat.text = safe_txt
                        # We don't need global_lyrics_words anymore since we attach to beat.text
                    
                voice.beats.append(beat)
                first_beat = False
                
                if t.duration == 16: pos16 += 1
                elif t.duration == 8: pos16 += 2
                elif t.duration == 4: pos16 += 4
                elif t.duration == 2: pos16 += 8
                elif t.duration == 1: pos16 += 16
                
            # Update counters
            measure_number += 1
            current_start += measure_length_ticks

    # Fallback if no sections/measures
    if not track.measures:
        header = guitarpro.MeasureHeader()
        header.number = 1
        header.start = 0
        header.timeSignature.numerator = ts_num
        header.timeSignature.denominator.value = ts_den
        song.measureHeaders.append(header)
        measure = guitarpro.Measure(track, header)
        track.measures.append(measure)
        beat = guitarpro.Beat(measure.voices[0])
        beat.duration.value = 1 # whole
        beat.status = guitarpro.BeatStatus.rest
        measure.voices[0].beats.append(beat)

    # Remove the global track lyrics since we now use beat.text and beatTextAsLyrics

    out = io.BytesIO()
    guitarpro.write(song, out)
    return out.getvalue()
