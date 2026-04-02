#!/usr/bin/env python3
"""Sync app data tables from the Excel workbook.

Usage:
  python scripts/sync_tables_from_excel.py --write
  python scripts/sync_tables_from_excel.py --check
"""

from __future__ import annotations

import argparse
import json
from datetime import time
from pathlib import Path
from typing import Any

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK_PATH = ROOT / "resource" / "The Last Caretaker - Human Needs.xlsx"
FOODS_PATH = ROOT / "data" / "foods.js"
MEMORIES_PATH = ROOT / "data" / "memories.js"
PROFESSIONS_PATH = ROOT / "data" / "professions.js"

FOOD_NUMERIC_KEYS = [
    "lifeExp",
    "height",
    "weight",
    "strength",
    "intellect",
    "carbs",
    "protein",
    "fat",
    "omega3",
    "vitd",
    "calcium",
    "mito",
    "nanite",
    "bio",
]

MEMORY_NUMERIC_KEYS = [
    "adaptability",
    "comms",
    "creativity",
    "discipline",
    "empathy",
    "focus",
    "leadership",
    "logic",
    "patience",
    "wisdom",
    "starChild",
]

PROF_NUMERIC_KEYS = [
    "lifeExp",
    "height",
    "weight",
    "strength",
    "intellect",
    "comms",
    "empathy",
    "leadership",
    "discipline",
    "focus",
    "adaptability",
    "creativity",
    "patience",
    "wisdom",
    "logic",
    "starChild",
]


def clean_num(v: Any) -> int:
    return 0 if v is None else int(v)


def rank_to_num(rank_value: Any) -> int:
    if rank_value is None:
        return 0
    text = str(rank_value)
    try:
        return int(text.split("-")[0])
    except Exception:
        return 0


def time_to_text(v: Any) -> str:
    if isinstance(v, time):
        return f"{v.hour}:{v.minute:02d}"
    if v is None:
        return ""
    return str(v)


def js_quote(v: Any) -> str:
    return json.dumps(v, ensure_ascii=True)


