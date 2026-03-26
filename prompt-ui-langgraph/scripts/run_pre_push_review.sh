#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[pre-push] Running code review checks..."

if [[ -x "$ROOT_DIR/../venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/../venv/bin/python"
else
  PYTHON_BIN="python3"
fi

upstream_ref=""
if upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)"; then
  base_ref="$(git merge-base HEAD "$upstream_ref")"
else
  base_ref="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
fi

changed_files="$(git diff --name-only "$base_ref"...HEAD)"

if [[ -z "$changed_files" ]]; then
  echo "[pre-push] No file changes detected against base."
  exit 0
fi

echo "[pre-push] Base ref: $base_ref"

python_changed=0
web_changed=0
normalized_changed_files=""

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  normalized_file="${file#prompt-ui-langgraph/}"
  normalized_changed_files+="$normalized_file"$'\n'

  if [[ "$normalized_file" =~ ^services/orchestrator-api/.*\.py$ ]]; then
    python_changed=1
  fi
  if [[ "$normalized_file" =~ ^apps/web/ ]]; then
    web_changed=1
  fi
done <<< "$changed_files"

if [[ "$python_changed" -eq 1 ]]; then
  echo "[pre-push] Python changes detected. Running syntax checks..."
  while IFS= read -r py_file; do
    [[ -z "$py_file" ]] && continue
    "$PYTHON_BIN" -m py_compile "$py_file"
  done < <(printf '%s\n' "$normalized_changed_files" | awk '/^services\/orchestrator-api\/.*\.py$/')

  echo "[pre-push] Running backend import smoke check..."
  PYTHONPATH="$ROOT_DIR/services/orchestrator-api" "$PYTHON_BIN" - <<'PY'
import importlib

modules = [
    "app.main",
    "app.auth",
    "app.settings",
]

for module_name in modules:
    importlib.import_module(module_name)

print("Backend imports look good")
PY
fi

if [[ "$web_changed" -eq 1 ]]; then
  echo "[pre-push] Frontend changes detected. Running Next.js build..."
  npm --prefix apps/web run build
fi

review_comment="Copilot pre-push review passed on $(date -u +'%Y-%m-%dT%H:%M:%SZ'). Checks: python=${python_changed}, web=${web_changed}."
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  git notes add -f -m "$review_comment" HEAD >/dev/null 2>&1 || true
  echo "[pre-push] Git note added on HEAD: $review_comment"
fi

echo "[pre-push] All checks passed."
