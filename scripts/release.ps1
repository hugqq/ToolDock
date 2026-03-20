<#
.SYNOPSIS
    Release script for ToolDock - Updates version and creates release tag
.DESCRIPTION
    This script updates version numbers in package.json, Cargo.toml, and tauri.conf.json,
    commits the changes, and creates/pushes a git tag for release.
.PARAMETER Version
    The new version number (e.g., 1.0.1, 2.0.0-beta)
.EXAMPLE
    .\release.ps1 1.0.1
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidatePattern('^\d+\.\d+\.\d+(-\w+)?$')]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$packageJson = Join-Path $rootDir "package.json"
$cargoToml = Join-Path $rootDir "src-tauri\Cargo.toml"
$tauriConf = Join-Path $rootDir "src-tauri\tauri.conf.json"

Write-Host "`n🚀 ToolDock Release Script" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Version: $Version`n" -ForegroundColor Yellow

# Step 1: Update package.json
Write-Host "📦 Updating package.json..." -ForegroundColor Green
$pkg = Get-Content $packageJson -Raw -Encoding UTF8
$oldVersion = if ($pkg -match '"version"\s*:\s*"([^"]+)"') { $matches[1] } else { "unknown" }
$pkg = $pkg -replace '("version"\s*:\s*)"[^"]+"', "`${1}`"$Version`""
[System.IO.File]::WriteAllText($packageJson, $pkg)

# Step 2: Update Cargo.toml
Write-Host "🦀 Updating Cargo.toml..." -ForegroundColor Green
$cargo = Get-Content $cargoToml -Raw -Encoding UTF8
$cargo = $cargo -replace '(?m)^(version\s*=\s*")[^"]+"', "`${1}$Version`""
[System.IO.File]::WriteAllText($cargoToml, $cargo)

# Step 3: Update tauri.conf.json
Write-Host "⚙️  Updating tauri.conf.json..." -ForegroundColor Green
$tauri = Get-Content $tauriConf -Raw -Encoding UTF8
$tauri = $tauri -replace '("version"\s*:\s*)"[^"]+"', "`${1}`"$Version`""
[System.IO.File]::WriteAllText($tauriConf, $tauri)

Write-Host "`n✅ Version updated: $oldVersion → $Version" -ForegroundColor Green

# Step 4: Git commit
Write-Host "`n📝 Committing changes..." -ForegroundColor Green
git add $packageJson $cargoToml $tauriConf
git commit -m "chore: bump version to $Version"

# Step 5: Create and push tag
$tagName = "v$Version"
Write-Host "`n🏷️  Creating tag $tagName..." -ForegroundColor Green

# Check if tag already exists
$existingTag = git tag -l $tagName
if ($existingTag) {
    Write-Host "⚠️  Tag $tagName already exists, replacing..." -ForegroundColor Yellow
    git tag -d $tagName
    git push origin ":refs/tags/$tagName" 2>$null
}

git tag $tagName

Write-Host "`n📤 Pushing to remote..." -ForegroundColor Green
git push
git push origin $tagName

Write-Host "`n✨ Release v$Version created successfully!" -ForegroundColor Cyan
Write-Host "GitHub Actions will now build and publish the release." -ForegroundColor Gray
