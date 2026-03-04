#!/usr/bin/env python3
"""
Generate JSON fixtures for TypeScript parity tests.

Runs every preset through the Python geometry engine and captures
derived_values and fret_positions. The TypeScript port must produce
identical numerical results for these inputs.

Usage:
    python scripts/generate_ts_fixtures.py

Output:
    tests/fixtures/python_parity.json

Re-run this whenever the Python geometry engine changes so the fixtures
stay in sync with the reference implementation.
"""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from instrument_generator import generate_violin_neck
from geometry_engine import calculate_fret_positions

PRESETS_DIR = Path(__file__).parent.parent / 'presets'
OUTPUT_FILE = Path(__file__).parent.parent / 'tests' / 'fixtures' / 'python_parity.json'

# Skip non-instrument files
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


def generate_fixture(preset_name: str, params: dict) -> dict:
    result = json.loads(generate_violin_neck(json.dumps(params)))
    if not result['success']:
        raise RuntimeError(f"Generation failed for {preset_name}: {result['errors']}")
    vsl = params.get('vsl', 325.0)
    no_frets = params.get('no_frets', 0)
    return {
        'preset': preset_name,
        'params': params,
        'expected': {
            'derived_values': result['derived_values'],
            'fret_positions': calculate_fret_positions(vsl, no_frets),
        }
    }


def main():
    fixtures = []
    errors = []

    preset_files = sorted(
        p for p in PRESETS_DIR.glob('*.json')
        if p.name not in SKIP
    )

    for preset_path in preset_files:
        params = load_preset(preset_path)
        if params is None:
            continue
        try:
            fixture = generate_fixture(preset_path.stem, params)
            fixtures.append(fixture)
            print(f'  OK  {preset_path.name}  ({len(fixture["expected"]["derived_values"])} derived values)')
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
