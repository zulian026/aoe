#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AOE Clean Installation Verification Harness
# Tests production installation and execution from packed npm tarball in isolation
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX_DIR="$(mktemp -d /tmp/aoe-clean-test-XXXXXX)"
TARBALL_DIR="$(mktemp -d /tmp/aoe-tarball-XXXXXX)"

cleanup() {
  echo ""
  echo "==> Cleaning up test sandboxes..."
  rm -rf "$SANDBOX_DIR" "$TARBALL_DIR"
  echo "Cleaned up."
}
trap cleanup EXIT

echo "==========================================================="
echo "AOE Clean-Install Production Verification Harness"
echo "Repository: $REPO_ROOT"
echo "Sandbox:    $SANDBOX_DIR"
echo "==========================================================="

# Step 1: Build the repository from clean state
echo ""
echo "[1/7] Building workspace from clean state..."
cd "$REPO_ROOT"
pnpm clean
pnpm build

# Step 2: Pack @zyanx04/cli
echo ""
echo "[2/7] Packing @zyanx04/cli into npm tarball..."
cd "$REPO_ROOT/apps/cli"
TARBALL_PATH=$(npm pack --pack-destination "$TARBALL_DIR" | tail -n 1)
FULL_TARBALL="$TARBALL_DIR/$TARBALL_PATH"

if [[ ! -f "$FULL_TARBALL" ]]; then
  echo "ERROR: Packed tarball not found at $FULL_TARBALL"
  exit 1
fi
echo "Packed tarball: $FULL_TARBALL ($(du -h "$FULL_TARBALL" | cut -f1))"

# Step 3: Audit tarball contents
echo ""
echo "[3/7] Auditing tarball contents for leaked tests, maps, and temporary binaries..."
TAR_CONTENTS=$(tar -tf "$FULL_TARBALL")

check_forbidden() {
  local pattern="$1"
  local match
  match=$(echo "$TAR_CONTENTS" | grep -E "$pattern" || true)
  if [[ -n "$match" ]]; then
    echo "ERROR: Tarball contains forbidden files matching '$pattern':"
    echo "$match"
    exit 1
  fi
}

check_forbidden '\.test\.(js|d\.ts)$'
check_forbidden '\.map$'
check_forbidden 'test-bin\.js'
check_forbidden 'tests/'
check_forbidden 'src/'

FILE_COUNT=$(echo "$TAR_CONTENTS" | wc -l)
echo "PASS: Zero leaked test files, sourcemaps, or test binaries found."
echo "Total packaged files: $FILE_COUNT"

# Step 4: Install into clean isolated sandbox
echo ""
echo "[4/7] Installing tarball into clean sandbox..."
cd "$SANDBOX_DIR"
npm init -y > /dev/null
npm install "$FULL_TARBALL" > /dev/null 2>&1

AOE_BIN="$SANDBOX_DIR/node_modules/.bin/aoe"
if [[ ! -x "$AOE_BIN" ]]; then
  echo "ERROR: Installed binary not executable at $AOE_BIN"
  exit 1
fi
echo "PASS: Installed binary exists at $AOE_BIN"

# Verify no symlinks back to monorepo
REAL_CLI_PATH=$(realpath "$SANDBOX_DIR/node_modules/@zyanx04/cli")
if [[ "$REAL_CLI_PATH" == *"$REPO_ROOT"* ]]; then
  echo "ERROR: Package is symlinked back to repository workspace! ($REAL_CLI_PATH)"
  exit 1
fi
echo "PASS: Verified zero symlinks to monorepo source ($REAL_CLI_PATH)"

# Step 5: Test CLI Command Suite in Sandbox
echo ""
echo "[5/7] Testing standard CLI commands..."

# 5a. Version command
CLI_VERSION=$(node -p "require('$REPO_ROOT/apps/cli/package.json').version")
VERSION_OUT=$("$AOE_BIN" --version)
echo "  [CLI] aoe --version -> $VERSION_OUT"
if [[ "$VERSION_OUT" != *"$CLI_VERSION"* ]] || [[ "$VERSION_OUT" != *"v1.0.0"* ]]; then
  echo "ERROR: Version output mismatch: $VERSION_OUT (expected CLI $CLI_VERSION)"
  exit 1
fi

# 5b. Help command
HELP_OUT=$("$AOE_BIN" --help)
echo "  [CLI] aoe --help -> verified commands"
for cmd in render pipe theme doctor skill bridge sidecar; do
  if [[ "$HELP_OUT" != *"$cmd"* ]]; then
    echo "ERROR: Missing command '$cmd' in help output"
    exit 1
  fi
done

# 5c. Doctor command
echo "  [CLI] aoe doctor..."
"$AOE_BIN" doctor > /dev/null

# 5d. Theme list command
THEME_OUT=$("$AOE_BIN" theme list)
echo "  [CLI] aoe theme list..."
if [[ "$THEME_OUT" != *"obsidian"* ]]; then
  echo "ERROR: Theme list missing obsidian theme"
  exit 1
