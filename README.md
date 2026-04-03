# The Last Caretaker — Human Optimizer

A lightweight web app for calculating the optimal food and memory combination
to grow a human for any profession in The Last Caretaker.

> [!WARNING]
> Spoilers ahead: this project includes profession, trait, planning, and progression information that may reveal discovery content in The Last Caretaker.

## Quick start

Open `index.html` in any browser. No server required.

If you want live-reload during development, any of these work:

- VS Code + Live Server extension
- `python -m http.server 8080` then open <http://localhost:8080>
- `npx serve .` if you have Node installed

## File structure

```text
last-caretaker/
├── index.html          Main app
├── css/
│   └── styles.css      All styling (default + PECO theme)
├── js/
│   ├── optimizer.js    Core optimization logic (no DOM dependency)
│   └── ui.js           Rendering and event handling
└── data/
    ├── bio.js          Bio-stuff sources, ingredients, conversion ratios
    ├── foods.js        Food definitions (trait outputs + ingredient recipes)
    ├── memories.js     Memory definitions (personality trait outputs + ranks)
    └── professions.js  Profession definitions (all trait requirements)
```

## Updating data

The canonical source for foods, memories, and professions is:

- `resource/The Last Caretaker - Human Needs.xlsx`

Use the sync script to regenerate data files:

- `e:/DevProjects/last-caretaker-human-optimizer/.venv/Scripts/python.exe scripts/sync_tables_from_excel.py --write`

Check if local data files are in sync with the workbook:

- `e:/DevProjects/last-caretaker-human-optimizer/.venv/Scripts/python.exe scripts/sync_tables_from_excel.py --check`

Notes:

- `data/foods.js`, `data/memories.js`, and `data/professions.js` are generated in sparse format (non-zero numeric fields only).
- `data/bio.js` remains manually maintained for conversion ratios and source metadata.

## Hosting on GitHub Pages

Live site:

- <https://camrex.github.io/last-caretaker-human-optimizer/>

For maintainers: deployment steps and release checklist are in `docs/deploy.md`.

Notes:

- `localStorage` (inventory, plan/session state, created professions, settings, theme) works on GitHub Pages.
- Data is browser-local per device/browser profile.
- No backend/server is required.

## Key mechanics

### Physical traits (food)

Life Exp, Height, Weight, Strength, Intellect are satisfied entirely by food.
Hard minimums: Life Exp ≥ 10, Height ≥ 30, Weight ≥ 20 for any human.

### Personality traits (memories)

Comms, Empathy, Leadership, Discipline, Focus, Adaptability, Creativity,
Patience, Wisdom, Logic are satisfied entirely by memories.
Star Child is a special trait currently only provided by Star Child Memory.

### Bio-stuff conversion

Bio-stuff is farmed and processed into food ingredients at approximately 1:1
(actual yield ~10–20% higher at full power).

- Bio Seaweed → Carbohydrates + Protein (both simultaneously from 1 unit)
- Bio Flesh → Mito. Amp. + Nanite Nutrient + Bioregulator (all three simultaneously)

### Inventory (local only)

- Inventory counts for foods and memories are stored in browser `localStorage`.
- Enable **Use stored inventory limits** to constrain optimization to your owned counts.
- Ash Notebook has a dedicated cap input (default 10) so recommendations account for finite Artifact memory usage.
- You can select professions using either **Committee then profession** or **Direct profession selection** mode.
- Use the **Progress** tab to mark professions as created and track committee completion.
- The **Optimizer** tab still includes quick mark/unmark actions for the currently selected profession.
- Use **Export planning JSON** / **Import planning JSON** to back up and restore profile state, including profession selection/mode, baseline sliders, toggles, inventory mode, theme, inventory counts, created professions, and plan/session/rocket data.
- Use **Share plan via QR** in the Plan tab to generate a compressed URL hash for read-only plan viewing on another device. You can share all sessions or only selected sessions, and a built-in size indicator helps estimate QR scan reliability. Shared links do not overwrite local data unless you explicitly import.
- No server-side storage is used.

### Tabs

- **Home:** overview, spoiler warning, project notice, and PECO-theme easter egg terminal screen.
- **Optimizer:** build a plan for a specific profession and review Ash Notebook recommendations.
- **Sandbox:** set custom food/memory quantities and preview resulting traits plus potentially satisfied professions.
- **Plan:** organize sessions, store planned humans, assign rockets, review deficits, and generate QR/share links for read-only mobile snapshots.
- **Progress:** track created professions, filter remaining work, and monitor committee completion.
- **Professions:** browse profession requirements, filter by committee/tier/status, and mark created/uncreated.
- **Foods:** browse food data and manage food inventory directly on cards.
- **Memories:** browse memory data, filter by rank/type/trait, and manage memory inventory directly on cards.
- **Data:** import/export planning JSON and reset inventory to zero.

## Planned / TBD

- [ ] Human tracking: track each created human with created date, profession, committee assignment, and Earth/Space status (allow duplicate professions across multiple humans).
- [ ] Session/Rocket flow update: allow rocket planning without requiring humans to be marked as created first.
- [ ] Human tracking + rocket planning bridge: support adding already-created humans (outside a plan) into rocket plans.
- [ ] Human seed tracking: track seed availability and remaining seeds per known location.
- [ ] Ensure full data portability: include all plan/tracking state in Data Export/Import.
- [ ] Add a non-spoiler mode that hides or masks progression-sensitive data until explicitly revealed.
