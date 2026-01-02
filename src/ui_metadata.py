"""
UI Metadata Definitions

This module defines the organization of the user interface including:
- Section definitions (collapsible groups of parameters)
- Instrument presets (quick-start templates)
- UI structure and hierarchy

All UI organization is defined here as metadata - the JavaScript layer
just renders what this module defines.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum
import json


class SectionType(Enum):
    """Type of UI section"""
    INPUT_BASIC = "input_basic"          # Basic input parameters
    INPUT_ADVANCED = "input_advanced"    # Advanced input parameters
    OUTPUT_CORE = "output_core"          # Core derived values
    OUTPUT_DETAILED = "output_detailed"  # Detailed/internal outputs


@dataclass
class SectionDefinition:
    """Defines a collapsible UI section"""
    id: str                              # Unique identifier (e.g., 'basic')
    title: str                           # Display name (e.g., 'Basic Parameters')
    type: SectionType                    # Section type
    icon: str                            # Icon/emoji for header
    default_expanded: bool               # Initial state (True = expanded)
    order: int                           # Display order (lower = earlier)
    parameter_names: List[str]           # Which parameters belong here
    description: str                     # Help text shown in section

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        return {
            'id': self.id,
            'title': self.title,
            'type': self.type.value,
            'icon': self.icon,
            'default_expanded': self.default_expanded,
            'order': self.order,
            'parameter_names': self.parameter_names,
            'description': self.description
        }


@dataclass
class InstrumentPreset:
    """Preset that auto-fills basic parameters"""
    id: str                              # Unique identifier (e.g., 'violin')
    display_name: str                    # Display name (e.g., 'Violin')
    family: str                          # VIOLIN, VIOL, or GUITAR_MANDOLIN
    basic_params: Dict[str, Any]         # Auto-fill values
    icon: str = ''                       # Emoji/icon (optional, deprecated)
    description: str = ''                # Tooltip/help text

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        return {
            'id': self.id,
            'display_name': self.display_name,
            'family': self.family,
            'basic_params': self.basic_params,
            'icon': self.icon,
            'description': self.description
        }


# ============================================
# SECTION DEFINITIONS
# ============================================

SECTIONS = {
    'basic': SectionDefinition(
        id='basic',
        title='Basic Parameters',
        type=SectionType.INPUT_BASIC,
        icon='🎯',
        default_expanded=True,  # Expanded by default, but collapsible
        order=1,
        parameter_names=[
            'instrument_family',  # First: choose instrument type
            'vsl',                # Then the 6 core basic params
            'body_length',
            'body_stop',
            'overstand',
            'bridge_height',
            'arching_height'
        ],
        description='Essential parameters required for all instruments'
    ),

    'advanced_geometry': SectionDefinition(
        id='advanced_geometry',
        title='Advanced Geometry',
        type=SectionType.INPUT_ADVANCED,
        icon='📐',
        default_expanded=False,  # Collapsed by default
        order=2,
        parameter_names=[
            'neck_stop',
            'fingerboard_length',
            'rib_height',
            'belly_edge_thickness',
            'fingerboard_radius'
        ],
        description='Detailed geometric parameters for fine-tuning'
    ),

    'advanced_fingerboard': SectionDefinition(
        id='advanced_fingerboard',
        title='Fingerboard Details',
        type=SectionType.INPUT_ADVANCED,
        icon='🎵',
        default_expanded=False,
        order=3,
        parameter_names=[
            'fingerboard_width_at_nut',
            'fingerboard_width_at_end',
            'fb_visible_height_at_nut',
            'fb_visible_height_at_join',
            'string_height_nut',
            'string_height_eof',
            'string_height_12th_fret'
        ],
        description='Fingerboard dimensions and string action'
    ),

    'advanced_frets': SectionDefinition(
        id='advanced_frets',
        title='Fret Configuration',
        type=SectionType.INPUT_ADVANCED,
        icon='🎸',
        default_expanded=False,
        order=4,
        parameter_names=[
            'no_frets',
            'fret_join'
        ],
        description='Fret positions and neck/body junction (optional for body-stop driven instruments)'
    ),

    'display': SectionDefinition(
        id='display',
        title='Display Options',
        type=SectionType.INPUT_ADVANCED,
        icon='⚙️',
        default_expanded=False,
        order=5,
        parameter_names=[
            'instrument_name',
            'show_measurements'
        ],
        description='Visualization and annotation settings'
    ),

    'core_outputs': SectionDefinition(
        id='core_outputs',
        title='Core Measurements',
        type=SectionType.OUTPUT_CORE,
        icon='📊',
        default_expanded=True,
        order=10,
        parameter_names=[
            'Neck Angle',
            'Neck Stop',
            'Body Stop',
            'Nut Relative to Ribs',
            'Total FB Thickness at Nut',
            'Total FB Thickness at Join'
        ],
        description='Primary calculated values'
    ),

    'detailed_outputs': SectionDefinition(
        id='detailed_outputs',
        title='Detailed Calculations',
        type=SectionType.OUTPUT_DETAILED,
        icon='🔬',
        default_expanded=False,
        order=11,
        parameter_names=[
            'Sagitta at Nut',
            'Sagitta at Join',
            'String Angle to Ribs',
            'String Angle to Fingerboard',
            'Neck Angle (rad)',
            'Neck End X',
            'Neck End Y',
            'Nut Draw Radius',
            'Neck Line Angle',
            'Nut Top X',
            'Nut Top Y',
            'Bridge Top X',
            'Bridge Top Y',
            'Fingerboard Direction Angle',
            'Fingerboard Bottom End X',
            'Fingerboard Bottom End Y',
            'Fingerboard Thickness at End',
            'Nut Perpendicular Intersection X',
            'Nut Perpendicular Intersection Y',
            'Nut to Perpendicular Distance',
            'String X at Fingerboard End',
            'String Y at Fingerboard End',
            'Fingerboard Surface Point X',
            'Fingerboard Surface Point Y',
            'String Height at Fingerboard End'
        ],
        description='Internal geometry and detailed calculations for advanced users'
    )
}


# ============================================
# INSTRUMENT PRESETS
# ============================================
# NOTE: Presets are now loaded from JSON files in the presets/ directory.
# This allows easy editing without touching Python code.
# To add/edit presets:
# 1. Edit instrument_presets_full.csv with your values
# 2. Run: python3 scripts/export_presets_to_json.py
# 3. This will create/update JSON files in presets/

# Legacy hardcoded presets - kept as fallback only
_LEGACY_INSTRUMENT_PRESETS = {
    'violin': InstrumentPreset(
        id='violin',
        display_name='Violin',
        family='VIOLIN',
        icon='🎻',
        basic_params={
            'instrument_family': 'VIOLIN',
            'vsl': 325.0,
            'body_length': 355.0,
            'body_stop': 195.0,
            'overstand': 12.0,
            'bridge_height': 33.0,
            'arching_height': 15.0
        },
        description='Standard violin dimensions based on Stradivari models'
    ),

    'viola': InstrumentPreset(
        id='viola',
        display_name='Viola',
        family='VIOLIN',
        icon='🎻',
        basic_params={
            'instrument_family': 'VIOLIN',
            'vsl': 370.0,
            'body_length': 410.0,
            'body_stop': 225.0,
            'overstand': 14.0,
            'bridge_height': 35.0,
            'arching_height': 16.0
        },
        description='Standard viola dimensions'
    ),

    'cello': InstrumentPreset(
        id='cello',
        display_name='Cello',
        family='VIOLIN',
        icon='🎻',
        basic_params={
            'instrument_family': 'VIOLIN',
            'vsl': 690.0,
            'body_length': 755.0,
            'body_stop': 400.0,
            'overstand': 24.0,
            'bridge_height': 80.0,
            'arching_height': 28.0
        },
        description='Standard cello dimensions'
    ),

    'treble_viol': InstrumentPreset(
        id='treble_viol',
        display_name='Treble Viol',
        family='VIOL',
        icon='🎻',
        basic_params={
            'instrument_family': 'VIOL',
            'vsl': 330.0,
            'body_length': 400.0,
            'body_stop': 200.0,
            'overstand': 10.0,
            'bridge_height': 30.0,
            'arching_height': 14.0,
            'no_frets': 7  # Viols have frets
        },
        description='Treble viol / Pardessus de viole'
    ),

    'tenor_viol': InstrumentPreset(
        id='tenor_viol',
        display_name='Tenor Viol',
        family='VIOL',
        icon='🎻',
        basic_params={
            'instrument_family': 'VIOL',
            'vsl': 400.0,
            'body_length': 480.0,
            'body_stop': 240.0,
            'overstand': 12.0,
            'bridge_height': 35.0,
            'arching_height': 16.0,
            'no_frets': 7
        },
        description='Tenor viol dimensions'
    ),

    'bass_viol': InstrumentPreset(
        id='bass_viol',
        display_name='Bass Viol',
        family='VIOL',
        icon='🎻',
        basic_params={
            'instrument_family': 'VIOL',
            'vsl': 680.0,
            'body_length': 750.0,
            'body_stop': 400.0,
            'overstand': 20.0,
            'bridge_height': 75.0,
            'arching_height': 25.0,
            'no_frets': 7
        },
        description='Bass viol dimensions (Viola da Gamba)'
    ),

    'archtop_guitar': InstrumentPreset(
        id='archtop_guitar',
        display_name='Archtop Guitar',
        family='GUITAR_MANDOLIN',
        icon='🎸',
        basic_params={
            'instrument_family': 'GUITAR_MANDOLIN',
            'vsl': 635.0,
            'body_length': 505.0,
            'fret_join': 14,
            'overstand': 8.0,
            'bridge_height': 25.0,
            'arching_height': 18.0,
            'no_frets': 20
        },
        description='Archtop jazz guitar dimensions (fret-join driven)'
    ),

    'mandolin': InstrumentPreset(
        id='mandolin',
        display_name='Mandolin',
        family='GUITAR_MANDOLIN',
        icon='🎸',
        basic_params={
            'instrument_family': 'GUITAR_MANDOLIN',
            'vsl': 330.0,
            'body_length': 280.0,
            'fret_join': 12,
            'overstand': 5.0,
            'bridge_height': 15.0,
            'arching_height': 12.0,
            'no_frets': 20
        },
        description='Standard mandolin dimensions (fret-join driven)'
    ),

    'mandola': InstrumentPreset(
        id='mandola',
        display_name='Mandola',
        family='GUITAR_MANDOLIN',
        icon='🎸',
        basic_params={
            'instrument_family': 'GUITAR_MANDOLIN',
            'vsl': 420.0,
            'body_length': 350.0,
            'fret_join': 12,
            'overstand': 6.0,
            'bridge_height': 18.0,
            'arching_height': 14.0,
            'no_frets': 20
        },
        description='Alto mandola dimensions (fret-join driven)'
    ),

    'octave_mandolin': InstrumentPreset(
        id='octave_mandolin',
        display_name='Octave Mandolin',
        family='GUITAR_MANDOLIN',
        icon='🎸',
        basic_params={
            'instrument_family': 'GUITAR_MANDOLIN',
            'vsl': 550.0,
            'body_length': 450.0,
            'fret_join': 12,
            'overstand': 7.0,
            'bridge_height': 22.0,
            'arching_height': 16.0,
            'no_frets': 20
        },
        description='Octave mandolin / bouzouki dimensions (fret-join driven)'
    ),

    # Special option: Custom/Other instrument
    'custom': InstrumentPreset(
        id='custom',
        display_name='Other / Custom',
        family='VIOLIN',  # Default to violin family
        icon='🔧',
        basic_params={
            'instrument_family': 'VIOLIN',
            'vsl': 325.0,           # Default string length
            'body_length': 355.0,   # Default body length
            'body_stop': 195.0,     # Default body stop
            'overstand': 12.0,      # Default overstand
            'bridge_height': 33.0,  # Default bridge height
            'arching_height': 15.0  # Default arching height
        },
        description='Start with default values for a custom instrument'
    )
}

# Load presets from JSON files (preferred method)
def _load_presets_from_json():
    """Load preset metadata from JSON files in presets/ directory"""
    try:
        from preset_loader import discover_presets
        presets_metadata = discover_presets()

        # Convert to InstrumentPreset format for compatibility
        presets = {}
        for preset_id, metadata in presets_metadata.items():
            presets[preset_id] = InstrumentPreset(
                id=metadata.id,
                display_name=metadata.display_name,
                family=metadata.family,
                icon=metadata.icon,
                basic_params={},  # Will be loaded from JSON by JavaScript
                description=metadata.description
            )
        return presets
    except Exception as e:
        print(f"Warning: Could not load presets from JSON: {e}")
        print("Falling back to legacy hardcoded presets")
        return _LEGACY_INSTRUMENT_PRESETS

# Try to load from JSON, fall back to legacy if that fails
INSTRUMENT_PRESETS = _load_presets_from_json()


# ============================================
# EXPORT FUNCTIONS
# ============================================

def get_ui_metadata_bundle() -> dict:
    """
    Export complete UI metadata bundle.

    This is the single source of truth for UI organization.
    JavaScript loads this and renders the interface accordingly.

    Returns:
        dict: Complete metadata including sections, presets, parameters, and derived values
    """
    # Import here to avoid circular dependency
    from instrument_parameters import INSTRUMENT_PARAMETERS
    from derived_value_metadata import DERIVED_VALUE_METADATA

    return {
        'sections': {k: v.to_dict() for k, v in SECTIONS.items()},
        'presets': {k: v.to_dict() for k, v in INSTRUMENT_PRESETS.items()},
        'parameters': {k: v.to_dict() for k, v in INSTRUMENT_PARAMETERS.items()},
        'derived_values': {k: v.to_dict() for k, v in DERIVED_VALUE_METADATA.items()}
    }


def get_sections_as_json() -> str:
    """Export sections as JSON string"""
    return json.dumps({k: v.to_dict() for k, v in SECTIONS.items()})


def get_presets_as_json() -> str:
    """Export presets as JSON string"""
    return json.dumps({k: v.to_dict() for k, v in INSTRUMENT_PRESETS.items()})


if __name__ == '__main__':
    # Test metadata export
    print("=== UI METADATA BUNDLE ===")
    bundle = get_ui_metadata_bundle()

    print(f"\nSections: {len(bundle['sections'])}")
    for section_id, section in bundle['sections'].items():
        print(f"  - {section['title']} ({len(section['parameter_names'])} items)")

    print(f"\nPresets: {len(bundle['presets'])}")
    for preset_id, preset in bundle['presets'].items():
        print(f"  - {preset['icon']} {preset['display_name']} ({len(preset['basic_params'])} params)")

    print(f"\nParameters: {len(bundle['parameters'])}")
    print(f"Derived Values: {len(bundle['derived_values'])}")

    print("\n✓ Metadata bundle ready for export")
