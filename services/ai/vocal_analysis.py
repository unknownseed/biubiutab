from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List

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
        # soft-fail: keep pipeline running
        return {"text": "", "segments": [], "error": str(e)}


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

