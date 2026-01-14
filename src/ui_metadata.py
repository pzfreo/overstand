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
    # ============================================
    # STAGE 1: INSTRUMENT IDENTITY
    # ============================================
    'identity': SectionDefinition(
        id='identity',
        title='Instrument Identity',
        type=SectionType.INPUT_BASIC,
        icon='🎻',
        default_expanded=True,
        order=1,
        parameter_names=[
            'instrument_name',
            'instrument_family',
            'vsl'
        ],
        description='What you\'re building and at what scale - these define the foundation'
    ),

    # ============================================
    # STAGE 2: SIDE VIEW - BODY & BRIDGE
    # ============================================
    'body_and_bridge': SectionDefinition(
        id='body_and_bridge',
        title='Body & Bridge',
        type=SectionType.INPUT_BASIC,
        icon='📐',
        default_expanded=True,
        order=2,
        parameter_names=[
            'body_length',
            'overstand',
            'bridge_height',
            'arching_height',
            'body_stop',    # Violin/Viol only (visible_when filters it)
            'fret_join'     # Guitar/Mandolin only (visible_when filters it)
        ],
        description='Core side-view geometry: the "triangle" that defines your instrument\'s profile. For guitars, fret_join defines where the neck meets the body (like body_stop for violins)'
    ),

    # ============================================
    # STAGE 3: SIDE VIEW - STRING ACTION
    # ============================================
    'string_action': SectionDefinition(
        id='string_action',
        title='String Action',
        type=SectionType.INPUT_BASIC,
        icon='🎼',
        default_expanded=True,
        order=3,
        parameter_names=[
            'string_height_nut',
            'string_height_eof',         # Violin/Viol only
            'string_height_12th_fret'    # Guitar/Mandolin only
        ],
        description='String height at key points - REQUIRED for side view generation. The neck angle is calculated from these values'
    ),

    # ============================================
    # STAGE 4: SIDE VIEW - VIOL SPECIFIC
    # ============================================
    'viol_specific': SectionDefinition(
        id='viol_specific',
        title='Viol Geometry',
        type=SectionType.INPUT_ADVANCED,
        icon='🎻',
        default_expanded=False,
        order=4,
        parameter_names=[
            'break_angle',
            'top_block_height'
        ],
        description='Viol-specific side view geometry: back break angle and top block height'
    ),

    # ============================================
    # STAGE 5: FINGERBOARD GEOMETRY
    # ============================================
    'fingerboard': SectionDefinition(
        id='fingerboard',
        title='Fingerboard',
        type=SectionType.INPUT_ADVANCED,
        icon='🎯',
        default_expanded=False,
        order=5,
        parameter_names=[
            'fingerboard_length',
            'fingerboard_radius',
            'fingerboard_width_at_nut',
            'fingerboard_width_at_end',
            'fb_visible_height_at_nut',
            'fb_visible_height_at_join'
        ],
        description='Fingerboard dimensions - length (side view), curvature and width (cross-section), visible heights (both views)'
    ),

    # ============================================
    # STAGE 6: CROSS-SECTION - NECK DIMENSIONS
    # ============================================
    'neck_cross_section': SectionDefinition(
        id='neck_cross_section',
        title='Cross-Section: Neck',
        type=SectionType.INPUT_ADVANCED,
        icon='📏',
        default_expanded=False,
        order=6,
        parameter_names=[
            'button_width_at_join',
            'neck_width_at_top_of_ribs',
            'fb_blend_percent'
        ],
        description='Neck dimensions at the body join - defines the neck cross-section view'
    ),

    # ============================================
    # STAGE 7: FRETS
    # ============================================
    'frets': SectionDefinition(
        id='frets',
        title='Frets',
        type=SectionType.INPUT_ADVANCED,
        icon='📊',
        default_expanded=False,
        order=7,
        parameter_names=[
            'no_frets'
        ],
        description='Number of frets to calculate (fret_join is in Body & Bridge section)'
    ),

    # ============================================
    # STAGE 8: ADVANCED GEOMETRY
    # ============================================
    'advanced_geometry': SectionDefinition(
        id='advanced_geometry',
        title='Advanced Geometry',
        type=SectionType.INPUT_ADVANCED,
        icon='⚙️',
        default_expanded=False,
        order=8,
        parameter_names=[
            'rib_height',
            'belly_edge_thickness',
            'tailpiece_height'
        ],
        description='Advanced geometric parameters for fine-tuning. Note: neck_angle is always calculated, never manually input'
    ),

    # ============================================
    # STAGE 9: DISPLAY OPTIONS
    # ============================================
    'display': SectionDefinition(
        id='display',
        title='Display Options',
        type=SectionType.INPUT_ADVANCED,
        icon='👁️',
        default_expanded=False,
        order=9,
        parameter_names=[
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
            'neck_angle',
            'neck_stop',
            'body_stop',
            'nut_relative_to_ribs',
            'string_break_angle',
            'downward_force_percent',
            'fb_thickness_at_nut',
            'fb_thickness_at_join',
            'neck_block_max_width'
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
            'sagitta_at_nut',
            'sagitta_at_join',
            'string_angle_to_ribs',
            'string_angle_to_fingerboard',
            'afterlength_angle',
            'neck_line_angle_deg',
            'fb_direction_angle_deg',
            'neck_end_x',
            'neck_end_y',
            'nut_draw_radius',
            'nut_top_x',
            'nut_top_y',
            'bridge_top_x',
            'bridge_top_y',
            'fb_bottom_end_x',
            'fb_bottom_end_y',
            'fb_thickness_at_end',
            'nut_perpendicular_intersection_x',
            'nut_perpendicular_intersection_y',
            'nut_to_perpendicular_distance',
            'string_x_at_fb_end',
            'string_y_at_fb_end',
            'fb_surface_point_x',
            'fb_surface_point_y',
            'string_height_at_fb_end'
        ],
        description='Internal geometry and detailed calculations for advanced users'
    )
}


