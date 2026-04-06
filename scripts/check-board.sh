#!/bin/bash
#
# check-board.sh — SessionStart hook for Claude Code
#
# When you start a Claude Code session in the App Hub project,
# this script checks for pending issues in the Claude lane and
# injects them as context so Claude knows about pending work.
#
set -euo pipefail

HUB_URL="${APPHUB_URL:-http://localhost:5174}"

# Silently exit if hub isn't running
response=$(curl -s --max-time 2 "$HUB_URL/api/board/claude" 2>/dev/null) || exit 0

ok=$(echo "$response" | jq -r '.ok' 2>/dev/null) || exit 0
if [[ "$ok" != "true" ]]; then
  exit 0
fi

count=$(echo "$response" | jq '.data | length' 2>/dev/null) || exit 0
if [[ "$count" == "0" ]]; then
  exit 0
fi

# Output context for Claude to see
echo ""
echo "=== App Hub Board: $count issue(s) in the Claude lane ==="
echo ""

echo "$response" | jq -r '.data[] | "- [\(.priority)] \(.title) (id: \(.id))\(if .description != "" then "\n  " + (.description | split("\n") | first) else "" end)"' 2>/dev/null

echo ""
echo "To work on an issue, claim it first:"
echo "  curl -X POST $HUB_URL/api/board/claude/claim -H 'Content-Type: application/json' -d '{\"id\":\"ISSUE_ID\"}'"
echo "Or run: ./scripts/claude-runner.sh"
echo ""
