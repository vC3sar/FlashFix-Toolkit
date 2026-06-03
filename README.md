# FlashFix Toolkit

**Uncomplicated FlashFix Toolkit**

FlashFix Toolkit is an independent firmware utility for Samsung Galaxy recovery and controlled firmware reinstalls.

It is not affiliated with or endorsed by Samsung.
It does not bypass FRP, KG, Knox Guard, MDM, carrier locks, accounts, or device security.

## Architecture

- Frontend: Electron + HTML/CSS/JavaScript
- Backend/Core: C# .NET
- Samsung engine: `SharpOdinClient`

Electron does not talk to USB directly. It only spawns `FlashFix.Core.exe` and reads JSON lines from stdout.

## Current scope

This first functional version focuses on:

- device detection
- device info
- PIT reading
- Samsung firmware package analysis
- flash plan generation
- safe flash plan execution
- temporary file cleanup
- persistent logs

It does not implement any bypass feature.

## Backend commands

`FlashFix.Core.exe` supports these commands:

```txt
detect
device-info
read-pit
analyze-firmware "C:\ruta\firmware"
build-plan "C:\ruta\firmware" "C:\ruta\pit.json"
flash-plan "C:\ruta\plan.json"
clean-temp
```

## Output contract

The backend writes one JSON object per line to stdout.

Examples:

```json
{ "ok": true, "type": "result", "command": "detect", "message": "Device detected in Download Mode", "data": {} }
```

```json
{ "type": "progress", "step": "analyzing_firmware", "message": "Extracting AP package...", "percent": 35 }
```

```json
{ "ok": false, "type": "error", "command": "read-pit", "message": "No Samsung device detected in Download Mode", "code": "NO_DEVICE" }
```

## Requirements

- Windows
- Node.js
- Electron dependencies installed with `npm install`
- .NET SDK 8.0 or newer to build `FlashFix.Core`
- Samsung USB drivers if your system needs them for Download Mode

## Install

```bash
npm install
```

## Run the frontend

```bash
npm start
```

## UI / Theme

The renderer uses Tailwind CSS with a compiled stylesheet at `renderer/styles.css`.

Source files:

- `tailwind.config.js`
- `renderer/input.css`
- `renderer/index.html`
- `renderer/app.js`
- `renderer/js/*.js`

Build the theme manually:

```bash
npm run build:styles
```

Watch the theme while editing:

```bash
npm run watch:styles
```

What controls the look and feel:

- `tailwind.config.js` defines the FlashFix color palette and flat UI tokens.
- `renderer/input.css` defines reusable component classes with `@apply`.
- `renderer/index.html` defines the layout structure, including the fixed log sidebar, the linear workspace flow, and the dedicated Settings view.
- `renderer/js/logger-ui.js` manages the log console rendering, filters, search, copy/export actions, and expandable details.
- `renderer/js/navigation.js` is kept for reference, but the current UI only switches between `Workspace` and `Settings`.

Log behavior:

- The backend emits one JSON object per line to stdout.
- `type=progress` is rendered as a running/info event with progress state.
- `type=result` is rendered as success when `ok=true` and error when `ok=false`.
- `type=error` is rendered as error.
- `type=warning` is rendered as warning.
- `type=debug` and raw lines are rendered as muted/debug entries.
- Entries with `data`, `details`, `stdout`, `stderr`, or `stack` can be expanded inline.
- The logs panel stays visible in the left sidebar with a collapsed summary by default.
- The main area switches between `Workspace` and the dedicated `Settings` view.
- `Workspace` keeps the five core sections visible at once: Dashboard, Device, Firmware, PIT, and Flash Plan.
- `Settings` shows only routes, maintenance, and legal notes, with copy buttons for project paths and log exports.

The UI does not clear the real log files when you click "Limpiar vista". It only clears the visible console buffer.

## Build `FlashFix.Core`

Build the backend from the project in `core/FlashFix.Core/`.

Example:

```bash
dotnet publish core/FlashFix.Core/FlashFix.Core.csproj -c Release -r win-x64 --self-contained false
```

Copy the resulting `FlashFix.Core.exe` into:

```txt
engines/FlashFix.Core.exe
```

The Electron app looks for the backend in `engines/` first.

## Firmware analysis and flash plan

The backend analyzes Samsung firmware packages from a folder:

- `BL_*.tar.md5`
- `AP_*.tar.md5`
- `CP_*.tar.md5`
- `CSC_*.tar.md5`
- `HOME_CSC_*.tar.md5`

It extracts supported images into `temp/firmware/` and builds a flash plan by mapping images to allowed partitions.

The plan excludes unsafe or unmapped items by default.

## Logs

The app creates `logs/` automatically.

It stores:

- operation logs
- PIT dumps
- firmware analysis JSON
- flash plans
- flash results

## SharpOdinClient note

`SharpOdinClient` is used as the Samsung backend.

The NuGet package I inspected does not surface a clear SPDX license in the package metadata, so verify the upstream source and package notice before redistribution.

Package reference:

- `SharpOdinClient` 1.0.2 by Alephgsm

## Limitations

- No Odin-style automatic BL/AP/CP/CSC parsing beyond the analysis pipeline.
- No bypass features.
- No arbitrary user-entered commands.
- Flashing remains plan-based and safety-gated.
