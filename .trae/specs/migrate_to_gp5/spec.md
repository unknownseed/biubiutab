# Migrate to GP5 Output Spec

## Why
Currently, the system generates AlphaTex (a plain text format) to render guitar tabs in the frontend using AlphaTab. However, AlphaTex lacks robust structural support for complex alignments (like lyrics tied to specific beats) and dynamic rhythm patterns, resulting in poor automatic layout and monotonous accompaniment. Migrating the output format from AlphaTex to standard Guitar Pro 5 (`.gp5`) binary files will leverage AlphaTab's native, high-quality rendering capabilities for `.gp` files, ensuring professional, stable layouts and allowing for structured rhythm pattern generation.

## What Changes
- Create a new Python module `gp_generator.py` to generate `.gp5` binary data using the `pyguitarpro` library.
- Implement a structured rhythm pattern library (e.g., folk strumming, simple strumming, arpeggios) within the generator.
- Implement a chord fingering dictionary to map chord names to specific string/fret combinations.
- Map the audio analysis results (BPM, time signature, chords per bar, beat-aligned lyrics, song structure) into the `pyguitarpro` object model (Song -> Track -> Measure -> Beat -> Note).
- Update the main processing pipeline (`process_audio` or equivalent) to return `.gp5` binary data instead of an AlphaTex string.
- **BREAKING**: Change the backend API response `Content-Type` to `application/octet-stream` (or `application/x-guitar-pro`) and return binary data.
- **BREAKING**: Update the frontend `AlphaTabViewer` component to fetch the binary blob and load it via `api.load(uint8Array)` instead of passing a text string to `api.tex()`.

## Impact
- Affected specs: Audio-to-Tab transcription pipeline, Frontend Score Rendering.
- Affected code: 
  - Backend: `services/ai/main.py`, new file `services/ai/gp_generator.py`
  - Frontend: `apps/web/src/components/alphatab-viewer.tsx`, `apps/web/src/app/api/jobs/route.ts` (or wherever the result is served to the client)

## ADDED Requirements
### Requirement: GP5 Binary Generation
The system SHALL provide a function to generate a `.gp5` binary file from structured musical data.

#### Scenario: Success case
- **WHEN** the audio analysis pipeline completes
- **THEN** the system generates a `.gp5` file containing the correct tempo, time signature, chords, rhythm patterns, and beat-aligned lyrics, and returns it as bytes.

## MODIFIED Requirements
### Requirement: Frontend Score Rendering
The frontend SHALL load and render binary Guitar Pro data instead of AlphaTex text.

## REMOVED Requirements
### Requirement: AlphaTex Formatting
**Reason**: Replaced by GP5 generation for better layout and structure.
**Migration**: The `formatters.py` logic that builds AlphaTex strings will be bypassed or replaced by calls to `gp_generator.py`.