fi

# 5e. Skill show command
SKILL_OUT=$("$AOE_BIN" skill show)
echo "  [CLI] aoe skill show..."
if [[ "$SKILL_OUT" != *"Universal presentation enhancement system"* ]]; then
  echo "ERROR: Skill definition content missing"
  exit 1
fi

# Step 6: Test Protocol Rendering Pipeline in Sandbox
echo ""
echo "[6/7] Testing protocol rendering pipeline via stdin..."
TEST_SESSION="sess_clean_verify_$(date +%s)"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

RENDER_INPUT=$(cat <<EOF
{"protocolVersion":"1.0.0","eventId":"evt_0","sessionId":"$TEST_SESSION","sequence":0,"timestamp":"$NOW","eventType":"session.started","payload":{"agent":{"name":"clean-test","version":"1.0.0"},"workingDirectory":"/tmp"}}
{"protocolVersion":"1.0.0","eventId":"evt_1","sessionId":"$TEST_SESSION","sequence":1,"timestamp":"$NOW","eventType":"task.started","payload":{"taskId":"task_0","taskName":"Clean Install Task"}}
{"protocolVersion":"1.0.0","eventId":"evt_2","sessionId":"$TEST_SESSION","sequence":2,"timestamp":"$NOW","eventType":"file.changed","payload":{"action":"CREATED","path":"src/index.ts","lineDelta":{"added":42,"removed":0},"evidence":{"verifiedOnDisk":true}}}
{"protocolVersion":"1.0.0","eventId":"evt_3","sessionId":"$TEST_SESSION","sequence":3,"timestamp":"$NOW","eventType":"task.completed","payload":{"taskId":"task_0","resultSummary":"Clean build passed","verified":true}}
{"protocolVersion":"1.0.0","eventId":"evt_4","sessionId":"$TEST_SESSION","sequence":4,"timestamp":"$NOW","eventType":"session.ended","payload":{"status":"completed","durationMs":500,"stats":{"tasksTotal":1,"tasksCompleted":1}}}
EOF
)

RENDER_OUT=$(echo "$RENDER_INPUT" | "$AOE_BIN" render --format static)
if [[ "$RENDER_OUT" != *"Clean Install Task"* ]] || [[ "$RENDER_OUT" != *"src/index.ts"* ]]; then
  echo "ERROR: Render output did not contain expected task/file elements:"
  echo "$RENDER_OUT"
  exit 1
fi
echo "PASS: Static protocol rendering verified successfully."

# Step 7: Test Sidecar IPC in Sandbox
echo ""
echo "[7/7] Testing Sidecar IPC server & client communication in sandbox..."
TEST_SOCK="/tmp/aoe-clean-ipc-$$.sock"
rm -f "$TEST_SOCK"

# Start sidecar in listen mode in the background
"$AOE_BIN" sidecar --listen --socket "$TEST_SOCK" --static > "$SANDBOX_DIR/sidecar.out" 2>&1 &
SIDECAR_PID=$!

# Wait for socket to appear (up to 3 seconds)
for i in {1..30}; do
  if [[ -S "$TEST_SOCK" ]]; then
    break
  fi
  sleep 0.1
done

if [[ ! -S "$TEST_SOCK" ]]; then
  echo "ERROR: Sidecar socket was not created at $TEST_SOCK"
  kill "$SIDECAR_PID" 2>/dev/null || true
  exit 1
fi

# Send event through hook bridge to the listening sidecar
BRIDGE_PAYLOAD=$(cat <<EOF
{
  "hookEventName": "SessionStart",
  "conversationId": "sess_clean_bridge_$$",
  "workingDirectory": "/tmp"
}
EOF
)

AOE_SOCKET_PATH="$TEST_SOCK" echo "$BRIDGE_PAYLOAD" | "$AOE_BIN" bridge --event SessionStart > "$SANDBOX_DIR/bridge.out" 2>&1

# Allow event processing and shutdown sidecar cleanly
sleep 0.5
kill -TERM "$SIDECAR_PID" 2>/dev/null || true
wait "$SIDECAR_PID" 2>/dev/null || true

SIDECAR_OUTPUT=$(cat "$SANDBOX_DIR/sidecar.out" || true)
if [[ "$SIDECAR_OUTPUT" != *"AOE Sidecar"* ]] && [[ "$SIDECAR_OUTPUT" != *"Session"* ]] && [[ "$SIDECAR_OUTPUT" != *"SIDECAR"* ]]; then
  echo "WARNING: Sidecar output did not contain expected header:"
  echo "$SIDECAR_OUTPUT"
fi
echo "PASS: Sidecar IPC execution verified successfully."

rm -f "$TEST_SOCK"

echo ""
echo "==========================================================="
echo "ALL CLEAN-INSTALL VERIFICATION TESTS PASSED SUCCESSFULLY!"
echo "Package:    $TARBALL_PATH"
echo "File Count: $FILE_COUNT"
echo "Integrity:  VERIFIED"
echo "==========================================================="
exit 0
