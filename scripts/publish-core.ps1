$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$projectFile = Join-Path $projectRoot 'core\FlashFix.Core\FlashFix.Core.csproj'
$publishDir = Join-Path $projectRoot 'core\FlashFix.Core\bin\Release\net8.0-windows\win-x64\publish'
$enginesDir = Join-Path $projectRoot 'engines'

$localDotnet = Join-Path $projectRoot '.dotnet-local\dotnet.exe'
if (Test-Path $localDotnet) {
    $dotnet = $localDotnet
}
else {
    $dotnet = (Get-Command dotnet -ErrorAction Stop).Source
}

Write-Host "Publishing FlashFix.Core with: $dotnet"
& $dotnet publish $projectFile -c Release -r win-x64 --self-contained false

$exePath = Join-Path $publishDir 'FlashFix.Core.exe'
if (-not (Test-Path $exePath)) {
    throw "Publish did not produce the backend executable at $exePath"
}

New-Item -ItemType Directory -Force -Path $enginesDir | Out-Null
Get-ChildItem -Path $enginesDir -Force |
    Where-Object { $_.Name -ne '.gitkeep' } |
    Remove-Item -Force -Recurse

Copy-Item -Path (Join-Path $publishDir '*') -Destination $enginesDir -Force

Write-Host "Copied publish output to $enginesDir"
