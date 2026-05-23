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

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
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
    title: Optional[str] = None
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

def _low_mem_mode() -> bool:
    return _truthy(os.environ.get("AI_LOW_MEM", "")) or _truthy(os.environ.get("AI_LITE", ""))

def _disabled(flag: str) -> bool:
    return _truthy(os.environ.get(flag, "")) or _low_mem_mode()


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
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_origins=["null"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
_jobs: dict[str, JobState] = {}
_MAX_CONCURRENCY = max(1, int(os.environ.get("AI_MAX_CONCURRENCY", "2")))
_JOB_TIMEOUT_SEC = max(60, int(os.environ.get("AI_JOB_TIMEOUT_SEC", "1200")))
_JOB_CANCELLED: set[str] = set()


@app.middleware("http")
async def _request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


def _require_internal_auth(request: Request, x_ai_token: Optional[str] = Header(default=None, alias="x-ai-token")) -> None:
    expected = (os.environ.get("AI_SERVICE_TOKEN") or "").strip()
    if expected:
        if (x_ai_token or "").strip() != expected:
            raise HTTPException(status_code=401, detail="unauthorized")
        return
    host = request.client.host if request.client else ""
    if host in {"127.0.0.1", "::1"}:
        return
    raise HTTPException(status_code=401, detail="AI_SERVICE_TOKEN not configured")

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
    if job.id in _JOB_CANCELLED and job.status == "succeeded":
        job.status = "failed"
        job.error = job.error or "job timeout"
        job.message = job.message or "任务超时"
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



@app.get("/health", dependencies=[Depends(_require_internal_auth)])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
async def _startup_tasks():
    strict = _truthy(os.environ.get("AI_STRICT_ENV", "")) or (os.environ.get("AI_ENV", "").strip().lower() in {"prod", "production"})
    if strict:
        required = [
            "AI_SERVICE_TOKEN",
            "SUPABASE_URL",
            "SUPABASE_KEY",
            "CLOUDFLARE_ACCOUNT_ID",
            "CLOUDFLARE_ACCESS_KEY_ID",
            "CLOUDFLARE_SECRET_ACCESS_KEY",
            "CLOUDFLARE_BUCKET_NAME",
        ]
        missing = [k for k in required if not (os.environ.get(k) or "").strip()]
        if missing:
            raise RuntimeError("Missing env: " + ",".join(missing))
    async def _loop_cleanup():
        while True:
            try:
                _cleanup_expired(_storage_root())
            except Exception:
                pass
            await asyncio.sleep(3600)
    asyncio.create_task(_loop_cleanup())


def _job_to_response(job: JobState) -> JobResponse:
    return JobResponse(
        id=job.id,
        status=job.status,
        progress=job.progress,
        title=job.title,
        message=job.message,
        error=job.error,
        preview=job.preview,
        storage_provider=job.storage_provider,
    )


async def _run_job(job_id: str) -> None:
    job = await _get_job_state(job_id)
    if not job:
        return

    async def _watch_timeout():
        await asyncio.sleep(_JOB_TIMEOUT_SEC)
        j = await _get_job_state(job_id)
        if not j:
            return
        if j.status in {"queued", "processing"}:
            _JOB_CANCELLED.add(job_id)
            j.status = "failed"
            j.error = "job timeout"
            j.message = "任务超时"
            j.preview = {**(j.preview or {}), "step": "failed"}
            await _save_job_state(j)

    asyncio.create_task(_watch_timeout())

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
            job.message = "正在从网络解析并下载音轨..."
            await _save_job_state(job)
            
            def _download_yt():
                # 我们使用预编译的最新的 yt-dlp 二进制文件来绕过 Python 3.9 的限制
                import subprocess
                
                target_path = str(uploads_dir / f"{job.id}")
                url_str = job.audio_path if isinstance(job.audio_path, str) else str(job.audio_path)
                
                # 动态判断当前操作系统，决定使用哪个 yt-dlp 二进制文件
                import sys
                import platform
                
                # 如果是 macOS，使用我们刚刚下载的 yt-dlp (macOS 版)
                if sys.platform == "darwin":
                    yt_dlp_bin = _repo_root() / "services" / "ai" / "yt-dlp"
                # 如果是 Linux (例如部署在 Render, AWS 等服务器上)
                else:
                    # 部署时需要在服务器上安装 yt-dlp linux 二进制文件，或者直接使用系统安装的 yt-dlp 命令
                    yt_dlp_bin = "yt-dlp" 
                
                cmd = [
                    str(yt_dlp_bin),
                    "-f", "bestaudio/best",
                    "-o", f"{target_path}.%(ext)s",
                    "-x", "--audio-format", "mp3", "--audio-quality", "192",
                    "--quiet", "--no-warnings",
                    "--print", "%(title)s",
                    "--no-simulate"
                ]
                
                # 部署环境没有本地 Chrome 浏览器！
                # 所以我们不能用 --cookies-from-browser chrome
                # 我们改为：如果服务器上有 cookies.txt 文件，就使用它
                cookies_file = _repo_root() / "services" / "ai" / "cookies.txt"
                if cookies_file.exists():
                    cmd.extend(["--cookies", str(cookies_file)])
                elif sys.platform == "darwin":
                    # 只有在本地 macOS 开发时，如果没有 cookies.txt，才尝试读取本地 Chrome
                    cmd.extend(["--cookies-from-browser", "chrome"])
                
                # 开启外部 JS 解析支持，解决 YouTube 签名报错
                cmd.extend([
                    "--js-runtimes", "node",
                    "--remote-components", "ejs:github"
                ])
                
                if "bilibili.com" in url_str or "b23.tv" in url_str:
                    cmd.extend([
                        "--add-header",
                        "User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ])
                elif "youtube.com" in url_str or "youtu.be" in url_str:
                    cmd.extend([
                        "--extractor-args",
                        "youtube:player_client=web,ios"
                    ])
                    
                cmd.append(url_str)
                
                try:
                    timeout_sec = max(30, int(os.environ.get("AI_YTDLP_TIMEOUT_SEC", "300")))
                    result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=timeout_sec)
                    lines = [line.strip() for line in result.stdout.split('\n') if line.strip()]
                    return lines[-1] if lines else job.title
                except subprocess.TimeoutExpired:
                    raise Exception("Failed to download audio: yt-dlp timeout")
                except subprocess.CalledProcessError as e:
                    print(f"yt-dlp binary failed: {e.stderr}")
                    raise Exception(f"Failed to download audio: {e.stderr}")
            
            real_title = await asyncio.to_thread(_download_yt)
            if real_title:
                job.title = _clean_title(real_title)
                title = job.title  # 更新局部变量，供后续分析及吉他谱生成使用
                
            # The postprocessor changes the extension to .mp3
            upload_copy = uploads_dir / f"{job.id}.mp3"

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
            if _disabled("DISABLE_DEMUCS"):
                stems_tmp = {}
                job.message = "已跳过人声剥离（低资源模式）"
            else:
                try:
                    stems_tmp = await asyncio.to_thread(separate_stems, str(upload_copy), tmp_dir)
                except Exception as e:
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
            harmonic_path = acc_path
            percussive_path = str(upload_copy)
            if _disabled("DISABLE_HPSS"):
                hpss_tmp = {}
                rhythm_energy = None
            else:
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

            if _disabled("DISABLE_LYRICS"):
                lyrics = None
            else:
                vocals_path = stems_tmp.get("vocals")
                if vocals_path:
                    orig_provider = job.preview.get("storage_provider") if isinstance(job.preview, dict) else None
                    search_title = job.title if orig_provider != "url" else None
                    lyrics = await asyncio.to_thread(transcribe_lyrics, vocals_path, "zh", search_title)
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

            if _disabled("DISABLE_VOCAL_MELODY"):
                vocal_melody = None
            else:
                vocals_path = stems_tmp.get("vocals")
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

        melody_mix = []
        if not _disabled("DISABLE_PITCH"):
            try:
                melody_mix = await asyncio.wait_for(
                    asyncio.to_thread(detect_melody, str(upload_copy)),
                    timeout=max(30, int(os.environ.get("AI_PITCH_TIMEOUT_SEC", "180"))),
                )
            except Exception:
                melody_mix = []
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
            intro_bars = await asyncio.wait_for(
                asyncio.to_thread(
                    build_intro_bar_overrides,
                    melody=melody_mix,
                    tempo_bpm=analysis.tempo_bpm,
                    duration_sec=analysis.duration_sec,
                    time_signature=analysis.time_signature,
                    bar_chords=analysis.bar_chords,
                    bars=int(os.environ.get("INTRO_BARS", "8")),
                    min_notes_per_bar=int(os.environ.get("INTRO_MIN_NOTES_PER_BAR", "2")),
                    jianpu_beats=jianpu,
                    lyrics_beats=lyrics_beats,
                ),
                timeout=max(20, int(os.environ.get("AI_INTRO_TIMEOUT_SEC", "120"))),
            )
        except Exception:
            intro_bars = {}

        levels = [1, 2, 3, 4] if _truthy(os.environ.get("AI_GENERATE_ALL_LEVELS", "")) else [4]
        gp5_timeout = max(30, int(os.environ.get("AI_GP5_TIMEOUT_SEC", "240")))
        created_any = False
        for i, level in enumerate(levels):
            job.progress = max(79, min(99, 80 + int((i / max(1, len(levels))) * 18)))
            job.message = f"正在写入 GP5（Level {level}）..."
            await _save_job_state(job)
            try:
                gp5_bytes = await asyncio.wait_for(
                    asyncio.to_thread(
                        generate_gp5_binary,
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
                    ),
                    timeout=gp5_timeout,
                )
            except Exception as e:
                if level == 4:
                    raise
                continue

            # Write results artifacts under storage/results/{job_id}/
            try:
                results_dir.mkdir(parents=True, exist_ok=True)
                (results_dir / f"result_l{level}.gp5").write_bytes(gp5_bytes)
                
                # We also save the default (level 4) as result.gp5 for backward compatibility
                if level == 4:
                    (results_dir / "result.gp5").write_bytes(gp5_bytes)
                created_any = True
                    
                if isinstance(vocal_melody, dict) and isinstance(vocal_melody.get("alphatex"), str):
                    (results_dir / "melody.alphatex").write_text(vocal_melody["alphatex"], encoding="utf-8")
            except Exception:
                pass

        if not created_any:
            raise RuntimeError("failed to generate gp5")

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
                s3_client = _get_s3_client()
                if not s3_client:
                    return
                    
                # 1. 上传所有 .gp5 和 output.json
                if results_dir.exists():
                    for f in results_dir.glob("*"):
                        if f.is_file() and (f.suffix == ".gp5" or f.name == "output.json"):
                            content_type = "application/octet-stream" if f.suffix == ".gp5" else "application/json"
                            _upload_r2_artifact(f, f"results/{job.id}/{f.name}", content_type)
                
                # 2. 仅上传前端播放需要的 no_vocals，并将其转换为 mp3 以节省 90% 的空间
                if stems_dir.exists():
                    no_vocals_wav = stems_dir / "no_vocals.wav"
                    if no_vocals_wav.exists():
                        no_vocals_mp3 = stems_dir / "no_vocals.mp3"
                        # 使用 ffmpeg 将 wav 压缩为 192kbps mp3
                        import subprocess
                        timeout_sec = max(30, int(os.environ.get("AI_FFMPEG_TIMEOUT_SEC", "120")))
                        try:
                            subprocess.run(
                                ["ffmpeg", "-y", "-i", str(no_vocals_wav), "-b:a", "192k", str(no_vocals_mp3), "-loglevel", "error"],
                                capture_output=True,
                                check=True,
                                timeout=timeout_sec,
                            )
                        except subprocess.TimeoutExpired:
                            return
                        except subprocess.CalledProcessError:
                            return
                        if no_vocals_mp3.exists():
                            _upload_r2_artifact(no_vocals_mp3, f"stems/{job.id}/no_vocals.mp3", "audio/mpeg")
                            
                # 3. 原声音频 (audio_path) 如果在本地，也要确保上传 (在前面 url 处理时已经上传过了，这里处理 file 上传的情况)
                # 如果是 r2，说明已经在云端了，不需要重复上传
                if job.storage_provider != "r2":
                    orig_ext = job.audio_path.suffix.lower() if isinstance(job.audio_path, Path) else ".mp3"
                    orig_path = uploads_dir / f"{job.id}{orig_ext}"
                    if orig_path.exists():
                        # 为了极致压缩，如果是 wav 也可以转 mp3，但这里假设用户上传的已经是 mp3/m4a
                        _upload_r2_artifact(orig_path, f"uploads/{job.id}{orig_ext}", "audio/mpeg")
                            
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


@app.post("/jobs", response_model=JobResponse, dependencies=[Depends(_require_internal_auth)])
async def create_job(req: CreateJobRequest, x_user_id: Optional[str] = Header(default=None, alias="x-user-id")) -> JobResponse:
    audio_path = req.audio_path if req.storage_provider == "url" else Path(req.audio_path)
    
    # 如果是云端存储或网络链接，跳过本地存在性检查
    if req.storage_provider not in ("r2", "url"):
        if not isinstance(audio_path, Path) or not audio_path.exists() or not audio_path.is_file():
            raise HTTPException(status_code=400, detail="audio_path not found")

    storage = _storage_dir()
    storage.mkdir(parents=True, exist_ok=True)

    job_id = uuid.uuid4().hex
    title = _clean_title((req.title or "").strip() or audio_path.name)
    if not x_user_id:
        raise HTTPException(status_code=400, detail="missing user")
    running = sum(1 for j in _jobs.values() if j.status in {"queued", "processing"})
    if running >= _MAX_CONCURRENCY:
        raise HTTPException(status_code=429, detail="server busy")
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
        user_id=x_user_id,
    )
    await _save_job_state(state)
    asyncio.create_task(_run_job(job_id))
    return _job_to_response(state)

async def _get_owned_job(job_id: str, x_user_id: str) -> JobState:
    job = await _get_job_state(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if not job.user_id and x_user_id:
        job.user_id = x_user_id
        await _save_job_state(job)
    if (job.user_id or "") != (x_user_id or ""):
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.get("/jobs/{job_id}", response_model=JobResponse, dependencies=[Depends(_require_internal_auth)])
async def get_job(job_id: str, x_user_id: Optional[str] = Header(default=None, alias="x-user-id")) -> JobResponse:
    if not x_user_id:
        raise HTTPException(status_code=400, detail="missing user")
    job = await _get_owned_job(job_id, x_user_id)
    return _job_to_response(job)


@app.get("/jobs/{job_id}/result", response_model=JobResult, dependencies=[Depends(_require_internal_auth)])
async def get_job_result(job_id: str, x_user_id: Optional[str] = Header(default=None, alias="x-user-id")) -> JobResult:
    if not x_user_id:
        raise HTTPException(status_code=400, detail="missing user")
    job = await _get_owned_job(job_id, x_user_id)
    if job.status != "succeeded" or not job.result:
        raise HTTPException(status_code=409, detail="job not ready")
    return job.result


@app.get("/jobs/{job_id}/result.gp5", dependencies=[Depends(_require_internal_auth)])
async def get_job_result_gp5(job_id: str, level: Optional[int] = 4, x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    if not x_user_id:
        raise HTTPException(status_code=400, detail="missing user")
    job = await _get_owned_job(job_id, x_user_id)
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


@app.get("/jobs/{job_id}/audio", dependencies=[Depends(_require_internal_auth)])
async def get_job_audio(job_id: str, type: Optional[str] = "original", x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    if not x_user_id:
        raise HTTPException(status_code=400, detail="missing user")
    job = await _get_owned_job(job_id, x_user_id)

    def _guess_media_type(p: Path) -> str:
        ext = p.suffix.lower()
        if ext == ".wav":
            return "audio/wav"
        if ext == ".mp3":
            return "audio/mpeg"
        if ext == ".m4a":
            return "audio/mp4"
        if ext == ".aac":
            return "audio/aac"
        if ext == ".ogg":
            return "audio/ogg"
        if ext == ".flac":
            return "audio/flac"
        return "application/octet-stream"

    root = _storage_root()
    stems_dir = root / "stems" / job_id
    uploads_dir = root / "uploads"

    selected: Path | None = None
    kind = (type or "original").strip().lower()

    if kind == "no_vocals":
        for cand in (stems_dir / "no_vocals.mp3", stems_dir / "no_vocals.wav", stems_dir / "other.wav"):
            if cand.exists():
                selected = cand
                break
    elif kind == "original":
        if isinstance(job.audio_path, Path) and job.audio_path.exists():
            selected = job.audio_path
        else:
            for ext in (".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"):
                cand = uploads_dir / f"{job_id}{ext}"
                if cand.exists():
                    selected = cand
                    break
    else:
        raise HTTPException(status_code=400, detail="unknown type")

    if not selected or not selected.exists():
        raise HTTPException(status_code=404, detail="audio not found")

    return FileResponse(path=selected, media_type=_guess_media_type(selected), filename=selected.name)
