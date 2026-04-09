#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-dev}"

cd "$ROOT_DIR"

print_help() {
  cat <<'EOF'
Usage: ./start.sh [dev|prod|worker|help]

Modes:
  dev     Start the Next.js development server (default)
  prod    Build the app and start the production server
  worker  Start the refresh worker
  help    Show this message
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_command npm

if [[ ! -f package.json ]]; then
  echo "package.json was not found in $ROOT_DIR" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Dependencies are not installed. Run: npm install" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Warning: .env was not found. The app may start, but Twitch features will be unavailable." >&2
fi

case "$MODE" in
  dev)
    echo "Starting development server on http://localhost:3000"
    npm run dev
    ;;
  prod)
    echo "Building app and starting production server"
    npm run build
    npm run start
    ;;
  worker)
    echo "Starting refresh worker"
    npm run worker
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    print_help
    exit 1
    ;;
esac
