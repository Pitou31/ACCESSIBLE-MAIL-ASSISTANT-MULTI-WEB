Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [switch]$WithOllama,
  [switch]$ForceEnv
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

function Get-CommandOrNull {
  param([string]$Name)
  try {
    return Get-Command $Name -ErrorAction Stop
  } catch {
    return $null
  }
}

function Ensure-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  $command = Get-CommandOrNull -Name $Name
  if ($null -eq $command) {
    Fail "$Name est introuvable. $InstallHint"
  }

  return $command
}

function Get-NodeMajorVersion {
  $nodeVersion = (& node -v).Trim()
  if ($nodeVersion -notmatch "^v(\d+)\.") {
    Fail "Impossible d'identifier correctement la version de Node.js ($nodeVersion)."
  }

  return [int]$Matches[1]
}

function Ensure-PythonPackage {
  param(
    [string]$PackageName,
    [string]$ImportName = $PackageName
  )

  $checkScript = "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$ImportName') else 1)"
  & python -c $checkScript
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Package Python '$PackageName' déjà présent." -ForegroundColor Green
    return
  }

  Write-Host "Installation du package Python '$PackageName'..." -ForegroundColor Yellow
  & python -m pip install --user $PackageName
  if ($LASTEXITCODE -ne 0) {
    Fail "L'installation de $PackageName a échoué."
  }
}

function Ensure-Directory {
  param([string]$PathValue)
  if (-not (Test-Path -LiteralPath $PathValue)) {
    New-Item -ItemType Directory -Path $PathValue | Out-Null
  }
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDirectory "..\..")
$envTemplatePath = Join-Path $projectRoot ".env.windows.example"
$envPath = Join-Path $projectRoot ".env"
$dataDirectory = Join-Path $projectRoot "backend\data"

Write-Host "Installation locale Windows - Accessible Mail Assistant" -ForegroundColor Magenta
Write-Host "Projet : $projectRoot"

Write-Step "Vérification des prérequis système"
Ensure-Command -Name "node" -InstallHint "Installe Node.js 22 LTS ou supérieur : https://nodejs.org/"
Ensure-Command -Name "npm" -InstallHint "npm doit être installé avec Node.js : https://nodejs.org/"
Ensure-Command -Name "python" -InstallHint "Installe Python 3 et coche 'Add Python to PATH' : https://www.python.org/downloads/windows/"

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor -lt 22) {
  Fail "Node.js $nodeMajor détecté. Installe Node.js 22 LTS ou supérieur."
}

Write-Host "Node.js OK (v$nodeMajor+)." -ForegroundColor Green
Write-Host "npm OK." -ForegroundColor Green
Write-Host "Python OK." -ForegroundColor Green

if ($WithOllama) {
  $ollamaCommand = Get-CommandOrNull -Name "ollama"
  if ($null -eq $ollamaCommand) {
    Fail "Ollama est demandé mais introuvable. Installe-le : https://ollama.com/download/windows"
  }
  Write-Host "Ollama détecté." -ForegroundColor Green
}

Write-Step "Installation des dépendances Node.js"
Push-Location $projectRoot
try {
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Fail "npm install a échoué."
  }
} finally {
  Pop-Location
}

Write-Step "Installation de la dépendance PDF Python"
Ensure-PythonPackage -PackageName "pypdf"

Write-Step "Installation de la transcription audio locale"
Ensure-PythonPackage -PackageName "faster-whisper" -ImportName "faster_whisper"

Write-Step "Préparation des dossiers de données"
Ensure-Directory -PathValue $dataDirectory
Write-Host "Dossier de données prêt : $dataDirectory" -ForegroundColor Green

Write-Step "Préparation du fichier .env"
if (-not (Test-Path -LiteralPath $envTemplatePath)) {
  Fail "Le modèle .env.windows.example est introuvable : $envTemplatePath"
}

if ((Test-Path -LiteralPath $envPath) -and -not $ForceEnv) {
  Write-Host ".env existe déjà. Il n'est pas écrasé." -ForegroundColor Yellow
} else {
  Copy-Item -LiteralPath $envTemplatePath -Destination $envPath -Force
  Write-Host ".env généré depuis .env.windows.example" -ForegroundColor Green
}

Write-Step "Contrôle optionnel Ollama"
if ($WithOllama) {
  & ollama list
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Attention : Ollama est installé mais ne répond pas encore correctement." -ForegroundColor Yellow
    Write-Host "Lance Ollama puis exécute : ollama pull mistral:latest et ollama pull deepseek-r1:latest"
  } else {
    Write-Host "Ollama répond correctement." -ForegroundColor Green
  }
} else {
  Write-Host "Mode sans Ollama demandé. Les modèles API distants restent possibles." -ForegroundColor Yellow
}

Write-Step "Installation terminée"
Write-Host "Actions restantes obligatoires :" -ForegroundColor Yellow
Write-Host "1. Ouvre le fichier .env et renseigne tes secrets : Gmail OAuth, SMTP, DeepSeek si nécessaire."
Write-Host "2. Si tu veux les modèles locaux, installe/lance Ollama puis télécharge les modèles :"
Write-Host "   ollama pull mistral:latest"
Write-Host "   ollama pull deepseek-r1:latest"
Write-Host "3. Démarre ensuite l'application avec :"
Write-Host "   npm start"
Write-Host "4. Ouvre enfin dans ton navigateur :"
Write-Host "   http://localhost:3000/frontend/account.html"
