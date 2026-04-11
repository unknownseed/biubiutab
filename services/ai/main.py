import asyncio
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


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


class TabResult(BaseModel):
    title: str
    tuning: str
    alphatex: str
    tab_text: Optional[str] = None


_STANDARD_TUNING = [
    ("E4", 64),
    ("B3", 59),
    ("G3", 55),
    ("D3", 50),
    ("A2", 45),
    ("E2", 40),
]


_GUITAR_MIN_PITCH = min(p for _, p in _STANDARD_TUNING)
_GUITAR_MAX_PITCH = max(p for _, p in _STANDARD_TUNING) + 24


def _map_pitch_to_fret_string(pitch: int, used_strings: set[int]) -> tuple[int, int]:
    candidates: list[tuple[float, int, int]] = []
    for string, (_, open_pitch) in enumerate(_STANDARD_TUNING, start=1):
        if string in used_strings:
            continue
        fret = pitch - open_pitch
        if fret < 0 or fret > 24:
            continue
        fret_penalty = 0.0
        if fret > 5:
            fret_penalty += (fret - 5) * 2.0
        thickness_bonus = -string * 0.05
        score = float(fret) + fret_penalty + thickness_bonus
        candidates.append((score, fret, string))

    if not candidates:
        for string, (_, open_pitch) in enumerate(_STANDARD_TUNING, start=1):
            fret = pitch - open_pitch
            if fret < 0 or fret > 24:
                continue
            fret_penalty = 0.0
            if fret > 5:
                fret_penalty += (fret - 5) * 2.0
            thickness_bonus = -string * 0.05
            score = float(fret) + fret_penalty + thickness_bonus + 1000.0
            candidates.append((score, fret, string))

    if not candidates:
        raise ValueError(f"Pitch {pitch} cannot be mapped to standard guitar range")

    _, fret, string = min(candidates, key=lambda x: x[0])
    return fret, string


def _group_notes_to_alphatex(
    title: str,
    notes: list[tuple[float, float, int, int]],
    tempo_bpm: int = 120,
    time_signature: tuple[int, int] = (4, 4),
) -> tuple[str, str]:
    if not notes:
        raise ValueError("No notes detected")

    beats_per_bar = time_signature[0]
    steps_per_beat = 2
    steps_per_bar = beats_per_bar * steps_per_beat
    step_sec = (60.0 / float(tempo_bpm)) / float(steps_per_beat)

    grid: dict[int, list[tuple[int, int]]] = {}
    max_step = 0
    for start, end, pitch, velocity in notes:
        if end <= start:
            continue
        step = int(round(start / step_sec))
        grid.setdefault(step, []).append((int(pitch), int(velocity)))
        max_step = max(max_step, step)

    total_steps = max_step + 1
    if total_steps < 1:
        raise ValueError("No notes detected")

    header = "\n".join(
        [
            f'\\title "{title}"',
            '\\track "Guitar"',
            "\\staff {tabs}",
            f"\\tuning ({' '.join(n for n, _ in _STANDARD_TUNING)})",
            f"\\tempo {tempo_bpm}",
        ]
    )

    parts: list[str] = []
    parts.append(":8")
    for i in range(total_steps):
        events = grid.get(i, [])
        if not events:
            parts.append("r")
        else:
            events = sorted(events, key=lambda x: (x[1], x[0]), reverse=True)[:6]
            used_strings: set[int] = set()
            mapped: list[tuple[int, int]] = []
            for p, _v in events:
                if p < _GUITAR_MIN_PITCH or p > _GUITAR_MAX_PITCH:
                    continue
                try:
                    fret, string = _map_pitch_to_fret_string(p, used_strings)
                except ValueError:
                    continue
                used_strings.add(string)
                mapped.append((fret, string))
            if not mapped:
                parts.append("r")
            else:
                mapped_str = " ".join(f"{fret}.{string}" for fret, string in mapped)
                parts.append(mapped_str if len(mapped) == 1 else f"({mapped_str})")

        if (i + 1) % steps_per_bar == 0:
            parts.append("|")

    if not parts[-1].endswith("|"):
        parts.append("|")

    alphatex = header + "\n" + " ".join(parts)
    tuning_label = "Standard (E A D G B E)"
    return tuning_label, alphatex


@dataclass
class JobState:
    id: str
    status: JobStatus
    progress: int
    message: Optional[str]
    error: Optional[str]
    audio_path: Path
    title: str
    result: Optional[TabResult]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _storage_dir() -> Path:
    configured = os.environ.get("AI_STORAGE_DIR")
    if configured:
        return Path(configured)
    return _repo_root() / "storage" / "ai"


app = FastAPI(title="Guitar Tab AI - AI Service")
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
        title = job.title or job.audio_path.name

        job.progress = 10
        job.message = "Running transcription (Basic Pitch)"

        def _predict_notes(audio_path: Path) -> tuple[list[tuple[float, float, int, int]], int]:
            from basic_pitch.inference import predict
            import librosa

            y, sr = librosa.load(str(audio_path), sr=None, mono=True)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            if not isinstance(tempo, (float, int)) or tempo != tempo:
                tempo = 120
            tempo_i = int(round(float(tempo)))
            if tempo_i < 50:
                tempo_i = 50
            if tempo_i > 220:
                tempo_i = 220

            _, midi_data, _ = predict(
                str(audio_path),
                minimum_frequency=70.0,
                maximum_frequency=1500.0,
                minimum_note_length=80.0,
            )

            out: list[tuple[float, float, int, int]] = []
            for inst in midi_data.instruments:
                for n in inst.notes:
                    out.append((float(n.start), float(n.end), int(n.pitch), int(getattr(n, "velocity", 0))))
            return out, tempo_i

        notes, tempo_bpm = await asyncio.to_thread(_predict_notes, job.audio_path)

        job.progress = 65
        job.message = "Mapping notes to guitar"

        tuning, alphatex = await asyncio.to_thread(_group_notes_to_alphatex, title, notes, tempo_bpm)
        job.result = TabResult(title=title, tuning=tuning, alphatex=alphatex)
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
    title = (req.title or "").strip() or audio_path.name
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


@app.get("/jobs/{job_id}/result", response_model=TabResult)
async def get_job_result(job_id: str) -> TabResult:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != "succeeded" or not job.result:
        raise HTTPException(status_code=409, detail="job not ready")
    return job.result
