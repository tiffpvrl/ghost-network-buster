# Ghost Network Buster

AI voice auditor that calls every provider in an insurer's mental health directory and detects "ghost" listings — providers who are listed but unreachable, out-of-network, retired, or otherwise inaccessible. Generates regulatory complaint letters when the ghost rate exceeds legal thresholds.

Two portals share the same backend: a **patient portal** for individual spot-check audits and an **employer portal** for batch audits across multiple carriers and ZIPs, with financial exposure modeling and carrier renewal negotiation packet generation.

Built as a Columbia University Agentic AI capstone (May 2026).

---

## Live URL & Demo
Live URL can be found at: [https://ghost-network-buster.vercel.app/](url)

*NOTE* that the deployed version does not go through our Twilio/Deepgram/Pipecat pipeline because the free version of Twilio that we are using requires you to verify phone numbers that the agent calls via OTP. This means we were able to set it up so that it calls our personal phone numbers, but it cannot be run on actual providers' phone numbers. Rest assured that the voice agent is fully working and you can see this in our demo linked here: [https://drive.google.com/file/d/1LibFWn4MIqikXnhj9umDktob1XW0RHKF/view?usp=sharing](url)!

If you are interested in seeing the voice agent in action, you can clone this repo locally and set up your own Twilio, Deepgram, and Ngrok accounts – putting these into the .env file as listed in .env.example. On Twilio, you can then add your own phone number and verify yourself via OTP. Then, on data/providers_test.json, you can add your phone number. Finally, on .env, make sure you are setting "VOICE_PROVIDER" as "pipecat" and "PROVIDERS_DATA_FILE" as "data/providers_test.json".


## Class concepts → code

| Concept | Implementation |
|---------|---------------|
| **Agent framework (Google ADK)** | `ghost_network_buster/adk_blueprint.py` + `pipeline/adk_audit.py` — `SequentialAgent` runs directory load → bounded-parallel voice calls → optional graph classify → corpus retrieve → `LlmAgent` RAG bullets + letter body. Introspect: `GET /api/agents/graph`. Production path selected with **`USE_ADK_AUDIT`** (default: legacy `pipeline/run_audit.py` only). |
| **Multi-agent orchestration** | **ADK mode** (`USE_ADK_AUDIT=true`): `run_audit_with_adk()` drives a `Runner` and maps ADK events to **`WsHub`** (`type: adk_event`) while keeping **`summary`** broadcasts. **Legacy mode**: FastAPI `asyncio` + `run_audit_pipeline` only. |
| **Tool use** | `tools/voice_provider.py` (Twilio outbound calls), `tools/rag.py` (regulatory corpus retrieval), `tools/memory_tool.py` (per-NPI result memory) |
| **Hybrid classifier** | `agents/classifier.py` — keyword fast-path for high-confidence signals (disconnected, voicemail) with Gemini Flash LLM fallback. 8 ghost reason categories. |
| **RAG** | `tools/rag.py` — local TF-IDF over bundled regulatory corpus (`data/regulatory_corpus/`): NY ISC §3217-a/§4324, MHPAEA, NSA. RAG hits injected into complaint letters and returned in `AuditSummary.rag_hits`. |
| **LLM structured output** | `agents/classifier.py` — Gemini Flash returns `{status, ghost_reason, summary}` JSON. `agents/complaint_agent.py` — Gemini synthesizes a multi-page complaint letter grounded in RAG hits. |
| **Voice pipeline** | `main.py` (`/ws/twilio-audio/{call_id}`) — Twilio media stream → Pipecat 1.0 → Deepgram STT → `_VertexLLMProcessor` (Vertex Gemini, **streaming** `generate_content_stream` → `LLMTextFrame` chunks) → Deepgram TTS (**token** aggregation) → audio back to Twilio |
| **Parallel execution** | `pipeline/run_audit.py` — `asyncio.Semaphore(max_parallel_calls)` fans out provider calls concurrently |
| **Structured output / Pydantic** | `models.py` — `CallResult`, `AuditState`, `AuditSummary` with full type validation throughout |
| **Memory** | `tools/memory_tool.py` — per-NPI result JSON persisted to `data/memory_npi/` or `GCS_MEMORY_BUCKET` to avoid re-calling known providers |
| **Iterative refinement** | `pipeline/run_audit.py` — voicemail re-dial loop; high ghost-rate QA note appended to `loop_agent_note` |
| **WebSocket streaming** | `services/ws_hub.py` + `WsHub` — pushes `{type:"summary", data:...}` to the frontend after every completed call |
| **Persistence** | `services/audit_store.py` — in-process cache + local JSON + optional GCS. Audits survive server restarts when `AUDIT_LOCAL_DIR` or `GCS_AUDITS_BUCKET` is set. |
| **Evals / golden dataset** | `evals/call_scenarios.json` — 20 labeled transcript scenarios covering all 8 ghost types, 3 real confirmations, voicemail, STT noise, and edge cases. Runner: `pytest tests/test_classifier_eval.py` |
| **Demo replay mode** | `frontend/src/demo-data.ts` + `frontend/src/audio.ts` — fully client-side replay of a pre-canned audit at human-readable pace with synthesized Web Audio sound effects. No API calls placed. |

---

## Frontend architecture

The React + Vite + TypeScript frontend (`frontend/src/`) uses a **Beacon design system** — a consistent visual language shared across both portals.

### Design tokens

All color, spacing, and shadow values are CSS custom properties defined in `frontend/src/index.css`:

| Token group | Values |
|-------------|--------|
| Accent (primary) | `--accent: #5b3df5` (indigo violet) / dark: `#8b6dff` |
| Surface | `--surface`, `--surface-2`, `--bg` |
| Semantic | `--success` (real), `--danger` (ghost), `--warning` (voicemail) |
| Typography | Inter (UI), Instrument Serif italic (editorial accents), DM Mono (IDs, formulas) |
| Shadows | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |

Dark mode is toggled via `data-theme="dark"` on `<html>` (persisted in `localStorage`).

### Routing & roles

| Route | Role | Page |
|-------|------|------|
| `/app/patient` | patient | Patient dashboard — single audit spot-check |
| `/app/patient/audits/new` | patient | New audit form |
| `/app/patient/audits/:id` | patient | Live audit results |
| `/app/employer` | employer | Employer dashboard — network health overview |
| `/app/employer/audits/new` | employer | New batch audit form |
| `/app/employer/batches/:id` | employer | Batch drill-down |
| `/app/employer/audits/:id` | employer | Single audit detail |
| `/app/employer/packet` | employer | Carrier Renewal Negotiation Packet |

The shared `AppLayout` renders the Beacon sidebar + sticky topbar and injects an `<Outlet>` for page content. Role-gating is handled by `RequireAuth` + `RoleGate`.

---

## Employer portal

The employer portal targets HR/benefits teams running network adequacy compliance for a group plan. It adds several layers on top of the patient audit flow.

### Batch audits

An employer batch (`frontend/src/data/employerBatches.ts`) groups 1-to-N audits by carrier × ZIP. Each audit in the batch is assigned a simulated audit ID resolved by `frontend/src/data/employerSim.ts` against an 879-provider Aetna NYC pool (`frontend/src/data/providersPool.ts`, built from real NPPES + Aetna TiC data).

### Network health dashboard (`/app/employer`)

The employer home (`frontend/src/pages/app/EmployerHome.tsx`) surfaces:

- **Hero card** — animated 5×7 carrier-×-ZIP matrix visualization (diagonal ripple pulse)
- **Recent batches** — last 3 batch runs with status, carrier/ZIP counts, and timestamps
- **Ghost rate by carrier** — all audited carriers ranked by ghost rate with severity-coded bars (severe ≥70%, high ≥60%)
- **Financial exposure calculator** — live `headcount × 10% prevalence × weighted ghost rate × $4,783` estimate, editable headcount
- **Coverage gaps by ZIP** — stacked real/ghost bar per ZIP with provider counts
- **Carrier Renewal Negotiation Packet** — CTA card to build or view the packet (includes PDF memo, executive summary, and CSV evidence)

### Carrier Renewal Negotiation Packet (`/app/employer/packet`)

Client-side deterministic packet generator (`frontend/src/lib/negotiationPacket.ts`). Reads `EmployerAggregates` and produces a structured artifact with:

1. Executive summary
2. Negotiation asks (per-carrier ghost rate vs. legal threshold)
3. Market evidence (cross-carrier benchmark)
4. Financial concession targets
5. Recommended contract language
6. Provider evidence appendix

The packet UI (`frontend/src/pages/app/EmployerPacket.tsx`) renders a print-ready layout. The negotiation packet PDF renderer lives in `frontend/src/lib/negotiationPacketPdf.ts`.

> **Note:** The ADK orchestrator wiring (`adk_blueprint.py`) is scaffolded but intentionally not connected to the packet generator. The current implementation is fully deterministic and client-side — no LLM call is made for packet generation.

---

## Simulation data

The employer portal runs entirely client-side against a curated simulation dataset — no backend calls are made for employer audits.

**Provider pool:** 879 real Aetna NYC behavioral-health providers from NPPES + Aetna Transparency in Coverage MRF data, stored in `frontend/src/data/providersPool.ts`. Phone numbers are masked (555-XXXX).

**Audit simulation:** `frontend/src/data/employerSim.ts` deterministically resolves each `(carrier, zip, auditId)` tuple to a set of call results. Ghost rates are seeded to reflect realistic NYC market conditions (60–92% by carrier in the sample data).

**Multi-variant transcripts:** Each simulated call pulls a transcript variant from a pool covering all 8 ghost reason types, realistic provider dialogue, and STT-noise variants.

**Dynamic demo context:** URL params (`?carrier=`, `?zip=`, `?careNeed=`) inject live context into the voice agent simulation for demo personalization.

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

- Patient portal: log in with role `patient`
- Employer portal: log in with role `employer` (or append `?role=employer` in demo)

### GCP Cloud Shell (single command)

From the **repository root** (the directory that contains `pyproject.toml` and `frontend/`):

```bash
bash scripts/run-web-cloudshell.sh
```

For **real Twilio / Pipecat** on this same machine, pass **`--with-ngrok`** so the script starts **ngrok → 8000** and **exports `PUBLIC_URL`** for `uvicorn`:

```bash
bash scripts/run-web-cloudshell.sh --with-ngrok
```

This installs **uv** if missing, runs **`uv sync`** (and **`uv sync --extra pipecat`** when **`VOICE_PROVIDER=pipecat`**), creates **`.env`** from **`.env.example`** when missing, installs npm deps once, then starts the API on **0.0.0.0:8000** and Vite on **0.0.0.0:5173**.

In Cloud Shell, open **Web Preview → Preview on port 5173**.

---

## Demo mode (no calls placed)

Visit **http://localhost:5173/?demo=true** or click **"Watch demo"** on the landing page.

- Replays 8 pre-canned providers at 2.5s per call with synthesized sound effects
- SIT tri-tone for disconnected numbers, chime for confirmed real providers
- After replay: click any tile to pin its transcript in the live call panel
- Downloads (PDF summary, complaint DOCX) work via `/api/download/*/demo` — seeded at startup

The employer portal demo runs entirely client-side (no backend required) — the simulation data and aggregation are computed in-browser from `localStorage`.

---

## Deployed simulation (default — no Twilio)

For a publicly shared URL the patient pipeline must not place real phone calls. The repo's `.env.example` is configured for this by default:

```env
VOICE_PROVIDER=mock
PROVIDERS_DATA_FILE=data/providers_sim.json
MOCK_VOICE_DELAY_MIN_S=6
MOCK_VOICE_DELAY_MAX_S=9
MOCK_VOICE_REAL_SHARE=0.35
MAX_PARALLEL_CALLS=1
```

- `MockVoiceProvider` fabricates `CallResult`s entirely server-side — no Twilio, no Pipecat, no outbound HTTP — at 6–9 s per call.
- 12 NY-themed synthetic providers in `data/providers_sim.json` with masked `212`/`718` 555-XXXX phone numbers.
- Outcome variety covers all 7 ghost reasons plus `voicemail` and `real`.
- The full RAG + ADK complaint-letter path runs unchanged.

Total wall-clock for a default 12-provider audit at `MAX_PARALLEL_CALLS=1`: roughly 60–100 s.

To **place real calls** locally, uncomment the override block at the bottom of `.env`:

```env
VOICE_PROVIDER=pipecat
PROVIDERS_DATA_FILE=data/providers_test.json
```

…and supply Twilio + Deepgram credentials. The cost guard `PIPECAT_COST_GUARD=5` prevents accidental large fan-outs.

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

---

## Pipecat + Deepgram live smoke test

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
2. Run `bash scripts/run-web-cloudshell.sh --with-ngrok` (exports `PUBLIC_URL` from ngrok) or start ngrok yourself and set `PUBLIC_URL` in `.env`.
3. `POST /api/start-audit` with `max_providers: 1`

**Expected logs on answer:** `twilio_audio_ws:deepgram_init` → `AudioDebugLogger: first audio chunk`.

If Deepgram returns HTTP 400: check `DEEPGRAM_STT_MODEL` (use `nova-3-general` or `nova-2-general`), confirm `DEEPGRAM_STT_SAMPLE_RATE=8000`.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/start-audit` | Start a patient audit. Set **`USE_ADK_AUDIT=true`** to run the full ADK graph; default uses legacy pipeline. |
| `GET` | `/api/summary/{id}` | Current audit summary including `rag_hits` when completed |
| `GET` | `/api/status/{id}` | Raw `AuditState` |
| `WS` | `/ws/audit/{id}` | Live push: `{type:"summary", data:...}` after each call; ADK audits also emit `{type:"adk_event", ...}` |
| `GET` | `/api/download/summary/{id}` | PDF audit report |
| `GET` | `/api/download/complaint/{id}` | DOCX regulatory complaint (requires ghost rate > 0) |
| `POST` | `/api/seed-demo` | Seed the fixed demo audit state (called automatically at startup) |
| `GET` | `/api/agents/graph` | ADK agent tree as JSON |
| `GET` | `/api/health` | Health check |

> Employer batch audits, network health aggregation, negotiation packet generation, and quick exports are all **client-side** — they read/write `localStorage` and require no additional backend endpoints.

---

## Real directory data (NPPES + Aetna TiC)

Use the ingestion CLI to build a provider list from CMS NPPES (behavioral health by ZIP) joined with an Aetna in-network MRF (streamed via `ijson`). See `data_ingestion_README.md` and:

```bash
python -m ghost_network_buster.data_ingestion.join_providers --help
```

Set `PROVIDERS_DATA_FILE` in `.env` to point the API at the output file. Default: `data/providers_test.json`.

The employer simulation pool (`frontend/src/data/providersPool.ts`) was built from this same pipeline and contains 879 deduplicated behavioral-health providers across NYC ZIPs (10001, 10027, 11201, and others).

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
