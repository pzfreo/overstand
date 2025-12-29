"""
Violin Neck Parameter Definitions

This is YOUR main configuration file. Add parameters here and they 
automatically appear in the UI. Focus on encoding your lutherie expertise.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
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

class InstrumentFamily(Enum):
    """Instrument family - determines calculation approach"""
    VIOLIN = "Violin Family (Body Stop Driven)"
    VIOL = "Viol Family (Body Stop Driven)"
    GUITAR_MANDOLIN = "Guitar/Mandolin Family (Fret Join Driven)"


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
    visible_when: Optional[Dict[str, Any]] = None  # Condition for visibility
    is_output: Optional[Dict[str, bool]] = None    # When this is calculated vs input

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        result = {
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

        # Add conditional metadata if present
        if self.visible_when:
            result['visible_when'] = self.visible_when
        if self.is_output:
            result['is_output'] = self.is_output

        return result


@dataclass
class EnumParameter:
    """Enum/dropdown parameter"""
    name: str
    label: str
    enum_class: type
    default: Enum
    description: str
    category: str
    visible_when: Optional[Dict[str, Any]] = None  # Condition for visibility
    is_output: Optional[Dict[str, bool]] = None    # When this is calculated vs input

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        result = {
            'type': 'enum',
            'name': self.name,
            'label': self.label,
            'options': [{'value': e.name, 'label': e.value} for e in self.enum_class],
            'default': self.default.name,
            'description': self.description,
            'category': self.category
        }

        # Add conditional metadata if present
        if self.visible_when:
            result['visible_when'] = self.visible_when
        if self.is_output:
            result['is_output'] = self.is_output

        return result


@dataclass
class BooleanParameter:
    """Boolean/checkbox parameter"""
    name: str
    label: str
    default: bool
    description: str
    category: str
    visible_when: Optional[Dict[str, Any]] = None  # Condition for visibility
    is_output: Optional[Dict[str, bool]] = None    # When this is calculated vs input

    def to_dict(self) -> dict:
        result = {
            'type': 'boolean',
            'name': self.name,
            'label': self.label,
            'default': self.default,
            'description': self.description,
            'category': self.category
        }

        # Add conditional metadata if present
        if self.visible_when:
            result['visible_when'] = self.visible_when
        if self.is_output:
            result['is_output'] = self.is_output

        return result


@dataclass
class StringParameter:
    """Text/string parameter"""
    name: str
    label: str
    default: str
    description: str
    category: str
    max_length: int = 100
    visible_when: Optional[Dict[str, Any]] = None  # Condition for visibility
    is_output: Optional[Dict[str, bool]] = None    # When this is calculated vs input

    def to_dict(self) -> dict:
        result = {
            'type': 'string',
            'name': self.name,
            'label': self.label,
            'default': self.default,
            'description': self.description,
            'category': self.category,
            'max_length': self.max_length
        }

        # Add conditional metadata if present
        if self.visible_when:
            result['visible_when'] = self.visible_when
        if self.is_output:
            result['is_output'] = self.is_output

        return result


# ============================================
# PARAMETER DEFINITIONS - YOUR FOCUS AREA
# ============================================

INSTRUMENT_PARAMETERS = {
    # Instrument Family (first question)
    'instrument_family': EnumParameter(
        name='instrument_family',
        label='Instrument Family',
        enum_class=InstrumentFamily,
        default=InstrumentFamily.VIOLIN,
        description='Select instrument family - determines calculation approach for neck/body dimensions',
        category='General'
    ),

    # Instrument Name
    'instrument_name': StringParameter(
        name='instrument_name',
        label='Instrument Name',
        default='My Instrument',
        description='Name/label for this instrument (used in filenames)',
        category='General',
        max_length=50
    ),



    # Basic Dimensions
    'vsl': NumericParameter(
        name='vsl',
        label='Vibrating String Length',
        unit='mm',
        default=325.0,
        min_val=10.0,
        max_val=1000.0,
        description='Total length from nut to bridge along string path',
        category='Basic Dimensions',
        step=0.5
    ),

    'fret_join': NumericParameter(
        name='fret_join',
        label='Fret at Body Join',
        unit='fret #',
        default=12,
        min_val=1,
        max_val=24,
        step=1,
        description='Which fret is located at the neck/body junction',
        category='Basic Dimensions',
        visible_when={'instrument_family': 'GUITAR_MANDOLIN'}
    ),

    'no_frets': NumericParameter(
        name='no_frets',
        label='Number of Frets',
        default=7,
        min_val=0,
        max_val=30,
        step=1,
        unit='',
        visible_when={'instrument_family': ['VIOL', 'GUITAR_MANDOLIN']},
        description='Number of frets to calculate positions for',
        category='Construction'
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
        step=0.1,
        is_output={'VIOLIN': False, 'VIOL': False, 'GUITAR_MANDOLIN': True}
    ),

    'neck_stop': NumericParameter(
        name='neck_stop',
        label='Neck Stop',
        unit='mm',
        default=130.0,
        min_val=10.0,
        max_val=500.0,
        description='Length from nut to where neck meets body',
        category='Basic Dimensions',
        step=0.1,
        visible_when={'instrument_family': ['VIOLIN', 'VIOL']},
        is_output={'VIOLIN': True, 'VIOL': True, 'GUITAR_MANDOLIN': True}
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
        step=1
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
        step=0.5
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
        step=1
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

    # Belly edge thickness
    'belly_edge_thickness': NumericParameter(
        name='belly_edge_thickness',
        label='Belly Edge Thickness',
        unit='mm',
        default=3.5,
        min_val=0.0,
        max_val=10.0,
        description='Thickness of belly (top plate) at the edge',
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

    # Fingerboard radius
    'fingerboard_radius': NumericParameter(
        name='fingerboard_radius',
        label='Fingerboard Radius',
        unit='mm',
        default=41.0,
        min_val=20.0,
        max_val=1000.0,
        description='Radius of fingerboard curvature (larger = flatter). Typical: Violin 41mm, Viol 60-80mm, Guitar 300mm',
        category='Basic Dimensions',
        step=1.0
    ),

    # Fingerboard visible height at nut
    'fb_visible_height_at_nut': NumericParameter(
        name='fb_visible_height_at_nut',
        label='Fingerboard visible height at nut',
        unit='mm',
        default=4.0,
        min_val=0.0,
        max_val=100.0,
        description='Height of the flat visible side of fingerboard at nut',
        category='Basic Dimensions',
        step=0.1
    ),

    # Fingerboard visible height at body join
    'fb_visible_height_at_join': NumericParameter(
        name='fb_visible_height_at_join',
        label='Fingerboard visible height at body join',
        unit='mm',
        default=6.0,
        min_val=0.0,
        max_val=100.0,
        description='Height of the flat visible side of fingerboard at body join',
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

    # String height at end of fingerboard
    'string_height_eof': NumericParameter(
        name='string_height_eof',
        label='String height at end of fb',
        unit='mm',
        default=4.0,
        min_val=0.0,
        max_val=10.0,
        description='String height at the end of the fingerboard',
        category='Basic Dimensions',
        step=0.1,
        visible_when={'instrument_family': ['VIOLIN', 'VIOL']}
    ),


    # String height at 12th fret
    'string_height_12th_fret': NumericParameter(
        name='string_height_12th_fret',
        label='String height at 12th fret',
        unit='mm',
        default=4.0,
        min_val=0.0,
        max_val=10.0,
        description='String height at the 12th fret',
        category='Basic Dimensions',
        step=0.1,
        visible_when={'instrument_family': 'GUITAR_MANDOLIN'}
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
        elif isinstance(param, StringParameter):
            defaults[name] = param.default
        else:
            defaults[name] = param.default

    return defaults


# ============================================
# PRESETS
# ============================================
# Presets are now loaded from JSON files in the presets/ directory.
# See instrument_generator.py::get_presets() for implementation.


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
