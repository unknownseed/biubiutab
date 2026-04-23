import asyncio
import os
import shutil
import sys
import io
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional
import json

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from audio_preprocess import compute_percussive_energy, extract_harmonic_percussive
from voice_leading import apply_voice_leading
from chord_detector import analyze_audio_multi
from formatters import ChordAt, SectionOut, build_display_sections_and_arrangement, generate_practice_data
from gp_generator import generate_gp5_binary
from intro_transcriber import build_intro_bar_overrides
from melody_tab import (
    align_melody_to_lyrics,
    build_vocal_melody_track_alphatex,
    convert_aligned_melody_to_tab_bars,
)
from melody_detector import detect_melody, make_beat_grid, melody_to_jianpu
from section_detector import detect_sections
from source_separation import separate_stems
from vocal_analysis import extract_vocal_melody, lyrics_to_beats, transcribe_lyrics
from waveform import compute_waveform_peaks


def _force_utf8_io() -> None:
    try:
        for name in ("stdout", "stderr"):
            s = getattr(sys, name, None)
            if s is None:
                continue
            if hasattr(s, "reconfigure"):
                s.reconfigure(encoding="utf-8", errors="backslashreplace")
                continue
            buf = getattr(s, "buffer", None)
            if buf is None:
                continue
            wrapped = io.TextIOWrapper(buf, encoding="utf-8", errors="backslashreplace", line_buffering=True)
            setattr(sys, name, wrapped)
    except Exception:
        pass


_force_utf8_io()


class CreateJobRequest(BaseModel):
    audio_path: str = Field(min_length=1)
    title: Optional[str] = None


JobStatus = Literal["queued", "processing", "succeeded", "failed"]


class JobResponse(BaseModel):
    id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: Optional[str] = None
    error: Optional[str] = None
    preview: Optional[dict] = None


class ChordModel(BaseModel):
    chord: str
    bar: int = Field(ge=0)
    beat: int = Field(ge=1)


class SectionModel(BaseModel):
    name: str
    start_bar: int = Field(ge=0)
    end_bar: int = Field(ge=0)
    chords: list[ChordModel]


class JobResult(BaseModel):
    title: str
    artist: Optional[str] = None
    key: str
    tempo: int = Field(ge=1)
    time_signature: str
    sections: list[SectionModel]
    arrangement: str
    alphatex: Optional[str] = None
    stems: Optional[dict] = None
    vocal_melody: Optional[dict] = None
    lyrics: Optional[dict] = None
    metadata: Optional[dict] = None
    practiceData: Optional[dict] = None


@dataclass
class JobState:
    id: str
    status: JobStatus
    progress: int
    message: Optional[str]
    error: Optional[str]
    audio_path: Path
    title: str
    result: Optional[JobResult]
    preview: Optional[dict]


def _clean_title(title: str) -> str:
    """
    Normalize user-facing title.
    - Remove common audio file extensions (.mp3/.wav).
    """
    t = (title or "").strip()
    if not t:
        return t
    base, ext = os.path.splitext(t)
    if ext.lower() in {".mp3", ".wav"} and base.strip():
        return base.strip()
    return t


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _storage_dir() -> Path:
    configured = os.environ.get("AI_STORAGE_DIR")
    if configured:
        return Path(configured)
    return _repo_root() / "storage" / "ai"


def _storage_root() -> Path:
    """
    Storage root for artifacts matching the required layout:
      storage/uploads/{job_id}.mp3
      storage/stems/{job_id}/...
      storage/temp/{job_id}/...
      storage/results/{job_id}/...
    """
    return _repo_root() / "storage"


