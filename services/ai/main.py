import asyncio
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from chord_detector import analyze_audio
from formatters import ChordAt, SectionOut, build_display_sections_and_arrangement, sections_to_alphatex
from melody_detector import detect_melody, make_beat_grid, melody_to_jianpu
from section_detector import detect_sections


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
    alphatex: str


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
    )


async def _run_job(job_id: str) -> None:
    job = _jobs.get(job_id)
    if not job:
        return

    job.status = "processing"
    job.progress = 1
    job.message = "Loading audio"

    try:
        title = _clean_title(job.title or job.audio_path.name)

        job.progress = 10
        job.message = "Analyzing tempo/key/chords"

        analysis = await asyncio.to_thread(analyze_audio, str(job.audio_path), title)

        job.progress = 65
        job.message = "Detecting sections"

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
        job.message = "Extracting melody"

        melody = await asyncio.to_thread(detect_melody, str(job.audio_path))
        total_beats = max(1, len(analysis.bar_chords) * 4)
        beat_grid = make_beat_grid(analysis.tempo_bpm, analysis.duration_sec, total_beats)
        jianpu = melody_to_jianpu(melody, beat_grid, analysis.key, total_beats)
        if len(jianpu) > 128:
            jianpu = jianpu[:128]

        display_sections, arrangement = build_display_sections_and_arrangement(section_out)

        alphatex = sections_to_alphatex(
            title=_clean_title(analysis.title),
            tempo=analysis.tempo_bpm,
            time_signature=analysis.time_signature,
            key=analysis.key,
            sections=display_sections,
            jianpu=jianpu,
        )

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
            alphatex=alphatex,
        )
        job.status = "succeeded"
        job.progress = 100
        job.message = "Done"
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.message = "Failed"


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
        message="Queued",
        error=None,
        audio_path=audio_path,
        title=title,
        result=None,
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
