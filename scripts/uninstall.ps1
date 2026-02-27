# ── AgentSmith uninstaller (PowerShell) ───────────────────────────────
# irm https://raw.githubusercontent.com/plosson/agentsmith/main/scripts/uninstall.ps1 | iex
# ──────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$Marketplace = "agentsmith-marketplace"
$Plugin = "agentsmith"
$ConfigDir = Join-Path $env:USERPROFILE ".config\agentsmith"

# ── Helpers ──────────────────────────────────────────────────────────

function Info($msg)  { Write-Host "==> $msg" -ForegroundColor Blue }
function Ok($msg)    { Write-Host " ✓  $msg" -ForegroundColor Green }

# ── Banner ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  █▀█ █▀▀ █▀▀ █▄ █ ▀█▀   █▀ █▀▄▀█ █ ▀█▀ █ █" -ForegroundColor White
Write-Host "  █▀█ █ █ ██▀ █ ▀█  █    ▄█ █ ▀ █ █  █  █▀█" -ForegroundColor White
Write-Host "  ▀ ▀ ▀▀▀ ▀▀▀ ▀  ▀  ▀    ▀▀ ▀   ▀ ▀  ▀  ▀ ▀" -ForegroundColor White
Write-Host ""

Info "Uninstalling AgentSmith..."

# ── Uninstall plugin from all scopes ─────────────────────────────────

foreach ($scope in @("user", "project", "local")) {
    $out = & claude plugin uninstall $Plugin -s $scope 2>&1 | Out-String
    if ($out -notmatch "not found|not installed") {
        Ok "Plugin removed from $scope scope"
    }
}

# ── Remove marketplace ───────────────────────────────────────────────

$mpOut = & claude plugin marketplace remove $Marketplace 2>&1 | Out-String
if ($mpOut -match "not found|not installed|does not exist") {
    Ok "Marketplace already removed"
} else {
    Ok "Marketplace removed"
}

# ── Offer to remove config ───────────────────────────────────────────

Write-Host ""
$removeConfig = Read-Host "  Remove config at ${ConfigDir}? [y/N]"
if ($removeConfig -match "^[yY]") {
    Remove-Item -Recurse -Force $ConfigDir -ErrorAction SilentlyContinue
    Ok "Config removed"
} else {
    Ok "Config kept at $ConfigDir"
}

# ── Done ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  AgentSmith uninstalled." -ForegroundColor Green
Write-Host "  Restart Claude Code to complete removal."
Write-Host ""
