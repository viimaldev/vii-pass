#!/usr/bin/env pwsh
# Git extension: create-story-branch.ps1
# Creates a "story" branch of the form:
#   <branch_prefix><story_id_prefix><id>-<slug>   e.g. topic/vii-1000-project-initial-setup
# Story ids start at a configurable base (default 1000) and increment for each new story.
#
# NOTE: Git forbids ':' in ref names, so the branch uses a git-safe id prefix (e.g. "vii-").
# The colon "display" form (e.g. "vii:1000") is emitted as STORY_ID for use in commit
# messages and PR titles by /speckit.create_pr; it is never used in the branch name.
#
# Configuration is read from .specify/extensions/git/git-config.yml (story_branch section).
[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$AllowExistingBranch,
    [switch]$DryRun,
    [string]$ShortName,
    [switch]$Help,
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$FeatureDescription
)
$ErrorActionPreference = 'Stop'

if ($Help) {
    Write-Host "Usage: ./create-story-branch.ps1 [-Json] [-DryRun] [-AllowExistingBranch] [-ShortName <name>] <feature description>"
    Write-Host ""
    Write-Host "Creates a story branch like 'topic/vii-1000-project-initial-setup'."
    Write-Host "Story ids start at 1000 (configurable) and increment for each new story."
    Write-Host "Configuration: .specify/extensions/git/git-config.yml (story_branch section)."
    Write-Host ""
    Write-Host "Environment variables:"
    Write-Host "  GIT_BRANCH_NAME   Use this exact branch name, bypassing story-id generation."
    exit 0
}

if (-not $FeatureDescription -or $FeatureDescription.Count -eq 0) {
    Write-Error "Usage: ./create-story-branch.ps1 [-Json] [-DryRun] [-AllowExistingBranch] [-ShortName <name>] <feature description>"
    exit 1
}

$featureDesc = ($FeatureDescription -join ' ').Trim()
if ([string]::IsNullOrWhiteSpace($featureDesc)) {
    Write-Error "Error: Feature description cannot be empty or contain only whitespace"
    exit 1
}

# ---------------------------------------------------------------------------
# Locate the project root (nearest ancestor containing .specify or .git).
# ---------------------------------------------------------------------------
function Find-ProjectRoot {
    param([string]$StartDir)
    $current = Resolve-Path $StartDir
    while ($true) {
        foreach ($marker in @('.specify', '.git')) {
            if (Test-Path (Join-Path $current $marker)) { return $current }
        }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current) { return $null }
        $current = $parent
    }
}

$projectRoot = Find-ProjectRoot -StartDir $PSScriptRoot
if (-not $projectRoot) { $projectRoot = (Get-Location).Path }
Set-Location $projectRoot

# ---------------------------------------------------------------------------
# Load story-branch configuration. A minimal, dependency-free YAML read is used
# so the script works without any external PowerShell modules.
# ---------------------------------------------------------------------------
$branchPrefix  = 'topic/'
$idPrefix      = 'vii-'
$displayPrefix = 'vii:'
$startId       = 1000

