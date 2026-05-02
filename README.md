# Ghost Network Buster

AI voice auditor that calls every provider in an insurer's mental health directory and detects "ghost" listings — providers who are listed but unreachable, out-of-network, retired, or otherwise inaccessible. Generates regulatory complaint letters when the ghost rate exceeds legal thresholds.

Built as a Columbia University Agentic AI capstone (May 2026).

---

## Class concepts → code

| Concept | Implementation |
|---------|---------------|
| **Agent framework (Google ADK)** | `ghost_network_buster/adk_blueprint.py` — `SequentialAgent` orchestrates the full audit; `ParallelAgent` fans out provider calls; `LlmAgent` nodes for classifier, RAG retrieval, and complaint synthesis. Introspect the live tree: `GET /api/agents/graph` |
| **Multi-agent orchestration** | Same file: directory loader → parallel callers → hybrid classifier → RAG retrieval → complaint synthesizer. Each node is an independently testable ADK agent. |
| **Tool use** | `tools/voice_provider.py` (Twilio outbound calls), `tools/rag.py` (regulatory corpus retrieval), `tools/memory_tool.py` (per-NPI result memory) |
| **Hybrid classifier** | `agents/classifier.py` — keyword fast-path for high-confidence signals (disconnected, voicemail) with Gemini Flash LLM fallback for all other cases. 8 ghost reason categories. |
| **RAG** | `tools/rag.py` — local TF-IDF over bundled regulatory corpus (`data/regulatory_corpus/`): NY ISC §3217-a/§4324, MHPAEA, NSA. RAG hits injected into complaint letters and returned in `AuditSummary.rag_hits`. |
| **LLM structured output** | `agents/classifier.py` — Gemini Flash returns `{status, ghost_reason, summary}` JSON. `agents/complaint_agent.py` — Gemini synthesizes a multi-page complaint letter grounded in RAG hits. |
| **Voice pipeline** | `main.py` (`/ws/twilio-audio/{call_id}`) — Twilio media stream → Pipecat 1.0 → Deepgram STT → `_VertexLLMProcessor` (Gemini 2.0 Flash on Vertex AI) → Deepgram TTS → audio back to Twilio |
| **Parallel execution** | `pipeline/run_audit.py` — `asyncio.Semaphore(max_parallel_calls)` fans out provider calls concurrently |
| **Structured output / Pydantic** | `models.py` — `CallResult`, `AuditState`, `AuditSummary` with full type validation throughout |
| **Memory** | `tools/memory_tool.py` — per-NPI result JSON persisted to `data/memory_npi/` or `GCS_MEMORY_BUCKET` to avoid re-calling known providers |
| **Iterative refinement** | `pipeline/run_audit.py` — voicemail re-dial loop; high ghost-rate QA note appended to `loop_agent_note` |
| **WebSocket streaming** | `services/ws_hub.py` + `WsHub` — pushes `{type:"summary", data:...}` to the frontend after every completed call |
| **Persistence** | `services/audit_store.py` — in-process cache + local JSON + optional GCS. Audits survive server restarts when `AUDIT_LOCAL_DIR` or `GCS_AUDITS_BUCKET` is set. |
| **Evals / golden dataset** | `evals/call_scenarios.json` — 20 labeled transcript scenarios covering all 8 ghost types, 3 real confirmations, voicemail, STT noise, and edge cases. Runner: `pytest tests/test_classifier_eval.py` |
| **Demo replay mode** | `frontend/src/demo-data.ts` + `frontend/src/audio.ts` — fully client-side replay of a pre-canned audit at human-readable pace with synthesized Web Audio sound effects (SIT tone, chimes, arpeggio). No API calls placed. |

---

## Quick start (local)

### Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 18+
- A `.env` file (copy from `.env.example`)

### Backend

```bash
cd ghost-network-buster
uv sync
cp .env.example .env
# Edit .env — minimum for mock mode: VOICE_PROVIDER=mock
uv run uvicorn ghost_network_buster.main:app --reload --port 8000
```

