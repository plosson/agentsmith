# ── AgentSmith installer (PowerShell) ─────────────────────────────────
# irm https://raw.githubusercontent.com/plosson/agentsmith/main/install.ps1 | iex
# ──────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$Repo = "plosson/agentsmith"
$ConfigDir = Join-Path $env:USERPROFILE ".config\agentsmith"
$ConfigFile = Join-Path $ConfigDir "config"

# ── Helpers ──────────────────────────────────────────────────────────

function Info($msg)  { Write-Host "==> $msg" -ForegroundColor Blue }
function Ok($msg)    { Write-Host " ✓  $msg" -ForegroundColor Green }
function Err($msg)   { Write-Host " ✗  $msg" -ForegroundColor Red; exit 1 }

function Set-ConfigValue {
    param([string]$Key, [string]$Value)

    if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }

    if (Test-Path $ConfigFile) {
        $content = Get-Content $ConfigFile -Raw
        if ($content -match "(?m)^$Key=") {
            $content = $content -replace "(?m)^$Key=.*", "$Key=$Value"
            Set-Content -Path $ConfigFile -Value $content -NoNewline
            return
        }
    }
    Add-Content -Path $ConfigFile -Value "$Key=$Value"
}

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
    Write-Host " ✗  Claude Code is not installed." -ForegroundColor Red
    Write-Host "    Install it from: https://docs.anthropic.com/en/docs/claude-code"
    exit 1
}

$bunPath = Get-Command bun -ErrorAction SilentlyContinue
if ($bunPath) {
    $bunVersion = try { & bun --version 2>$null } catch { "unknown version" }
    Ok "Bun found ($bunVersion)"
} else {
    Write-Host " ✗  Bun is not installed. The local proxy requires Bun to run." -ForegroundColor Red
    Write-Host "    Install it from: https://bun.sh"
    exit 1
}

# ── Step 2: Add marketplace ──────────────────────────────────────────

Info "Adding AgentSmith marketplace..."
& claude plugin marketplace add $Repo
Ok "Marketplace added"

# ── Step 3: Choose install scope ─────────────────────────────────────

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
& claude plugin install agentsmith@agentsmith-marketplace @scopeArgs
Ok "Plugin installed"

# ── Step 4: Username ─────────────────────────────────────────────────

Write-Host ""
$defaultUser = try { & git config user.email 2>$null } catch { "" }
if ($defaultUser) {
    $userInput = Read-Host "  Username [$defaultUser]"
} else {
    $userInput = Read-Host "  Username (email)"
}
$user = if ($userInput) { $userInput } else { $defaultUser }

if (-not $user) { Err "Username is required." }

Set-ConfigValue "AGENTSMITH_USER" $user
Ok "Username set to $user"

# ── Step 5: Server URL ──────────────────────────────────────────────

Write-Host ""
$serverUrl = Read-Host "  Server URL"

if (-not $serverUrl) { Err "Server URL is required." }

Set-ConfigValue "AGENTSMITH_SERVER_URL" $serverUrl
Ok "Server URL set to $serverUrl"

# ── Done ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  AgentSmith installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Config: $ConfigFile"
Write-Host "  Restart Claude Code to activate the plugin."
Write-Host ""
