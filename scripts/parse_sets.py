#!/usr/bin/env python3

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CAVERN_HTML = PROJECT_ROOT / "sets.html"
PLANAR_HTML = PROJECT_ROOT / "planar.html"
JSON_PATH = PROJECT_ROOT / "assets" / "relic_sets.json"
SETS_IMG_DIR = PROJECT_ROOT / "assets" / "images" / "sets"
ITEMS_IMG_DIR = PROJECT_ROOT / "assets" / "images" / "items"

CAVERN_SLOTS = ["head", "hands", "body", "feet"]
PLANAR_SLOTS = ["sphere", "rope"]


def download_image(url: str, filepath: Path) -> bool:
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_bytes(response.content)
        return True
    except Exception as e:
        print(f"  Failed: {e}", file=sys.stderr)
        return False


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def get_full_resolution_url(url: str) -> str:
    return re.sub(r"scale-to-width-down/\d+", "scale-to-width-down/256", url)


def parse_bonuses(td) -> dict:
    text = td.get_text(separator=" ", strip=True)
    bonuses = {}
    two_match = re.search(r"2\s*Piece:\s*(.+?)(?=4\s*Piece:|$)", text, re.DOTALL | re.IGNORECASE)
    four_match = re.search(r"4\s*Piece:\s*(.+)$", text, re.DOTALL | re.IGNORECASE)
    if two_match:
        bonuses["2_piece"] = two_match.group(1).strip()
    if four_match:
        bonuses["4_piece"] = four_match.group(1).strip()
    return bonuses


def parse_sets(html_content: str) -> list[dict]:
    soup = BeautifulSoup(html_content, "html.parser")
    rows = soup.select("tbody tr")
    sets_data = []

    for row in rows:
        tds = row.find_all("td")
        if len(tds) < 4:
            continue

        icon_td = tds[0]
        name_td = tds[1]
        pieces_td = tds[2]
        bonuses_td = tds[3]

        set_link = name_td.find("a", href=re.compile(r"^/wiki/"), title=True)
        if not set_link:
            continue

        set_name = set_link.get("title", set_link.get_text(strip=True))
        set_id = slugify(set_name)

        set_img = icon_td.find("img", {"data-image-key": True})
        set_icon_url = ""
        if set_img:
            set_icon_url = get_full_resolution_url(
                set_img.get("data-src") or set_img.get("src") or ""
            )

        items = []
        item_spans = pieces_td.select("span.item")
        for idx, span in enumerate(item_spans):
            link = span.find("a", href=re.compile(r"^/wiki/"), title=True)
            if not link:
                continue
            item_name = link.get("title", "").replace("'", "'")
            item_img = span.find("img", {"data-image-key": True})
            item_icon_url = ""
            if item_img:
                item_icon_url = get_full_resolution_url(
                    item_img.get("data-src") or item_img.get("src") or ""
                )
            slots = CAVERN_SLOTS if len(item_spans) == 4 else PLANAR_SLOTS
            slot = slots[idx] if idx < len(slots) else ""
            items.append({
                "id": slugify(item_name),
                "name": item_name,
                "slot": slot,
                "icon": item_icon_url,
            })

        if not items:
            continue

        relic_type = "planar" if len(items) == 2 else "cavern"
        bonuses = parse_bonuses(bonuses_td)

        sets_data.append({
            "id": set_id,
            "name": set_name,
            "icon": set_icon_url,
            "type": relic_type,
            "bonuses": bonuses,
            "items": items,
        })

    return sets_data


def main():
    sets_data = []
    if CAVERN_HTML.exists():
        cavern_html = CAVERN_HTML.read_text(encoding="utf-8")
        cavern_sets = parse_sets(cavern_html)
        sets_data.extend(cavern_sets)
        print(f"Parsed {len(cavern_sets)} cavern sets from {CAVERN_HTML.name}")
    else:
        print(f"Warning: {CAVERN_HTML} not found", file=sys.stderr)
    if PLANAR_HTML.exists():
        planar_html = PLANAR_HTML.read_text(encoding="utf-8")
        planar_sets = parse_sets(planar_html)
        sets_data.extend(planar_sets)
        print(f"Parsed {len(planar_sets)} planar sets from {PLANAR_HTML.name}")
    else:
        print(f"Warning: {PLANAR_HTML} not found", file=sys.stderr)
    print(f"Total: {len(sets_data)} relic sets")

    for relic_set in sets_data:
        set_dir = SETS_IMG_DIR
        set_filepath = set_dir / f"{relic_set['id']}.png"
        if relic_set.get("icon"):
            print(f"Downloading set {relic_set['name']}...", end=" ")
            if download_image(relic_set["icon"], set_filepath):
                relic_set["icon"] = f"assets/images/sets/{relic_set['id']}.png"
                print("OK")
            else:
                print("SKIP")

        for item in relic_set["items"]:
            slot = item["slot"]
            if not slot or not item.get("icon"):
                continue
            item_dir = ITEMS_IMG_DIR / slot
            item_filepath = item_dir / f"{item['id']}.png"
            print(f"  {slot}/{item['id']}...", end=" ")
            if download_image(item["icon"], item_filepath):
                item["icon"] = f"assets/images/items/{slot}/{item['id']}.png"
                print("OK")
            else:
                print("SKIP")

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(
        json.dumps(sets_data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"\nSaved {JSON_PATH}")


if __name__ == "__main__":
    main()