$configPath = Join-Path $projectRoot '.specify/extensions/git/git-config.yml'
if (Test-Path $configPath) {
    $cfg = Get-Content -LiteralPath $configPath -Raw
    if ($cfg -match '(?m)^\s*branch_prefix:\s*"?([^"\r\n#]+?)"?\s*(?:#.*)?$')           { $branchPrefix  = $Matches[1].Trim() }
    if ($cfg -match '(?m)^\s*story_id_prefix:\s*"?([^"\r\n#]+?)"?\s*(?:#.*)?$')         { $idPrefix      = $Matches[1].Trim() }
    if ($cfg -match '(?m)^\s*story_id_display_prefix:\s*"?([^"\r\n#]+?)"?\s*(?:#.*)?$') { $displayPrefix = $Matches[1].Trim() }
    if ($cfg -match '(?m)^\s*start:\s*"?(\d+)"?\s*(?:#.*)?$')                           { $startId       = [int]$Matches[1] }
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Test-HasGitRepo {
    param([string]$Root)
    try {
        if (-not (Test-Path (Join-Path $Root '.git'))) { return $false }
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return $false }
        git -C $Root rev-parse --is-inside-work-tree 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function ConvertTo-Slug {
    param([string]$Name)
    return ($Name.ToLower() -replace '[^a-z0-9]', '-' -replace '-{2,}', '-' -replace '^-', '' -replace '-$', '')
}

# Build a concise, human-readable slug from a free-text description by dropping
# common stop words and keeping the first few meaningful words.
function Get-Slug {
    param([string]$Description)
    $stopWords = @('i','a','an','the','to','for','of','in','on','at','by','with','from',
        'is','are','was','were','be','been','being','have','has','had','do','does','did',
        'will','would','should','could','can','may','might','must','shall','this','that',
        'these','those','my','your','our','their','want','need','add','get','set')
    $clean = $Description.ToLower() -replace '[^a-z0-9\s]', ' '
    $words = $clean -split '\s+' | Where-Object { $_ }
    $meaningful = @()
    foreach ($w in $words) {
        if ($stopWords -contains $w) { continue }
        if ($w.Length -ge 3) { $meaningful += $w }
    }
    if ($meaningful.Count -gt 0) {
        $maxWords = if ($meaningful.Count -ge 4) { 4 } else { 3 }
        return (($meaningful | Select-Object -First $maxWords) -join '-')
    }
    $fallback = (ConvertTo-Slug $Description) -split '-' | Where-Object { $_ } | Select-Object -First 3
    return ($fallback -join '-')
}

# Scan local and remote branches for the highest existing story id.
function Get-HighestStoryId {
    param([string]$BranchPrefix, [string]$IdPrefix)
    [int]$highest = 0
    $pattern = '^' + [regex]::Escape("$BranchPrefix$IdPrefix") + '(\d+)-'
    try {
        $branches = git branch -a --format='%(refname:short)' 2>$null
        if ($LASTEXITCODE -eq 0 -and $branches) {
            foreach ($b in $branches) {
                $name = ($b -replace '^remotes/[^/]+/', '').Trim()
                if ($name -match $pattern) {
                    [int]$n = [int]$Matches[1]
                    if ($n -gt $highest) { $highest = $n }
                }
            }
        }
    } catch { }
    return $highest
}

$hasGit = Test-HasGitRepo -Root $projectRoot

# ---------------------------------------------------------------------------
# Resolve the branch name, story id, and feature number.
# ---------------------------------------------------------------------------
if ($env:GIT_BRANCH_NAME) {
    # Explicit override: use the exact branch name, bypassing story-id generation.
    $branchName = $env:GIT_BRANCH_NAME
    if ($branchName -match ([regex]::Escape($idPrefix) + '(\d+)')) {
        $featureNum = $Matches[1]
        $storyId    = "$displayPrefix$($Matches[1])"
    } elseif ($branchName -match '^(\d+)-') {
        $featureNum = $Matches[1]
        $storyId    = $branchName
    } else {
        $featureNum = $branchName
        $storyId    = $branchName
    }
} else {
    if ($ShortName) { $slug = ConvertTo-Slug $ShortName } else { $slug = Get-Slug $featureDesc }
    if ([string]::IsNullOrWhiteSpace($slug)) { $slug = 'story' }

    if ($hasGit) {
        try { git fetch --all --prune 2>$null | Out-Null } catch { }
        $highest = Get-HighestStoryId -BranchPrefix $branchPrefix -IdPrefix $idPrefix
    } else {
        $highest = 0
    }

    if ($highest -ge $startId) { $nextId = $highest + 1 } else { $nextId = $startId }

    $branchName = "$branchPrefix$idPrefix$nextId-$slug"
    $storyId    = "$displayPrefix$nextId"
    $featureNum = "$nextId"

    # Enforce GitHub's 244-byte branch-name limit by truncating the slug.
    if ([System.Text.Encoding]::UTF8.GetByteCount($branchName) -gt 244) {
        $fixedPrefix = "$branchPrefix$idPrefix$nextId-"
        $maxSuffix = 244 - $fixedPrefix.Length
        if ($maxSuffix -lt 1) { $maxSuffix = 1 }
        $slug = ($slug.Substring(0, [Math]::Min($slug.Length, $maxSuffix))) -replace '-$', ''
        $original = $branchName
        $branchName = "$fixedPrefix$slug"
        Write-Warning "[specify] Story branch exceeded 244 bytes; truncated '$original' to '$branchName'"
    }
}

# ---------------------------------------------------------------------------
# Create (or switch to) the branch.
# ---------------------------------------------------------------------------
if (-not $DryRun) {
    if ($hasGit) {
        $created = $false
        $err = ''
        try {
            $err = git checkout -q -b $branchName 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) { $created = $true }
        } catch { $err = $_.Exception.Message }

        if (-not $created) {
            $existing = git branch --list $branchName 2>$null
            $current = ''
            try { $current = (git rev-parse --abbrev-ref HEAD 2>$null).Trim() } catch { }
            if ($existing) {
                if ($AllowExistingBranch) {
                    if ($current -ne $branchName) {
                        git checkout -q $branchName 2>&1 | Out-String | Out-Null
                        if ($LASTEXITCODE -ne 0) {
                            Write-Error "Error: Branch '$branchName' exists but could not be checked out. Resolve uncommitted changes or conflicts and try again."
                            exit 1
                        }
                    }
                } else {
                    Write-Error "Error: Branch '$branchName' already exists. Use -AllowExistingBranch to switch to it, or choose a different description."
                    exit 1
                }
            } else {
                Write-Error "Error: Failed to create git branch '$branchName'.`n$($err.Trim())"
                exit 1
            }
        }
        $env:SPECIFY_FEATURE = $branchName
    } else {
        if ($Json) {
            [Console]::Error.WriteLine("[specify] Warning: Git repository not detected; skipped branch creation for $branchName")
        } else {
            Write-Warning "[specify] Warning: Git repository not detected; skipped branch creation for $branchName"
        }
    }
}

# ---------------------------------------------------------------------------
# Emit results.
# ---------------------------------------------------------------------------
if ($Json) {
    $obj = [PSCustomObject]@{
        BRANCH_NAME = $branchName
        FEATURE_NUM = $featureNum
        STORY_ID    = $storyId
        HAS_GIT     = $hasGit
    }
    if ($DryRun) { $obj | Add-Member -NotePropertyName 'DRY_RUN' -NotePropertyValue $true }
    $obj | ConvertTo-Json -Compress
} else {
    Write-Output "BRANCH_NAME: $branchName"
    Write-Output "FEATURE_NUM: $featureNum"
    Write-Output "STORY_ID: $storyId"
    Write-Output "HAS_GIT: $hasGit"
}
