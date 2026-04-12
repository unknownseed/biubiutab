"""
基于 madmom 的和弦识别模块
使用深度学习模型（CNN + CRF）提升准确度
"""

from __future__ import annotations

from typing import Any, Dict, List

from madmom.features.chords import CNNChordFeatureProcessor, CRFChordRecognitionProcessor
from madmom.processors import SequentialProcessor


def detect_chords_madmom(audio_path: str) -> List[Dict[str, float | str]]:
    """
    使用 madmom 识别和弦

    Args:
        audio_path: 音频文件路径

    Returns:
        list of dict: [
            {
                'time': 0.0,        # 和弦开始时间（秒）
                'chord': 'C',       # 和弦名称
                'duration': 2.5     # 持续时间（秒）
            },
            ...
        ]
    """
    print(f"[madmom] 开始处理音频: {audio_path}")

    # 步骤 1: 提取 CNN 特征（madmom 内置模型，fps=10）
    print("[madmom] 提取 CNNChord 特征...")
    feat = CNNChordFeatureProcessor()

    # 步骤 2: CRF 解码（输出 segments: (start, end, label)）
    print("[madmom] 运行 CRFChordRecognition 解码...")
    decode = CRFChordRecognitionProcessor()

    chordrec = SequentialProcessor([feat, decode])
    segments = chordrec(audio_path)

    # 步骤 3: 格式化输出
    print(f"[madmom] 识别到 {len(segments)} 个和弦段落")
    result: List[Dict[str, float | str]] = []

    for seg in segments:
        start = float(seg["start"])
        end = float(seg["end"])
        chord = str(seg["label"])
        duration = max(0.0, end - start)
        result.append(
            {
                "time": start,
                "chord": chord,
                "duration": float(duration),
                "end": end,
            }
        )

    return result


def simplify_chord_name(chord: str) -> str:
    """
    简化 madmom 输出的和弦名称

    madmom 可能输出 'C:maj' 或 'C:min7'
    简化为 'C' 或 'Cm7'
    """
    if ":" not in chord:
        return chord

    root, quality = chord.split(":", 1)

    # 映射表
    quality_map = {
        "maj": "",
        "min": "m",
        "maj7": "maj7",
        "min7": "m7",
        "7": "7",
        "dim": "dim",
        "aug": "aug",
        "sus2": "sus2",
        "sus4": "sus4",
    }

    simplified_quality = quality_map.get(quality, quality)
    return f"{root}{simplified_quality}"


def align_chords_to_beats(
    chords: List[Dict[str, Any]],
    bpm: float,
    time_signature: str = "4/4",
) -> List[List[Dict[str, Any]]]:
    """
    将和弦对齐到音乐小节

    Args:
        chords: detect_chords_madmom 的输出
        bpm: 歌曲速度
        time_signature: 拍号（默认 4/4）

    Returns:
        list: 按小节组织的和弦
    """
    if bpm <= 0:
        raise ValueError("bpm must be > 0")

    beats_per_measure = int(time_signature.split("/")[0])
    beat_duration = 60.0 / float(bpm)
    measure_duration = beat_duration * beats_per_measure

    measures: List[List[Dict[str, Any]]] = []
    current_measure: List[Dict[str, Any]] = []
    current_measure_idx = 0

    for chord in chords:
        chord_time = float(chord["time"])
        measure_idx = int(chord_time / measure_duration)

        # 进入新小节：把当前小节写入 measures，并补齐中间空小节
        if measure_idx != current_measure_idx:
            # 保存当前小节
            if current_measure:
                measures.append(current_measure)
            else:
                measures.append([])

            # 补齐空小节（如果跳过多个小节）
            while len(measures) < measure_idx:
                measures.append([])

            current_measure = []
            current_measure_idx = measure_idx

        simplified_chord = simplify_chord_name(str(chord["chord"]))
        current_measure.append(
            {
                "chord": simplified_chord,
                "time": chord_time,
                "duration": float(chord.get("duration", 0.0)),
            }
        )

    if current_measure:
        measures.append(current_measure)

    return measures


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("用法: python chord_detector_madmom.py <audio_file.mp3>")
        sys.exit(1)

    audio_file = sys.argv[1]

    print(f"\n{'='*50}")
    print("测试 madmom 和弦识别")
    print(f"{'='*50}\n")

    chords = detect_chords_madmom(audio_file)

    print("\n识别结果（前 20 个和弦）：\n")
    for i, chord in enumerate(chords[:20]):
        print(f"{i+1:2d}. {chord['time']:6.2f}s - {str(chord['chord']):8s} (持续 {chord['duration']:.2f}s)")

    print(f"\n总计: {len(chords)} 个和弦段落")
