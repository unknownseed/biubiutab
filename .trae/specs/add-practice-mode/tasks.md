# Tasks
- [x] Task 1: Implement backend `generate_practice_data` and integrate into `JobResult`
  - [x] Update `JobResult` model in `services/ai/main.py` with `practiceData: Optional[dict] = None`
  - [x] Implement `generate_practice_data` in `services/ai/formatters.py` mapping `beat_grid`, `chords`, and `aligned_lyrics` into `practiceData`
  - [x] Pass `practiceData` when instantiating `JobResult` in `services/ai/main.py`
- [x] Task 2: Implement frontend `JobResult` schema update and Tab switcher
  - [x] Update `JobResult` TypeScript interface in `apps/web/src/components/editor-client.tsx`
  - [x] Add `viewMode` state to toggle between `full` and `practice` mode in `editor-client.tsx`
- [x] Task 3: Create `ChordTimeline.tsx` and animations
  - [x] Add `chordGlowPulse` keyframes and `.chord-glow-pulse` to `apps/web/src/app/globals.css`
  - [x] Create `apps/web/src/components/ChordTimeline.tsx` with the provided template
- [x] Task 4: Create Practice Mode Sub-Components
  - [x] Create `apps/web/src/components/SyncedLyrics.tsx`
  - [x] Create `apps/web/src/components/LargeChordDiagram.tsx`
  - [x] Create `apps/web/src/components/PlaybackControls.tsx`
- [x] Task 5: Create `PracticeMode.tsx` container
  - [x] Assemble `ChordTimeline`, `SyncedLyrics`, `LargeChordDiagram`, and `PlaybackControls`
  - [x] Hook up AlphaTab player events (`playerPositionChanged`) to `currentTime` state
  - [x] Expose `onSeek` correctly via AlphaTab `timePosition` property

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 5] depends on [Task 3]
- [Task 5] depends on [Task 4]
