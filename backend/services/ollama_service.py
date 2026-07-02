import json
import logging
import math
from typing import List, Optional

import httpx

from backend.models import CVAnalysis

logger = logging.getLogger(__name__)

CV_EXTRACTION_PROMPT = """Du är en expert på att analysera CV:n. Extrahera följande information från CV-texten nedan och returnera ENBART ett JSON-objekt, utan förklaringar.

JSON-format:
{{
  "yrkestitel": "Personens nuvarande eller senaste yrkestitel",
  "kompetenser": ["kompetens1", "kompetens2", "..."],
  "erfarenhet": "Kort sammanfattning av erfarenhet (1-2 meningar)",
  "plats": "Stad eller region personen befinner sig i, eller null om okänt"
}}

CV-text:
{cv_text}

Returnera ENBART JSON, inga andra kommentarer."""

JOB_MATCH_PROMPT = """Du är en rekryteringsexpert. Analysera hur väl detta CV matchar jobbannonsen och ge en matchningspoäng.

CV-profil:
Yrkestitel: {yrkestitel}
Kompetenser: {kompetenser}
Erfarenhet: {erfarenhet}

Jobbannons:
Titel: {job_titel}
Beskrivning: {job_beskrivning}

Returnera ENBART ett JSON-objekt:
{{
  "score": <nummer mellan 0 och 100>,
  "motivering": "En mening om varför detta är en bra eller dålig matchning"
}}"""


class OllamaService:
    def __init__(self, base_url: str, model: str, embed_model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.embed_model = embed_model
        self.client = httpx.AsyncClient(timeout=120.0)

    async def _generate(self, prompt: str) -> str:
        """Skickar en prompt till Ollama och returnerar svaret."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        try:
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        except httpx.ConnectError:
            raise ConnectionError(
                f"Kunde inte ansluta till Ollama på {self.base_url}. "
                "Kontrollera att Ollama körs: 'ollama serve'"
            )
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama returnerade fel: {e.response.status_code} - {e.response.text}")

    async def _embed(self, text: str) -> List[float]:
        """Genererar en embedding-vektor för given text."""
        url = f"{self.base_url}/api/embeddings"
        payload = {"model": self.embed_model, "prompt": text}
        try:
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            return response.json().get("embedding", [])
        except httpx.ConnectError:
            raise ConnectionError(f"Kunde inte ansluta till Ollama på {self.base_url}.")

    async def extract_cv_info(self, cv_text: str) -> CVAnalysis:
        """Extraherar strukturerad information från CV-text med LLM."""
        prompt = CV_EXTRACTION_PROMPT.format(cv_text=cv_text[:4000])  # Begränsa input
        logger.info(f"Skickar CV-text till Ollama ({self.model})...")

        raw = await self._generate(prompt)
        logger.debug(f"Ollama CV-svar: {raw[:200]}")

        try:
            data = json.loads(raw)
            return CVAnalysis(
                yrkestitel=data.get("yrkestitel", "Okänd"),
                kompetenser=data.get("kompetenser", []),
                erfarenhet=data.get("erfarenhet", ""),
                plats=data.get("plats"),
                raw_text=cv_text,
            )
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Kunde inte parsa Ollama-svar som JSON: {e}\nSvar: {raw}")
            # Fallback: returnera grundläggande analys
            return CVAnalysis(
                yrkestitel="Kunde inte extrahera",
                kompetenser=[],
                erfarenhet="CV-analys misslyckades. Försök igen.",
                raw_text=cv_text,
            )

    async def match_job(self, cv: CVAnalysis, job_titel: str, job_beskrivning: str) -> tuple[float, str]:
        """Rankar ett jobb mot ett CV (0-100 scale) via LLM-prompt."""
        prompt = JOB_MATCH_PROMPT.format(
            yrkestitel=cv.yrkestitel,
            kompetenser=", ".join(cv.kompetenser),
            erfarenhet=cv.erfarenhet,
            job_titel=job_titel,
            job_beskrivning=(job_beskrivning or "")[:1500],
        )
        raw = await self._generate(prompt)
        try:
            data = json.loads(raw)
            score = float(data.get("score", 50)) / 100.0  # Normalisera till 0-1
            motivering = data.get("motivering", "")
            return min(1.0, max(0.0, score)), motivering
        except (json.JSONDecodeError, ValueError):
            return 0.5, "Matchningsanalys ej tillgänglig"

    async def compute_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Beräknar embeddings för en lista av texter."""
        embeddings = []
        for text in texts:
            emb = await self._embed(text[:2000])
            embeddings.append(emb)
        return embeddings

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Beräknar cosinus-likhet mellan två vektorer."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        mag_a = math.sqrt(sum(a * a for a in vec_a))
        mag_b = math.sqrt(sum(b * b for b in vec_b))
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)

    async def rank_jobs_by_embeddings(
        self, cv_text: str, job_descriptions: List[str]
    ) -> List[float]:
        """
        Rankar jobbannonser mot CV via embeddings (snabbare än LLM-prompt per jobb).
        Returnerar lista av scores (0.0–1.0) i samma ordning som job_descriptions.
        """
        logger.info(f"Beräknar embeddings för {len(job_descriptions)} jobbannonser...")
        cv_embedding = await self._embed(cv_text[:2000])
        job_embeddings = await self.compute_embeddings(job_descriptions)
        scores = [self.cosine_similarity(cv_embedding, je) for je in job_embeddings]
        return scores

    async def close(self):
        await self.client.aclose()
