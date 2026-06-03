$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

& npm run build:styles
& .\node_modules\.bin\electron.cmd .
