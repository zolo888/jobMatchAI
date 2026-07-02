# JobMatchAI 🤖

AI-driven jobbmatchare som kombinerar ditt CV med live-jobbannonser från Arbetsförmedlingens öppna API.

## Arkitektur

```
Frontend (React/Vite)  →  Backend (FastAPI)  →  Ollama (lokal LLM)
                                           →  Arbetsförmedlingens JobSearch API
```

## Snabbstart (utan Docker)

### 1. Förbered Ollama

```bash
# Installera Ollama: https://ollama.com
ollama pull llama3.2          # CV-extraktion och jobbmatchning (~2 GB)
ollama pull nomic-embed-text  # Embedding-ranking (~300 MB)
ollama serve                  # Starta Ollama (körs på port 11434)
```

### 2. Starta Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env

# Kör från projektrooten
cd ..
uvicorn backend.main:app --reload --port 8000
```

Öppna [http://localhost:8000/docs](http://localhost:8000/docs) för Swagger UI.

### 3. Starta Frontend

```bash
cd frontend
npm install
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) i webbläsaren.

---

## Snabbstart (med Docker)

```bash
# Starta allt
docker-compose up -d

# Ladda modeller in i Ollama-containern (första gången)
docker exec jobmatch_ollama ollama pull llama3.2
docker exec jobmatch_ollama ollama pull nomic-embed-text
```

---

## API-endpoints

| Metod | Endpoint | Beskrivning |
|-------|----------|-------------|
| `GET` | `/health` | Hälsokontroll |
| `POST` | `/analyze-cv` | Analysera CV (returnerar strukturerad JSON) |
| `POST` | `/match-jobs` | Komplett pipeline: CV → jobbar → ranking |
| `GET` | `/search-jobs?q=...` | Direktsökning mot Arbetsförmedlingen |

---

## Konfiguration (`.env`)

| Variabel | Standard | Beskrivning |
|----------|----------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama-serveradress |
| `OLLAMA_MODEL` | `llama3.2` | LLM-modell för extraktion |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Modell för embeddings |
| `MAX_JOBS_TO_RANK` | `20` | Max antal jobb att hämta |

---

## Alternativa modeller

| Modell | Storlek | Användning |
|--------|---------|------------|
| `llama3.2` | ~2 GB | Bra balans, rekommenderas |
| `mistral` | ~4 GB | Bättre instruktionsföljning |
| `phi3:mini` | ~2 GB | Snabbare, enklare |
| `nomic-embed-text` | ~300 MB | Embeddings (krävs för snabb ranking) |

---

## Projektstruktur

```
myNewApp/
├── backend/
│   ├── main.py              # FastAPI-app
│   ├── models.py            # Pydantic-modeller
│   ├── requirements.txt
│   ├── Dockerfile
│   └── services/
│       ├── cv_parser.py     # PDF/bild-parsning
│       ├── ollama_service.py # LLM-integration
│       └── job_search_service.py # Arbetsförmedlingens API
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Wizard-flöde
│   │   ├── App.module.css
│   │   ├── index.css        # Global design-token CSS
│   │   └── components/
│   │       ├── CVUpload.tsx + .module.css
│   │       ├── JobCard.tsx + .module.css
│   │       └── JobList.tsx + .module.css
│   ├── Dockerfile
│   └── vite.config.ts
├── docker-compose.yml
└── .env.example
```

---

## Licens

Jobbannonser: [Arbetsförmedlingens öppna data (CC0)](https://jobtechdev.se)  
Kod: MIT
