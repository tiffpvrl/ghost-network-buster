# Ghost Network Buster (capstone)

Multi-agent insurer directory audit: **Google ADK blueprint**, FastAPI pipeline, **mock or Pipecat/Twilio** voice, **local TF-IDF RAG** over bundled regulatory snippets, **GCS/local persistence**, **WebSocket** live summaries, PDF deliverables.

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

### Pipecat + Deepgram (one-call smoke test)

Use this to verify **Twilio media streams**, **Deepgram STT/TTS**, and **Gemini** in the live pipeline.

1. Install voice extras: `uv pip install -e ".[pipecat]"` (or `pip install -e ".[pipecat]"`).
2. In `.env`: `VOICE_PROVIDER=pipecat`, `MAX_PARALLEL_CALLS=1`, `PUBLIC_URL=<https ngrok or deployed URL>`, plus Twilio, `DEEPGRAM_API_KEY`, `GOOGLE_CLOUD_PROJECT`, and optional Deepgram tuning vars (`DEEPGRAM_STT_*`, `DEEPGRAM_TTS_*`) as in `.env.example`.
3. Run the API and start a single-provider audit from the UI or `POST /api/start-audit` with `max_providers: 1`.
4. **Expected logs** when the callee answers: NDJSON `twilio_audio_ws:deepgram_init` (STT model / TTS voice), then `AudioDebugLogger: first audio chunk call_id=...` with PCM from Deepgram TTS (Twilio still receives 8 kHz µ-law after resampling).

If Deepgram logs **`HTTP 400` / `Unexpected error when initializing websocket connection`**, check **`DEEPGRAM_STT_MODEL`** — use a full model id (e.g. `nova-3-general`, `nova-2-general`), confirm **`DEEPGRAM_API_KEY`** is valid in [Deepgram Console](https://console.deepgram.com/), and ensure **`DEEPGRAM_STT_SAMPLE_RATE=8000`** matches Twilio’s stream.

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

