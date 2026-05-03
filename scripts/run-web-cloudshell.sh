#!/usr/bin/env bash
# One-shot dev stack for GCP Cloud Shell (or any Linux box): API + Vite with proxy.
#
# Usage (from repo root):
#   bash scripts/run-web-cloudshell.sh
#   bash scripts/run-web-cloudshell.sh --with-ngrok   # Pipecat / Twilio: export PUBLIC_URL from ngrok
#   GHB_WITH_NGROK=1 bash scripts/run-web-cloudshell.sh
#
# Ngrok: https://ngrok.com/download — then once:
#   ngrok config add-authtoken <token>

set -euo pipefail

WITH_NGROK=0
for arg in "$@"; do
  case "$arg" in
    --with-ngrok) WITH_NGROK=1 ;;
    -h|--help)
      echo "Usage: bash scripts/run-web-cloudshell.sh [--with-ngrok]"
      echo "  --with-ngrok   Start ngrok on port 8000 and export PUBLIC_URL (for VOICE_PROVIDER=pipecat / Twilio)"
      exit 0
      ;;
  esac
done
if [[ "${GHB_WITH_NGROK:-}" == "1" ]]; then
  WITH_NGROK=1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "Could not find uv after install. Add ~/.local/bin to PATH and retry." >&2
  exit 1
fi

# Cloud Shell has a small $HOME; stale caches often push installs over the limit.
if [[ "${CLOUD_SHELL:-}" == "true" ]]; then
  echo "Cloud Shell: pruning uv/pip caches to free disk…"
  uv cache prune 2>/dev/null || true
  rm -rf "${HOME}/.cache/pip" 2>/dev/null || true
fi

echo "Syncing Python dependencies…"
set +e
uv sync
_uv_ec=$?
set -e
if [[ "${_uv_ec}" -ne 0 ]]; then
  echo "" >&2
  echo "uv sync failed. If the error was 'No space left on device', free space and retry:" >&2
  echo "  uv cache prune && rm -rf ~/.cache/uv ~/.cache/pip" >&2
  echo "  # optional: docker system prune -af" >&2
  echo "  df -h ~" >&2
  exit "${_uv_ec}"
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example (VOICE_PROVIDER=mock is fine for the UI)."
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. On Cloud Shell, install Node or use: sudo apt-get update && sudo apt-get install -y npm" >&2
  exit 1
fi

cd "${ROOT}/frontend"
if [[ ! -d node_modules ]]; then
  echo "Installing frontend dependencies…"
  npm install
fi
cd "${ROOT}"

API_PID=""
NGROK_PID=""
cleanup() {
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${NGROK_PID}" ]] && kill -0 "${NGROK_PID}" 2>/dev/null; then
    kill "${NGROK_PID}" 2>/dev/null || true
    wait "${NGROK_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

_ngrok_public_url() {
  python3 - <<'PY' 2>/dev/null || true
import json, sys, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as r:
        data = json.load(r)
except Exception:
    sys.exit(1)
for t in data.get("tunnels") or []:
    if t.get("proto") == "https":
        print(t.get("public_url", "").rstrip("/"))
        raise SystemExit(0)
raise SystemExit(1)
PY
}

if [[ "${WITH_NGROK}" -eq 1 ]]; then
  if ! command -v ngrok >/dev/null 2>&1; then
    echo "ngrok not found. Install: https://ngrok.com/download" >&2
    echo "Then: ngrok config add-authtoken <your-token>" >&2
    exit 1
  fi
  echo "Starting ngrok → localhost:8000 (inspector: http://127.0.0.1:4040)…"
  ngrok http 8000 --log=stderr >/dev/null 2>&1 &
  NGROK_PID=$!

  PUBLIC_URL_RESOLVED=""
  for _ in $(seq 1 40); do
    PUBLIC_URL_RESOLVED="$(_ngrok_public_url || true)"
    if [[ -n "${PUBLIC_URL_RESOLVED}" ]]; then
      break
    fi
    sleep 0.25
  done
  if [[ -z "${PUBLIC_URL_RESOLVED}" ]]; then
    echo "Could not read HTTPS URL from ngrok (http://127.0.0.1:4040/api/tunnels). Is ngrok authenticated?" >&2
    exit 1
  fi
  export PUBLIC_URL="${PUBLIC_URL_RESOLVED}"
  echo ""
  echo "PUBLIC_URL=${PUBLIC_URL}  (exported for uvicorn in this session)"
  echo "Optional: set the same in .env if you restart the API outside this script."
  echo ""
fi

echo "Starting API on 0.0.0.0:8000…"
uv run uvicorn ghost_network_buster.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!

# Brief wait so Vite's first proxied /api calls do not race a slow import.
sleep 1

echo ""
echo "Starting Vite on 0.0.0.0:5173 (proxies /api and /ws → 8000)."
echo "  • Local:     http://localhost:5173"
echo "  • Cloud Shell: Web Preview → port 5173"
echo "  • Demo UI:   http://localhost:5173/?demo=true"
if [[ "${WITH_NGROK}" -eq 1 ]]; then
  echo "  • Twilio:    keep this terminal open; webhooks use PUBLIC_URL above"
fi
echo ""

cd "${ROOT}/frontend"
# No exec: EXIT trap stops uvicorn (and ngrok) when Vite exits.
npm run dev
