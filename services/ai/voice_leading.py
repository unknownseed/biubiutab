# Add simple voice leading for common bass lines
def apply_voice_leading(chords: list[str]) -> list[str]:
    out = []
    n = len(chords)
    for i in range(n):
        c = chords[i]
        
        # Look ahead and behind
        prev_c = chords[i-1] if i > 0 else None
        next_c = chords[i+1] if i < n - 1 else None
        
        # Very simple rules for common walk-downs:
        # C -> G -> Am => C -> G/B -> Am
        # Am -> G -> F => Am -> Am/G -> F
        # F -> C -> Dm => F -> C/E -> Dm
        # G -> D -> Em => G -> D/F# -> Em
        
        if c == "G" and prev_c == "C" and next_c == "Am":
            out.append("G/B")
        elif c == "G" and prev_c == "Am" and next_c == "F":
            out.append("G") # could be C/G, but G is fine. Actually Am -> Am/G -> F is common.
            # wait, if c is G, it's already a walkdown.
        elif c == "C" and prev_c == "F" and next_c == "Dm":
            out.append("C/E")
        elif c == "D" and prev_c == "G" and next_c == "Em":
            out.append("D/F#")
        elif c == "D" and prev_c == "Em" and next_c == "C":
            out.append("D") # or D/F#? Usually Em -> D/F# -> G.
        else:
            out.append(c)
            
    return out
