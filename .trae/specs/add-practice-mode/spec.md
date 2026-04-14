# Practice Mode (跟练模式) Spec

## Why
Users need a way to practice playing songs interactively, similar to Chordify, while maintaining the advantages of precise lyrics alignment and full tab view. This mode will provide a horizontal scrolling chord timeline and karaoke-style synced lyrics to assist with real-time practice.

## What Changes
- Add `generate_practice_data` in `services/ai/formatters.py` to convert backend analysis into a `practiceData` object.
- Modify `JobResult` in `services/ai/main.py` to include `practiceData`.
- Add a tab switcher in the frontend editor (`apps/web/src/components/editor-client.tsx`) to toggle between "Full Score" and "Practice Mode".
- Create `PracticeMode.tsx` to handle the new view, playback state, and synchronization with AlphaTab.
- Create `ChordTimeline.tsx` to display the scrolling chord blocks with dynamic highlighting.
- Create `SyncedLyrics.tsx` to display word-level karaoke lyrics.
- Create `LargeChordDiagram.tsx` to show the current chord fingering dynamically.
- Create `PlaybackControls.tsx` for play/pause, tempo, loop, and progress control.
- Implement time synchronization using AlphaTab's `playerPositionChanged` event and `timePosition` setter.
- Add CSS animations for chord highlighting in `globals.css`.

## Impact
- Affected specs: Practice and playback capabilities.
- Affected code: `services/ai/main.py`, `services/ai/formatters.py`, `apps/web/src/components/editor-client.tsx`, and new UI components.

## ADDED Requirements
### Requirement: Practice Mode View
The system SHALL provide a secondary tab in the editor for "Practice Mode" containing a chord timeline, large chord diagrams, and synced lyrics.

#### Scenario: Success case
- **WHEN** user switches to "Practice Mode" tab and plays the song
- **THEN** the chord timeline scrolls and highlights the active chord, lyrics highlight the active word, and the chord diagram updates based on the current time.

### Requirement: Backend Practice Data
The system SHALL generate and return a `practiceData` object containing `metadata`, `chordBlocks`, and `lyrics` word-level timestamps.
