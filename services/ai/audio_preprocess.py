from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict

import librosa
import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


def extract_harmonic_percussive(audio_path: str) -> Dict[str, str]:
    """
    使用 librosa.effects.hpss 提取 harmonic / percussive 部分

    返回：
    {
      "harmonic_path": "...",
      "percussive_path": "..."
    }
    """
    in_path = Path(audio_path).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"audio_path not found: {audio_path}")

    sr = int(os.environ.get("AUDIO_SR") or "44100")
    margin = float(os.environ.get("HPSS_MARGIN") or "3.0")
    kernel_size = int(os.environ.get("HPSS_KERNEL_SIZE") or "31")

    logger.info("[hpss] start input=%s sr=%s margin=%s kernel_size=%s", in_path, sr, margin, kernel_size)

    y, _sr = librosa.load(str(in_path), sr=sr, mono=True)
    if not np.isfinite(y).all():
        y = np.nan_to_num(y)

    y_h, y_p = librosa.effects.hpss(y, margin=margin, kernel_size=kernel_size)

    base = in_path.with_suffix("")
    harmonic_path = base.parent / f"{base.name}.harmonic.wav"
    percussive_path = base.parent / f"{base.name}.percussive.wav"

    sf.write(str(harmonic_path), y_h.astype(np.float32), sr)
    sf.write(str(percussive_path), y_p.astype(np.float32), sr)

    logger.info("[hpss] done harmonic=%s percussive=%s", harmonic_path, percussive_path)
    return {"harmonic_path": str(harmonic_path), "percussive_path": str(percussive_path)}

