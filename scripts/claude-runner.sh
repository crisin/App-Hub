#!/bin/bash
#
# claude-runner.sh — Pick up issues from the App Hub Claude lane and run Claude Code on them
#
# Usage:
#   ./scripts/claude-runner.sh              # Process one issue
#   ./scripts/claude-runner.sh --loop       # Keep polling (60s interval)
#   ./scripts/claude-runner.sh --loop 30    # Custom poll interval (seconds)
#   ./scripts/claude-runner.sh --dry-run    # Show what would run without executing
#
set -euo pipefail

# Ensure PATH includes common tool locations
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"

HUB_URL="${APPHUB_URL:-http://localhost:5174}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOOP=false
DRY_RUN=false
POLL_INTERVAL=60

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop)
      LOOP=true
      if [[ "${2:-}" =~ ^[0-9]+$ ]]; then
        POLL_INTERVAL="$2"
        shift
      fi
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown flag: $1"
      echo "Usage: $0 [--loop [interval_seconds]] [--dry-run]"
      exit 1
      ;;
  esac
done

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

log() { echo -e "${BLUE}[claude-runner]${RESET} $*"; }
warn() { echo -e "${YELLOW}[claude-runner]${RESET} $*"; }
success() { echo -e "${GREEN}[claude-runner]${RESET} $*"; }
error() { echo -e "${RED}[claude-runner]${RESET} $*"; }

# Find the claude binary
find_claude() {
  # 1. Check PATH
  if command -v claude &>/dev/null; then
    echo "claude"
    return
  fi

  # 2. Check Claude Desktop App bundled CLI (macOS)
  local app_support="$HOME/Library/Application Support/Claude/claude-code"
  if [[ -d "$app_support" ]]; then
    # Find the latest version
    local latest
    latest=$(ls -v "$app_support" 2>/dev/null | tail -1)
    if [[ -n "$latest" ]]; then
      local bin="$app_support/$latest/claude.app/Contents/MacOS/claude"
      if [[ -x "$bin" ]]; then
        echo "$bin"
        return
      fi
    fi
  fi

  # 3. Check common install locations
  for path in /usr/local/bin/claude "$HOME/.npm-global/bin/claude" "$HOME/.local/bin/claude"; do
    if [[ -x "$path" ]]; then
      echo "$path"
      return
    fi
  done

  return 1
}

CLAUDE_BIN=""

# Check dependencies
check_deps() {
  if ! command -v curl &>/dev/null; then
    error "curl is required"
    exit 1
  fi
  if ! command -v jq &>/dev/null; then
    if ! command -v node &>/dev/null; then
      error "jq or node is required for JSON parsing"
      exit 1
    fi
  fi
  CLAUDE_BIN=$(find_claude) || {
    error "claude CLI not found"
    error "Install: npm install -g @anthropic-ai/claude-code"
    error "Or open Claude Desktop App (it bundles the CLI)"
    exit 1
  }
  log "Claude binary: ${DIM}$CLAUDE_BIN${RESET}"
}

# JSON helper — use jq if available, otherwise node
json_get() {
  local json="$1"
  local path="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$path"
  else
    echo "$json" | node -e "process.stdin.on('data',d=>console.log(eval('('+d+')'+'.'+path.replace(/^\./,''))))" 2>/dev/null
  fi
}

# Check if hub is running
check_hub() {
  if ! curl -s --max-time 3 "$HUB_URL/api/board/claude" > /dev/null 2>&1; then
    error "Hub is not running at $HUB_URL"
    error "Start it with: npm run dev"
    return 1
  fi
}

# Fetch unclaimed issues from Claude lane
fetch_issues() {
  curl -s "$HUB_URL/api/board/claude"
}

# Claim an issue
claim_issue() {
  local id="$1"
  curl -s -X POST "$HUB_URL/api/board/claude/claim" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"$id\",\"agent_id\":\"claude-runner\"}"
}

# Complete an issue
complete_issue() {
  local id="$1"
  curl -s -X POST "$HUB_URL/api/board/claude/complete" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"$id\"}"
}

# Process one issue
process_issue() {
  local response
  response=$(fetch_issues)

  local ok
  ok=$(echo "$response" | jq -r '.ok' 2>/dev/null || echo "false")
  if [[ "$ok" != "true" ]]; then
    error "Failed to fetch issues from hub"
    return 1
  fi

  local count
  count=$(echo "$response" | jq '.data | length' 2>/dev/null || echo "0")
  if [[ "$count" == "0" ]]; then
    log "${DIM}No unclaimed issues in Claude lane${RESET}"
    return 1
  fi

  # Get the highest priority issue
  local issue
  issue=$(echo "$response" | jq '.data[0]')

  local id title description priority labels
  id=$(echo "$issue" | jq -r '.id')
  title=$(echo "$issue" | jq -r '.title')
  description=$(echo "$issue" | jq -r '.description // ""')
  priority=$(echo "$issue" | jq -r '.priority')
  labels=$(echo "$issue" | jq -r '.labels | join(", ")')

  log "Found issue: ${GREEN}$title${RESET} ${DIM}($id, $priority)${RESET}"

  if [[ -n "$labels" ]]; then
    log "  Labels: $labels"
  fi
  if [[ -n "$description" ]]; then
    log "  Description: ${DIM}${description:0:120}${RESET}"
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    warn "[dry-run] Would claim and run: $title"
    return 0
  fi

  # Claim the issue
  log "Claiming issue..."
  local claim_result
  claim_result=$(claim_issue "$id")

  local claimed
  claimed=$(echo "$claim_result" | jq -r '.ok' 2>/dev/null || echo "false")
  if [[ "$claimed" != "true" ]]; then
    error "Failed to claim issue (may already be claimed)"
    return 1
  fi

  success "Claimed: $title"

  # Build the prompt for Claude Code
  local prompt="You are working on the App Hub project.

TASK: $title
PRIORITY: $priority"

  if [[ -n "$description" ]]; then
    prompt="$prompt

DESCRIPTION:
$description"
  fi

  if [[ -n "$labels" ]]; then
    prompt="$prompt

LABELS: $labels"
  fi

  prompt="$prompt

INSTRUCTIONS:
- Work in the App Hub project at: $PROJECT_ROOT
- This task was picked up from the Hub kanban board (issue $id)
- Follow the coding guidelines in CLAUDE.md
- When done, summarize what you changed"

  # Run Claude Code
  log "Running Claude Code..."
  echo ""

  local exit_code=0
  "$CLAUDE_BIN" -p "$prompt" --allowedTools "Read,Grep,Glob,Bash,Edit,Write" || exit_code=$?

  echo ""

  if [[ "$exit_code" -eq 0 ]]; then
    # Mark as complete
    complete_issue "$id" > /dev/null 2>&1
    success "Completed: $title -> Done"
  else
    warn "Claude exited with code $exit_code — issue stays in progress"
    warn "You can manually complete it: curl -X POST $HUB_URL/api/board/claude/complete -H 'Content-Type: application/json' -d '{\"id\":\"$id\"}'"
  fi

  return 0
}

# Main
main() {
  log "Starting claude-runner"
  log "Hub: $HUB_URL"
  log "Project: $PROJECT_ROOT"
  echo ""

  check_deps
  check_hub

  if [[ "$LOOP" == "true" ]]; then
    log "Polling mode (every ${POLL_INTERVAL}s). Ctrl+C to stop."
    echo ""
    while true; do
      process_issue || true
      sleep "$POLL_INTERVAL"
    done
  else
    process_issue
  fi
}

main
