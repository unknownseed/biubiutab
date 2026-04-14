# Tasks
- [x] Task 1: Setup `pyguitarpro` dependencies
  - [x] SubTask 1.1: Add `pyguitarpro` to `requirements.txt` or equivalent dependencies file in `services/ai`
- [x] Task 2: Implement `gp_generator.py`
  - [x] SubTask 2.1: Create `services/ai/gp_generator.py`
  - [x] SubTask 2.2: Define the `chord_fingering` dictionary mapping chord names to fret arrays
  - [x] SubTask 2.3: Define the `rhythm_library` containing patterns for strumming and arpeggios
  - [x] SubTask 2.4: Implement the `generate_gp5_binary` function to build the `Song` object structure
  - [x] SubTask 2.5: Implement logic to map rhythm patterns to `Beat` and `Note` objects based on the current chord
  - [x] SubTask 2.6: Implement logic to align `lyrics_aligned` data to `Beat.text` annotations
  - [x] SubTask 2.7: Ensure the function returns `io.BytesIO().getvalue()` representing the GP5 binary
- [x] Task 3: Update Backend Pipeline
  - [x] SubTask 3.1: Modify `services/ai/main.py` (or the relevant job processing script) to call `generate_gp5_binary` instead of `sections_to_alphatex`
  - [x] SubTask 3.2: Map the existing analysis outputs (`chords_per_bar`, `lyrics`, etc.) to the parameters required by `generate_gp5_binary`
  - [x] SubTask 3.3: Save the generated GP5 bytes to the results directory (e.g., `result.gp5`) or return them directly via API
- [x] Task 4: Update API Route
  - [x] SubTask 4.1: Ensure the endpoint serving the transcription result returns the raw binary data (or a URL to the binary file) with appropriate Content-Type
- [x] Task 5: Update Frontend Rendering
  - [x] SubTask 5.1: Modify `apps/web/src/components/alphatab-viewer.tsx` to fetch the GP5 binary data as an `ArrayBuffer`
  - [x] SubTask 5.2: Convert the `ArrayBuffer` to `Uint8Array`
  - [x] SubTask 5.3: Call `api.load(uint8Array)` instead of `api.tex(string)` to render the GP5 file

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4