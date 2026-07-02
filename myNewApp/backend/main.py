import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.models import CVAnalysis, CVUploadResponse, JobSearchResponse, MatchResponse, MatchResult
from backend.services.cv_parser import extract_text
from backend.services.job_search_service import JobSearchService
from backend.services.ollama_service import OllamaService

# ── Konfiguration via miljövariabler ──────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
JOBSEARCH_API_URL = os.getenv("JOBSEARCH_API_URL", "https://jobsearch.api.jobtechdev.se")
MAX_JOBS_TO_RANK = int(os.getenv("MAX_JOBS_TO_RANK", "20"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Globala tjänster ──────────────────────────────────────────────────────────
ollama: OllamaService = None
job_search: JobSearchService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ollama, job_search
    ollama = OllamaService(OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_EMBED_MODEL)
    job_search = JobSearchService(JOBSEARCH_API_URL)
    logger.info(f"✅ Tjänster startade — Ollama: {OLLAMA_BASE_URL}, Modell: {OLLAMA_MODEL}")
    yield
    await ollama.close()
    await job_search.close()
    logger.info("🔒 Tjänster stängda")


# ── FastAPI-app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="CV-Jobbmatchare API",
    description="Matchar CV mot jobbannonser från Arbetsförmedlingen via Ollama LLM",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # I produktion: specificera din frontend-URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Hälsokontroll — används av Docker och frontend."""
    return {"status": "ok", "ollama_model": OLLAMA_MODEL}


@app.post("/analyze-cv", response_model=CVUploadResponse)
async def analyze_cv(file: UploadFile = File(...)):
    """
    Laddar upp ett CV (PDF eller bild) och extraherar:
    yrkestitel, kompetenser, erfarenhet och plats via Ollama.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Ingen fil skickades")

    allowed = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tiff"}
    suffix = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Filtyp '{suffix}' stöds inte. Tillåtna: {', '.join(allowed)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # Max 10 MB
        raise HTTPException(status_code=413, detail="Filen är för stor (max 10 MB)")

    try:
        cv_text = extract_text(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if len(cv_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Kunde inte extrahera tillräckligt med text från filen. Är PDF:en skannad? Prova en bildfil.",
        )

    try:
        cv_analysis = await ollama.extract_cv_info(cv_text)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return CVUploadResponse(cv_analysis=cv_analysis)


@app.post("/match-jobs", response_model=MatchResponse)
async def match_jobs(
    file: UploadFile = File(...),
    max_results: int = Query(default=10, ge=1, le=50),
    use_embeddings: bool = Query(default=True, description="True = snabb embedding-ranking, False = LLM-ranking"),
):
    """
    Komplett pipeline: laddar upp CV → analyserar → söker jobb → rankar → returnerar matchningar.
    """
    # 1. Analysera CV
    cv_upload_response = await analyze_cv(file)
    cv = cv_upload_response.cv_analysis

    # 2. Bygg sökfråga från CV-analys
    search_query = _build_search_query(cv)
    logger.info(f"Sökfråga: '{search_query}'")

    # 3. Hämta jobbannonser
    try:
        jobs, total = await job_search.search(
            query=search_query,
            plats=cv.plats,
            limit=MAX_JOBS_TO_RANK,
        )
    except (ConnectionError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Jobbsökning misslyckades: {e}")

    if not jobs:
        return MatchResponse(results=[], cv_analysis=cv)

    # 4. Ranka jobb
    results: List[MatchResult] = []

    if use_embeddings and cv.raw_text:
        # Snabb embedding-ranking
        descriptions = [f"{j.titel} {j.foretag or ''} {j.beskrivning or ''}" for j in jobs]
        try:
            scores = await ollama.rank_jobs_by_embeddings(cv.raw_text, descriptions)
        except Exception as e:
            logger.warning(f"Embedding-ranking misslyckades, faller tillbaka på score=0.5: {e}")
            scores = [0.5] * len(jobs)

        for job, score in zip(jobs, scores):
            results.append(MatchResult(job=job, score=round(score, 3), motivering=None))
    else:
        # LLM-ranking (långsammare men ger motivering)
        for job in jobs:
            try:
                score, motivering = await ollama.match_job(cv, job.titel, job.beskrivning or "")
            except Exception as e:
                logger.warning(f"LLM-matchning för '{job.titel}' misslyckades: {e}")
                score, motivering = 0.5, None
            results.append(MatchResult(job=job, score=round(score, 3), motivering=motivering))

    # Sortera fallande på score
    results.sort(key=lambda r: r.score, reverse=True)

    return MatchResponse(results=results[:max_results], cv_analysis=cv)


@app.get("/search-jobs", response_model=JobSearchResponse)
async def search_jobs_endpoint(
    q: str = Query(..., description="Sökfråga, t.ex. 'Python Stockholm'"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Direktsökning mot Arbetsförmedlingens JobSearch API."""
    try:
        jobs, total = await job_search.search(query=q, limit=limit, offset=offset)
    except (ConnectionError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=str(e))
    return JobSearchResponse(jobs=jobs, total=total)


# ── Hjälpfunktioner ───────────────────────────────────────────────────────────

def _build_search_query(cv: CVAnalysis) -> str:
    """Bygger en sökfråga från CV-analysen."""
    parts = [cv.yrkestitel]
    # Lägg till de 3 viktigaste kompetenserna
    parts.extend(cv.kompetenser[:3])
    return " ".join(p for p in parts if p).strip()
