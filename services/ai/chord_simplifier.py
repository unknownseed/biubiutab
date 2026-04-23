import re

def simplify_chord(chord: str, force_triads: bool = False) -> str:
    """
    Simplifies chords.
    If force_triads=True (for beginner modes):
      - Strips all 7ths, maj7s, m7s, sus, etc. down to pure Major/Minor triads.
    Otherwise (for advanced/original mode):
      - Removes 'addX' (e.g. add9, add11)
      - Maps 'aug' to major, 'dim' to minor
      - Keeps 7ths, maj7, m7, sus2, sus4
    """
    if not chord or chord == "N":
        return "N"
        
    parts = chord.split('/')
    base = parts[0]
    bass = f"/{parts[1]}" if len(parts) > 1 else ""
    
    # 1. Remove 'add' variations
    base = re.sub(r'\(?add\d+\)?', '', base)
    
    # 2. Handle 'dim' and 'dim7'
    if 'dim' in base:
        if '7' in base:
            base = base.replace('dim7', 'm7').replace('dim', 'm')
        else:
            base = base.replace('dim', 'm')
            
    # 3. Handle 'aug'
    if 'aug' in base:
        base = base.replace('aug', '')
        
    # 4. Handle half-diminished 'm7b5' or 'hdim'
    if 'm7b5' in base or 'hdim' in base:
        base = base.replace('m7b5', 'm7').replace('hdim', 'm7')
        
    # 5. Handle minor-major 7th 'mM7' or 'minmaj7'
    if 'mM7' in base or 'minmaj7' in base:
        base = base.replace('mM7', 'm').replace('minmaj7', 'm')

    # 6. Simplify extended chords (6, 9, 11, 13) down to 7ths or triads
    base = re.sub(r'maj(9|11|13)', 'maj7', base)
    base = re.sub(r'm(9|11|13)', 'm7', base)
    base = re.sub(r'(?<!m)(?<!maj)(9|11|13)', '7', base) # X9 -> X7
    
    # Handling 6th chords: X6 -> X, Xm6 -> Xm
    base = re.sub(r'm6', 'm', base)
    base = re.sub(r'6', '', base)
    
    # Clean up empty brackets if any
    base = base.replace('()', '')
    
    # 7. For beginner modes: ruthlessly strip all 7ths, sus, maj7, m7 to pure Major/Minor triads
    if force_triads:
        # e.g., Cmaj7 -> C, Cm7 -> Cm, G7 -> G, Asus4 -> A
        base = re.sub(r'maj7|maj', '', base)
        base = re.sub(r'm7', 'm', base)
        base = re.sub(r'sus2|sus4|sus', '', base)
        base = re.sub(r'7', '', base)
        
        # If the bass note is no longer useful or confusing for a pure triad,
        # we can strip the slash chord entirely, or keep it. Let's keep it but simplify the base.
        # Actually, for absolute beginners, slash chords (e.g. D/F#) are hard.
        # We can drop the bass note to force pure root chords.
        bass = ""
    
    return f"{base}{bass}"

