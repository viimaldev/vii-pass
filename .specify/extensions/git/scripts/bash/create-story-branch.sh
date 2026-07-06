#!/usr/bin/env bash
# Git extension: create-story-branch.sh
# Creates a "story" branch of the form:
#   <branch_prefix><story_id_prefix><id>-<slug>   e.g. topic/vii-1000-project-initial-setup
# Story ids start at a configurable base (default 1000) and increment for each new story.
#
# NOTE: Git forbids ':' in ref names, so the branch uses a git-safe id prefix (e.g. "vii-").
# The colon "display" form (e.g. "vii:1000") is emitted as STORY_ID for commit / PR text.
#
# Configuration is read from .specify/extensions/git/git-config.yml (story_branch section).
set -euo pipefail

JSON=false
DRY_RUN=false
ALLOW_EXISTING=false
SHORT_NAME=""
ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=true; shift;;
    --dry-run) DRY_RUN=true; shift;;
    --allow-existing-branch) ALLOW_EXISTING=true; shift;;
    --short-name) SHORT_NAME="${2:-}"; shift 2;;
    -h|--help)
      echo "Usage: create-story-branch.sh [--json] [--dry-run] [--allow-existing-branch] [--short-name <name>] <description>"
      echo "Creates a story branch like 'topic/vii-1000-project-initial-setup'."
      exit 0;;
    *) ARGS+=("$1"); shift;;
  esac
done

FEATURE_DESC="${ARGS[*]:-}"
FEATURE_DESC="$(printf '%s' "$FEATURE_DESC" | sed 's/^ *//; s/ *$//')"
if [[ -z "$FEATURE_DESC" ]]; then
  echo "Error: feature description cannot be empty" >&2
  exit 1
fi

# Locate the project root (nearest ancestor containing .specify or .git).
find_root() {
  local d="$1"
  while [[ "$d" != "/" && -n "$d" ]]; do
    if [[ -d "$d/.specify" || -d "$d/.git" ]]; then echo "$d"; return; fi
    d="$(dirname "$d")"
  done
  echo ""
}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(find_root "$SCRIPT_DIR")"
[[ -z "$PROJECT_ROOT" ]] && PROJECT_ROOT="$(pwd)"
cd "$PROJECT_ROOT"

# Defaults (overridden by git-config.yml story_branch section).
BRANCH_PREFIX="topic/"
ID_PREFIX="vii-"
DISPLAY_PREFIX="vii:"
START_ID=1000

CONFIG="$PROJECT_ROOT/.specify/extensions/git/git-config.yml"
read_cfg() {
  grep -E "^[[:space:]]*$1:" "$CONFIG" 2>/dev/null | head -1 \
    | sed -E "s/^[[:space:]]*$1:[[:space:]]*//; s/[[:space:]]*#.*$//; s/^\"//; s/\"$//; s/^ *//; s/ *$//"
}
if [[ -f "$CONFIG" ]]; then
  v="$(read_cfg branch_prefix)";           [[ -n "$v" ]] && BRANCH_PREFIX="$v"
  v="$(read_cfg story_id_prefix)";         [[ -n "$v" ]] && ID_PREFIX="$v"
  v="$(read_cfg story_id_display_prefix)"; [[ -n "$v" ]] && DISPLAY_PREFIX="$v"
  v="$(read_cfg start)";                   [[ -n "$v" ]] && START_ID="$v"
fi

HAS_GIT=false
if command -v git >/dev/null 2>&1 && [[ -d "$PROJECT_ROOT/.git" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  HAS_GIT=true
fi

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/-{2,}/-/g; s/^-//; s/-$//'
}

# Resolve branch name / story id / feature number.
if [[ -n "${GIT_BRANCH_NAME:-}" ]]; then
  BRANCH_NAME="$GIT_BRANCH_NAME"
  if [[ "$BRANCH_NAME" =~ ${ID_PREFIX}([0-9]+) ]]; then
    FEATURE_NUM="${BASH_REMATCH[1]}"; STORY_ID="${DISPLAY_PREFIX}${BASH_REMATCH[1]}"
  elif [[ "$BRANCH_NAME" =~ ^([0-9]+)- ]]; then
    FEATURE_NUM="${BASH_REMATCH[1]}"; STORY_ID="$BRANCH_NAME"
  else
    FEATURE_NUM="$BRANCH_NAME"; STORY_ID="$BRANCH_NAME"
  fi
else
  if [[ -n "$SHORT_NAME" ]]; then SLUG="$(slugify "$SHORT_NAME")"; else SLUG="$(slugify "$FEATURE_DESC")"; fi
  [[ -z "$SLUG" ]] && SLUG="story"

  HIGHEST=0
  if [[ "$HAS_GIT" == true ]]; then
    git fetch --all --prune >/dev/null 2>&1 || true
    esc_prefix="$(printf '%s' "${BRANCH_PREFIX}${ID_PREFIX}" | sed -E 's/[][\.^$*+?(){}|/]/\\&/g')"
    while IFS= read -r ref; do
      name="${ref#remotes/*/}"
      if [[ "$name" =~ ^${esc_prefix}([0-9]+)- ]]; then
        n="${BASH_REMATCH[1]}"
        (( n > HIGHEST )) && HIGHEST=$n
      fi
    done < <(git branch -a --format='%(refname:short)' 2>/dev/null || true)
  fi

  if (( HIGHEST >= START_ID )); then NEXT_ID=$(( HIGHEST + 1 )); else NEXT_ID=$START_ID; fi
  BRANCH_NAME="${BRANCH_PREFIX}${ID_PREFIX}${NEXT_ID}-${SLUG}"
  STORY_ID="${DISPLAY_PREFIX}${NEXT_ID}"
  FEATURE_NUM="$NEXT_ID"
fi

# Create (or switch to) the branch.
if [[ "$DRY_RUN" != true ]]; then
  if [[ "$HAS_GIT" == true ]]; then
    if ! git checkout -q -b "$BRANCH_NAME" 2>/dev/null; then
      if git branch --list "$BRANCH_NAME" | grep -q .; then
        if [[ "$ALLOW_EXISTING" == true ]]; then
          git checkout -q "$BRANCH_NAME" || { echo "Error: Branch '$BRANCH_NAME' exists but could not be checked out." >&2; exit 1; }
        else
          echo "Error: Branch '$BRANCH_NAME' already exists. Use --allow-existing-branch or a different description." >&2
          exit 1
        fi
      else
        echo "Error: Failed to create git branch '$BRANCH_NAME'." >&2
        exit 1
      fi
    fi
    export SPECIFY_FEATURE="$BRANCH_NAME"
  else
    echo "[specify] Warning: Git repository not detected; skipped branch creation for $BRANCH_NAME" >&2
  fi
fi

# Emit results.
if [[ "$JSON" == true ]]; then
  printf '{"BRANCH_NAME":"%s","FEATURE_NUM":"%s","STORY_ID":"%s","HAS_GIT":%s}\n' \
    "$BRANCH_NAME" "$FEATURE_NUM" "$STORY_ID" "$HAS_GIT"
else
  echo "BRANCH_NAME: $BRANCH_NAME"
  echo "FEATURE_NUM: $FEATURE_NUM"
  echo "STORY_ID: $STORY_ID"
  echo "HAS_GIT: $HAS_GIT"
fi
