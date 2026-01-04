"""
Unified Parameter Registry - Single Source of Truth for All Parameters

This module defines all parameters (input and output) in one centralized location,
eliminating duplication between instrument_parameters.py and derived_value_metadata.py.

Each parameter is defined once with all its metadata, and can serve as:
- INPUT_ONLY: Always a user input
- OUTPUT_ONLY: Always a calculated output
- CONDITIONAL: Input or output depending on instrument family

Key benefits:
- Consistent naming (lowercase_snake_case everywhere)
- No duplication of metadata (unit, description, etc.)
- Type-safe parameter references
- Runtime validation of configuration

Author: Claude Code
Date: 2026-01-02
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from enum import Enum


class ParameterRole(Enum):
    """Defines how a parameter is used in the system"""
    INPUT_ONLY = "input_only"       # Always a user input (e.g., vsl, body_length)
    OUTPUT_ONLY = "output_only"     # Always calculated (e.g., neck_angle)
    CONDITIONAL = "conditional"      # Input OR output depending on instrument family


class ParameterType(Enum):
    """Data type of the parameter"""
    NUMERIC = "numeric"     # Float/int values with min/max
    ENUM = "enum"          # Dropdown selection from predefined options
    BOOLEAN = "boolean"    # True/False checkbox
    STRING = "string"      # Text input


# ============================================
# INSTRUMENT ENUMS (moved from instrument_parameters.py)
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


@dataclass
class InputConfig:
    """
    Configuration for when a parameter is used as an input.

    Defines validation rules, defaults, and conditional visibility.
    """
    min_val: float
    max_val: float
    default: Any
    step: float = 0.1
    visible_when: Optional[Dict[str, Any]] = None  # Conditional visibility
    category: str = "Basic Dimensions"


@dataclass
class OutputConfig:
    """
    Configuration for when a parameter is used as an output.

    Defines display formatting and organization.
    """
    decimals: int = 1
    visible: bool = True
    category: str = "Geometry"
    order: int = 0


@dataclass
class UnifiedParameter:
    """
    Unified parameter definition combining input and output metadata.

    This is the single source of truth for all parameters in the system.
    Each parameter is defined once with all its characteristics.

    Example - Input Only:
        UnifiedParameter(
            key='vsl',
            display_name='Vibrating String Length',
            param_type=ParameterType.NUMERIC,
            unit='mm',
            description='Total length from nut to bridge',
            role=ParameterRole.INPUT_ONLY,
            input_config=InputConfig(min_val=10.0, max_val=1000.0, default=325.0)
        )

    Example - Conditional (Input for VIOLIN, Output for GUITAR_MANDOLIN):
        UnifiedParameter(
            key='body_stop',
            display_name='Body Stop',
            param_type=ParameterType.NUMERIC,
            unit='mm',
            description='Length from neck/body join to bridge',
            role=ParameterRole.CONDITIONAL,
            is_output_for={'VIOLIN': False, 'VIOL': False, 'GUITAR_MANDOLIN': True},
            input_config=InputConfig(...),  # For when it's an input
            output_config=OutputConfig(...) # For when it's an output
        )
    """
    # Identity
    key: str                              # Canonical key (lowercase_snake_case)
    display_name: str                     # Human-readable name for UI

    # Type and basic metadata
    param_type: ParameterType
    unit: str                             # Unit string (e.g., 'mm', '°', '')
    description: str                      # Help text / tooltip
    help_text: Optional[str] = None       # Extended help (optional)

    # Role and behavior
    role: ParameterRole = ParameterRole.INPUT_ONLY
    is_output_for: Optional[Dict[str, bool]] = None  # {'VIOLIN': True, 'GUITAR': False}

    # Type-specific configuration
    input_config: Optional[InputConfig] = None
    output_config: Optional[OutputConfig] = None
    enum_class: Optional[type] = None      # For ENUM types
    max_length: Optional[int] = None       # For STRING types

    def is_input_in_mode(self, instrument_family: str) -> bool:
        """Check if this parameter is an input in the given instrument family"""
        if self.role == ParameterRole.INPUT_ONLY:
            return True
        if self.role == ParameterRole.OUTPUT_ONLY:
            return False
        # CONDITIONAL
        if self.is_output_for is None:
            return True
        return not self.is_output_for.get(instrument_family, False)

    def is_output_in_mode(self, instrument_family: str) -> bool:
        """Check if this parameter is an output in the given instrument family"""
        if self.role == ParameterRole.OUTPUT_ONLY:
            return True
        if self.role == ParameterRole.INPUT_ONLY:
            return False
        # CONDITIONAL
        if self.is_output_for is None:
            return False
        return self.is_output_for.get(instrument_family, False)

    def is_visible_in_context(self, current_params: Dict[str, Any]) -> bool:
        """Check if parameter should be visible given current parameter values"""
        if not self.input_config or not self.input_config.visible_when:
            return True

        condition = self.input_config.visible_when
        for key, expected in condition.items():
            current_val = current_params.get(key)
            if isinstance(expected, list):
                if current_val not in expected:
                    return False
            else:
                if current_val != expected:
                    return False
        return True

    def to_input_metadata(self) -> dict:
        """
        Generate metadata in instrument_parameters.py format.

        Returns a dict that can be used to create NumericParameter, EnumParameter, etc.
        """
        if not self.input_config:
            raise ValueError(f"Parameter {self.key} has no input configuration")

        result = {
            'type': self.param_type.value,
            'name': self.key,
            'label': self.display_name,
            'description': self.description,
            'category': self.input_config.category,
        }

        if self.param_type == ParameterType.NUMERIC:
            result.update({
                'unit': self.unit,
                'default': self.input_config.default,
                'min_val': self.input_config.min_val,
                'max_val': self.input_config.max_val,
                'step': self.input_config.step,
            })
        elif self.param_type == ParameterType.ENUM:
            if not self.enum_class:
                raise ValueError(f"ENUM parameter {self.key} must have enum_class")
            result.update({
                'enum_class': self.enum_class,
                'default': self.input_config.default,
            })
        elif self.param_type == ParameterType.BOOLEAN:
            result['default'] = self.input_config.default
        elif self.param_type == ParameterType.STRING:
            result.update({
                'default': self.input_config.default,
                'max_length': self.max_length or 100,
            })

        # Add conditional metadata
        if self.input_config.visible_when:
            result['visible_when'] = self.input_config.visible_when
        if self.is_output_for:
            result['is_output'] = self.is_output_for

        return result

    def to_output_metadata(self) -> dict:
        """
        Generate metadata in derived_value_metadata.py format.

        Returns a dict that can be used to create DerivedValueMetadata.
        """
        if not self.output_config:
            raise ValueError(f"Parameter {self.key} has no output configuration")

        return {
            'key': self.key,
            'display_name': self.display_name,
            'unit': self.unit,
            'decimals': self.output_config.decimals,
            'visible': self.output_config.visible,
            'category': self.output_config.category,
            'description': self.description,
            'order': self.output_config.order
        }

    def to_dict(self) -> dict:
        """
        Convert to JSON-serializable dict for UI consumption.

        Returns output metadata format if output_config exists,
        otherwise returns input metadata format.
        """
        if self.output_config:
            return self.to_output_metadata()
        elif self.input_config:
            return self.to_input_metadata()
        else:
            # Fallback for bare parameters
            return {
                'key': self.key,
                'display_name': self.display_name,
                'unit': self.unit,
                'description': self.description
            }

    def format_value(self, value: float) -> str:
        """Format a value according to output configuration"""
        if not self.output_config:
            return str(value)
        return f"{value:.{self.output_config.decimals}f}"

    def format_with_unit(self, value: float) -> str:
        """Format value with unit"""
        formatted = self.format_value(value)
        if self.unit:
            return f"{formatted} {self.unit}"
        return formatted


# ============================================
# PARAMETER REGISTRY
# ============================================

PARAMETER_REGISTRY: Dict[str, UnifiedParameter] = {
    # ============================================
    # ENUM PARAMETERS (Input Only)
    # ============================================

    'instrument_family': UnifiedParameter(
        key='instrument_family',
        display_name='Instrument Family',
        param_type=ParameterType.ENUM,
        unit='',
        description='Select instrument family - determines calculation approach for neck/body dimensions',
        role=ParameterRole.INPUT_ONLY,
        enum_class=InstrumentFamily,
        input_config=InputConfig(
            min_val=0,
            max_val=0,
            default=InstrumentFamily.VIOLIN,
            category='General'
        )
    ),

    # ============================================
    # CORE DIMENSION PARAMETERS (Input Only)
    # ============================================

    'vsl': UnifiedParameter(
        key='vsl',
        display_name='Vibrating String Length',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Playing length from nut to bridge along string path',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=10.0,
            max_val=1000.0,
            default=325.0,
            step=0.5,
            category='Basic Dimensions'
        )
    ),

    # ============================================
    # CONDITIONAL PARAMETERS (Input for some families, Output for others)
    # ============================================

    'body_stop': UnifiedParameter(
        key='body_stop',
        display_name='Body Stop',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Length from where neck meets body to bridge',
        role=ParameterRole.CONDITIONAL,
        is_output_for={'VIOLIN': False, 'VIOL': False, 'GUITAR_MANDOLIN': True},
        input_config=InputConfig(
            min_val=10.0,
            max_val=500.0,
            default=195.0,
            step=0.1,
            visible_when={'instrument_family': ['VIOLIN', 'VIOL']},
            category='Basic Dimensions'
        ),
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=4
        )
    ),

    'neck_stop': UnifiedParameter(
        key='neck_stop',
        display_name='Neck Stop',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Horizontal distance from body join to nut',
        role=ParameterRole.CONDITIONAL,
        is_output_for={'VIOLIN': True, 'VIOL': True, 'GUITAR_MANDOLIN': True},
        input_config=InputConfig(
            min_val=10.0,
            max_val=500.0,
            default=130.0,
            step=0.1,
            visible_when={'instrument_family': ['VIOLIN', 'VIOL']},
            category='Basic Dimensions'
        ),
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=3
        )
    ),

    # ============================================
    # OUTPUT ONLY PARAMETERS (Always Calculated)
    # ============================================

    'neck_angle': UnifiedParameter(
        key='neck_angle',
        display_name='Neck Angle',
        param_type=ParameterType.NUMERIC,
        unit='°',
        description='Angle of the neck relative to the body (measured from horizontal)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=1
        )
    ),

    'string_angle_to_ribs': UnifiedParameter(
        key='string_angle_to_ribs',
        display_name='String Angle to Ribs',
        param_type=ParameterType.NUMERIC,
        unit='°',
        description='Angle of string relative to rib line',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=5
        )
    ),

    'string_angle_to_fingerboard': UnifiedParameter(
        key='string_angle_to_fingerboard',
        display_name='String Angle to Fingerboard',
        param_type=ParameterType.NUMERIC,
        unit='°',
        description='Angle of string relative to fingerboard surface',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Geometry',
            order=7
        )
    ),

    # ============================================
    # BASIC DIMENSION PARAMETERS (Input Only)
    # ============================================

    'instrument_name': UnifiedParameter(
        key='instrument_name',
        display_name='Instrument Name',
        param_type=ParameterType.STRING,
        unit='',
        description='Name/label for this instrument (used in filenames)',
        role=ParameterRole.INPUT_ONLY,
        max_length=50,
        input_config=InputConfig(
            min_val=0,
            max_val=0,
            default='My Instrument',
            category='General'
        )
    ),

    'fret_join': UnifiedParameter(
        key='fret_join',
        display_name='Fret at Body Join',
        param_type=ParameterType.NUMERIC,
        unit='fret #',
        description='Which fret is located at the neck/body junction',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=1,
            max_val=24,
            default=12,
            step=1,
            visible_when={'instrument_family': 'GUITAR_MANDOLIN'},
            category='Basic Dimensions'
        )
    ),

    'no_frets': UnifiedParameter(
        key='no_frets',
        display_name='Number of Frets',
        param_type=ParameterType.NUMERIC,
        unit='',
        description='Number of frets to calculate positions for',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0,
            max_val=30,
            default=7,
            step=1,
            visible_when={'instrument_family': ['VIOL', 'GUITAR_MANDOLIN']},
            category='Construction'
        )
    ),

    'body_length': UnifiedParameter(
        key='body_length',
        display_name='Body Length',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Length of body from join to saddle',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=10.0,
            max_val=1000.0,
            default=355.0,
            step=1,
            category='Basic Dimensions'
        )
    ),

    'rib_height': UnifiedParameter(
        key='rib_height',
        display_name='Rib Height',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description="Rib Height assumed constant (doesn't affect calculation)",
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=10.0,
            max_val=500.0,
            default=30.0,
            step=0.5,
            category='Basic Dimensions'
        )
    ),

    'fingerboard_length': UnifiedParameter(
        key='fingerboard_length',
        display_name='Fingerboard Length',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Length of fingerboard from nut',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=20.0,
            max_val=1000.0,
            default=270.0,
            step=1,
            category='Basic Dimensions'
        )
    ),

    'arching_height': UnifiedParameter(
        key='arching_height',
        display_name='Arching Height',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of arching from top of ribs to bridge location',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=100.0,
            default=15.0,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'belly_edge_thickness': UnifiedParameter(
        key='belly_edge_thickness',
        display_name='Belly Edge Thickness',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Thickness of belly (top plate) at the edge',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=10.0,
            default=3.5,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'bridge_height': UnifiedParameter(
        key='bridge_height',
        display_name='Bridge Height',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of bridge above arching',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=100.0,
            default=33.0,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'overstand': UnifiedParameter(
        key='overstand',
        display_name='Overstand',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of fingerboard above ribs at neck join',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=100.0,
            default=12.0,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'fingerboard_radius': UnifiedParameter(
        key='fingerboard_radius',
        display_name='Fingerboard Radius',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Radius of fingerboard curvature (larger = flatter). Typical: Violin 41mm, Viol 60-80mm, Guitar 300mm',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=20.0,
            max_val=1000.0,
            default=41.0,
            step=1.0,
            category='Basic Dimensions'
        )
    ),

    'fb_visible_height_at_nut': UnifiedParameter(
        key='fb_visible_height_at_nut',
        display_name='Fingerboard visible height at nut',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of the flat visible side of fingerboard at nut',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=100.0,
            default=4.0,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'fb_visible_height_at_join': UnifiedParameter(
        key='fb_visible_height_at_join',
        display_name='Fingerboard visible height at body join',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of the flat visible side of fingerboard at body join',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=100.0,
            default=6.0,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'string_height_nut': UnifiedParameter(
        key='string_height_nut',
        display_name='String height at nut',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='String height at nut',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=10.0,
            default=0.6,
            step=0.1,
            category='Basic Dimensions'
        )
    ),

    'string_height_eof': UnifiedParameter(
        key='string_height_eof',
        display_name='String height at end of fb',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='String height at the end of the fingerboard',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=10.0,
            default=4.0,
            step=0.1,
            visible_when={'instrument_family': ['VIOLIN', 'VIOL']},
            category='Basic Dimensions'
        )
    ),

    'string_height_12th_fret': UnifiedParameter(
        key='string_height_12th_fret',
        display_name='String height at 12th fret',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='String height at the 12th fret',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=10.0,
            default=4.0,
            step=0.1,
            visible_when={'instrument_family': 'GUITAR_MANDOLIN'},
            category='Basic Dimensions'
        )
    ),

    'fingerboard_width_at_nut': UnifiedParameter(
        key='fingerboard_width_at_nut',
        display_name='Width at Nut',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Width of fingerboard at the nut',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=10.0,
            max_val=100.0,
            default=24.0,
            step=0.1,
            category='Fingerboard Dimensions'
        )
    ),

    'fingerboard_width_at_end': UnifiedParameter(
        key='fingerboard_width_at_end',
        display_name='Fingerboard width at end',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Fingerboard width at bridge end of fingerboard',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=10.0,
            max_val=100.0,
            default=30.0,
            step=0.1,
            category='Fingerboard Dimensions'
        )
    ),

    'show_measurements': UnifiedParameter(
        key='show_measurements',
        display_name='Show Measurements',
        param_type=ParameterType.BOOLEAN,
        unit='',
        description='Display dimension annotations',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0,
            max_val=0,
            default=True,
            category='Display Options'
        )
    ),

    # ============================================
    # VIOL-SPECIFIC PARAMETERS (Input Only)
    # ============================================

    'break_angle': UnifiedParameter(
        key='break_angle',
        display_name='Break Angle',
        param_type=ParameterType.NUMERIC,
        unit='°',
        description='Angle at which the back breaks (viol back construction)',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=0.0,
            max_val=45.0,
            default=15.0,
            step=0.5,
            visible_when={'instrument_family': 'VIOL'},
            category='Viol Construction'
        )
    ),

    'top_block_height': UnifiedParameter(
        key='top_block_height',
        display_name='Top Block Height',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of the top block where the neck joins the body',
        role=ParameterRole.INPUT_ONLY,
        input_config=InputConfig(
            min_val=10.0,
            max_val=150.0,
            default=40.0,
            step=1.0,
            visible_when={'instrument_family': 'VIOL'},
            category='Viol Construction'
        )
    ),

    # ============================================
    # VIOL-SPECIFIC OUTPUT PARAMETERS
    # ============================================

    'back_break_length': UnifiedParameter(
        key='back_break_length',
        display_name='Back Break Length',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Length of the back from hookbar to break point',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Viol Geometry',
            order=50
        )
    ),

    # ============================================
    # OUTPUT ONLY PARAMETERS (Geometry Results)
    # ============================================

    'string_length': UnifiedParameter(
        key='string_length',
        display_name='String Length',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Playing length from nut to bridge',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=False,
            category='Geometry',
            order=2
        )
    ),

    'nut_relative_to_ribs': UnifiedParameter(
        key='nut_relative_to_ribs',
        display_name='Nut Relative to Ribs',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Vertical distance from rib plane to top of nut',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=5
        )
    ),

    'sagitta_at_nut': UnifiedParameter(
        key='sagitta_at_nut',
        display_name='Sagitta at Nut',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of fingerboard arc at nut due to radius',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=20
        )
    ),

    'sagitta_at_join': UnifiedParameter(
        key='sagitta_at_join',
        display_name='Sagitta at Join',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Height of fingerboard arc at body join due to radius',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=21
        )
    ),

    'fb_thickness_at_nut': UnifiedParameter(
        key='fb_thickness_at_nut',
        display_name='Total FB Thickness at Nut',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Total fingerboard thickness at nut (visible height + sagitta)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=22
        )
    ),

    'fb_thickness_at_join': UnifiedParameter(
        key='fb_thickness_at_join',
        display_name='Total FB Thickness at Join',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Total fingerboard thickness at body join (visible height + sagitta)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=1,
            visible=True,
            category='Geometry',
            order=23
        )
    ),

    # Internal calculation values (visible=False)
    'neck_angle_rad': UnifiedParameter(
        key='neck_angle_rad',
        display_name='Neck Angle (rad)',
        param_type=ParameterType.NUMERIC,
        unit='rad',
        description='Neck angle in radians (for internal calculations)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=4,
            visible=False,
            category='Internal',
            order=100
        )
    ),

    'neck_end_x': UnifiedParameter(
        key='neck_end_x',
        display_name='Neck End X',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate of neck end point (for geometry)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=101
        )
    ),

    'neck_end_y': UnifiedParameter(
        key='neck_end_y',
        display_name='Neck End Y',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate of neck end point (for geometry)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=102
        )
    ),

    'nut_draw_radius': UnifiedParameter(
        key='nut_draw_radius',
        display_name='Nut Draw Radius',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Radius of nut quarter-circle (for drawing)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=103
        )
    ),

    'neck_line_angle': UnifiedParameter(
        key='neck_line_angle',
        display_name='Neck Line Angle',
        param_type=ParameterType.NUMERIC,
        unit='rad',
        description='Angle of neck center line (for geometry)',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=4,
            visible=False,
            category='Internal',
            order=104
        )
    ),

    'nut_top_x': UnifiedParameter(
        key='nut_top_x',
        display_name='Nut Top X',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate of nut top where string contacts',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=105
        )
    ),

    'nut_top_y': UnifiedParameter(
        key='nut_top_y',
        display_name='Nut Top Y',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate of nut top where string contacts',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=106
        )
    ),

    'bridge_top_x': UnifiedParameter(
        key='bridge_top_x',
        display_name='Bridge Top X',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate of bridge top where string contacts',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=107
        )
    ),

    'bridge_top_y': UnifiedParameter(
        key='bridge_top_y',
        display_name='Bridge Top Y',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate of bridge top where string contacts',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=108
        )
    ),

    'fb_bottom_end_x': UnifiedParameter(
        key='fb_bottom_end_x',
        display_name='Fingerboard Bottom End X',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate of fingerboard bottom at end',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=109
        )
    ),

    'fb_bottom_end_y': UnifiedParameter(
        key='fb_bottom_end_y',
        display_name='Fingerboard Bottom End Y',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate of fingerboard bottom at end',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=110
        )
    ),

    'fb_direction_angle': UnifiedParameter(
        key='fb_direction_angle',
        display_name='Fingerboard Direction Angle',
        param_type=ParameterType.NUMERIC,
        unit='rad',
        description='Angle of fingerboard direction',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=4,
            visible=False,
            category='Internal',
            order=111
        )
    ),

    'fb_thickness_at_end': UnifiedParameter(
        key='fb_thickness_at_end',
        display_name='Fingerboard Thickness at End',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Fingerboard thickness at end',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=112
        )
    ),

    'fb_surface_point_x': UnifiedParameter(
        key='fb_surface_point_x',
        display_name='Fingerboard Surface Point X',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate of fingerboard surface reference point',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=113
        )
    ),

    'fb_surface_point_y': UnifiedParameter(
        key='fb_surface_point_y',
        display_name='Fingerboard Surface Point Y',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate of fingerboard surface reference point',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=114
        )
    ),

    'string_x_at_fb_end': UnifiedParameter(
        key='string_x_at_fb_end',
        display_name='String X at Fingerboard End',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate of string at fingerboard end',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=115
        )
    ),

    'string_y_at_fb_end': UnifiedParameter(
        key='string_y_at_fb_end',
        display_name='String Y at Fingerboard End',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate of string at fingerboard end',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=116
        )
    ),

    'string_height_at_fb_end': UnifiedParameter(
        key='string_height_at_fb_end',
        display_name='String Height at Fingerboard End',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='String height at end of fingerboard',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=117
        )
    ),

    'nut_perpendicular_intersection_x': UnifiedParameter(
        key='nut_perpendicular_intersection_x',
        display_name='Nut Perpendicular Intersection X',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='X coordinate where nut perpendicular intersects rib plane',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=118
        )
    ),

    'nut_perpendicular_intersection_y': UnifiedParameter(
        key='nut_perpendicular_intersection_y',
        display_name='Nut Perpendicular Intersection Y',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Y coordinate where nut perpendicular intersects rib plane',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=119
        )
    ),

    'nut_to_perpendicular_distance': UnifiedParameter(
        key='nut_to_perpendicular_distance',
        display_name='Nut to Perpendicular Distance',
        param_type=ParameterType.NUMERIC,
        unit='mm',
        description='Distance from nut to perpendicular intersection',
        role=ParameterRole.OUTPUT_ONLY,
        output_config=OutputConfig(
            decimals=2,
            visible=False,
            category='Internal',
            order=120
        )
    ),
}


# ============================================
# VALIDATION
# ============================================

def validate_registry():
    """
    Validate the parameter registry for consistency.

    Checks:
    - No duplicate keys
    - CONDITIONAL parameters have both input_config and output_config
    - INPUT_ONLY parameters have input_config
    - OUTPUT_ONLY parameters have output_config
    - All keys are lowercase_snake_case (no spaces, no capitals)

    Raises ValueError if validation fails.
    """
    errors = []

    # Check for duplicates (shouldn't happen with dict, but good to verify)
    keys = set()
    for key in PARAMETER_REGISTRY:
        if key in keys:
            errors.append(f"Duplicate key: {key}")
        keys.add(key)

    # Check that parameters have proper configuration based on role
    for key, param in PARAMETER_REGISTRY.items():
        if param.role == ParameterRole.CONDITIONAL:
            if not param.input_config:
                errors.append(f"{key}: CONDITIONAL parameter must have input_config")
            if not param.output_config:
                errors.append(f"{key}: CONDITIONAL parameter must have output_config")
            if not param.is_output_for:
                errors.append(f"{key}: CONDITIONAL parameter must have is_output_for dict")

        if param.role == ParameterRole.INPUT_ONLY and not param.input_config:
            errors.append(f"{key}: INPUT_ONLY parameter must have input_config")

        if param.role == ParameterRole.OUTPUT_ONLY and not param.output_config:
            errors.append(f"{key}: OUTPUT_ONLY parameter must have output_config")

        # Check snake_case naming
        if key != key.lower() or ' ' in key:
            errors.append(f"{key}: Key must be lowercase_snake_case (no spaces, no capitals)")

        # Check that ENUM types have enum_class
        if param.param_type == ParameterType.ENUM and not param.enum_class:
            errors.append(f"{key}: ENUM parameter must have enum_class")

    if errors:
        raise ValueError("Parameter registry validation failed:\n" + "\n".join(errors))


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_parameter(key: str) -> Optional[UnifiedParameter]:
    """Get a parameter by key"""
    return PARAMETER_REGISTRY.get(key)


def get_all_input_parameters(instrument_family: str = None) -> Dict[str, UnifiedParameter]:
    """
    Get all parameters that are inputs.

    If instrument_family is provided, returns only inputs for that family.
    """
    result = {}
    for key, param in PARAMETER_REGISTRY.items():
        if instrument_family:
            if param.is_input_in_mode(instrument_family):
                result[key] = param
        else:
            # Return all that have input_config
            if param.input_config is not None:
                result[key] = param
    return result


def get_all_output_parameters(instrument_family: str = None) -> Dict[str, UnifiedParameter]:
    """
    Get all parameters that are outputs.

    If instrument_family is provided, returns only outputs for that family.
    """
    result = {}
    for key, param in PARAMETER_REGISTRY.items():
        if instrument_family:
            if param.is_output_in_mode(instrument_family):
                result[key] = param
        else:
            # Return all that have output_config
            if param.output_config is not None:
                result[key] = param
    return result


def get_visible_parameters(current_params: Dict[str, Any], instrument_family: str = None) -> List[str]:
    """
    Get list of parameter keys that should be visible given current context.

    Respects visible_when conditions.
    """
    visible = []
    for key, param in PARAMETER_REGISTRY.items():
        if instrument_family and not param.is_input_in_mode(instrument_family):
            continue
        if param.is_visible_in_context(current_params):
            visible.append(key)
    return visible


# ============================================
# CONVENIENCE FUNCTIONS (moved from instrument_parameters.py)
# ============================================

def get_parameter_categories() -> List[str]:
    """
    Returns ordered list of categories for UI grouping.
    Controls the order categories appear in the interface.
    """
    return [
        'General',
        'Basic Dimensions',
        'Fingerboard Dimensions',
        'Viol Construction',
        'Display Options'
    ]


def get_default_values() -> Dict[str, Any]:
    """Returns dictionary of all default parameter values for input parameters"""
    import json
    defaults = {}

    for key, param in PARAMETER_REGISTRY.items():
        # Skip output-only parameters
        if param.role == ParameterRole.OUTPUT_ONLY:
            continue

        if param.input_config is None:
            continue

        default_val = param.input_config.default

        # Handle enum defaults - convert to name string
        if param.param_type == ParameterType.ENUM and hasattr(default_val, 'name'):
            defaults[key] = default_val.name
        else:
            defaults[key] = default_val

    return defaults


def validate_parameters(params: Dict[str, Any]) -> tuple:
    """
    Validates parameter values using domain-specific rules.

    Add lutherie expertise rules here. These will be checked
    before geometry generation.

    Args:
        params: Dictionary of parameter name -> value

    Returns:
        (is_valid, list_of_error_messages)
    """
    errors = []

    # Basic range validation for numeric parameters
    for key, param in PARAMETER_REGISTRY.items():
        if key not in params:
            continue

        value = params[key]

        if param.param_type == ParameterType.NUMERIC and param.input_config:
            if value < param.input_config.min_val:
                errors.append(f"{param.display_name} must be at least {param.input_config.min_val}")
            if value > param.input_config.max_val:
                errors.append(f"{param.display_name} must be at most {param.input_config.max_val}")

    # Add domain-specific validation rules here
    # Example: string length must be greater than body stop
    # vsl = params.get('vsl', 325.0)
    # body_stop = params.get('body_stop', 195.0)
    # if vsl <= body_stop:
    #     errors.append("Vibrating string length must be greater than body stop")

    return len(errors) == 0, errors


def get_parameters_as_json() -> str:
    """
    Export all input parameters as JSON for web UI.
    Called by JavaScript to auto-generate forms.
    """
    import json
    params_dict = {}

    for key, param in PARAMETER_REGISTRY.items():
        # Skip output-only parameters
        if param.role == ParameterRole.OUTPUT_ONLY:
            continue

        if param.input_config is None:
            continue

        # Build parameter dict for JSON
        if param.param_type == ParameterType.NUMERIC:
            params_dict[key] = {
                'type': 'number',
                'name': key,
                'label': param.display_name,
                'unit': param.unit,
                'default': param.input_config.default,
                'min': param.input_config.min_val,
                'max': param.input_config.max_val,
                'step': param.input_config.step,
                'description': param.description,
                'category': param.input_config.category
            }
        elif param.param_type == ParameterType.ENUM:
            params_dict[key] = {
                'type': 'enum',
                'name': key,
                'label': param.display_name,
                'options': [{'value': e.name, 'label': e.value} for e in param.enum_class],
                'default': param.input_config.default.name if hasattr(param.input_config.default, 'name') else param.input_config.default,
                'description': param.description,
                'category': param.input_config.category
            }
        elif param.param_type == ParameterType.BOOLEAN:
            params_dict[key] = {
                'type': 'boolean',
                'name': key,
                'label': param.display_name,
                'default': param.input_config.default,
                'description': param.description,
                'category': param.input_config.category
            }
        elif param.param_type == ParameterType.STRING:
            params_dict[key] = {
                'type': 'string',
                'name': key,
                'label': param.display_name,
                'default': param.input_config.default,
                'description': param.description,
                'category': param.input_config.category,
                'max_length': param.max_length or 100
            }

        # Add conditional metadata if present
        if param.input_config.visible_when:
            params_dict[key]['visible_when'] = param.input_config.visible_when
        if param.is_output_for:
            params_dict[key]['is_output'] = param.is_output_for

    return json.dumps({
        'parameters': params_dict,
        'categories': get_parameter_categories()
    })


def get_derived_metadata_as_dict() -> dict:
    """
    Get all output parameter metadata as a JSON-serializable dictionary.
    Used by instrument_generator to export metadata to web UI.
    """
    metadata = {}

    for key, param in PARAMETER_REGISTRY.items():
        # Only include parameters that have output config
        if param.output_config is None:
            continue

        metadata[key] = {
            'key': key,
            'display_name': param.display_name,
            'unit': param.unit,
            'decimals': param.output_config.decimals,
            'visible': param.output_config.visible,
            'category': param.output_config.category,
            'description': param.description,
            'order': param.output_config.order
        }

    return metadata


# Run validation when module is imported
# This catches configuration errors early
if PARAMETER_REGISTRY:  # Only validate if registry is populated
    validate_registry()
