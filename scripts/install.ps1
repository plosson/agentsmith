# ── AgentSmith installer (PowerShell) ─────────────────────────────────
# irm https://raw.githubusercontent.com/plosson/agentsmith/main/scripts/install.ps1 | iex
# ──────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$Repo = "plosson/agentsmith"
$Marketplace = "agentsmith-marketplace"
$Plugin = "agentsmith"

# ── Helpers ──────────────────────────────────────────────────────────

function Info($msg)  { Write-Host "==> $msg" -ForegroundColor Blue }
function Ok($msg)    { Write-Host " ✓  $msg" -ForegroundColor Green }
function Err($msg)   { Write-Host " ✗  $msg" -ForegroundColor Red }

# ── Banner ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  █▀█ █▀▀ █▀▀ █▄ █ ▀█▀   █▀ █▀▄▀█ █ ▀█▀ █ █" -ForegroundColor White
Write-Host "  █▀█ █ █ ██▀ █ ▀█  █    ▄█ █ ▀ █ █  █  █▀█" -ForegroundColor White
Write-Host "  ▀ ▀ ▀▀▀ ▀▀▀ ▀  ▀  ▀    ▀▀ ▀   ▀ ▀  ▀  ▀ ▀" -ForegroundColor White
Write-Host ""

# ── Step 1: Check prerequisites ──────────────────────────────────────

Info "Checking prerequisites..."

$claudePath = Get-Command claude -ErrorAction SilentlyContinue
if ($claudePath) {
    $claudeVersion = try { & claude --version 2>$null } catch { "unknown version" }
    Ok "Claude Code found ($claudeVersion)"
} else {
    Err "Claude Code is not installed."
    Write-Host "    Install it from: https://docs.anthropic.com/en/docs/claude-code"
    exit 1
}

$bunPath = Get-Command bun -ErrorAction SilentlyContinue
if ($bunPath) {
    $bunVersion = try { & bun --version 2>$null } catch { "unknown version" }
    Ok "Bun found ($bunVersion)"
} else {
    Err "Bun is not installed. The local proxy requires Bun to run."
    Write-Host "    Install it from: https://bun.sh"
    exit 1
}

# ── Step 2: Add marketplace ──────────────────────────────────────────

Info "Adding AgentSmith marketplace..."
$mpOut = & claude plugin marketplace add $Repo 2>&1 | Out-String
if ($mpOut -match "already installed") {
    Ok "Marketplace already added"
} else {
    Ok "Marketplace added"
}

# ── Step 3: Install or update plugin ─────────────────────────────────

Write-Host ""
Info "Where should AgentSmith be installed?"
Write-Host ""
Write-Host "    [1] All projects          - available everywhere (recommended)"
Write-Host "    [2] This project (team)   - shared with your team via .claude/"
Write-Host "    [3] This project (just me) - local to you, not committed"
Write-Host ""
$scopeChoice = Read-Host "  Choose [1/2/3] (default: 1)"

switch ($scopeChoice) {
    "2" { $scopeArgs = @("-s", "project"); $scopeLabel = "project (team)" }
    "3" { $scopeArgs = @("-s", "local");   $scopeLabel = "project (just me)" }
    default { $scopeArgs = @();            $scopeLabel = "all projects" }
}

Info "Installing for ${scopeLabel}..."
$instOut = & claude plugin install "agentsmith@$Marketplace" @scopeArgs 2>&1 | Out-String
if ($instOut -match "already installed") {
    Ok "Plugin already installed - updating..."
    & claude plugin update $Plugin 2>&1 | Out-Null
    Ok "Plugin updated"
} else {
    Ok "Plugin installed"
}

# ── Step 4: Link token ───────────────────────────────────────────────

# Find link.sh from the installed plugin (take latest version)
$pluginDir = Join-Path $env:USERPROFILE ".claude\plugins\cache\$Marketplace\$Plugin"
$linkScript = Get-ChildItem -Path "$pluginDir\*\hooks\scripts\link.sh" -ErrorAction SilentlyContinue |
    Sort-Object { $_.Directory.Parent.Parent.Parent.Name } |
    Select-Object -Last 1
if (-not $linkScript) {
    Err "Could not find link.sh - plugin installation may have failed."
    exit 1
}
$linkScript = $linkScript.FullName

Write-Host ""
Info "Visit https://agentsmith.me/#/link to get your setup token"
Write-Host ""
$token = (Read-Host "  Paste token").Trim()

& bash $linkScript $token
if ($LASTEXITCODE -ne 0) { exit 1 }

# ── Done ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  AgentSmith installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Config: $(Join-Path $env:USERPROFILE '.config\agentsmith\config')"
Write-Host "  Restart Claude Code to activate the plugin."
Write-Host ""
