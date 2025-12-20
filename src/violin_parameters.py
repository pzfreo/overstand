"""
Violin Neck Parameter Definitions

This is YOUR main configuration file. Add parameters here and they 
automatically appear in the UI. Focus on encoding your lutherie expertise.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any
from enum import Enum
import json


# ============================================
# ENUMERATIONS (Dropdown Options)
# ============================================

class NeckProfile(Enum):
    """Neck cross-section profiles"""
    C_SHAPE = "C-Shape (Modern)"
    V_SHAPE = "V-Shape (Baroque)" 
    D_SHAPE = "D-Shape (Romantic)"
    CUSTOM = "Custom"


class StringCount(Enum):
    """Number of strings"""
    FOUR = "4 (Violin/Viola)"
    FIVE = "5 (Five-string Viola)"


class InstrumentType(Enum):
    """Type of bowed instrument"""
    VIOLIN = "Violin"
    VIOLA = "Viola"
    CELLO = "Cello (scaled)"


# ============================================
# PARAMETER CLASSES
# ============================================

@dataclass
class NumericParameter:
    """Numeric parameter with validation"""
    name: str
    label: str
    unit: str
    default: float
    min_val: float
    max_val: float
    description: str
    category: str
    step: float = 0.1
    
    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        return {
            'type': 'number',
            'name': self.name,
            'label': self.label,
            'unit': self.unit,
            'default': self.default,
            'min': self.min_val,
            'max': self.max_val,
            'step': self.step,
            'description': self.description,
            'category': self.category
        }


@dataclass
class EnumParameter:
    """Enum/dropdown parameter"""
    name: str
    label: str
    enum_class: type
    default: Enum
    description: str
    category: str
    
    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        return {
            'type': 'enum',
            'name': self.name,
            'label': self.label,
            'options': [{'value': e.name, 'label': e.value} for e in self.enum_class],
            'default': self.default.name,
            'description': self.description,
            'category': self.category
        }


@dataclass
class BooleanParameter:
    """Boolean/checkbox parameter"""
    name: str
    label: str
    default: bool
    description: str
    category: str
    
    def to_dict(self) -> dict:
        return {
            'type': 'boolean',
            'name': self.name,
            'label': self.label,
            'default': self.default,
            'description': self.description,
            'category': self.category
        }


# ============================================
# PARAMETER DEFINITIONS - YOUR FOCUS AREA
# ============================================

VIOLIN_PARAMETERS = {
    # Instrument Type
    'instrument_type': EnumParameter(
        name='instrument_type',
        label='Instrument Type',
        enum_class=InstrumentType,
        default=InstrumentType.VIOLIN,
        description='Type of instrument (affects default proportions)',
        category='General'
    ),
    
    # Basic Dimensions
    'total_length': NumericParameter(
        name='total_length',
        label='Total Length',
        unit='mm',
        default=130.0,
        min_val=120.0,
        max_val=180.0,
        description='Total length from nut to heel button',
        category='Basic Dimensions',
        step=0.5
    ),
    
    'neck_length': NumericParameter(
        name='neck_length',
        label='Neck Length (String)',
        unit='mm',
        default=130.0,
        min_val=120.0,
        max_val=140.0,
        description='String length from nut to where neck meets body',
        category='Basic Dimensions',
        step=0.5
    ),
    
    'width_at_nut': NumericParameter(
        name='width_at_nut',
        label='Width at Nut',
        unit='mm',
        default=24.0,
        min_val=22.0,
        max_val=28.0,
        description='Width of fingerboard at the nut',
        category='Basic Dimensions',
        step=0.1
    ),
    
    'width_at_heel': NumericParameter(
        name='width_at_heel',
        label='Width at Heel',
        unit='mm',
        default=27.0,
        min_val=24.0,
        max_val=32.0,
        description='Width of neck at the heel joint',
        category='Basic Dimensions',
        step=0.1
    ),
    
    'thickness_at_nut': NumericParameter(
        name='thickness_at_nut',
        label='Thickness at Nut',
        unit='mm',
        default=19.0,
        min_val=16.0,
        max_val=23.0,
        description='Neck thickness at the nut (center, back to front)',
        category='Basic Dimensions',
        step=0.1
    ),
    
    'thickness_at_heel': NumericParameter(
        name='thickness_at_heel',
        label='Thickness at Heel',
        unit='mm',
        default=22.0,
        min_val=19.0,
        max_val=26.0,
        description='Neck thickness at the heel (center)',
        category='Basic Dimensions',
        step=0.1
    ),
    
    # Neck Profile
    'profile_type': EnumParameter(
        name='profile_type',
        label='Neck Profile',
        enum_class=NeckProfile,
        default=NeckProfile.C_SHAPE,
        description='Cross-sectional shape of the neck back',
        category='Neck Profile'
    ),
    
    'profile_roundness': NumericParameter(
        name='profile_roundness',
        label='Profile Roundness',
        unit='%',
        default=70.0,
        min_val=40.0,
        max_val=100.0,
        description='Curvature of the back profile (100% = semicircle)',
        category='Neck Profile',
        step=5.0
    ),
    
    'taper_curve': NumericParameter(
        name='taper_curve',
        label='Taper Curve',
        unit='',
        default=1.0,
        min_val=0.5,
        max_val=2.0,
        description='1.0 = linear, <1.0 = concave, >1.0 = convex taper',
        category='Neck Profile',
        step=0.1
    ),
    
    # Scroll Parameters
    'scroll_diameter': NumericParameter(
        name='scroll_diameter',
        label='Scroll Outer Diameter',
        unit='mm',
        default=58.0,
        min_val=50.0,
        max_val=70.0,
        description='Outer diameter of the scroll volute',
        category='Scroll',
        step=0.5
    ),
    
    'scroll_turns': NumericParameter(
        name='scroll_turns',
        label='Scroll Turns',
        unit='turns',
        default=2.5,
        min_val=2.0,
        max_val=3.5,
        description='Number of complete spiral turns',
        category='Scroll',
        step=0.25
    ),
    
    'scroll_eye_diameter': NumericParameter(
        name='scroll_eye_diameter',
        label='Scroll Eye Diameter',
        unit='mm',
        default=8.0,
        min_val=6.0,
        max_val=12.0,
        description='Diameter of the center eye of the scroll',
        category='Scroll',
        step=0.5
    ),
    
    # Pegbox
    'pegbox_length': NumericParameter(
        name='pegbox_length',
        label='Pegbox Length',
        unit='mm',
        default=70.0,
        min_val=60.0,
        max_val=85.0,
        description='Length of the pegbox',
        category='Pegbox',
        step=0.5
    ),
    
    'pegbox_width': NumericParameter(
        name='pegbox_width',
        label='Pegbox Width',
        unit='mm',
        default=22.0,
        min_val=18.0,
        max_val=28.0,
        description='Width of pegbox interior',
        category='Pegbox',
        step=0.5
    ),
    
    'string_count': EnumParameter(
        name='string_count',
        label='Number of Strings',
        enum_class=StringCount,
        default=StringCount.FOUR,
        description='Number of strings (affects peg placement)',
        category='Pegbox'
    ),
    
    # Fingerboard
    'fingerboard_overhang': NumericParameter(
        name='fingerboard_overhang',
        label='Fingerboard Overhang',
        unit='mm',
        default=5.5,
        min_val=4.0,
        max_val=8.0,
        description='How far fingerboard projects past neck edges',
        category='Fingerboard',
        step=0.1
    ),
    
    'fingerboard_scoop': NumericParameter(
        name='fingerboard_scoop',
        label='Fingerboard Scoop',
        unit='mm',
        default=0.5,
        min_val=0.0,
        max_val=2.0,
        description='Concave relief in fingerboard (longitudinal)',
        category='Fingerboard',
        step=0.1
    ),
    
    # Advanced Options
    'show_centerline': BooleanParameter(
        name='show_centerline',
        label='Show Centerline',
        default=True,
        description='Display construction centerline',
        category='Display Options'
    ),
    
    'show_measurements': BooleanParameter(
        name='show_measurements',
        label='Show Measurements',
        default=True,
        description='Display dimension annotations',
        category='Display Options'
    ),
    
    'show_reference_points': BooleanParameter(
        name='show_reference_points',
        label='Show Reference Points',
        default=True,
        description='Show nut, heel, and key reference points',
        category='Display Options'
    ),
}


# ============================================
# VALIDATION RULES - YOUR EXPERT KNOWLEDGE
# ============================================

def validate_parameters(params: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validates parameter values using lutherie expertise.
    
    Add your domain-specific rules here. These will be checked
    before geometry generation.
    
    Args:
        params: Dictionary of parameter name -> value
        
    Returns:
        (is_valid, list_of_error_messages)
    """
    errors = []
    
    # Extract values with defaults
    width_nut = params.get('width_at_nut', 24.0)
    width_heel = params.get('width_at_heel', 27.0)
    thick_nut = params.get('thickness_at_nut', 19.0)
    thick_heel = params.get('thickness_at_heel', 22.0)
    profile_roundness = params.get('profile_roundness', 70.0)
    scroll_diameter = params.get('scroll_diameter', 58.0)
    fingerboard_overhang = params.get('fingerboard_overhang', 5.5)
    
    # Rule 1: Width must increase from nut to heel
    if width_heel <= width_nut:
        errors.append(
            f"Width at heel ({width_heel}mm) must be greater than "
            f"width at nut ({width_nut}mm)"
        )
    
    # Rule 2: Width taper should be reasonable (traditional proportions)
    width_diff = width_heel - width_nut
    if width_diff < 1.5:
        errors.append(
            f"Width taper ({width_diff:.1f}mm) is too small. "
            "Traditional necks taper at least 2-3mm"
        )
    if width_diff > 6.0:
        errors.append(
            f"Width taper ({width_diff:.1f}mm) is too large. "
            "Typical range is 2-5mm"
        )
    
    # Rule 3: Thickness must increase from nut to heel
    if thick_heel <= thick_nut:
        errors.append(
            f"Thickness at heel ({thick_heel}mm) must be greater than "
            f"thickness at nut ({thick_nut}mm)"
        )
    
    # Rule 4: High roundness requires adequate thickness
    if profile_roundness > 80 and thick_nut < 18:
        errors.append(
            f"Profile roundness {profile_roundness}% requires minimum "
            f"18mm thickness at nut (currently {thick_nut}mm)"
        )
    
    # Rule 5: Scroll diameter proportional to neck width
    min_scroll = width_heel * 1.9
    max_scroll = width_heel * 2.5
    if scroll_diameter < min_scroll:
        errors.append(
            f"Scroll diameter ({scroll_diameter}mm) too small for "
            f"neck width ({width_heel}mm). Minimum: {min_scroll:.1f}mm"
        )
    if scroll_diameter > max_scroll:
        errors.append(
            f"Scroll diameter ({scroll_diameter}mm) too large for "
            f"neck width ({width_heel}mm). Maximum: {max_scroll:.1f}mm"
        )
    
    # Rule 6: Fingerboard overhang validation
    if fingerboard_overhang > width_nut * 0.25:
        errors.append(
            f"Fingerboard overhang ({fingerboard_overhang}mm) should not "
            f"exceed 25% of nut width ({width_nut * 0.25:.1f}mm)"
        )
    
    # Rule 7: Aspect ratio check (prevent awkward proportions)
    aspect_ratio = thick_nut / width_nut
    if aspect_ratio < 0.65:
        errors.append(
            f"Neck is too flat (thickness/width = {aspect_ratio:.2f}). "
            "Should be at least 0.70 for comfortable playing"
        )
    if aspect_ratio > 0.95:
        errors.append(
            f"Neck is too thick (thickness/width = {aspect_ratio:.2f}). "
            "Should be at most 0.90 for normal hands"
        )
    
    return len(errors) == 0, errors


