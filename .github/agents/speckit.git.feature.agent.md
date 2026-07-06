---
description: Create a story feature branch (topic/vii-<id>-<slug>, ids from 1000)
---


<!-- Extension: git -->
<!-- Config: .specify/extensions/git/ -->
# Create Story Feature Branch

Create and switch to a new git branch for the given specification using this project's
**story-branch** convention. This command handles **branch creation only** — the spec
directory and files are created by the core `/speckit.specify` workflow.

Branches look like: `topic/vii-1000-project-initial-setup`

- `topic/` — branch prefix
- `vii-<id>` — git-safe story id (git forbids `:` in branch names, so a hyphen is used)
- `<id>` — sequential story id starting at **1000**, incremented for each new story
- `<slug>` — short description derived from the feature

The colon "display" form (e.g. `vii:1000`) is emitted as `STORY_ID` for use in commit
messages and PR titles by `/speckit.create_pr`; it is never used in the branch name.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Environment Variable Override

If the user explicitly provided `GIT_BRANCH_NAME` (e.g., via environment variable, argument, or in their request), pass it through to the script by setting the `GIT_BRANCH_NAME` environment variable before invoking the script. When `GIT_BRANCH_NAME` is set:
- The script uses the exact value as the branch name, bypassing story-id generation
- `--short-name` is ignored
- `FEATURE_NUM` and `STORY_ID` are extracted from the name when it contains a story-id prefix (e.g. `vii-1000`), otherwise set to the full branch name

## Prerequisites

- Verify Git is available by running `git rev-parse --is-inside-work-tree 2>/dev/null`
- If Git is not available, warn the user and skip branch creation

## Configuration

The story-branch convention is configured in `.specify/extensions/git/git-config.yml` under
the `story_branch` section:

- `branch_prefix` (default `topic/`)
- `story_id_prefix` (default `vii-`) — git-safe id prefix used in the branch
- `story_id_display_prefix` (default `vii:`) — colon form used in commit / PR text
- `start` (default `1000`) — first story id; incremented for each new story

The script reads this configuration automatically and determines the next story id by
scanning existing local and remote branches, so ids stay unique and monotonic.

## Execution

Generate a concise short name (2-4 words) for the branch:
- Analyze the feature description and extract the most meaningful keywords
- Use action-noun format when possible (e.g., "user-auth", "vault-encryption")
- Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)

Run the appropriate script based on your platform:

- **PowerShell**: `.specify/extensions/git/scripts/powershell/create-story-branch.ps1 -Json -ShortName "<short-name>" "<feature description>"`
- **Bash**: `.specify/extensions/git/scripts/bash/create-story-branch.sh --json --short-name "<short-name>" "<feature description>"`

**IMPORTANT**:
- Do NOT compute or pass the story id — the script determines the next id automatically
- Always include the JSON flag (`-Json` for PowerShell, `--json` for Bash) so the output can be parsed reliably
- You must only ever run this script once per feature
- The JSON output will contain `BRANCH_NAME`, `FEATURE_NUM`, and `STORY_ID`

## Graceful Degradation

If Git is not installed or the current directory is not a Git repository:
- Branch creation is skipped with a warning: `[specify] Warning: Git repository not detected; skipped branch creation`
- The script still outputs `BRANCH_NAME`, `FEATURE_NUM`, and `STORY_ID` so the caller can reference them

## Output

The script outputs JSON with:
- `BRANCH_NAME`: The branch name (e.g. `topic/vii-1000-project-initial-setup`)
- `FEATURE_NUM`: The numeric story id (e.g. `1000`)
- `STORY_ID`: The display story id used in commit / PR text (e.g. `vii:1000`)