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

try:
    from .pattern_engine import load_library, find_best_pattern, transplant_pattern
except ImportError:
    from pattern_engine import load_library, find_best_pattern, transplant_pattern

# Initialize pattern library
load_library()


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
    intro_bars: dict = None,
) -> bytes:
    song = guitarpro.Song()
    song.tracks.clear()
    song.measureHeaders.clear()
    song.title = _gp_safe_text(title) or "score"
    song.tempo = max(40, min(240, int(tempo)))

    track = guitarpro.Track(song)
    track.name = _gp_safe_text("Acoustic Guitar") or "Guitar"
    track.channel.instrument = 25  # Standard Acoustic Guitar (steel)
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

    # ── Step 1: Prepare chord sequence and find best pattern ────────────────
    chords_seq = []
    for s in sections:
        for c in s.chords:
            chords_seq.append({
                "chord": c.chord,
                "duration_beats": ts_num  # assume each chord spans ts_num beats (1 bar)
            })

    energy = rhythm_energy if rhythm_energy is not None else 0.5
    template_id = find_best_pattern(bpm=tempo, section_energy=energy)

    if template_id and chords_seq:
        # ── Step 2: Transplant pattern ──────────────────────────────────────
        result = transplant_pattern(template_id, chords_seq)

        # ── Step 3: Build GP5 from beats ────────────────────────────────────
        song_obj = _build_gp5_from_beats(
            rhythm_beats=result["rhythm_beats"],
            lead_beats=result["lead_beats"],
            is_dual=result["is_dual"],
            bpm=tempo,
            title=title,
            ts_num=ts_num,
            ts_den=ts_den
        )
        out = io.BytesIO()
        guitarpro.write(song_obj, out)
        return out.getvalue()

    # ── Step 4: Fallback to simple generator ────────────────────────────────
    return _build_gp5_simple_binary(
        title=title, tempo=tempo, ts_num=ts_num, ts_den=ts_den, key=key, 
        sections=sections, lyrics_beats=lyrics_beats, rhythm_energy=rhythm_energy, song=song, track=track, intro_bars=intro_bars
    )

def _build_gp5_from_beats(rhythm_beats, lead_beats, is_dual, bpm, title, ts_num, ts_den):
    song = guitarpro.Song()
    song.title = _gp_safe_text(title) or "score"
    song.tempo = max(40, min(240, int(bpm)))

    # 复用 guitarpro.Song() 默认创建的第一个轨道
    rhythm_track = song.tracks[0]
    rhythm_track.name = "Rhythm Guitar"
    rhythm_track.channel.instrument = 25
    rhythm_track.strings = [
        guitarpro.GuitarString(1, 64), guitarpro.GuitarString(2, 59),
        guitarpro.GuitarString(3, 55), guitarpro.GuitarString(4, 50),
        guitarpro.GuitarString(5, 45), guitarpro.GuitarString(6, 40)
    ]
    
    tracks_to_fill = [(rhythm_track, rhythm_beats, True)]

    if is_dual and lead_beats:
        lead_track = guitarpro.Track(song)
        lead_track.name = "Lead Guitar"
        lead_track.channel.instrument = 27
        lead_track.strings = [
            guitarpro.GuitarString(1, 64), guitarpro.GuitarString(2, 59),
            guitarpro.GuitarString(3, 55), guitarpro.GuitarString(4, 50),
            guitarpro.GuitarString(5, 45), guitarpro.GuitarString(6, 40)
        ]
        song.tracks.append(lead_track)
        tracks_to_fill.append((lead_track, lead_beats, False))

    for track, beats, show_chords in tracks_to_fill:
        _fill_track_measures(song, track, beats, ts_num, ts_den, show_chords)

    # 确保所有轨道的小节数对齐，并且每个小节至少有一个休止符（防止 AlphaTab 崩溃）
    for track in song.tracks:
        while len(track.measures) < len(song.measureHeaders):
            idx = len(track.measures)
            header = song.measureHeaders[idx]
            measure = guitarpro.Measure(track, header)
            track.measures.append(measure)

        for m in track.measures:
            v = m.voices[0]
            if len(v.beats) == 0:
                # 使用贪心算法填补休止符，直到补齐 ticks_per_measure
                ticks_per_measure = int(960 * 4 * ts_num / ts_den)
                remaining_ticks = ticks_per_measure
                current_start = m.header.start
                
                while remaining_ticks > 0:
                    for allowed_duration in [1, 2, 4, 8, 16, 32, 64]:
                        allowed_ticks = int(960 * 4 / allowed_duration)
                        if allowed_ticks <= remaining_ticks:
                            gp_beat = guitarpro.Beat(v)
                            gp_beat.start = current_start
                            gp_beat.duration.value = allowed_duration
                            gp_beat.status = guitarpro.BeatStatus.rest
                            v.beats.append(gp_beat)
                            
                            remaining_ticks -= allowed_ticks
                            current_start += allowed_ticks
                            break

    return song

