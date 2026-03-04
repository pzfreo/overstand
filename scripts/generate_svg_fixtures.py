#!/usr/bin/env python3
"""
Generate SVG reference fixtures for TypeScript SVG parity tests.

Runs every preset through the Python geometry engine, captures SVG output
for each view (side, cross_section), and extracts structural properties
(viewBox, element counts, text contents, path data).

Usage:
    python scripts/generate_svg_fixtures.py

Output:
    tests/fixtures/python_svg_parity.json

Re-run this whenever the Python SVG rendering changes so the fixtures
stay in sync with the reference implementation.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from instrument_generator import generate_violin_neck

PRESETS_DIR = Path(__file__).parent.parent / 'presets'
OUTPUT_FILE = Path(__file__).parent.parent / 'tests' / 'fixtures' / 'python_svg_parity.json'

# Skip non-instrument files (same as generate_ts_fixtures.py)
SKIP = {'presets.json', 'test_minimal.json', 'custom.json'}


def load_preset(path: Path) -> dict | None:
    with open(path) as f:
        data = json.load(f)
    if 'parameters' in data:
        return data['parameters']
    # Skip files that aren't instrument presets
    if 'metadata' not in data and 'instrument_family' not in data:
        return None
    return data


def parse_svg_properties(svg_string: str) -> dict:
    """Extract structural properties from an SVG string."""

    # Parse with ElementTree
    # SVG namespace
    ns = {'svg': 'http://www.w3.org/2000/svg'}

    try:
        root = ET.fromstring(svg_string)
    except ET.ParseError as e:
        return {
            'svg': svg_string,
            'parse_error': str(e),
            'viewBox': '',
            'path_count': 0,
            'text_count': 0,
            'group_count': 0,
            'text_contents': [],
            'path_data': [],
        }

    # Extract viewBox
    viewBox = root.attrib.get('viewBox', '')

    # Count elements - search recursively
    # ElementTree uses {namespace}tagname format
    paths = root.findall('.//{http://www.w3.org/2000/svg}path')
    if not paths:
        # Try without namespace (some SVGs don't use namespaces)
        paths = root.findall('.//path')

    texts = root.findall('.//{http://www.w3.org/2000/svg}text')
    if not texts:
        texts = root.findall('.//text')

    groups = root.findall('.//{http://www.w3.org/2000/svg}g')
    if not groups:
        groups = root.findall('.//g')

    # Extract text contents
    text_contents = []
    for t in texts:
        text_str = t.text or ''
        # Also check for child tspan elements
        for child in t:
            tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if tag == 'tspan' and child.text:
                text_str += child.text
        text_str = text_str.strip()
        if text_str:
            text_contents.append(text_str)

    # Extract path d attributes
    path_data = []
    for p in paths:
        d = p.attrib.get('d', '')
        if d:
            path_data.append(d)

    return {
        'svg': svg_string,
        'viewBox': viewBox,
        'path_count': len(paths),
        'text_count': len(texts),
        'group_count': len(groups),
        'text_contents': text_contents,
        'path_data': path_data,
    }


def generate_svg_fixture(preset_name: str, params: dict) -> dict:
    """Generate SVG fixture for a single preset."""
    result = json.loads(generate_violin_neck(json.dumps(params)))
    if not result['success']:
        raise RuntimeError(f"Generation failed for {preset_name}: {result['errors']}")

    views = {}
    for view_name in ('side', 'cross_section'):
        svg_string = result['views'].get(view_name, '')
        if svg_string and svg_string.startswith('<svg'):
            views[view_name] = parse_svg_properties(svg_string)
        else:
            views[view_name] = {
                'svg': svg_string,
                'viewBox': '',
                'path_count': 0,
                'text_count': 0,
                'group_count': 0,
                'text_contents': [],
                'path_data': [],
            }

    return {
        'preset': preset_name,
        'params': params,
        'views': views,
    }


def main():
    fixtures = []
    errors = []

    preset_files = sorted(
        p for p in PRESETS_DIR.glob('*.json')
        if p.name not in SKIP
    )

    print('Generating SVG parity fixtures...\n')

    for preset_path in preset_files:
        params = load_preset(preset_path)
        if params is None:
            continue
        try:
            fixture = generate_svg_fixture(preset_path.stem, params)
            side_info = fixture['views']['side']
            cs_info = fixture['views']['cross_section']
            print(f'  OK  {preset_path.name}')
            print(f'       side: {side_info["path_count"]} paths, '
                  f'{side_info["text_count"]} texts, '
                  f'{side_info["group_count"]} groups')
            print(f'       cross_section: {cs_info["path_count"]} paths, '
                  f'{cs_info["text_count"]} texts, '
                  f'{cs_info["group_count"]} groups')
            fixtures.append(fixture)
        except Exception as e:
            errors.append((preset_path.name, str(e)))
            print(f'  FAIL {preset_path.name}: {e}')

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(fixtures, f, indent=2)

    print(f'\nWrote {len(fixtures)} fixtures to {OUTPUT_FILE}')
    if errors:
        print(f'\nFailed ({len(errors)}):')
        for name, err in errors:
            print(f'  {name}: {err}')
        sys.exit(1)


if __name__ == '__main__':
    main()
