from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict

import librosa
import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


def compute_percussive_energy(audio_path: str) -> float:
    """
    Step 8A: percussive.wav 能量估计（0~1）。

    目标：为节奏型选择提供一个“是否更适合扫弦/密集节奏”的粗指标。
    该值不追求物理意义精确，追求跨歌曲的相对可用性。
    """
    in_path = Path(audio_path).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"audio_path not found: {audio_path}")

    sr = int(os.environ.get("AUDIO_SR") or "44100")
    y, _sr = librosa.load(str(in_path), sr=sr, mono=True)
    if y.size == 0:
        return 0.0
    if not np.isfinite(y).all():
        y = np.nan_to_num(y)

    # RMS 能量（越大越“有力度”）
    rms = librosa.feature.rms(y=y)[0]
    rms_mean = float(np.mean(rms))

    # Onset strength（越大越“更有打击感/节奏点”）
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_mean = float(np.mean(onset_env)) if onset_env.size else 0.0

    # Normalize to 0..1 by heuristic scales.
    # 经验上：rms_mean 常在 0.01~0.12；onset_mean 常在 0.5~6（跟 hop/谱差相关）
    rms_n = min(1.0, max(0.0, rms_mean / 0.08))
    onset_n = min(1.0, max(0.0, onset_mean / 4.0))

    energy = 0.6 * onset_n + 0.4 * rms_n
    logger.info("[energy] percussive rms=%.4f onset=%.3f -> energy=%.3f (%s)", rms_mean, onset_mean, energy, in_path)
    return float(energy)


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

    sr = int(os.environ.get("AUDIO_SR") or "22050")  # 降低采样率，极大缓解内存和计算压力
    margin = float(os.environ.get("HPSS_MARGIN") or "3.0")
    kernel_size = int(os.environ.get("HPSS_KERNEL_SIZE") or "31")

    logger.info("[hpss] start input=%s sr=%s margin=%s kernel_size=%s", in_path, sr, margin, kernel_size)

    # 限制最多处理前 6 分钟的音频，防止极端长文件导致 OOM 和假死
    y, _sr = librosa.load(str(in_path), sr=sr, mono=True, duration=360.0)
    
    # 替换全局 NaN
    y = np.nan_to_num(y)

    # 执行 STFT 和中值滤波（这里是耗时大户，降低 sr 后速度会提升约 4 倍）
    y_h, y_p = librosa.effects.hpss(y, margin=margin, kernel_size=kernel_size)

    base = in_path.with_suffix("")
    harmonic_path = base.parent / f"{base.name}.harmonic.wav"
    percussive_path = base.parent / f"{base.name}.percussive.wav"

    sf.write(str(harmonic_path), y_h.astype(np.float32), sr)
    sf.write(str(percussive_path), y_p.astype(np.float32), sr)

    logger.info("[hpss] done harmonic=%s percussive=%s", harmonic_path, percussive_path)
    return {"harmonic_path": str(harmonic_path), "percussive_path": str(percussive_path)}
