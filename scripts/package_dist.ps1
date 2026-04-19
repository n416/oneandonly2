$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting distribution packaging..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 依存関係（Sidecarバイナリ）の自動配置
$SidecarTargetDir = ".\src-tauri\bin"
$SidecarTargetPath = "$SidecarTargetDir\llm-api-x86_64-pc-windows-msvc.exe"
$SidecarSourcePath = ".\llm-api\dist\main.exe"

if (-Not (Test-Path -Path $SidecarTargetDir)) {
    New-Item -ItemType Directory -Path $SidecarTargetDir | Out-Null
}

if (Test-Path -Path $SidecarSourcePath) {
    Write-Host "Found compiled main.exe. Copying and renaming to Sidecar binary..." -ForegroundColor Green
    Copy-Item -Path $SidecarSourcePath -Destination $SidecarTargetPath -Force
} elseif (-Not (Test-Path -Path $SidecarTargetPath)) {
    Write-Host "[Error] Python Sidecar binary not found!" -ForegroundColor Red
    Write-Host "Please build llm-api first: cd llm-api; pyinstaller --onefile main.py" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "Sidecar binary already exists in src-tauri\bin. Proceeding..." -ForegroundColor Green
}

# 2. Recreate dist_package
$DistPath = ".\dist_package"
if (Test-Path -Path $DistPath) {
    Write-Host "Cleaning up old dist_package..." -ForegroundColor Yellow
    Remove-Item -Path $DistPath -Recurse -Force
}
New-Item -ItemType Directory -Path $DistPath | Out-Null
Write-Host "Created fresh dist_package directory." -ForegroundColor Green

# 3. Tauri Build
Write-Host "Running Tauri build (this may take a while)..." -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Error] Tauri build failed." -ForegroundColor Red
    exit 1
}

# 4. exe ファイル群のコピー
$ExeSource = ".\src-tauri\target\release\tauri-app.exe"
$SidecarSource = ".\src-tauri\target\release\llm-api.exe"

if (Test-Path -Path $ExeSource) {
    Write-Host "Copying tauri-app.exe..." -ForegroundColor Green
    Copy-Item -Path $ExeSource -Destination $DistPath
} else {
    Write-Host "[Error] Executable not found at $ExeSource" -ForegroundColor Red
    exit 1
}

if (Test-Path -Path $SidecarSource) {
    Write-Host "Copying llm-api.exe (Sidecar)..." -ForegroundColor Green
    Copy-Item -Path $SidecarSource -Destination $DistPath
} else {
    Write-Host "[Warning] llm-api.exe not found in target\release. Sidecar might not work." -ForegroundColor Yellow
}

# 5. Copy .env
$EnvSource = ".\llm-api\.env"
if (Test-Path -Path $EnvSource) {
    Write-Host "Copying .env..." -ForegroundColor Green
    Copy-Item -Path $EnvSource -Destination $DistPath
} else {
    Write-Host "[Warning] .env file not found in llm-api\. Skipping." -ForegroundColor Yellow
}

# 6. Copy models
$ModelsSource = ".\llm-api\models"
if (Test-Path -Path $ModelsSource) {
    Write-Host "Copying models directory..." -ForegroundColor Cyan
    Copy-Item -Path $ModelsSource -Destination $DistPath -Recurse
    Write-Host "Models copied." -ForegroundColor Green
} else {
    Write-Host "[Warning] models directory not found in llm-api\. Skipping." -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
$FullPath = (Resolve-Path $DistPath).Path
Write-Host "Packaging complete! Check the folder at: $FullPath" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