def parse_foods(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["FOOD"]
    foods: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        if not row or not row[0]:
            continue
        if row[0] == "Food":
            continue
        foods.append(
            {
                "name": str(row[0]).strip(),
                "rank": rank_to_num(row[1]),
                "level": clean_num(row[2]),
                "craftTime": time_to_text(row[3]),
                "lifeExp": clean_num(row[4]),
                "height": clean_num(row[5]),
                "weight": clean_num(row[6]),
                "strength": clean_num(row[7]),
                "intellect": clean_num(row[8]),
                "carbs": clean_num(row[9]),
                "protein": clean_num(row[10]),
                "fat": clean_num(row[11]),
                "omega3": clean_num(row[12]),
                "vitd": clean_num(row[13]),
                "calcium": clean_num(row[14]),
                "mito": clean_num(row[15]),
                "nanite": clean_num(row[16]),
                "bio": clean_num(row[17]),
                "tooltip": str(row[18]).strip() if row[18] else "",
            }
        )
    return foods


def parse_memories(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["MEMORIES"]
    memories: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        memories.append(
            {
                "name": str(row[0]).strip(),
                "rank": rank_to_num(row[1]),
                "adaptability": clean_num(row[2]),
                "comms": clean_num(row[3]),
                "creativity": clean_num(row[4]),
                "discipline": clean_num(row[5]),
                "empathy": clean_num(row[6]),
                "focus": clean_num(row[7]),
                "leadership": clean_num(row[8]),
                "logic": clean_num(row[9]),
                "patience": clean_num(row[10]),
                "wisdom": clean_num(row[11]),
                "starChild": clean_num(row[12]),
                "tooltip": str(row[13]).strip() if len(row) > 13 and row[13] else "",
            }
        )
    return memories


def parse_professions(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["PROFESSION"]
    professions: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[1]:
            continue
        if str(row[1]).startswith("*"):
            continue
        committee = None if row[4] is None else str(row[4]).strip()
        professions.append(
            {
                "name": str(row[1]).strip(),
                "tier": clean_num(row[2]),
                "committee": committee,
                "lifeExp": clean_num(row[6]),
                "height": clean_num(row[7]),
                "weight": clean_num(row[8]),
                "strength": clean_num(row[9]),
                "intellect": clean_num(row[10]),
                "comms": clean_num(row[11]),
                "empathy": clean_num(row[12]),
                "leadership": clean_num(row[13]),
                "discipline": clean_num(row[14]),
                "focus": clean_num(row[15]),
                "adaptability": clean_num(row[16]),
                "creativity": clean_num(row[17]),
                "patience": clean_num(row[18]),
                "wisdom": clean_num(row[19]),
                "logic": clean_num(row[20]),
                "starChild": clean_num(row[21]),
            }
        )
    return professions


def render_sparse_object(item: dict[str, Any], fixed: list[str], numeric: list[str]) -> str:
    parts: list[str] = []
    for key in fixed:
        value = item[key]
        if value is None:
            parts.append(f"{key}:null")
        elif isinstance(value, str):
            parts.append(f"{key}:{js_quote(value)}")
        else:
            parts.append(f"{key}:{value}")

    for key in numeric:
        value = int(item.get(key, 0) or 0)
        if value != 0:
            parts.append(f"{key}:{value}")

    if item.get("tooltip"):
        parts.append(f"tooltip:{js_quote(item['tooltip'])}")

    return "{ " + ", ".join(parts) + " }"


def render_foods(foods: list[dict[str, Any]]) -> str:
    lines = [
        "// data/foods.js",
        "// Food definitions for The Last Caretaker optimizer.",
        "// Sparse format: only non-zero numeric traits are stored.",
        "",
        "var FOODS = [",
    ]
    for i, item in enumerate(foods):
        text = "  " + render_sparse_object(item, ["name", "rank", "craftTime", "level"], FOOD_NUMERIC_KEYS)
        if i < len(foods) - 1:
            text += ","
        lines.append(text)
    lines.extend([
        "];",
        "",
        "// Foods that require Bio Flesh ingredients (mito/nanite/bio)",
        "var BIO_FLESH_FOODS = "
        + js_quote([f["name"] for f in foods if (f.get("mito", 0) + f.get("nanite", 0) + f.get("bio", 0)) > 0])
        + ";",
        "",
    ])
    return "\n".join(lines)


def render_memories(memories: list[dict[str, Any]]) -> str:
    lines = [
        "// data/memories.js",
        "// Memory definitions for The Last Caretaker optimizer.",
        "// Sparse format: only non-zero numeric traits are stored.",
        "",
        "var MEMORIES = [",
    ]
    for i, item in enumerate(memories):
        text = "  " + render_sparse_object(item, ["name", "rank"], MEMORY_NUMERIC_KEYS)
        if i < len(memories) - 1:
            text += ","
        lines.append(text)
    lines.extend([
        "];",
        "",
        "// Artifact memories flagged for the exclude toggle",
        "var ARTIFACT_MEMORIES = " + js_quote([m["name"] for m in memories if m.get("rank") == 5]) + ";",
        "",
    ])
    return "\n".join(lines)


def render_professions(professions: list[dict[str, Any]]) -> str:
    lines = [
        "// data/professions.js",
        "// Profession definitions for The Last Caretaker optimizer.",
        "// Sparse format: only non-zero numeric traits are stored.",
        "",
        "var PROFESSIONS = [",
    ]
    for i, item in enumerate(professions):
        text = "  " + render_sparse_object(item, ["name", "tier", "committee"], PROF_NUMERIC_KEYS)
        if i < len(professions) - 1:
            text += ","
        lines.append(text)
    lines.extend([
        "];",
        "",
    ])
    return "\n".join(lines)


def diff_check(path: Path, expected: str) -> bool:
    current = path.read_text(encoding="utf-8")
    return current == expected


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync data tables from workbook")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="Write generated outputs to data/*.js")
    mode.add_argument("--check", action="store_true", help="Fail if data/*.js are out of sync")
    args = parser.parse_args()

    wb = openpyxl.load_workbook(WORKBOOK_PATH, data_only=True)
    foods = parse_foods(wb)
    memories = parse_memories(wb)
    professions = parse_professions(wb)

    rendered = {
        FOODS_PATH: render_foods(foods),
        MEMORIES_PATH: render_memories(memories),
        PROFESSIONS_PATH: render_professions(professions),
    }

    if args.write:
        for path, text in rendered.items():
            path.write_text(text, encoding="utf-8")
        print(f"Updated {len(rendered)} files from workbook.")
        return 0

    out_of_sync = [path for path, text in rendered.items() if not diff_check(path, text)]
    if out_of_sync:
        print("Out of sync files:")
        for path in out_of_sync:
            print(" -", path.relative_to(ROOT))
        return 1

    print("Data files are in sync with workbook.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
