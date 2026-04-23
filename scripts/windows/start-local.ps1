Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$Port = "",
  [string]$OllamaGemma4Model = ""
)

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Host ""
  Write-Host "ERREUR : $Message" -ForegroundColor Red
  exit 1
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDirectory "..\..")
$envPath = Join-Path $projectRoot ".env"

Write-Host "Demarrage local Windows - Accessible Mail Assistant" -ForegroundColor Magenta
Write-Host "Projet : $projectRoot"

if (-not (Test-Path -LiteralPath $envPath)) {
  Fail "Le fichier .env est introuvable. Lance d'abord .\scripts\windows\install-local.ps1"
}

if ($Port.Trim()) {
  $env:PORT = $Port.Trim()
  Write-Host "Port force pour cette session : $env:PORT" -ForegroundColor Yellow
}

if ($OllamaGemma4Model.Trim()) {
  $env:OLLAMA_GEMMA4_MODEL = $OllamaGemma4Model.Trim()
  Write-Host "Modele Gemma 4 force pour cette session : $env:OLLAMA_GEMMA4_MODEL" -ForegroundColor Yellow
}

Write-Step "Controle rapide Node.js"
& node -v
if ($LASTEXITCODE -ne 0) {
  Fail "Node.js ne repond pas."
}

Write-Step "Demarrage de l'application"
Push-Location $projectRoot
try {
  & npm start
} finally {
  Pop-Location
}
