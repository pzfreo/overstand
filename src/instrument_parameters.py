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


class StringCount(Enum):
    """Number of strings"""
    FOUR = "4 (Violin/Viola/Cello)"
    FIVE = "5 (Five-string Violin/Viola/Cello)"
    SIX = "6 (6 String Viol)"
    SEVEN = "7 (7 String Viol)"

class InstrumentType(Enum):
    """Type of bowed instrument"""
    VIOLIN = "Violin"
    VIOLA = "Viola"
    CELLO = "Cello"
    PARDESSUS = "Pardessus"
    TREBLE = "Treble Viol"
    TENOR = "Tenor Viol"
    BASS = "Bass Viol"
    OTHER = "Other"


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

INSTRUMENT_PARAMETERS = {
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
    'vsl': NumericParameter(
        name='vsl',
        label='Vibrating String Length',
        unit='mm',
        default=130.0,
        min_val=120.0,
        max_val=180.0,
        description='Total length from nut to bridge along string path',
        category='Basic Dimensions',
        step=0.5
    ),
    
    'body_stop': NumericParameter(
        name='body_stop',
        label='Body Stop',
        unit='mm',
        default=195.0,
        min_val=10.0,
        max_val=500.0,
        description='Length from where neck meets body to bridge',
        category='Basic Dimensions',
        step=0.1
    ),


    'neck_stop': NumericParameter(
        name='body_stop',
        label='Body Stop',
        unit='mm',
        default=130.0,
        min_val=10.0,
        max_val=500.0,
        description='Length from nut to where neck meets body',
        category='Basic Dimensions',
        step=0.1
    ),

    'body_length': NumericParameter(
        name='body_length',
        label='Body Length',
        unit='mm',
        default=355.0,
        min_val=10.0,
        max_val=1000.0,
        description='Length of body from join to saddle',
        category='Basic Dimensions',
        step=0.1
    ),

    'rib_height': NumericParameter(
        name='rib_height',
        label='Rib Height',
        unit='mm',
        default=30.0,
        min_val=10.0,
        max_val=500.0,
        description='Rib Height assumed constant (doesn\'t affect calculation)',
        category='Basic Dimensions',
        step=0.1
    ),

    'fingerboard_length': NumericParameter(
        name='fingerboard_length',
        label='Fingerboard Length',
        unit='mm',
        default=270.0,
        min_val=20.0,
        max_val=1000.0,
        description='Length of fingerboard from nut',
        category='Basic Dimensions',
        step=0.1
    ),
    
    # 'neck_thickness_at_first': NumericParameter(
    #     name='neck_thickness_at_first',
    #     label='Neck Thickness at First Fret',
    #     unit='mm',
    #     default=19.0,
    #     min_val=16.0,
    #     max_val=23.0,
    #     description='Neck thickness at the top of the fingerboard where the first fret would be on a viol',
    #     category='Basic Dimensions',
    #     step=0.1
    # ),
    
    # 'neck_thickness_at_seventh': NumericParameter(
    #     name='neck_thickness_at_seventh',
    #     label='Neck Thickness at Seventh',
    #     unit='mm',
    #     default=22.0,
    #     min_val=19.0,
    #     max_val=26.0,
    #     description='Neck thickness at the heel of the neck where the seventh fret would be on a viol',
    #     category='Basic Dimensions',
    #     step=0.1
    # ),
    

    # Arching height
    'arching_height': NumericParameter(
        name='arching_height',
        label='Arching Height',
        unit='mm',
        default=15.0,
        min_val=0.0,
        max_val=100.0,
        description='Height of arching from top of ribs to bridge location',
        category='Basic Dimensions',
        step=0.1
    ),

    # Bridge Height
    'bridge_height': NumericParameter(
        name='bridge_height',
        label='Bridge Height',
        unit='mm',
        default=33.0,
        min_val=0.0,
        max_val=100.0,
        description='Height of bridge above arching',
        category='Basic Dimensions',
        step=0.1
    ),

    # overstand Inc top thickness.
    'overstand': NumericParameter(
        name='overstand',
        label='Overstand',
        unit='mm',
        default=12.0,
        min_val=0.0,
        max_val=100.0,
        description='Height of fingerboard above ribs at neck join',
        category='Basic Dimensions',
        step=0.1
    ),

    # fb thickness at nut
    'fb_thickness_nut': NumericParameter(
        name='fb_thickness_nut',
        label='Fingerboard thickness at nut',
        unit='mm',
        default=5.0,
        min_val=0.0,
        max_val=100.0,
        description='Max thickness of the fingerboard just next to the nut',
        category='Basic Dimensions',
        step=0.1
    ),

    # fb thickness at body join
    'fb_thickness_join': NumericParameter(
        name='fb_thickness_join',
        label='Fingerboard thickness at body join',
        unit='mm',
        default=7.0,
        min_val=0.0,
        max_val=100.0,
        description='Max thickness of the fingerboard at the body join',
        category='Basic Dimensions',
        step=0.1
    ),

    # String height at nut
    'string_height_nut': NumericParameter(
        name='string_height_nut',
        label='String height at nut',
        unit='mm',
        default=0.6,
        min_val=0.0,
        max_val=10.0,
        description='String height at nut',
        category='Basic Dimensions',
        step=0.1
    ),

    # String height at nut
    'string_height_eof': NumericParameter(
        name='string_height_eof',
        label='String height at end of fb',
        unit='mm',
        default=0.6,
        min_val=0.0,
        max_val=10.0,
        description='String height at the end of the fingerboard',
        category='Basic Dimensions',
        step=0.1
    ),

    'fingerboard_width_at_nut': NumericParameter(
        name='fingerboard_width_at_nut',
        label='Width at Nut',
        unit='mm',
        default=24.0,
        min_val=10.0,
        max_val=100.0,
        description='Width of fingerboard at the nut',
        category='Fingerboard Dimensions',
        step=0.1
    ),
    
    'fingerboard_width_at_end': NumericParameter(
        name='fingerboard_width_at_end',
        label='Fingerboard width at end',
        unit='mm',
        default=30.0,
        min_val=10.0,
        max_val=100.0,
        description='Fingerboard width at bridge end of fingerboard',
        category='Fingerboard Dimensions',
        step=0.1
    ),

    # 'string_count': EnumParameter(
    #     name='string_count',
    #     label='Number of Strings',
    #     enum_class=StringCount,
    #     default=StringCount.FOUR,
    #     description='Number of strings',
    #     category='Nut'
    # ),
    
    # Fingerboard
    
    # Advanced Options
    
    'show_measurements': BooleanParameter(
        name='show_measurements',
        label='Show Measurements',
        default=True,
        description='Display dimension annotations',
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
    
    # Rule 1: Width must increase from nut to heel
    # if width_heel <= width_nut:
    #     errors.append(
    #         f"Width at heel ({width_heel}mm) must be greater than "
    #         f"width at nut ({width_nut}mm)"
    #     )
    
    # Rule 2: Width taper should be reasonable (traditional proportions)
    # width_diff = width_heel - width_nut
    # if width_diff < 1.5:
    #     errors.append(
    #         f"Width taper ({width_diff:.1f}mm) is too small. "
    #         "Traditional necks taper at least 2-3mm"
    #     )
    # if width_diff > 6.0:
    #     errors.append(
    #         f"Width taper ({width_diff:.1f}mm) is too large. "
    #         "Typical range is 2-5mm"
    #     )
    
    # Rule 3: Thickness must increase from nut to heel
    # if thick_heel <= thick_nut:
    #     errors.append(
    #         f"Thickness at heel ({thick_heel}mm) must be greater than "
    #         f"thickness at nut ({thick_nut}mm)"
    #     )
    
    # Rule 7: Aspect ratio check (prevent awkward proportions)
    # aspect_ratio = thick_nut / width_nut
    # if aspect_ratio < 0.65:
    #     errors.append(
    #         f"Neck is too flat (thickness/width = {aspect_ratio:.2f}). "
    #         "Should be at least 0.70 for comfortable playing"
    #     )
    # if aspect_ratio > 0.95:
    #     errors.append(
    #         f"Neck is too thick (thickness/width = {aspect_ratio:.2f}). "
    #         "Should be at most 0.90 for normal hands"
    #     )
    
    return len(errors) == 0, errors


def get_parameter_categories() -> List[str]:
    """
    Returns ordered list of categories for UI grouping.
    Controls the order categories appear in the interface.
    """
    return [
        'General',
        'Basic Dimensions',
        'Fingerboard Dimensions',
        'Display Options'
    ]


def get_parameters_as_json() -> str:
    """
    Export all parameters as JSON for web UI.
    Called by JavaScript to auto-generate forms.
    """
    params_dict = {}
    
    for name, param in INSTRUMENT_PARAMETERS.items():
        params_dict[name] = param.to_dict()
    
    return json.dumps({
        'parameters': params_dict,
        'categories': get_parameter_categories()
    })


def get_default_values() -> Dict[str, Any]:
    """Returns dictionary of all default parameter values"""
    defaults = {}
    
    for name, param in INSTRUMENT_PARAMETERS.items():
        if isinstance(param, EnumParameter):
            defaults[name] = param.default.name
        else:
            defaults[name] = param.default
            
    return defaults


# ============================================
# PRESETS (Optional - for quick testing)
# ============================================

PRESETS = {
    'basic_violin': {
        'instrument_type': 'VIOLIN',
        'vsl': 328.5,
        'fingerboard_width_at_nut': 24.0,
        'fingerboard_width_at_end': 27.0,
        'neck_thickness_at_first': 19.5,
        'neck_thickness_at_seventh': 21.5,
        'body_stop': 195.0,
        'neck_stop': 130.0
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
