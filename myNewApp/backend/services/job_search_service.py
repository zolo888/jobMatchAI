import logging
from typing import List, Optional

import httpx

from backend.models import JobListing

logger = logging.getLogger(__name__)

JOBSEARCH_BASE_URL = "https://jobsearch.api.jobtechdev.se"


class JobSearchService:
    def __init__(self, base_url: str = JOBSEARCH_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={"Accept": "application/json"},
        )

    async def search(
        self,
        query: str,
        plats: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[List[JobListing], int]:
        """
        Söker jobb via Arbetsförmedlingens JobSearch API.
        Returnerar (lista av jobb, totalt antal träffar).
        """
        params: dict = {
            "q": query,
            "limit": limit,
            "offset": offset,
        }
        if plats:
            params["q"] = f"{query} {plats}"

        url = f"{self.base_url}/search"
        logger.info(f"Söker jobb: GET {url} params={params}")

        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.ConnectError:
            raise ConnectionError(
                f"Kunde inte nå Arbetsförmedlingens API: {self.base_url}"
            )
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"JobSearch API-fel: {e.response.status_code} - {e.response.text[:200]}"
            )

        hits = data.get("hits", [])
        total = data.get("total", {}).get("value", 0)
        jobs = [self._parse_hit(hit) for hit in hits]
        logger.info(f"Hittade {total} jobb, returnerar {len(jobs)}")
        return jobs, total

    def _parse_hit(self, hit: dict) -> JobListing:
        """Konverterar ett API-svar-hit till intern JobListing-modell."""
        # Arbetsförmedlingens API-struktur
        employer = hit.get("employer", {})
        workplace = hit.get("workplace_address", {})
        description = hit.get("description", {})

        return JobListing(
            id=hit.get("id", ""),
            titel=hit.get("headline", "Okänd titel"),
            foretag=employer.get("name"),
            plats=(
                workplace.get("municipality")
                or workplace.get("region")
                or workplace.get("country")
            ),
            beskrivning=self._clean_description(
                description.get("text") or description.get("text_formatted", "")
            ),
            url=hit.get("webpage_url") or self._build_af_url(hit.get("id", "")),
            publiceringsdatum=hit.get("publication_date"),
        )

    @staticmethod
    def _clean_description(text: str) -> str:
        """Tar bort HTML-taggar och begränsar längd för embedding-effektivitet."""
        import re
        text = re.sub(r"<[^>]+>", " ", text)   # Ta bort HTML
        text = re.sub(r"\s+", " ", text).strip()
        return text[:3000]

    @staticmethod
    def _build_af_url(job_id: str) -> str:
        """Bygger direktlänk till jobbannonsen på Arbetsförmedlingen."""
        return f"https://arbetsformedlingen.se/platsbanken/annonser/{job_id}"

    async def close(self):
        await self.client.aclose()
