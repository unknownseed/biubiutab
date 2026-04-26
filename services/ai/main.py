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
from typing import Literal, Optional, Union
import json

# 修复底层的科学计算库（OpenBLAS / MKL / OpenMP）在多线程并发时的死锁问题
# 这必须在引入任何音频处理、矩阵运算（如 numpy, librosa, torch）之前设置！
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

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
    storage_provider: Optional[str] = None
    user_id: Optional[str] = None

JobStatus = Literal["queued", "processing", "succeeded", "failed"]

class JobResponse(BaseModel):
    id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: Optional[str] = None
    error: Optional[str] = None
    preview: Optional[dict] = None
    storage_provider: Optional[str] = None
    user_id: Optional[str] = None


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
    audio_path: Union[Path, str]
    title: str
    result: Optional[JobResult]
    preview: Optional[dict]
    storage_provider: Optional[str] = None
    user_id: Optional[str] = None


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


from supabase import create_client, Client
import boto3
from botocore.config import Config

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
R2_ACCESS_KEY = os.environ.get("CLOUDFLARE_ACCESS_KEY_ID")
R2_SECRET_KEY = os.environ.get("CLOUDFLARE_SECRET_ACCESS_KEY")
R2_BUCKET = os.environ.get("CLOUDFLARE_BUCKET_NAME") or "biubiutab-uploads"

def _get_s3_client():
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY or not R2_SECRET_KEY:
        return None
    return boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

def _upload_r2_artifact(local_path: Path, r2_key: str, content_type: str):
    s3 = _get_s3_client()
    if not s3:
        return
    if not local_path.exists():
        return
    s3.upload_file(
        Filename=str(local_path),
        Bucket=R2_BUCKET,
        Key=r2_key,
        ExtraArgs={'ContentType': content_type}
    )

app = FastAPI(title="Biubiutab - AI Service")
_jobs: dict[str, JobState] = {}

def _jobstate_to_db_dict(job: JobState) -> dict:
    return {
        "id": job.id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "error": job.error,
        "audio_path": str(job.audio_path),
        "title": job.title,
        "result": job.result.model_dump() if job.result else None,
        "preview": job.preview,
        "user_id": job.user_id,
        # Note: we can optionally store storage_provider in the DB, 
        # but since we didn't add it to the SQL schema earlier, we will just use it in memory for now.
        # Alternatively we can add it to the 'preview' dict to avoid altering the SQL table again.
    }

def _db_dict_to_jobstate(d: dict) -> JobState:
    # try to extract storage_provider if we stored it in preview
    provider = None
    if d.get("preview") and isinstance(d["preview"], dict):
        provider = d["preview"].get("storage_provider")
        
    return JobState(
        id=d["id"],
        status=d["status"],
        progress=d["progress"],
        message=d.get("message"),
        error=d.get("error"),
        audio_path=d["audio_path"] if provider == "url" else Path(d["audio_path"]),
        title=d["title"],
        result=JobResult(**d["result"]) if d.get("result") else None,
        preview=d.get("preview"),
        storage_provider=provider,
        user_id=d.get("user_id")
    )

async def _save_job_state(job: JobState):
    _jobs[job.id] = job  # Keep in-memory cache as a fast local fallback
    if not supabase:
        return
    data = _jobstate_to_db_dict(job)
    def _do_update():
        try:
            supabase.table("ai_jobs").upsert(data).execute()
        except Exception as e:
            print(f"Failed to upsert job {job.id} to Supabase:", e)
    await asyncio.to_thread(_do_update)

async def _get_job_state(job_id: str) -> Optional[JobState]:
    if not supabase:
        return _jobs.get(job_id)
    def _do_get():
        try:
            res = supabase.table("ai_jobs").select("*").eq("id", job_id).execute()
            if res.data and len(res.data) > 0:
                return _db_dict_to_jobstate(res.data[0])
        except Exception as e:
            print(f"Failed to get job {job_id} from Supabase:", e)
        return None
    
    db_job = await asyncio.to_thread(_do_get)
    if db_job:
        _jobs[job_id] = db_job
        return db_job
    return _jobs.get(job_id)



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
        storage_provider=job.storage_provider,
    )


