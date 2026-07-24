#!/usr/bin/env bash
set -euo pipefail

APP_NAME="OSM Tactical Map"
NODE_VERSION="22"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5173}"
URL="http://localhost:${PORT}"

echo "=== ${APP_NAME} installer / launcher ==="
echo "Project: ${PROJECT_DIR}"
cd "${PROJECT_DIR}"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

# Load nvm if it already exists.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

# Install nvm if node/npm are missing and nvm is missing.
if ! need_cmd node || ! need_cmd npm; then
  if ! command -v nvm >/dev/null 2>&1; then
    echo "Node/npm not found. Installing nvm first..."
    if ! need_cmd curl; then
      echo "curl is required to install nvm. Install curl, then run this script again."
      echo "Ubuntu/Debian: sudo apt update && sudo apt install -y curl"
      exit 1
    fi
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
fi

# Use Node 22 through nvm when available. If system node is already present, still prefer nvm for consistency.
if command -v nvm >/dev/null 2>&1; then
  echo "Installing/using Node ${NODE_VERSION} via nvm..."
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
fi

if ! need_cmd npm; then
  echo "npm is still not available. Please install Node.js 22 or nvm, then rerun this script."
  exit 1
fi

echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

# Fresh install when node_modules is absent. Preserve package-lock if present.
if [ ! -d node_modules ]; then
  echo "Installing project dependencies..."
  npm install
else
  echo "Dependencies already installed. Skipping npm install."
fi

open_url() {
  sleep 2
  if need_cmd xdg-open; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif need_cmd gio; then
    gio open "$URL" >/dev/null 2>&1 || true
  else
    echo "Open this in your browser: $URL"
  fi
}

open_url &

echo "Starting dev server at ${URL} ..."
echo "Press Ctrl+C in this terminal to stop the server."
npm run dev -- --host 0.0.0.0 --port "$PORT"
