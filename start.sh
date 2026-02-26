#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTAINER_NAME="agentsmith-api"
API_PORT=6001
WEB_PORT=6080
CONFIG_DIR="$HOME/.config/agentsmith"
CONFIG_FILE="$CONFIG_DIR/config"
DATA_DIR="$CONFIG_DIR/data"
API_URL="http://localhost:$API_PORT"

# -- Parse flags -------------------------------------------------------------
CLEAN=false
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# -- Cleanup on exit ---------------------------------------------------------
cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "${LOGS_PID:-}" ]; then
    kill "$LOGS_PID" 2>/dev/null || true
  fi
  if [ -n "${WEB_PID:-}" ]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  echo "Web server stopped. Docker container '$CONTAINER_NAME' left running."
  echo "  Stop it with: docker stop $CONTAINER_NAME"
}
trap cleanup EXIT

# -- 0. Stop existing processes ----------------------------------------------
echo "==> Stopping existing processes..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
lsof -ti :"$WEB_PORT" | xargs kill 2>/dev/null || true

# -- 1. Build & run API via Docker -------------------------------------------
echo "==> Starting API server on port $API_PORT..."

echo "    Building Docker image..."
docker build -t agentsmith-api -f "$SCRIPT_DIR/backend/Dockerfile" "$SCRIPT_DIR/backend" --quiet

echo "    Starting container..."
if [ "$CLEAN" = true ]; then
  echo "    Cleaning data directory: $DATA_DIR"
  rm -rf "$DATA_DIR"
fi
mkdir -p "$DATA_DIR"
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$API_PORT:3000" \
  -v "$DATA_DIR:/data" \
  -e AUTH_DISABLED=true \
  agentsmith-api >/dev/null

# Wait for API to be ready
echo -n "    Waiting for API"
for i in $(seq 1 30); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 0.5
done

# -- 2. Ensure config --------------------------------------------------------
echo "==> Checking config at $CONFIG_FILE..."
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "AGENTSMITH_SERVER_URL=$API_URL" > "$CONFIG_FILE"
  echo "    Created config with AGENTSMITH_SERVER_URL=$API_URL"
elif grep -q "^AGENTSMITH_SERVER_URL=" "$CONFIG_FILE"; then
  sed -i '' "s|^AGENTSMITH_SERVER_URL=.*|AGENTSMITH_SERVER_URL=$API_URL|" "$CONFIG_FILE"
  echo "    Updated AGENTSMITH_SERVER_URL=$API_URL"
else
  echo "AGENTSMITH_SERVER_URL=$API_URL" >> "$CONFIG_FILE"
  echo "    Added AGENTSMITH_SERVER_URL=$API_URL"
fi

# -- 3. Serve frontend -------------------------------------------------------
echo "==> Starting web server on port $WEB_PORT..."
cd "$SCRIPT_DIR/frontend"
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
WEB_PID=$!

echo ""
echo "  API:  $API_URL"
echo "  Web:  http://localhost:$WEB_PORT"
echo ""

open "http://localhost:$WEB_PORT" 2>/dev/null || true

echo "Press Ctrl-C to stop. Tailing API logs below..."
echo ""
docker logs -f "$CONTAINER_NAME" &
LOGS_PID=$!
wait "$WEB_PID"
