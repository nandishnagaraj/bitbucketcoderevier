#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

payload="$(cat)"

# Fast-path: ignore events that are clearly not git push terminal invocations.
if [[ "$payload" != *"run_in_terminal"* ]] || [[ "$payload" != *"git push"* ]]; then
  exit 0
fi

if "$ROOT_DIR/scripts/run_pre_push_review.sh" >/dev/null 2>&1; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"Pre-push code review checks passed."}}'
  exit 0
fi

printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked git push: pre-push code review checks failed. Run ./.githooks/pre-push and fix issues."},"stopReason":"Blocked git push: pre-push review checks failed."}'
exit 2
