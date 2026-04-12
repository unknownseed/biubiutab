from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


def _pick_device() -> str:
    forced = (os.environ.get("DEMUCS_DEVICE") or "").strip().lower()
    if forced:
        return forced
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def _find_latest_stem_dir(root: Path) -> Path | None:
    """
    Demucs CLI output format is typically:
      <out>/<model>/<track_name>/(vocals.wav, drums.wav, bass.wav, other.wav)
    This helper searches for the newest directory that contains at least one .wav file.
    """
    best: tuple[float, Path] | None = None
    for p in root.rglob("*.wav"):
        try:
            mtime = p.stat().st_mtime
        except Exception:
            continue
        d = p.parent
        if best is None or mtime > best[0]:
            best = (mtime, d)
    return best[1] if best else None


def _sum_wavs(paths: list[Path], out_path: Path) -> None:
    ys: list[np.ndarray] = []
    sr: int | None = None
    for p in paths:
        y, this_sr = sf.read(str(p), dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = np.mean(y, axis=1)
        ys.append(y)
        sr = this_sr if sr is None else sr
        if sr != this_sr:
            raise RuntimeError(f"sample rate mismatch when building no_vocals: {sr} vs {this_sr} for {p}")
    if not ys or sr is None:
        raise RuntimeError("no input stems to sum for no_vocals")
    max_len = max(len(y) for y in ys)
    mix = np.zeros(max_len, dtype=np.float32)
    for y in ys:
        if len(y) < max_len:
            y = np.pad(y, (0, max_len - len(y)))
        mix += y
    # keep safe headroom
    mix = np.clip(mix, -1.0, 1.0)
    sf.write(str(out_path), mix, sr)


def separate_stems(audio_path: str, output_dir: str) -> Dict[str, str]:
    """
    使用 Demucs 做音源分离

    返回：
    {
      "vocals": ".../vocals.wav",
      "drums": ".../drums.wav",
      "bass": ".../bass.wav",
      "other": ".../other.wav",
      "no_vocals": ".../no_vocals.wav"
    }
    """
    in_path = Path(audio_path).expanduser().resolve()
    if not in_path.exists():
        raise FileNotFoundError(f"audio_path not found: {audio_path}")

    out_root = Path(output_dir).expanduser().resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    model = (os.environ.get("DEMUCS_MODEL") or "htdemucs").strip()
    device = _pick_device()
    shifts = int(os.environ.get("DEMUCS_SHIFTS") or "1")
    jobs = int(os.environ.get("DEMUCS_JOBS") or "1")

    logger.info("[demucs] start model=%s device=%s shifts=%s jobs=%s input=%s out=%s", model, device, shifts, jobs, in_path, out_root)

    # Run demucs via its CLI entrypoint in-process for stable behavior.
    try:
        from demucs.separate import main as demucs_main
    except Exception as e:
        raise RuntimeError(f"demucs import failed: {e}") from e

    # We direct output under out_root/demucs to avoid mixing with other artifacts.
    demucs_out = out_root / "demucs"
    demucs_out.mkdir(parents=True, exist_ok=True)

    argv = [
        "-n",
        model,
        "--device",
        device,
        "--shifts",
        str(shifts),
        "-j",
        str(jobs),
        "-o",
        str(demucs_out),
        str(in_path),
    ]

    try:
        demucs_main(argv)
    except SystemExit as e:
        # demucs CLI may call sys.exit; treat non-zero as failure
        code = int(getattr(e, "code", 1) or 0)
        if code != 0:
            raise RuntimeError(f"demucs failed with exit code {code}")
    except Exception as e:
        raise RuntimeError(f"demucs failed: {e}") from e

    stem_dir = _find_latest_stem_dir(demucs_out)
    if not stem_dir:
        raise RuntimeError("demucs finished but no stem wavs were found")

    # Standard demucs file names
    stems: dict[str, Path] = {}
    for name in ("vocals", "drums", "bass", "other"):
        p = stem_dir / f"{name}.wav"
        if p.exists():
            stems[name] = p

    if "vocals" not in stems or "other" not in stems:
        # Some demucs configurations may output different stem sets; keep error clear.
        found = ", ".join(sorted([p.name for p in stem_dir.glob("*.wav")]))
        raise RuntimeError(f"demucs output missing expected stems in {stem_dir}. found=[{found}]")

    # Build no_vocals = drums + bass + other when possible
    no_vocals_path = stem_dir / "no_vocals.wav"
    if not no_vocals_path.exists():
        parts: list[Path] = []
        for k in ("drums", "bass", "other"):
            if k in stems:
                parts.append(stems[k])
        if parts:
            _sum_wavs(parts, no_vocals_path)

    out: dict[str, str] = {k: str(v) for k, v in stems.items()}
    if no_vocals_path.exists():
        out["no_vocals"] = str(no_vocals_path)

    logger.info("[demucs] done stem_dir=%s keys=%s", stem_dir, ",".join(sorted(out.keys())))
    return out

