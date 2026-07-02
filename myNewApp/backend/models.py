from pydantic import BaseModel, HttpUrl
from typing import List, Optional


class CVAnalysis(BaseModel):
    yrkestitel: str
    kompetenser: List[str]
    erfarenhet: str
    plats: Optional[str] = None
    raw_text: Optional[str] = None


class JobListing(BaseModel):
    id: str
    titel: str
    foretag: Optional[str] = None
    plats: Optional[str] = None
    beskrivning: Optional[str] = None
    url: Optional[str] = None
    publiceringsdatum: Optional[str] = None


class MatchResult(BaseModel):
    job: JobListing
    score: float          # 0.0 – 1.0 cosinus-likhet
    motivering: Optional[str] = None


class CVUploadResponse(BaseModel):
    cv_analysis: CVAnalysis
    message: str = "CV analyserat framgångsrikt"


class JobSearchResponse(BaseModel):
    jobs: List[JobListing]
    total: int


class MatchResponse(BaseModel):
    results: List[MatchResult]
    cv_analysis: CVAnalysis