# ============================================
# KEY MEASUREMENTS CONFIGURATION
# ============================================
# These are displayed prominently at the top of the parameters panel.
# The first item is shown as the primary (larger) metric.
# Use 'key_conditional' for parameters that change based on instrument family.

KEY_MEASUREMENTS = [
    {'key': 'neck_angle', 'primary': True},
    {'key': 'neck_stop', 'key_conditional': {'GUITAR_MANDOLIN': 'body_stop'}},
    {'key': 'nut_relative_to_ribs'},
    {'key': 'string_break_angle'}
]


# ============================================
# VALIDATION
# ============================================

def validate_sections():
    """
    Validate that all section parameter_names reference valid parameters in the registry.

    This catches configuration errors at module load time.
    Raises ValueError if any section references an unknown parameter.
    """
    from parameter_registry import PARAMETER_REGISTRY

    errors = []

    for section_id, section in SECTIONS.items():
        for param_name in section.parameter_names:
            if param_name not in PARAMETER_REGISTRY:
                errors.append(
                    f"Section '{section_id}' references unknown parameter '{param_name}'"
                )

    if errors:
        error_msg = "UI Section Validation Failed:\n  " + "\n  ".join(errors)
        raise ValueError(error_msg)


# Run validation at module load
validate_sections()


# ============================================
# INSTRUMENT PRESETS
# ============================================
# NOTE: Presets are now loaded from JSON files in the presets/ directory.
# This allows easy editing without touching Python code.
# To add/edit presets:
# 1. Edit instrument_presets_full.csv with your values
# 2. Run: python3 scripts/export_presets_to_json.py
# 3. This will create/update JSON files in presets/

# Legacy hardcoded presets removed - now loaded from JSON files in presets/ directory

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
        return {}

# Load presets from JSON files
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
    from parameter_registry import get_all_input_parameters, get_all_output_parameters

    input_params = get_all_input_parameters()
    output_params = get_all_output_parameters()

    return {
        'sections': {k: v.to_dict() for k, v in SECTIONS.items()},
        'presets': {k: v.to_dict() for k, v in INSTRUMENT_PRESETS.items()},
        # Use to_input_metadata() explicitly for input params to ensure correct format
        # (CONDITIONAL params have both configs, to_dict() would return output format)
        'parameters': {k: v.to_input_metadata() for k, v in input_params.items()},
        'derived_values': {k: v.to_dict() for k, v in output_params.items()},
        'key_measurements': KEY_MEASUREMENTS
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
