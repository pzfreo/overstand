"""
Violin Neck Parameter Definitions

This is YOUR main configuration file. Add parameters here and they 
automatically appear in the UI. Focus on encoding your lutherie expertise.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from enum import Enum
import json

# Import from parameter registry (single source of truth)
from parameter_registry import (
    InstrumentFamily,
    StringCount,
    InstrumentType,
    PARAMETER_REGISTRY,
    ParameterRole,
    ParameterType
)


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
# PARAMETER DEFINITIONS - GENERATED FROM REGISTRY
# ============================================

def _generate_instrument_parameters():
    """
    Generate INSTRUMENT_PARAMETERS from the unified parameter registry.

    This creates backward-compatible parameter objects (NumericParameter, EnumParameter, etc.)
    from the registry's UnifiedParameter definitions.
    """
    params = {}

    for key, unified in PARAMETER_REGISTRY.items():
        # Skip output-only parameters
        if unified.role == ParameterRole.OUTPUT_ONLY:
            continue

        # Get the input metadata dict from the unified parameter
        metadata = unified.to_input_metadata()

        # Create the appropriate parameter type
        if unified.param_type == ParameterType.NUMERIC:
            params[key] = NumericParameter(
                name=metadata['name'],
                label=metadata['label'],
                unit=metadata['unit'],
                default=metadata['default'],
                min_val=metadata['min_val'],
                max_val=metadata['max_val'],
                description=metadata['description'],
                category=metadata['category'],
                step=metadata['step'],
                visible_when=metadata.get('visible_when'),
                is_output=metadata.get('is_output')
            )
        elif unified.param_type == ParameterType.ENUM:
            params[key] = EnumParameter(
                name=metadata['name'],
                label=metadata['label'],
                enum_class=metadata['enum_class'],
                default=metadata['default'],
                description=metadata['description'],
                category=metadata['category'],
                visible_when=metadata.get('visible_when'),
                is_output=metadata.get('is_output')
            )
        elif unified.param_type == ParameterType.BOOLEAN:
            params[key] = BooleanParameter(
                name=metadata['name'],
                label=metadata['label'],
                default=metadata['default'],
                description=metadata['description'],
                category=metadata['category'],
                visible_when=metadata.get('visible_when'),
                is_output=metadata.get('is_output')
            )
        elif unified.param_type == ParameterType.STRING:
            params[key] = StringParameter(
                name=metadata['name'],
                label=metadata['label'],
                default=metadata['default'],
                description=metadata['description'],
                category=metadata['category'],
                max_length=metadata['max_length'],
                visible_when=metadata.get('visible_when'),
                is_output=metadata.get('is_output')
            )

    return params


# Generate INSTRUMENT_PARAMETERS from registry
INSTRUMENT_PARAMETERS = _generate_instrument_parameters()


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
