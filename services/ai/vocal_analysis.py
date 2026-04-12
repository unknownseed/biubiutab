from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from melody_detector import NoteEvent

logger = logging.getLogger(__name__)


def _pick_device() -> str:
    forced = (os.environ.get("DEVICE") or os.environ.get("WHISPER_DEVICE") or "").strip().lower()
    if forced:
        return forced
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def transcribe_lyrics(audio_path: str, language: str = "zh") -> Dict[str, Any]:
    """
    使用 faster-whisper 对 vocals stem 做歌词识别

    返回：
    {
      "text": "...",
      "segments": [
        {"start": 0.0, "end": 2.3, "text": "..."}
      ]
    }
    """
    in_path = Path(audio_path).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"audio_path not found: {audio_path}")

    model_name = (os.environ.get("WHISPER_MODEL") or "small").strip()
    device = _pick_device()

    # Reasonable defaults:
    # - CPU: int8 is fast and works without GPU
    # - CUDA: float16 is typical
    compute_type = (os.environ.get("WHISPER_COMPUTE_TYPE") or ("float16" if device == "cuda" else "int8")).strip()

    logger.info("[whisper] start model=%s device=%s compute_type=%s lang=%s input=%s", model_name, device, compute_type, language, in_path)

    try:
        from faster_whisper import WhisperModel
    except Exception as e:
        raise RuntimeError(f"faster-whisper import failed: {e}") from e

    try:
        wm = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments_iter, info = wm.transcribe(str(in_path), language=language or None, vad_filter=True)
        segments: list[dict[str, Any]] = []
        texts: list[str] = []
        for s in segments_iter:
            t = (s.text or "").strip()
            if not t:
                continue
            segments.append({"start": float(s.start), "end": float(s.end), "text": t})
            texts.append(t)
        text = "".join(texts).strip()
        out: dict[str, Any] = {"text": text, "segments": segments, "language": getattr(info, "language", None)}
        logger.info("[whisper] done segments=%s chars=%s", len(segments), len(text))
        return out
    except Exception as e:
        logger.exception("[whisper] failed: %s", e)
        return {"text": "", "segments": [], "language": None, "error": str(e)}


def lyrics_to_beats(segments: List[Dict[str, Any]], beat_times: Any, beats: int) -> List[Optional[str]]:
    """
    Map faster-whisper text segments to the closest beat in a beat grid.
    Distributes words evenly across the beats that fall within the segment.
    Returns a list of length `beats`, where each element is the lyric string or None.
    """
    out: List[Optional[str]] = [None] * beats
    if not segments or beats == 0 or len(beat_times) == 0:
        return out

    for seg in segments:
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start + 2.0))
        text = str(seg.get("text", "")).strip()
        if not text:
            continue

        # Split into words (or characters if Chinese)
        # A simple heuristic: if it contains spaces, split by space; else treat as chars.
        if " " in text:
            words = text.split()
        else:
            words = list(text)

        if not words:
            continue

        # Find all beats within this segment
        seg_beats = []
        for i in range(beats):
            if i >= len(beat_times):
                break
            bt = float(beat_times[i])
            if start - 0.5 <= bt <= end + 0.5:
                seg_beats.append(i)

        if not seg_beats:
            # If no beats found, just map to the closest one
            best_diff = 999.0
            best_i = -1
            for i in range(beats):
                if i >= len(beat_times):
                    break
                diff = abs(float(beat_times[i]) - start)
                if diff < best_diff:
                    best_diff = diff
                    best_i = i
            if best_i >= 0:
                seg_beats = [best_i]

        # Distribute words across the found beats
        if seg_beats:
            step = max(1, len(seg_beats) / len(words))
            for idx, word in enumerate(words):
                beat_idx = seg_beats[min(len(seg_beats) - 1, int(idx * step))]
                if out[beat_idx]:
                    out[beat_idx] = str(out[beat_idx]) + " " + word
                else:
                    out[beat_idx] = word

    return out


def extract_vocal_melody(audio_path: str) -> Dict[str, Any]:
    """
    对 vocals stem 提取 melody
    第一版先使用 Basic Pitch

    返回：
    {
      "note_events": [...],
      "midi_path": "..."
    }
    """
    in_path = Path(audio_path).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"audio_path not found: {audio_path}")

    logger.info("[vocal_melody] start basic_pitch input=%s", in_path)
    try:
        from basic_pitch.inference import predict
    except Exception as e:
        raise RuntimeError(f"basic-pitch import failed: {e}") from e

    # Keep default parameters aligned with melody_detector.detect_melody
    _, midi_data, _ = predict(
        str(in_path),
        minimum_frequency=70.0,
        maximum_frequency=1500.0,
        minimum_note_length=80.0,
    )

    note_events: List[NoteEvent] = []
    for inst in midi_data.instruments:
        for n in inst.notes:
            note_events.append(
                NoteEvent(
                    start_sec=float(n.start),
                    end_sec=float(n.end),
                    pitch=int(n.pitch),
                    velocity=int(getattr(n, "velocity", 0)),
                )
            )

    midi_path = in_path.with_suffix("")
    midi_path = midi_path.parent / f"{midi_path.name}.vocal_melody.mid"
    try:
        midi_data.write(str(midi_path))
    except Exception:
        midi_path = None  # type: ignore[assignment]

    logger.info("[vocal_melody] done notes=%s midi=%s", len(note_events), midi_path)
    return {"note_events": [e.__dict__ for e in note_events], "midi_path": str(midi_path) if midi_path else None}

