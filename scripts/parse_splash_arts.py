#!/usr/bin/env python3

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
HTML_PATH = PROJECT_ROOT / "characters_full.html"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "images" / "splash"
CHARACTERS_JSON = PROJECT_ROOT / "assets" / "characters.json"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def get_full_resolution_url(url: str) -> str:
    return re.sub(r"/smart/width/\d+/height/\d+", "", url)


def parse_splash_arts(html_content: str) -> list[dict]:
    soup = BeautifulSoup(html_content, "html.parser")
    members = soup.select("li.category-page__member")
    characters = []

    for member in members:
        link = member.find("a", class_="category-page__member-link", href=re.compile(r"File:Character_.*_Splash_Art\.png"))
        if not link or not link.get("title"):
            continue

        title = link["title"]
        match = re.match(r"File:Character (.+) Splash Art\.png", title)
        if not match:
            continue

        name = match.group(1)
        img = member.find("img", class_="category-page__member-thumbnail")
        if not img:
            continue

        img_url = img.get("data-src") or img.get("src")
        if not img_url or "Character_" not in img_url or "Splash_Art" not in img_url:
            continue

        characters.append({
            "id": slugify(name),
            "name": name,
            "splash_url": get_full_resolution_url(img_url),
        })

    return characters


def download_splash(url: str, filepath: Path) -> bool:
    try:
        response = requests.get(url, timeout=60)
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
    characters = parse_splash_arts(html_content)
    print(f"Parsed {len(characters)} splash arts")

    if not CHARACTERS_JSON.exists():
        print(f"Error: {CHARACTERS_JSON} not found", file=sys.stderr)
        sys.exit(1)

    characters_data = json.loads(CHARACTERS_JSON.read_text(encoding="utf-8"))
    chars_by_id = {c["id"]: c for c in characters_data}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for char in characters:
        filename = f"{char['id']}_splash.png"
        filepath = OUTPUT_DIR / filename
        splash_local = f"assets/images/splash/{filename}"

        print(f"Downloading {char['name']}...", end=" ")
        if download_splash(char["splash_url"], filepath):
            print("OK")
        else:
            print("SKIP (using original URL)")
            splash_local = char["splash_url"]

        if char["id"] in chars_by_id:
            chars_by_id[char["id"]]["splash"] = splash_local

    CHARACTERS_JSON.write_text(json.dumps(characters_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved {CHARACTERS_JSON}")


if __name__ == "__main__":
    main()
