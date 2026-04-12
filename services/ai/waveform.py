from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List

import librosa
import numpy as np

logger = logging.getLogger(__name__)


def compute_waveform_peaks(audio_path: str, *, points: int = 2000) -> Dict[str, Any]:
    """
    Compute downsampled waveform peaks for fast UI rendering.

    Returns:
      {
        "source_path": "...",
        "sr": 11025,
        "duration_sec": 123.4,
        "peaks": [0..1 floats, length=points]
      }
    """
    in_path = Path(audio_path).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"audio_path not found: {audio_path}")

    # Low SR is enough for peaks + performance.
    sr = int(os.environ.get("WAVEFORM_SR") or "11025")
    pts = max(200, min(20000, int(points)))

    y, _sr = librosa.load(str(in_path), sr=sr, mono=True)
    if y.size == 0:
        return {"source_path": str(in_path), "sr": sr, "duration_sec": 0.0, "peaks": [0.0] * pts}
    if not np.isfinite(y).all():
        y = np.nan_to_num(y)

    duration_sec = float(librosa.get_duration(y=y, sr=sr))
    a = np.abs(y).astype(np.float32)

    # Chunk into pts windows and take max peak per window.
    n = a.shape[0]
    step = max(1, int(np.ceil(n / float(pts))))
    peaks: list[float] = []
    for i in range(0, n, step):
        peaks.append(float(np.max(a[i : i + step])))
        if len(peaks) >= pts:
            break
    if len(peaks) < pts:
        peaks.extend([0.0] * (pts - len(peaks)))

    mx = max(peaks) if peaks else 0.0
    if mx > 1e-6:
        peaks = [min(1.0, p / mx) for p in peaks]

    logger.info("[waveform] peaks points=%s sr=%s dur=%.2fs src=%s", pts, sr, duration_sec, in_path)
    return {"source_path": str(in_path), "sr": sr, "duration_sec": duration_sec, "peaks": peaks}

