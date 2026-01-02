#!/usr/bin/env python3
"""
Export instrument presets from CSV to JSON files.

This script reads the edited instrument_presets_full.csv and creates
individual JSON files for each preset in the presets/ directory,
using the same format as the save/load functionality.
"""

import csv
import json
import os
from datetime import datetime, timezone

def export_presets_from_csv(csv_path='instrument_presets_full.csv', output_dir='presets'):
    """Export presets from CSV to JSON files"""

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Read CSV
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Track which presets we create
    preset_files = []

    # Process each preset
    for row in rows:
        preset_id = row['preset_id']
        display_name = row['display_name']
        family = row['family']
        icon = row.get('icon', '')  # Optional icon field
        description = row['description']

        # Build parameters dict (exclude metadata columns)
        parameters = {}
        for key, value in row.items():
            if key in ['preset_id', 'display_name', 'family', 'icon', 'description']:
                continue

            # Skip empty values
            if value == '':
                continue

            # Convert types appropriately
            if key == 'instrument_family':
                parameters[key] = value  # Keep as string (enum value)
            elif key == 'instrument_name':
                parameters[key] = value  # Keep as string
            elif key == 'show_measurements':
                parameters[key] = value.lower() == 'true'  # Convert to boolean
            elif key in ['no_frets', 'fret_join']:
                # Integer parameters
                try:
                    parameters[key] = int(float(value))
                except ValueError:
                    continue
            else:
                # Numeric parameters
                try:
                    parameters[key] = float(value)
                except ValueError:
                    continue

        # Create JSON structure matching save/load format
        preset_data = {
            "metadata": {
                "version": "1.0",
                "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                "description": description,
                "preset_id": preset_id,
                "display_name": display_name,
                "family": family,
                "icon": icon
            },
            "parameters": parameters
        }

        # Write JSON file
        filename = f"{preset_id}.json"
        filepath = os.path.join(output_dir, filename)

        with open(filepath, 'w') as f:
            json.dump(preset_data, f, indent=2)

        preset_files.append(filename)
        print(f"✓ Created {filepath}")

    # Create presets.json manifest
    manifest = {
        "presets": preset_files,
        "generated": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }

    manifest_path = os.path.join(output_dir, 'presets.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n✓ Created manifest: {manifest_path}")
    print(f"✓ Total presets: {len(preset_files)}")

if __name__ == '__main__':
    import sys

    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'instrument_presets_full.csv'
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'presets'

    print(f"Exporting presets from {csv_path} to {output_dir}/")
    export_presets_from_csv(csv_path, output_dir)
    print("\n✅ Export complete!")
