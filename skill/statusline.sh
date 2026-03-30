#!/bin/bash
# fuck-ai statusline for Claude Code
# Shows current model's fuck score in your statusline.
#
# Setup: Add to ~/.claude/settings.json:
#   { "statusLine": { "type": "command", "command": "~/.claude/skills/fuck-ai/statusline.sh" } }
#
# Input: JSON from Claude Code via stdin (contains model.id, etc.)

set -euo pipefail

# Read model from stdin JSON
INPUT=$(cat)
MODEL_ID=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('model',{}).get('id',''))" 2>/dev/null || echo "")

# Map model ID to API slug
case "$MODEL_ID" in
  *opus*4*6*|*opus-4-6*)       SLUG="claude-opus-4-6" ;;
  *sonnet*4*6*|*sonnet-4-6*)   SLUG="claude-sonnet-4-6" ;;
  *sonnet*4*5*|*sonnet-4-5*)   SLUG="claude-sonnet-4-5" ;;
  *haiku*4*5*|*haiku-4-5*)     SLUG="claude-haiku-4-5" ;;
  *)                            SLUG="" ;;
esac

if [ -z "$SLUG" ]; then
  exit 0
fi

# Cache: fetch at most once per 5 minutes
CACHE="/tmp/fuck-ai-${SLUG}.json"
CACHE_AGE=300

if [ -f "$CACHE" ]; then
  AGE=$(( $(date +%s) - $(stat -f%m "$CACHE" 2>/dev/null || stat -c%Y "$CACHE" 2>/dev/null || echo 0) ))
else
  AGE=$((CACHE_AGE + 1))
fi

if [ "$AGE" -gt "$CACHE_AGE" ]; then
  # Fetch in background to avoid blocking statusline
  curl -sf --max-time 3 "https://api.fuck-ai.dev/api/status/${SLUG}" > "${CACHE}.tmp" 2>/dev/null && mv "${CACHE}.tmp" "$CACHE" &
fi

if [ ! -f "$CACHE" ]; then
  exit 0
fi

# Parse cached data
SCORE=$(python3 -c "import sys,json; d=json.load(open('$CACHE')); print(d.get('fuck_score',0))" 2>/dev/null || echo "0")
FUCKS=$(python3 -c "import sys,json; d=json.load(open('$CACHE')); print(d.get('current_fucks',0))" 2>/dev/null || echo "0")
STATUS=$(python3 -c "import sys,json; d=json.load(open('$CACHE')); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")

if [ "$SCORE" = "0" ]; then
  if [ "$FUCKS" != "0" ]; then
    echo "🧪 ${FUCKS}f/hr calibrating · /fuck if dumb"
  else
    echo "🧪 calibrating · /fuck if dumb"
  fi
  exit 0
fi

# Emoji by status
case "$STATUS" in
  genius)    ICON="✨" ;;
  smart)     ICON="💡" ;;
  normal)    ICON="😐" ;;
  dumb)      ICON="🔥" ;;
  braindead) ICON="💀" ;;
  *)         ICON="❓" ;;
esac

echo "${ICON} ${SCORE}/5 ${FUCKS}f/hr"