def _truthy(v: str) -> bool:
    return (v or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def _cleanup_expired(storage_root: Path) -> None:
    """
    Best-effort cleanup (non-blocking).
    - uploads/ + stems/: 24h
    - results/: 7d
    - temp/: immediate delete handled by TemporaryDirectory
    """
    if not _truthy(os.environ.get("ENABLE_STORAGE_CLEANUP", "1")):
        return
    now = time.time()
    ttl_uploads = 24 * 3600
    ttl_stems = 24 * 3600
    ttl_results = 7 * 24 * 3600

    def _rm_path(p: Path) -> None:
        try:
            if p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
            else:
                p.unlink(missing_ok=True)
        except Exception:
            pass

    # uploads
    up = storage_root / "uploads"
    if up.exists():
        for p in up.iterdir():
            try:
                if now - p.stat().st_mtime > ttl_uploads:
                    _rm_path(p)
            except Exception:
                continue

    # stems + results are job directories
    st = storage_root / "stems"
    if st.exists():
        for p in st.iterdir():
            try:
                if now - p.stat().st_mtime > ttl_stems:
                    _rm_path(p)
            except Exception:
                continue

    rs = storage_root / "results"
    if rs.exists():
        for p in rs.iterdir():
            try:
                if now - p.stat().st_mtime > ttl_results:
                    _rm_path(p)
            except Exception:
                continue


app = FastAPI(title="Biubiutab - AI Service")
_jobs: dict[str, JobState] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _job_to_response(job: JobState) -> JobResponse:
    return JobResponse(
        id=job.id,
        status=job.status,
        progress=job.progress,
        message=job.message,
        error=job.error,
        preview=job.preview,
    )


async def _run_job(job_id: str) -> None:
    job = _jobs.get(job_id)
    if not job:
        return

    job.status = "processing"
    job.progress = 1
    job.message = "正在感受这首歌曲的呼吸..."
    job.preview = {"step": "loading"}

    try:
        title = _clean_title(job.title or job.audio_path.name)

        # Align with required storage layout under repoRoot/storage/
        storage_root = _storage_root()
        uploads_dir = storage_root / "uploads"
        stems_dir = storage_root / "stems" / job.id
        results_dir = storage_root / "results" / job.id
        temp_base = storage_root / "temp"
        for d in (uploads_dir, stems_dir, results_dir, temp_base):
            d.mkdir(parents=True, exist_ok=True)

        _cleanup_expired(storage_root)

        # Copy original audio to storage/uploads/{job_id}.ext for retention/debug.
        ext = job.audio_path.suffix.lower() or ".wav"
        upload_copy = uploads_dir / f"{job.id}{ext}"
        try:
            shutil.copy2(job.audio_path, upload_copy)
        except Exception:
            upload_copy = job.audio_path

        job.progress = 10
        job.message = "正在小心翼翼地剥离人声的轨迹..."
        job.preview = {"step": "demucs"}

        t0 = time.time()
        stems_tmp: dict[str, str] = {}
        hpss_tmp: dict[str, str] = {}
        rhythm_energy: float | None = None
        lyrics: dict | None = None
        vocal_melody: dict | None = None
        stems_out: dict[str, str] | None = None
        visualization: dict | None = None

        with tempfile.TemporaryDirectory(prefix=f"{job.id}_", dir=str(temp_base)) as tmp_dir:
            try:
                stems_tmp = await asyncio.to_thread(separate_stems, str(upload_copy), tmp_dir)
            except Exception as e:
                # Soft fallback: proceed with mix audio.
                stems_tmp = {}
                job.message = f"人声剥离失败（退回混合原声）：{e}"

            job.progress = 25
            job.message = "正在寻找和弦的色彩与心跳的节拍..."
            job.preview = {"step": "hpss"}

            # Choose accompaniment stem for HPSS and chord detection
            # 6-stems mode provides 'accompaniment' (bass+guitar+piano+other)
            # which is perfect for chord detection as it excludes vocals and drums.
            acc_path = stems_tmp.get("accompaniment") or stems_tmp.get("no_vocals") or stems_tmp.get("other") or str(upload_copy)
            try:
                hpss_tmp = await asyncio.to_thread(extract_harmonic_percussive, acc_path)
            except Exception as e:
                hpss_tmp = {}
                job.message = f"节奏与和弦分离失败（退回原伴奏）：{e}"

            harmonic_path = hpss_tmp.get("harmonic_path") or acc_path
            percussive_path = hpss_tmp.get("percussive_path") or str(upload_copy)
            try:
                rhythm_energy = await asyncio.to_thread(compute_percussive_energy, percussive_path)
            except Exception:
                rhythm_energy = None

            # Preview waveform as soon as we have an accompaniment track (other/no_vocals preferred)
            try:
                waveform_src = stems_tmp.get("other") or stems_tmp.get("no_vocals") or acc_path
                job.preview = {
                    "step": "hpss",
                    "waveform": await asyncio.to_thread(compute_waveform_peaks, waveform_src),
                    "rhythm_energy": rhythm_energy,
                }
            except Exception:
                pass

            job.progress = 35
            job.message = "正在丈量音符的间距与调性..."
            job.preview = {**(job.preview or {}), "step": "analysis"}

            try:
                analysis = await asyncio.to_thread(
                    analyze_audio_multi,
                    str(upload_copy),
                    title,
                    tempo_path=percussive_path,
                    chord_path=harmonic_path,
                    key_path=harmonic_path,
                )
            except Exception as e:
                # Soft fallback to mix for everything.
                job.message = f"音乐分析受阻（退回混合原声）：{e}"
                analysis = await asyncio.to_thread(analyze_audio_multi, str(upload_copy), title)

            if analysis:
                # Apply voice leading to make bass progressions more natural
                analysis.bar_chords = apply_voice_leading(analysis.bar_chords)

            # Update preview with bar-level chords on a timeline
            try:
                beats = [float(x) for x in getattr(analysis, "beat_times", [])] if analysis else []
                bars: list[dict] = []
                beats_per_bar = 4
                if beats and len(beats) >= beats_per_bar + 1:
                    bar_count = max(1, (len(beats) - 1) // beats_per_bar)
                    for bi in range(bar_count):
                        b0 = bi * beats_per_bar
                        b1 = min(b0 + beats_per_bar, len(beats) - 1)
                        start_t = float(beats[b0])
                        end_t = float(beats[b1])
                        chord = analysis.bar_chords[bi] if analysis and bi < len(analysis.bar_chords) else "N"
                        bars.append({"bar": bi, "start": start_t, "end": end_t, "chord": chord})
                job.preview = {**(job.preview or {}), "step": "analysis", "beats": beats, "bars": bars}
            except Exception:
                pass

            job.progress = 60
            job.message = "正在倾听歌词中藏着的故事..."
            job.preview = {**(job.preview or {}), "step": "lyrics"}

            vocals_path = stems_tmp.get("vocals")
            if vocals_path:
                lyrics = await asyncio.to_thread(transcribe_lyrics, vocals_path, "zh")
            else:
                lyrics = None

            # Add lyrics timeline to preview
            try:
                job.preview = {
                    **(job.preview or {}),
                    "step": "lyrics",
                    "lyrics_segments": lyrics.get("segments") if isinstance(lyrics, dict) else None,
                }
            except Exception:
                pass

            job.progress = 70
            job.message = "正在捕捉风里的主旋律..."
            job.preview = {**(job.preview or {}), "step": "melody"}

            if vocals_path:
                try:
                    vocal_melody = await asyncio.to_thread(extract_vocal_melody, vocals_path)
                except Exception as e:
                    vocal_melody = {"note_events": [], "midi_path": None, "error": str(e)}
            else:
                vocal_melody = None

            # Step 6B/7B MVP: align melody to lyrics and generate a simple vocal melody TAB as alphaTex.
            # Keep it optional and non-blocking.
            try:
                if (
                    isinstance(vocal_melody, dict)
                    and isinstance(vocal_melody.get("note_events"), list)
                    and vocal_melody.get("note_events")
                    and isinstance(lyrics, dict)
                    and isinstance(lyrics.get("segments"), list)
                ):
                    aligned = align_melody_to_lyrics(vocal_melody["note_events"], lyrics["segments"], "zh")
                    vocal_melody["aligned_melody"] = aligned
                    bar_lines = convert_aligned_melody_to_tab_bars(
                        aligned,
                        tempo_bpm=analysis.tempo_bpm,
                        time_signature=analysis.time_signature,
                        bars=max(1, len(analysis.bar_chords)),
                        slot=8,
                        max_fret=int(os.environ.get("MELODY_MAX_FRET", "12")),
                    )
                    vocal_melody["alphatex"] = build_vocal_melody_track_alphatex(
                        tempo_bpm=analysis.tempo_bpm,
                        time_signature=analysis.time_signature,
                        bars=max(1, len(analysis.bar_chords)),
                        bar_lines=bar_lines,
                    )
            except Exception:
                # ignore alignment failures
                pass

            # Persist artifacts to storage/stems/{job_id}/ (required layout)
            stems_out = {}
            for k in ("vocals", "drums", "bass", "other", "no_vocals"):
                p = stems_tmp.get(k)
                if not p:
                    continue
                dst = stems_dir / f"{k}.wav"
                try:
                    shutil.copy2(p, dst)
                    stems_out[k] = str(dst)
                except Exception:
                    pass
            # HPSS outputs as harmonic.wav / percussive.wav inside stems/{job_id}/
            if "harmonic_path" in hpss_tmp:
                try:
                    dst = stems_dir / "harmonic.wav"
                    shutil.copy2(hpss_tmp["harmonic_path"], dst)
                    stems_out["harmonic"] = str(dst)
                except Exception:
                    pass
            if "percussive_path" in hpss_tmp:
                try:
                    dst = stems_dir / "percussive.wav"
                    shutil.copy2(hpss_tmp["percussive_path"], dst)
                    stems_out["percussive"] = str(dst)
                except Exception:
                    pass

            # Build visualization payload (best-effort):
            # - waveform peaks from other/no_vocals (as requested)
            # - beats, bar-level chord timeline
            # - lyrics segments timeline
            try:
                waveform_src = stems_out.get("other") or stems_out.get("no_vocals") or acc_path
                waveform = await asyncio.to_thread(compute_waveform_peaks, waveform_src)
                beats = [float(x) for x in getattr(analysis, "beat_times", [])] if analysis else []
                bars: list[dict] = []
                beats_per_bar = 4
                if beats and len(beats) >= beats_per_bar + 1:
                    bar_count = max(1, (len(beats) - 1) // beats_per_bar)
                    for bi in range(bar_count):
                        b0 = bi * beats_per_bar
                        b1 = min(b0 + beats_per_bar, len(beats) - 1)
                        start_t = float(beats[b0])
                        end_t = float(beats[b1])
                        chord = analysis.bar_chords[bi] if analysis and bi < len(analysis.bar_chords) else "N"
                        bars.append({"bar": bi, "start": start_t, "end": end_t, "chord": chord})

                visualization = {
                    "waveform": waveform,
                    "beats": beats,
                    "bars": bars,
                    "lyrics_segments": lyrics.get("segments") if isinstance(lyrics, dict) else None,
                }
            except Exception:
                visualization = None

            job.progress = 65
            job.message = "正在梳理歌曲的起承转合..."
            job.preview = {**(job.preview or {}), "step": "sections"}

        job.progress = 65
        job.message = "正在梳理歌曲的起承转合..."

        sections = detect_sections(analysis.bar_chords)

        section_out: list[SectionOut] = []
        for s in sections:
            chords: list[ChordAt] = []
            for bar in range(s.start_bar, s.end_bar):
                if 0 <= bar < len(analysis.bar_chords):
                    chord = analysis.bar_chords[bar]
                else:
                    chord = "N"
                chords.append(ChordAt(chord=chord, bar=bar, beat=1))
            section_out.append(SectionOut(name=s.name, start_bar=s.start_bar, end_bar=s.end_bar, chords=chords))

        job.progress = 78
        job.message = "正在为前奏编写指尖的刻痕..."

        # Keep existing melody extraction for intro/tab heuristics & as fallback.
        melody_mix = await asyncio.to_thread(detect_melody, str(upload_copy))
        total_beats = max(1, len(analysis.bar_chords) * 4)
        beat_grid = make_beat_grid(analysis.tempo_bpm, analysis.duration_sec, total_beats)

        lyrics_beats = None
        if isinstance(lyrics, dict) and isinstance(lyrics.get("segments"), list):
            lyrics_beats = lyrics_to_beats(lyrics["segments"], beat_grid, total_beats)

        # Prefer vocal melody (if available) for jianpu; fallback to mix.
        melody_for_jianpu = melody_mix
        if isinstance(vocal_melody, dict) and isinstance(vocal_melody.get("note_events"), list) and vocal_melody.get("note_events"):
            try:
                from melody_detector import NoteEvent

                melody_for_jianpu = [
                    NoteEvent(
                        start_sec=float(e.get("start_sec", 0.0)),
                        end_sec=float(e.get("end_sec", 0.0)),
                        pitch=int(e.get("pitch", 0)),
                        velocity=int(e.get("velocity", 0)),
                    )
                    for e in vocal_melody["note_events"]
                ]
            except Exception:
                melody_for_jianpu = melody_mix

        jianpu = melody_to_jianpu(melody_for_jianpu, beat_grid, analysis.key, total_beats)
        if len(jianpu) > 128:
            jianpu = jianpu[:128]

        display_sections, arrangement = build_display_sections_and_arrangement(section_out)

        # Intro MVP: try to render the first 8 bars as real TAB notes (from basic-pitch),
        # fallback to chord-based arpeggios if transcription is insufficient.
        intro_bars = {}
        try:
            intro_bars = build_intro_bar_overrides(
                melody=melody_mix,
                tempo_bpm=analysis.tempo_bpm,
                duration_sec=analysis.duration_sec,
                time_signature=analysis.time_signature,
                bar_chords=analysis.bar_chords,
                bars=int(os.environ.get("INTRO_BARS", "8")),
                min_notes_per_bar=int(os.environ.get("INTRO_MIN_NOTES_PER_BAR", "2")),
                jianpu_beats=jianpu,
                lyrics_beats=lyrics_beats,
            )
        except Exception:
            intro_bars = {}

        # Generate all 4 levels of GP5 files for the user to choose from
        for level in [1, 2, 3, 4]:
            gp5_bytes = generate_gp5_binary(
                title=_clean_title(analysis.title),
                tempo=analysis.tempo_bpm,
                time_signature=analysis.time_signature,
                key=analysis.key,
                sections=display_sections,
                intro_bars=intro_bars,
                lyrics_beats=lyrics_beats,
                rhythm_energy=rhythm_energy,
                accompaniment_path=str(upload_copy),
                beat_times=[float(x) for x in getattr(analysis, "beat_times", [])] if analysis else [],
                stems_paths=stems_tmp,
                level=level,
            )

            # Write results artifacts under storage/results/{job_id}/
            try:
                results_dir.mkdir(parents=True, exist_ok=True)
                (results_dir / f"result_l{level}.gp5").write_bytes(gp5_bytes)
                
                # We also save the default (level 4) as result.gp5 for backward compatibility
                if level == 4:
                    (results_dir / "result.gp5").write_bytes(gp5_bytes)
                    
                if isinstance(vocal_melody, dict) and isinstance(vocal_melody.get("alphatex"), str):
                    (results_dir / "melody.alphatex").write_text(vocal_melody["alphatex"], encoding="utf-8")
            except Exception:
                pass

        job.result = JobResult(
            title=_clean_title(analysis.title),
            artist=None,
            key=analysis.key,
            tempo=analysis.tempo_bpm,
            time_signature=analysis.time_signature,
            sections=[
                SectionModel(
                    name=s.name,
                    start_bar=s.start_bar,
                    end_bar=s.end_bar,
                    chords=[ChordModel(chord=c.chord, bar=c.bar, beat=c.beat) for c in s.chords],
                )
                for s in display_sections
            ],
            arrangement=arrangement,
            alphatex=None,
            stems=stems_out,
            vocal_melody=vocal_melody,
            lyrics=lyrics,
            metadata={
                "rhythm_energy": rhythm_energy,
                "rhythm_energy_low": float(os.environ.get("RHYTHM_ENERGY_LOW", "0.25")),
                "rhythm_energy_high": float(os.environ.get("RHYTHM_ENERGY_HIGH", "0.55")),
                "visualization": visualization,
            },
            # Here we must also simplify the chords for the React frontend timeline
            practiceData=generate_practice_data(
                beat_grid=beat_grid.tolist() if hasattr(beat_grid, "tolist") else beat_grid,
                chords=analysis.bar_chords,
                aligned_lyrics=vocal_melody.get("aligned_melody") if isinstance(vocal_melody, dict) else None,
                tempo_bpm=analysis.tempo_bpm
            ),
        )

        # Persist output.json + lyrics.lrc (best effort)
        try:
            (results_dir / "output.json").write_text(
                json.dumps(job.result.model_dump(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass
        try:
            if isinstance(lyrics, dict) and isinstance(lyrics.get("segments"), list):
                lines: list[str] = []
                for seg in lyrics["segments"]:
                    t = float(seg.get("start", 0.0))
                    mm = int(t // 60)
                    ss = int(t % 60)
                    cs = int(round((t - int(t)) * 100))
                    txt = (seg.get("text") or "").strip()
                    if not txt:
                        continue
                    lines.append(f"[{mm:02d}:{ss:02d}.{cs:02d}]{txt}")
                (results_dir / "lyrics.lrc").write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
        except Exception:
            pass
        job.status = "succeeded"
        job.progress = 100
        job.message = "一首完整的吉他谱已经凝固。"
        job.preview = {**(job.preview or {}), "step": "done"}
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.message = "抱歉，琴弦在这里断了。"
        job.preview = {**(job.preview or {}), "step": "failed"}


@app.post("/jobs", response_model=JobResponse)
async def create_job(req: CreateJobRequest) -> JobResponse:
    audio_path = Path(req.audio_path)
    if not audio_path.exists() or not audio_path.is_file():
        raise HTTPException(status_code=400, detail="audio_path not found")

    storage = _storage_dir()
    storage.mkdir(parents=True, exist_ok=True)

    job_id = uuid.uuid4().hex
    title = _clean_title((req.title or "").strip() or audio_path.name)
    state = JobState(
        id=job_id,
        status="queued",
        progress=0,
        message="正在排队等待时光的眷顾...",
        error=None,
        audio_path=audio_path,
        title=title,
        result=None,
        preview={"step": "queued"},
    )
    _jobs[job_id] = state
    asyncio.create_task(_run_job(job_id))
    return _job_to_response(state)


@app.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str) -> JobResponse:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_response(job)


@app.get("/jobs/{job_id}/result", response_model=JobResult)
async def get_job_result(job_id: str) -> JobResult:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != "succeeded" or not job.result:
        raise HTTPException(status_code=409, detail="job not ready")
    return job.result


@app.get("/jobs/{job_id}/result.gp5")
async def get_job_result_gp5(job_id: str, level: Optional[int] = 4):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != "succeeded":
        raise HTTPException(status_code=409, detail="job not ready")
        
    filename = f"result_l{level}.gp5" if level in [1, 2, 3] else "result.gp5"
    gp5_path = _storage_root() / "results" / job_id / filename
    
    # Fallback to result.gp5 if the specific level doesn't exist (for old jobs)
    if not gp5_path.exists():
        gp5_path = _storage_root() / "results" / job_id / "result.gp5"
        
    if not gp5_path.exists():
        raise HTTPException(status_code=404, detail="gp5 file not found")
        
    return FileResponse(
        path=gp5_path, 
        media_type="application/octet-stream",
        filename=f"{job_id}_l{level}.gp5"
    )
