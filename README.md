# The Last Caretaker - Human Optimizer

A static web app for planning and optimizing food + memory builds for professions in The Last Caretaker, including inventory-aware planning, progress tracking, and a mobile second-screen share flow.

> [!WARNING]
> Spoilers ahead: this project includes profession, trait, planning, and progression information that may reveal discovery content in The Last Caretaker.

## What This App Does

The app helps you:

- Optimize food and memory combinations for a selected profession.
- Track inventory and calculate deficits before crafting.
- Build multi-session human plans with rocket grouping.
- Track created/planned profession progress by committee.
- Share a read-only mobile snapshot of your plan via QR code.

No backend is required for runtime. The app is fully client-side and hosted as a static site.

## Core Workflows

### Profession optimization

Use the Optimizer tab to select a profession, set baseline physical floors, apply exclusions/toggles, and generate a recommended plan.

- Physical traits (Life Exp, Height, Weight, Strength, Intellect) are satisfied by food.
- Personality traits are satisfied by memories.
- Hard minimum floors: Life Exp >= 10, Height >= 30, Weight >= 20.

### Planning and deficit review

Use the Plan tab to accumulate humans into sessions and rockets.

- Sessions support up to 4 planned humans.
- Rockets support up to 3 humans.
- Deficit tables show what inventory is missing globally and per session.

### Second-screen mobile companion (QR share)

If you play fullscreen and want the plan visible on phone:

1. Build/update your plan on PC.
2. In Plan, click Share plan via QR.
3. Scan with your phone.
4. Open the read-only mobile page (`share.html`) as your companion view while gaming.

Notes:

- Share payload is compressed into URL hash (no server storage).
- You can share all sessions or selected sessions only.
- QR size guidance is shown in-app (balanced and ultra-safe subset suggestions).
- Shared page defaults to the sharer's theme, while viewers can still switch theme on mobile.
- Data tab can generate QR snapshots for inventory-only or created-professions progress-only sharing.

## App Feature Map

- Home: overview, workflow guidance, and project notice.
- Optimizer: profession-targeted plan generation with inventory-aware options.
- Sandbox: free-form quantity testing and resulting profession fulfillment.
- Plan: sessions, rockets, deficits, and QR/share generation.
- Progress: created/planned/remaining tracking by committee.
- Professions: browsable requirements and status marking.
- Foods: food reference and inventory editing.
- Memories: memory reference and inventory editing.
- Data: import/export profile JSON and reset inventory.
- Data: import/export profile JSON, reset inventory, and generate inventory/progress QR snapshots.

## Architecture Overview

### Runtime architecture (app first)

This project is a browser-only static app with two entry pages:

- `index.html`: main planner SPA (tab-based UI).
- `share.html`: mobile-focused read-only plan viewer for shared links.

JavaScript is split by responsibility:

- `js/optimizer.js`: optimization engine and domain logic.
- `js/ui.js`: UI rendering, state orchestration, persistence, plan/share actions.
- `js/share.js`: decode/render logic for shared mobile snapshots.

Styling is split by page:

- `css/styles.css`: main app styles and themes.
- `css/share.css`: mobile share page styles and themes.

Domain data is pre-generated/static:

- `data/foods.js`
- `data/memories.js`
- `data/professions.js`
- `data/bio.js` (manually maintained source metadata and conversion helpers)

### Persistence model

Runtime data is stored in browser localStorage (per browser profile/device), including:

- Inventory (foods/memories)
- Sandbox values + filters
- Plan sessions/humans/flights
- Created professions
- Selected tab/mode/theme and optimizer settings

Import/export JSON is provided in the Data tab for portability.

### Share model

Sharing uses compressed URL hash payloads:

- No backend persistence
- Read-only mobile rendering by default
- Optional import into local planner state from the shared snapshot
- Supports typed snapshots:
    - `plan` (sessions/flights/humans)
    - `inventory` (current food + memory quantities)
    - `progress` (created professions)

## Running Locally

Open `index.html` directly in a browser.

Optional local server options:

- VS Code + Live Server extension
- `python -m http.server 8080` then open <http://localhost:8080>
- `npx serve .`

## Hosting and Deployment

Production is hosted on GitHub Pages:

- <https://camrex.github.io/last-caretaker-human-optimizer/>

For setup and release checklist, see:

- `docs/deploy.md`

Key deployment notes:

- Push to `main` triggers Pages rebuild.
- App runtime remains fully static (no server runtime).

## Data Pipeline (Maintainer "Backend")

Although the app runtime is static, data maintenance uses a Python sync pipeline.

Canonical source workbook:

- `resource/The Last Caretaker - Human Needs.xlsx`

Sync script:

- `scripts/sync_tables_from_excel.py`

Commands:

- Write generated data:
    - `e:/DevProjects/last-caretaker-human-optimizer/.venv/Scripts/python.exe scripts/sync_tables_from_excel.py --write`
- Check whether generated files are in sync:
    - `e:/DevProjects/last-caretaker-human-optimizer/.venv/Scripts/python.exe scripts/sync_tables_from_excel.py --check`

Pipeline output:

- Regenerates `data/foods.js`, `data/memories.js`, `data/professions.js` in sparse format (non-zero numeric fields only).
- Emits stable numeric IDs for foods/memories/professions and persists name->id mapping in `resource/item_ids.json` for compact share encoding.
- Leaves `data/bio.js` manually maintained.

## Repository Structure

```text
last-caretaker-human-optimizer/
├── index.html
├── share.html
├── css/
│   ├── styles.css
│   └── share.css
├── js/
│   ├── optimizer.js
│   ├── ui.js
│   └── share.js
├── data/
│   ├── bio.js
│   ├── foods.js
│   ├── memories.js
│   └── professions.js
├── scripts/
│   └── sync_tables_from_excel.py
├── resource/
│   └── The Last Caretaker - Human Needs.xlsx
└── docs/
        └── deploy.md
```

## Privacy and Constraints

- All runtime state is local to the browser/device unless explicitly exported/shared.
- Shared links can expose planning details to anyone with the URL.
- QR scan reliability depends on payload size; prefer session-only sharing when needed.

## Planned / TBD

- [ ] Human tracking: track each created human with created date, profession, committee assignment, and Earth/Space status (allow duplicate professions across multiple humans).
- [ ] Session/Rocket flow update: allow rocket planning without requiring humans to be marked as created first.
- [ ] Human tracking + rocket planning bridge: support adding already-created humans (outside a plan) into rocket plans.
- [ ] Human seed tracking: track seed availability and remaining seeds per known location.
- [ ] Ensure full data portability: include all plan/tracking state in Data Export/Import.
- [ ] Add a non-spoiler mode that hides or masks progression-sensitive data until explicitly revealed.
