#!/usr/bin/env bash
set -euo pipefail

APP_NAME="OSM Tactical Map"
NODE_VERSION="22"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5173}"
URL="http://localhost:${PORT}"

echo "=== ${APP_NAME} installer / launcher ==="
cd "${PROJECT_DIR}"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

if ! need_cmd node || ! need_cmd npm; then
  if ! command -v nvm >/dev/null 2>&1; then
    echo "Node/npm not found. Installing nvm first..."
    if ! need_cmd curl; then
      echo "curl is required to install nvm. Install Xcode Command Line Tools or curl, then rerun this script."
      exit 1
    fi
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
  fi
fi

if command -v nvm >/dev/null 2>&1; then
  echo "Installing/using Node ${NODE_VERSION} via nvm..."
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
fi

if [ ! -d node_modules ]; then
  echo "Installing project dependencies..."
  npm install
else
  echo "Dependencies already installed. Skipping npm install."
fi

(sleep 2; open "$URL" >/dev/null 2>&1 || true) &

echo "Starting dev server at ${URL} ..."
echo "Press Ctrl+C in this terminal to stop the server."
npm run dev -- --host 0.0.0.0 --port "$PORT"