async def _run_job(job_id: str) -> None:
    job = await _get_job_state(job_id)
    if not job:
        return

    job.status = "processing"
    job.progress = 1
    job.message = "正在感受这首歌曲的呼吸..."
    job.preview = {"step": "loading"}
    await _save_job_state(job)

    try:
        title = _clean_title(job.title or (job.audio_path.name if isinstance(job.audio_path, Path) else str(job.audio_path)))

        # Align with required storage layout under repoRoot/storage/
        storage_root = _storage_root()
        uploads_dir = storage_root / "uploads"
        stems_dir = storage_root / "stems" / job.id
        results_dir = storage_root / "results" / job.id
        temp_base = storage_root / "temp"
        for d in (uploads_dir, stems_dir, results_dir, temp_base):
            d.mkdir(parents=True, exist_ok=True)

        _cleanup_expired(storage_root)

        ext = job.audio_path.suffix.lower() if isinstance(job.audio_path, Path) else ".mp3"
        upload_copy = uploads_dir / f"{job.id}{ext}"
        
        # If the file is in Cloudflare R2, download it first
        if job.storage_provider == "r2":
            job.message = "正在从云端下载音轨..."
            await _save_job_state(job)
            
            s3_client = _get_s3_client()
            if not s3_client:
                raise Exception("Missing R2 credentials")
                
            # 使用 as_posix() 确保在 Windows 环境下也能生成正确的 / 路径
            r2_key = job.audio_path.as_posix()
            
            def _download_r2():
                s3_client.download_file(R2_BUCKET, r2_key, str(upload_copy))
            await asyncio.to_thread(_download_r2)
            
        elif job.storage_provider == "url":
            # YouTube bypass logic is no longer needed as we switched to Cobalt API
            job.message = "正在从网络解析并下载音轨..."
            await _save_job_state(job)
            
            def _download_cobalt():
                import httpx
                target_path = str(uploads_dir / f"{job.id}.mp3")
                url_str = job.audio_path if isinstance(job.audio_path, str) else str(job.audio_path)
                
                api_url = "https://api.cobalt.tools/"
                headers = {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
                payload = {
                    "url": url_str,
                    "downloadMode": "audio",
                    "audioFormat": "mp3"
                }
                
                with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                    response = client.post(api_url, headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get("status") == "error":
                        raise Exception(f"Cobalt 解析失败: {data}")
                        
                    direct_url = data.get("url")
                    if not direct_url:
                        raise Exception(f"未能解析到下载链接: {data}")
                        
                    # 下载音频文件
                    with client.stream("GET", direct_url, headers=headers) as stream_resp:
                        stream_resp.raise_for_status()
                        with open(target_path, "wb") as f:
                            for chunk in stream_resp.iter_bytes(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                return job.title # Cobalt 不直接返回标题，我们保留原标题

            await asyncio.to_thread(_download_cobalt)
            
            # The postprocessor changes the extension to .mp3
            upload_copy = uploads_dir / f"{job.id}.mp3"
            
            # 将下载好的音频传到 R2，并把记录修改为 r2，让前端以后直接从 R2 播放原声
            r2_key = f"uploads/{job.id}.mp3"
            def _upload_url_audio():
                _upload_r2_artifact(upload_copy, r2_key, "audio/mpeg")
            await asyncio.to_thread(_upload_url_audio)
            
            job.audio_path = Path(r2_key)
            job.storage_provider = "r2"
            await _save_job_state(job)

        else:
            # Copy original local audio to storage/uploads/{job_id}.ext
            try:
                shutil.copy2(job.audio_path, upload_copy)
            except Exception:
                upload_copy = job.audio_path

        job.progress = 10
        job.message = "正在小心翼翼地剥离人声的轨迹..."
        job.preview = {"step": "demucs"}
        await _save_job_state(job)

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
            await _save_job_state(job)

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
            await _save_job_state(job)

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
            await _save_job_state(job)

            vocals_path = stems_tmp.get("vocals")
            if vocals_path:
                lyrics = await asyncio.to_thread(transcribe_lyrics, vocals_path, "zh", job.title)
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
            await _save_job_state(job)

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
            await _save_job_state(job)

        job.progress = 65
        job.message = "正在梳理歌曲的起承转合..."
        await _save_job_state(job)

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
        await _save_job_state(job)

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
                tempo_bpm=analysis.tempo_bpm,
                raw_segments=lyrics.get("segments") if isinstance(lyrics, dict) else None
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
        # If using R2, upload all generated artifacts back to cloud
        if job.storage_provider == "r2":
            job.message = "正在将伴奏和吉他谱送上云端..."
            await _save_job_state(job)
            
            def _upload_all_r2():
                # Upload stems
                if stems_dir.exists():
                    for f in stems_dir.iterdir():
                        if f.is_file():
                            r2_key = f"stems/{job.id}/{f.name}"
                            _upload_r2_artifact(f, r2_key, "audio/wav")
                # Upload results
                if results_dir.exists():
                    for f in results_dir.iterdir():
                        if f.is_file():
                            r2_key = f"results/{job.id}/{f.name}"
                            ctype = "application/json" if f.suffix == ".json" else "application/octet-stream"
                            if f.suffix == ".lrc" or f.suffix == ".alphatex":
                                ctype = "text/plain"
                            _upload_r2_artifact(f, r2_key, ctype)
                            
            await asyncio.to_thread(_upload_all_r2)

        job.status = "succeeded"
        job.progress = 100
        job.message = "一首完整的吉他谱已经凝固。"
        job.preview = {**(job.preview or {}), "step": "done"}
        await _save_job_state(job)
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.message = "抱歉，琴弦在这里断了。"
        job.preview = {**(job.preview or {}), "step": "failed"}
        await _save_job_state(job)


@app.post("/jobs", response_model=JobResponse)
async def create_job(req: CreateJobRequest) -> JobResponse:
    audio_path = req.audio_path if req.storage_provider == "url" else Path(req.audio_path)
    
    # 如果是云端存储或网络链接，跳过本地存在性检查
    if req.storage_provider not in ("r2", "url"):
        if not isinstance(audio_path, Path) or not audio_path.exists() or not audio_path.is_file():
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
        preview={"step": "queued", "storage_provider": req.storage_provider},
        storage_provider=req.storage_provider,
        user_id=req.user_id,
    )
    await _save_job_state(state)
    asyncio.create_task(_run_job(job_id))
    return _job_to_response(state)


@app.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str) -> JobResponse:
    job = await _get_job_state(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_response(job)


@app.get("/jobs/{job_id}/result", response_model=JobResult)
async def get_job_result(job_id: str) -> JobResult:
    job = await _get_job_state(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != "succeeded" or not job.result:
        raise HTTPException(status_code=409, detail="job not ready")
    return job.result


@app.get("/jobs/{job_id}/result.gp5")
async def get_job_result_gp5(job_id: str, level: Optional[int] = 4):
    job = await _get_job_state(job_id)
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
