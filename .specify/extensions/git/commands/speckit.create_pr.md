---
description: "Commit, push, and open a pull request against main for the current story branch"
---

# Create Pull Request

Commit all current changes on the active **story branch**, push the branch to the remote,
and open a pull request against the base branch (`main`) — using the **GitKraken MCP**
tools. This is a manual command (`/speckit.create_pr`); it is not wired to any hook.

## User Input

```text
$ARGUMENTS
```

If the user provided text, treat it as the PR **description** override. Otherwise derive the
description from the branch slug.

## Configuration

Read `.specify/extensions/git/git-config.yml`:

- `pull_request.base_branch` — target branch for the PR (default `main`)
- `pull_request.title_template` / `pull_request.body_template` — default `"{story_id}: {description}"`
- `story_branch.story_id_display_prefix` — colon story-id form used in text (default `vii:`)

## Execution Steps

1. **Verify Git** is available (`git rev-parse --is-inside-work-tree`). If not, warn and stop.

2. **Determine the current branch**: `git rev-parse --abbrev-ref HEAD`.
   - If the branch is the base branch (`main`) or `HEAD` is detached, warn that a story
     branch is expected and stop (nothing to PR).

3. **Parse the story id and description** from the branch name using the pattern
   `^topic/vii-(\d+)-(.+)$`:
   - `STORY_ID` = `vii:<n>` (display prefix + captured number).
   - Default `DESCRIPTION` = the captured slug with hyphens replaced by spaces, Title Cased
     (e.g. `project-initial-setup` → `Project Initial Setup`).
   - If `$ARGUMENTS` is non-empty, use it verbatim as `DESCRIPTION`.
   - If the branch does not match the pattern, warn, set `STORY_ID` empty, and use the branch
     name (de-slugified) as `DESCRIPTION`.

4. **Compose** the title and body from the templates:
   - `TITLE` = `BODY` = `"{story_id}: {description}"` → e.g. `vii:1000: Project Initial Setup`.
   - If `STORY_ID` is empty, drop the leading `": "` and just use `DESCRIPTION`.

5. **Stage & commit**:
   - Check `git status --porcelain`.
   - If there are changes, stage all and commit with message = `TITLE` using the GitKraken MCP
     commit tool (`mcp_gitkraken_cli_git_add_or_commit`).
   - If there is nothing to commit AND no unpushed commits on the branch, report "nothing to
     do" and stop.

6. **Check for a remote**: `git remote`.
   - **If there is NO remote** → graceful degradation: keep the local commit, report that push
     and PR creation were skipped because no git remote is configured, and tell the user to add
     one (`git remote add origin <url>`) and rerun `/speckit.create_pr`. Stop **without error**.

7. **Push** the current branch and set upstream using the GitKraken MCP push tool
   (`mcp_gitkraken_cli_git_push`).

8. **Open the pull request** against the base branch using the GitKraken MCP pull-request tool
   (`mcp_gitkraken_cli_pull_request_create`) with:
   - head = current branch
   - base = `main` (from `pull_request.base_branch`)
   - title = `TITLE`
   - body = `BODY`
   - If a PR already exists for this branch, report the existing PR URL instead of failing.

9. **Report** the PR URL (or a compare URL) and a one-line summary of what was committed and
   pushed.

## Tooling Notes

- The GitKraken MCP tools may be **deferred**. If a required tool is not loaded, search for it
  first (query e.g. "gitkraken commit push pull request"), then call it.
- If the GitKraken MCP server is unavailable, fall back to plain Git for commit + push
  (`git add -A`, `git commit -m "<TITLE>"`, `git push -u origin <branch>`) and print the PR
  compare URL for the user to open manually.
- Never include secrets or credentials in commit messages, PR titles, or PR bodies.

## Graceful Degradation

- **No Git / not a repo** → warn and stop.
- **On base branch or detached HEAD** → warn that a story branch is expected and stop.
- **No remote configured** → commit locally, skip push + PR, explain the next steps.
- **No changes and nothing unpushed** → report "nothing to do" and stop.
