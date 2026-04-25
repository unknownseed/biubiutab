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


def transcribe_lyrics(audio_path: str, language: str = "zh", song_title: Optional[str] = None) -> Dict[str, Any]:
    """
    使用 faster-whisper 对 vocals stem 做歌词识别，并接入 DeepSeek 歌词校验（Four-Pass）

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
        import stable_whisper
    except Exception as e:
        raise RuntimeError(f"stable_whisper import failed: {e}") from e

    try:
        # 使用 stable-ts 包装 faster-whisper，获得极致的时间戳准确度
        # load_faster_whisper 的参数与 faster_whisper 相同
        wm = stable_whisper.load_faster_whisper(model_name, device=device, compute_type=compute_type)
        
        # stable-ts 的 transcribe 返回的是一个定制的 WhisperResult 对象
        # 它已经内部做了大量的 VAD 和 DTW 对齐优化
        result = wm.transcribe(str(in_path), language=language or None, vad_filter=True, word_timestamps=True)
        
        segments: list[dict[str, Any]] = []
        texts: list[str] = []
        all_whisper_words = []
        
        # result.segments 是 stable-ts 的 Segment 列表
        for s in result.segments:
            t = (s.text or "").strip()
            if not t:
                continue
                
            segments.append({"start": float(s.start), "end": float(s.end), "text": t})
            texts.append(t)
            
            # 收集 stable-ts 优化过的逐字时间戳
            if getattr(s, "words", None):
                for w in s.words:
                    word_text = w.word.strip()
                    if word_text:
                        all_whisper_words.append({
                            "word": word_text,
                            "start": float(w.start),
                            "end": float(w.end)
                        })

        raw_text = "".join(texts).strip()
        logger.info("[whisper] transcription done, segments=%s chars=%s", len(segments), len(raw_text))

        # ─── 接入 DeepSeek 歌词校验流程 ───
        try:
            logger.info("[lyric_verifier] 准备引入 DeepSeek API 进行二次校验")
            from lyric_verifier import verify_lyrics, align_text_to_word_timestamps
            
            # 调用 DeepSeek 进行检索/纠错
            verify_result = verify_lyrics(raw_text, song_title=song_title)
            verified_text = verify_result.get("verified_lyrics", raw_text)
            
            # 将修正后的歌词强制对齐回 Whisper 提供的字级时间戳
            if verify_result.get("has_changes", False):
                raw_text = verified_text
                
                if all_whisper_words:
                    aligned_words = align_text_to_word_timestamps(verified_text, all_whisper_words)
                    
                    # 我们直接将每一个字作为一个独立的 segment 返回
                    new_segments = []
                    for aw in aligned_words:
                        word = aw["word"].strip()
                        if word and word not in "\n\t":
                            new_segments.append({
                                "start": aw["start"],
                                "end": aw["end"],
                                "text": word
                            })
                            
                    segments = new_segments
            else:
                # 如果没有经过修改（比如原词完美，或者匹配失败降级），也要保证单字拆分给前端
                if all_whisper_words:
                    new_segments = []
                    for w in all_whisper_words:
                        word = w["word"].strip()
                        if word and word not in "\n\t":
                            new_segments.append({
                                "start": w["start"],
                                "end": w["end"],
                                "text": word
                            })
                    segments = new_segments
                
        except Exception as e:
            logger.exception("[lyric_verifier] DeepSeek verification pipeline failed: %s", e)

        out: dict[str, Any] = {"text": raw_text, "segments": segments, "language": getattr(result, "language", None)}
        return out
    except Exception as e:
        logger.exception("[whisper] failed: %s", e)
        return {"text": "", "segments": [], "language": None, "error": str(e)}


def lyrics_to_beats(segments: List[Dict[str, Any]], beat_times: Any, beats: int) -> List[Optional[str]]:
    """
    Map faster-whisper text segments to the closest beat in a beat grid.
    Returns a list of length `beats`, where each element is the lyric string or None.
    """
    out: List[Optional[str]] = [None] * beats
    if not segments or beats == 0 or len(beat_times) == 0:
        return out

    for seg in segments:
        start = float(seg.get("start", 0.0))
        text = str(seg.get("text", "")).strip()
        if not text:
            continue

        # Find the absolute closest beat to the start time of this word
        best_diff = 9999.0
        best_i = -1
        for i in range(beats):
            if i >= len(beat_times):
                break
            diff = abs(float(beat_times[i]) - start)
            if diff < best_diff:
                best_diff = diff
                best_i = i

        if best_i >= 0:
            if out[best_i]:
                # If there's already a word on this beat, append it
                # Add space if both are English/alphanumeric
                prev_text = str(out[best_i])
                if prev_text and prev_text[-1].isalnum() and text and text[0].isalnum():
                    out[best_i] = prev_text + " " + text
                else:
                    out[best_i] = prev_text + text
            else:
                out[best_i] = text

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

