"""
Preset Loader - Loads instrument presets from JSON files

This module provides functions to load preset metadata from JSON files
in the presets/ directory, allowing easy editing of standard instruments
without touching Python code.
"""

import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class PresetMetadata:
    """Metadata for a preset (without full parameters)"""
    id: str
    display_name: str
    family: str
    icon: str
    description: str
    filepath: str  # Path to JSON file

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        return {
            'id': self.id,
            'display_name': self.display_name,
            'family': self.family,
            'icon': self.icon,
            'description': self.description,
            'filepath': self.filepath
        }


def load_preset_metadata_from_json(filepath: str) -> Optional[PresetMetadata]:
    """
    Load preset metadata from a JSON file.

    Args:
        filepath: Path to the JSON preset file

    Returns:
        PresetMetadata object or None if loading fails
    """
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)

        metadata = data.get('metadata', {})
        preset_id = metadata.get('preset_id')
        if not preset_id:
            # Try to derive from filename
            preset_id = os.path.basename(filepath).replace('.json', '')

        return PresetMetadata(
            id=preset_id,
            display_name=metadata.get('display_name', preset_id),
            family=metadata.get('family', 'VIOLIN'),
            icon=metadata.get('icon', ''),
            description=metadata.get('description', ''),
            filepath=filepath
        )
    except Exception as e:
        print(f"Warning: Failed to load preset from {filepath}: {e}")
        return None


def discover_presets(presets_dir: str = 'presets') -> Dict[str, PresetMetadata]:
    """
    Discover all preset JSON files in the presets directory.

    Args:
        presets_dir: Directory to search for preset files

    Returns:
        Dictionary of preset_id -> PresetMetadata
    """
    presets = {}

    # Get the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to repo root, then into presets
    repo_root = os.path.dirname(script_dir)
    presets_path = os.path.join(repo_root, presets_dir)

    if not os.path.exists(presets_path):
        print(f"Warning: Presets directory not found: {presets_path}")
        return presets

    # Check for presets.json manifest
    manifest_path = os.path.join(presets_path, 'presets.json')
    preset_files = []

    if os.path.exists(manifest_path):
        # Load from manifest
        try:
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)
                preset_files = manifest.get('presets', [])
        except Exception as e:
            print(f"Warning: Failed to load manifest {manifest_path}: {e}")

    # Fallback: discover all .json files (except presets.json itself)
    if not preset_files:
        for filename in os.listdir(presets_path):
            if filename.endswith('.json') and filename != 'presets.json':
                preset_files.append(filename)

    # Load metadata for each preset
    for filename in preset_files:
        filepath = os.path.join(presets_path, filename)
        if os.path.exists(filepath):
            metadata = load_preset_metadata_from_json(filepath)
            if metadata:
                # Store relative path for portability
                relative_path = os.path.join(presets_dir, filename)
                metadata.filepath = relative_path
                presets[metadata.id] = metadata

    return presets


# For backward compatibility, export a function to get presets as the old format
def get_presets_for_ui_bundle() -> dict:
    """
    Get presets formatted for UI metadata bundle.
    This maintains compatibility with the existing InstrumentPreset format.
    """
    presets = discover_presets()

    result = {}
    for preset_id, metadata in presets.items():
        result[preset_id] = {
            'id': metadata.id,
            'display_name': metadata.display_name,
            'family': metadata.family,
            'icon': metadata.icon,
            'description': metadata.description,
            # Note: basic_params are not included here - they'll be loaded from JSON
        }

    return result
