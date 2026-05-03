#!/usr/bin/env bash
# One-shot dev stack for GCP Cloud Shell (or any Linux box): API + Vite with proxy.
# Usage (from repo root):  bash scripts/run-web-cloudshell.sh

set -euo pipefail

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

echo "Syncing Python dependencies…"
uv sync

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
cleanup() {
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

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
echo ""

cd "${ROOT}/frontend"
exec npm run dev