def _fill_track_measures(song, track, beats, ts_num, ts_den, show_chords):
    ticks_per_measure = int(960 * 4 * ts_num / ts_den)
    
    measure_idx = 0
    current_measure = _get_or_create_measure(song, track, measure_idx, ts_num, ts_den)
    current_voice = current_measure.voices[0]
    
    current_start = current_measure.header.start
    measure_start_tick = current_start

    for beat_data in beats:
        duration_value = beat_data.get("duration", 8)
        beat_ticks = int(960 * 4 / duration_value)

        # 检查是否跨小节
        if (current_start - measure_start_tick) >= ticks_per_measure:
            measure_idx += 1
            current_measure = _get_or_create_measure(song, track, measure_idx, ts_num, ts_den)
            current_voice = current_measure.voices[0]
            measure_start_tick = current_measure.header.start
            current_start = measure_start_tick

        gp_beat = guitarpro.Beat(current_voice)
        gp_beat.start = current_start
        gp_beat.duration.value = duration_value

        if show_chords:
            chord_name = beat_data.get("chord_name")
            if chord_name:
                _add_chord_to_beat(gp_beat, chord_name)

        notes_added = 0
        for note_data in beat_data.get("notes", []):
            string_val = note_data.get("string", 0)
            fret_val = note_data.get("fret", -1)
            if 1 <= string_val <= 6 and fret_val >= 0:
                note = guitarpro.Note(gp_beat)
                note.string = string_val
                note.value = fret_val
                # 统一 velocity，防止 AlphaTab 渲染大量 f, mf 动态符号
                note.velocity = 95
                note.type = guitarpro.NoteType.normal
                gp_beat.notes.append(note)
                notes_added += 1

        if notes_added == 0:
            gp_beat.status = guitarpro.BeatStatus.rest
        else:
            gp_beat.status = guitarpro.BeatStatus.normal

        current_voice.beats.append(gp_beat)
        current_start += beat_ticks

    # 检查最后一小节是否未填满
    remaining_ticks_in_last_measure = ticks_per_measure - (current_start - measure_start_tick)
    if remaining_ticks_in_last_measure > 0 and remaining_ticks_in_last_measure < ticks_per_measure:
        # 使用贪心算法填补休止符，直到补齐 ticks_per_measure
        while remaining_ticks_in_last_measure > 0:
            for allowed_duration in [1, 2, 4, 8, 16, 32, 64]:
                allowed_ticks = int(960 * 4 / allowed_duration)
                if allowed_ticks <= remaining_ticks_in_last_measure:
                    gp_beat = guitarpro.Beat(current_voice)
                    gp_beat.start = current_start
                    gp_beat.duration.value = allowed_duration
                    gp_beat.status = guitarpro.BeatStatus.rest
                    current_voice.beats.append(gp_beat)
                    
                    remaining_ticks_in_last_measure -= allowed_ticks
                    current_start += allowed_ticks
                    break

def _add_chord_to_beat(beat, chord_name):
    from chord_shapes import chord_shape_for_label
    shape = chord_shape_for_label(chord_name)
    if shape:
        gp_chord = guitarpro.Chord(length=6)
        gp_chord.name = chord_name
        frets = shape.frets_high_to_low
        
        min_fret = 99
        for f in frets:
            if f is not None and str(f).lower() != "x" and int(f) > 0:
                min_fret = min(min_fret, int(f))
        if min_fret == 99:
            min_fret = 1
            
        gp_chord.firstFret = min_fret if min_fret > 4 else 1
        
        gp_chord_strings = [-1] * 6
        for string_idx, fret_str in enumerate(frets):
            if string_idx < 6:
                if fret_str is not None and str(fret_str).lower() != "x":
                    gp_chord_strings[string_idx] = int(fret_str)
                else:
                    gp_chord_strings[string_idx] = -1
        gp_chord.strings = gp_chord_strings
        beat.effect.chord = gp_chord

def _get_or_create_measure(song, track, idx, ts_num, ts_den):
    while len(track.measures) <= idx:
        # 如果 song.measureHeaders 里还没有这个 header，则创建
        if len(song.measureHeaders) <= idx:
            header = guitarpro.MeasureHeader()
            header.number = len(song.measureHeaders) + 1
            header.start = 0 if len(song.measureHeaders) == 0 else song.measureHeaders[-1].start + int(960 * 4 * ts_num / ts_den)
            header.timeSignature.numerator = ts_num
            header.timeSignature.denominator.value = ts_den
            song.measureHeaders.append(header)
        else:
            header = song.measureHeaders[idx]
            
        measure = guitarpro.Measure(track, header)
        track.measures.append(measure)
    return track.measures[idx]

def _build_gp5_simple_binary(title, tempo, ts_num, ts_den, key, sections, lyrics_beats, rhythm_energy, song, track, intro_bars=None):
    
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
            
            beat_start_tick = current_start
            
            for t in pattern.tokens:
                beat = guitarpro.Beat(voice)
                beat.start = beat_start_tick
                
                beat_ticks = 960
                if t.duration == 4: 
                    beat.duration.value = 4
                    beat_ticks = 960
                elif t.duration == 8: 
                    beat.duration.value = 8
                    beat_ticks = 480
                elif t.duration == 16: 
                    beat.duration.value = 16
                    beat_ticks = 240
                elif t.duration == 2: 
                    beat.duration.value = 2
                    beat_ticks = 1920
                elif t.duration == 1: 
                    beat.duration.value = 1
                    beat_ticks = 3840
                else: 
                    beat.duration.value = 4
                    beat_ticks = 960
                
                # Force beaming by quarter-note groups (960 ticks)
                if t.duration in (8, 16, 32):
                    tick_in_measure = beat_start_tick - current_start
                    if tick_in_measure % 960 == 0:
                        beat.display.breakBeam = True
                    else:
                        beat.display.forceBeam = True

                beat_start_tick += beat_ticks

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
