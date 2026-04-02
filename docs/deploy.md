# Deployment Guide

This project is a static site hosted on GitHub Pages.

## One-time setup

1. Push this project to a GitHub repository.
2. Open repository Settings, then Pages.
3. Under Build and deployment:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
4. Save.

Published URL format:

- `https://<your-username>.github.io/<repo-name>/`

Current production URL:

- <https://camrex.github.io/last-caretaker-human-optimizer/>

## Release checklist

Before pushing updates:

1. Regenerate data from workbook:
   - `e:/DevProjects/last-caretaker-human-optimizer/.venv/Scripts/python.exe scripts/sync_tables_from_excel.py --write`
2. Verify sync state:
   - `e:/DevProjects/last-caretaker-human-optimizer/.venv/Scripts/python.exe scripts/sync_tables_from_excel.py --check`
3. Run a quick local smoke test:
   - Open `index.html` and validate tab navigation, optimizer run, and data import/export.
4. Commit and push to `main`.

## Notes

- GitHub Pages rebuilds automatically when `main` changes.
- `localStorage` data is browser-local and is not shared across devices.
- No backend/server is required.
