#!/usr/bin/env python3

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
HTML_PATH = PROJECT_ROOT / "characters.html"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "images" / "icons"
JSON_PATH = PROJECT_ROOT / "assets" / "characters.json"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def get_full_resolution_url(url: str) -> str:
    return re.sub(r"scale-to-width-down/\d+", "scale-to-width-down/256", url)


def parse_characters(html_content: str) -> list[dict]:
    soup = BeautifulSoup(html_content, "html.parser")
    rows = soup.select("tbody tr")
    characters = []

    for row in rows:
        tds = row.find_all("td")
        if len(tds) < 5:
            continue

        char_td = tds[0]
        img = char_td.find("img", {"data-image-key": re.compile(r"^Character_.*_Icon\.png$")})
        if not img:
            continue

        name_link = char_td.find("a", href=re.compile(r"^/wiki/"), title=True)
        if not name_link or not name_link.get("title"):
            continue

        name = name_link["title"]
        icon_url = img.get("data-src") or img.get("src")
        if not icon_url or "Character_" not in icon_url:
            continue

        rarity_span = tds[1].find("span", title=True)
        rarity = rarity_span["title"] if rarity_span else ""

        path_links = tds[2].find_all("a", href=re.compile(r"^/wiki/"))
        path = next((a.get_text(strip=True) for a in path_links if a.get_text(strip=True)), "")

        combat_span = tds[3].find("span", class_=re.compile(r"text-"))
        combat_type = combat_span.get_text(strip=True) if combat_span else ""

        version_link = tds[4].find("a", href=re.compile(r"Version/"))
        version = version_link.get_text(strip=True) if version_link else ""

        characters.append({
            "id": slugify(name),
            "name": name,
            "icon_url": get_full_resolution_url(icon_url),
            "rarity": rarity,
            "path": path,
            "combat_type": combat_type,
            "version": version,
        })

    return characters


def download_icon(url: str, filepath: Path) -> bool:
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        filepath.write_bytes(response.content)
        return True
    except Exception as e:
        print(f"  Failed: {e}", file=sys.stderr)
        return False


def main():
    if not HTML_PATH.exists():
        print(f"Error: {HTML_PATH} not found", file=sys.stderr)
        sys.exit(1)

    html_content = HTML_PATH.read_text(encoding="utf-8")
    characters = parse_characters(html_content)
    print(f"Parsed {len(characters)} characters")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_data = []

    for char in characters:
        filename = f"{char['id']}_icon.png"
        filepath = OUTPUT_DIR / filename
        icon_local = f"assets/images/icons/{filename}"

        print(f"Downloading {char['name']}...", end=" ")
        if download_icon(char["icon_url"], filepath):
            print("OK")
        else:
            print("SKIP (using original URL)")
            icon_local = char["icon_url"]

        output_data.append({
            "id": char["id"],
            "name": char["name"],
            "icon": icon_local,
            "rarity": char["rarity"],
            "path": char["path"],
            "combat_type": char["combat_type"],
            "version": char["version"],
        })

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved {JSON_PATH}")


if __name__ == "__main__":
    main()
