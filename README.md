# Ghost Network Buster (capstone)

Multi-agent insurer directory audit: **Google ADK blueprint**, FastAPI pipeline, **mock or Retell** voice, **local TF-IDF RAG** over bundled regulatory snippets, **GCS/local persistence**, **WebSocket** live summaries, PDF deliverables.

## Class concepts → code

| Concept | Where |
|--------|--------|
| **Agent framework (Google ADK)** | `ghost_network_buster/adk_blueprint.py` — `SequentialAgent`, `ParallelAgent`, `StageMarkerAgent` (`BaseAgent`). Introspection: `GET /api/agents/graph` |
| **Multi-agent** | Same file: directory → parallel callers → classifier → RAG → synthesizer |
| **Tool use** | `tools/voice_provider.py`, `tools/rag.py`, `tools/memory_tool.py` |
| **Parallel execution** | `pipeline/run_audit.py` + `asyncio.Semaphore` (`max_parallel_calls`) |
| **Structured output** | `models.py` — `CallResult`, `AuditSummary` (Pydantic) |
| **RAG** | `tools/rag.py` + `data/regulatory_corpus/*.md` (swap corpus / backend for Vertex Vector Search later) |
| **Memory** | `tools/memory_tool.py` — per-NPI JSON in `data/memory_npi/` or `GCS_MEMORY_BUCKET` |
| **Iterative refinement** | `pipeline/run_audit.py` — voicemail re-dial loop; high ghost-rate QA note |
| **Evals** | `evals/call_scenarios.json` + `pytest tests/test_classifier_eval.py` |

## Real directory data (NPPES + Aetna TiC)

Use the ingestion CLI to build a JSON list from **CMS NPPES** (behavioral health by ZIP) joined with an **Aetna in-network MRF** (streamed via `ijson`). See **`data_ingestion_README.md`** for steps and `python -m ghost_network_buster.data_ingestion.join_providers --help`. Set **`PROVIDERS_DATA_FILE`** in `.env` to point the API at the output file.

## Quick start (local)

### Backend

```bash
cd "project 3"
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# VOICE_PROVIDER=mock — no telephony charges
uvicorn ghost_network_buster.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/ws` to port 8000.

If `DEMO_API_KEY` is set on the API, set `VITE_DEMO_API_KEY` in `frontend/.env`.

### Tests

```bash
pytest tests/ -q
```

## GCP / Cloud Run

1. **Container**: `docker build -t gnb-api .` then push to Artifact Registry, or `gcloud run deploy --source .`.
2. **Env vars** (minimum):
   - `PORT` — Cloud Run sets automatically.
   - `CORS_ORIGINS` — your hosted frontend origin(s), comma-separated.
   - `GOOGLE_CLOUD_PROJECT` — if using GCS.
   - `GCS_AUDITS_BUCKET` — optional; without it, audits persist under `AUDIT_LOCAL_DIR` (ephemeral on Cloud Run unless you mount a volume).
   - `GCS_MEMORY_BUCKET` — optional NPI memory.
   - `DEMO_API_KEY` — recommended for public demos.
3. **Service account**: Cloud Run runtime SA needs `roles/storage.objectAdmin` on audit/memory buckets (if used) and **Vertex** roles only when you wire Gemini/Vector Search.
4. **Frontend**: Build `frontend` with `VITE_API_BASE=https://<your-cloud-run-url>` and host on Firebase Hosting, second Cloud Run (static), or Cloud Storage + HTTPS.

## API notes

- `POST /api/start-audit` — body: `carrier`, `zip_code`, `care_needs`, optional `email`, `max_providers`.
- `GET /api/summary/{id}` — includes `rag_hits` when completed.
- `WS /ws/audit/{id}?demo_key=...` — push `{type:"summary", data: ...}` after each batch update.
- PDFs: `GET /api/download/summary/{id}`, `GET /api/download/complaint/{id}` (complaint if ghost rate ≥ 70%).

## Retell later

Set `VOICE_PROVIDER=retell`, `RETELL_API_KEY`, `RETELL_AGENT_ID`. Add webhooks for transcripts; see `tools/voice_provider.py`.