On startup you will see:
```
INFO ghost_network_buster.main: Demo audit state seeded (audit_id=demo)
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — Vite proxies `/api` and `/ws` to port 8000.

---

## Demo mode (no calls placed)

Visit **http://localhost:5173/?demo=true** or click **"Watch demo"** on the landing page.

- Replays 8 pre-canned providers at 2.5s per call with synthesized sound effects
- SIT tri-tone for disconnected numbers, chime for confirmed real providers
- After replay: click any tile to pin its transcript in the live call panel
- Downloads (PDF summary, complaint DOCX) work via `/api/download/*/demo` — seeded at startup

The demo requires the backend to be running (for downloads), but places zero Twilio calls.

---

## Running tests

```bash
# Full test suite
uv run pytest tests/ -v

# Classifier eval only (keyword-path scenarios run offline; LLM scenarios need GCP)
uv run pytest tests/test_classifier_eval.py -v

# Keyword fast-path only — no GCP required
uv run pytest tests/test_classifier_eval.py -v -k "S01 or S02 or S16 or S17"
```

The eval suite loads `evals/call_scenarios.json` and runs `classify_transcript()` against each labeled scenario. LLM-path scenarios are automatically skipped when `GOOGLE_CLOUD_PROJECT` is not set.

---

## Pipecat + Deepgram live smoke test

To verify the full voice pipeline (real Twilio calls):

1. Set in `.env`:
   ```
   VOICE_PROVIDER=pipecat
   MAX_PARALLEL_CALLS=1
   PUBLIC_URL=https://<ngrok-or-deployed-url>
   DEEPGRAM_API_KEY=...
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1...
   GOOGLE_CLOUD_PROJECT=...
   ```
2. Start ngrok: `ngrok http 8000` and update `PUBLIC_URL` in `.env`
3. `uv run uvicorn ghost_network_buster.main:app --reload --port 8000`
4. `POST /api/start-audit` with `max_providers: 1`

**Expected logs on answer:** `twilio_audio_ws:deepgram_init` → `AudioDebugLogger: first audio chunk`.

If Deepgram returns HTTP 400: check `DEEPGRAM_STT_MODEL` (use `nova-3-general` or `nova-2-general`), confirm `DEEPGRAM_STT_SAMPLE_RATE=8000`.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/start-audit` | Start an audit. Body: `carrier`, `zip_code`, `care_needs`, optional `max_providers`, `override_cost_guard` |
| `GET` | `/api/summary/{id}` | Current audit summary including `rag_hits` when completed |
| `GET` | `/api/status/{id}` | Raw `AuditState` |
| `WS` | `/ws/audit/{id}` | Live push: `{type:"summary", data:...}` after each call |
| `GET` | `/api/download/summary/{id}` | PDF audit report |
| `GET` | `/api/download/complaint/{id}` | DOCX regulatory complaint (requires ghost rate > 0) |
| `POST` | `/api/seed-demo` | Seed the fixed demo audit state — called automatically at startup |
| `GET` | `/api/agents/graph` | ADK agent tree as JSON |
| `POST` | `/api/agents/classify` | Run the ADK classifier agent on a transcript |
| `GET` | `/api/health` | Health check |

---

## Real directory data (NPPES + Aetna TiC)

Use the ingestion CLI to build a provider list from CMS NPPES (behavioral health by ZIP) joined with an Aetna in-network MRF (streamed via `ijson`). See `data_ingestion_README.md` and:

```bash
python -m ghost_network_buster.data_ingestion.join_providers --help
```

Set `PROVIDERS_DATA_FILE` in `.env` to point the API at the output file. Default: `data/providers_test.json`.

---

## GCP / Cloud Run

1. **Deploy**: `gcloud run deploy --source .` or build and push to Artifact Registry.
2. **Minimum env vars**:
   - `CORS_ORIGINS` — frontend origin(s), comma-separated
   - `GOOGLE_CLOUD_PROJECT` — required for Vertex AI (LLM + classifier)
   - `GCS_AUDITS_BUCKET` — optional; without it audits use `AUDIT_LOCAL_DIR` (ephemeral on Cloud Run)
   - `GCS_MEMORY_BUCKET` — optional NPI memory persistence
   - `DEMO_API_KEY` — recommended for public-facing deployments
3. **IAM**: runtime service account needs `roles/storage.objectAdmin` on audit/memory buckets and Vertex AI user role.
4. **Frontend**: build with `VITE_API_BASE=https://<cloud-run-url>` and host on Firebase Hosting or Cloud Storage + HTTPS.