def get_parameter_categories() -> List[str]:
    """
    Returns ordered list of categories for UI grouping.
    Controls the order categories appear in the interface.
    """
    return [
        'General',
        'Basic Dimensions',
        'Neck Profile',
        'Scroll',
        'Pegbox',
        'Fingerboard',
        'Display Options'
    ]


def get_parameters_as_json() -> str:
    """
    Export all parameters as JSON for web UI.
    Called by JavaScript to auto-generate forms.
    """
    params_dict = {}
    
    for name, param in VIOLIN_PARAMETERS.items():
        params_dict[name] = param.to_dict()
    
    return json.dumps({
        'parameters': params_dict,
        'categories': get_parameter_categories()
    })


def get_default_values() -> Dict[str, Any]:
    """Returns dictionary of all default parameter values"""
    defaults = {}
    
    for name, param in VIOLIN_PARAMETERS.items():
        if isinstance(param, EnumParameter):
            defaults[name] = param.default.name
        else:
            defaults[name] = param.default
            
    return defaults


# ============================================
# PRESETS (Optional - for quick testing)
# ============================================

PRESETS = {
    'stradivari_violin': {
        'instrument_type': 'VIOLIN',
        'total_length': 130.0,
        'width_at_nut': 24.0,
        'width_at_heel': 27.0,
        'thickness_at_nut': 19.5,
        'thickness_at_heel': 21.5,
        'profile_type': 'C_SHAPE',
        'scroll_diameter': 58.0,
    },
    
    'modern_viola': {
        'instrument_type': 'VIOLA',
        'total_length': 145.0,
        'width_at_nut': 26.0,
        'width_at_heel': 29.0,
        'thickness_at_nut': 21.0,
        'thickness_at_heel': 24.0,
        'profile_type': 'C_SHAPE',
        'scroll_diameter': 62.0,
    },
    
    'baroque_violin': {
        'instrument_type': 'VIOLIN',
        'total_length': 128.0,
        'width_at_nut': 23.5,
        'width_at_heel': 26.5,
        'thickness_at_nut': 18.0,
        'thickness_at_heel': 20.5,
        'profile_type': 'V_SHAPE',
        'scroll_diameter': 56.0,
        'scroll_turns': 2.75,
    }
}


if __name__ == '__main__':
    # Test parameter export
    print(get_parameters_as_json())
    
    # Test validation
    test_params = get_default_values()
    is_valid, errors = validate_parameters(test_params)
    print(f"\nValidation: {'✓ PASS' if is_valid else '✗ FAIL'}")
    if errors:
        for error in errors:
            print(f"  - {error}")
