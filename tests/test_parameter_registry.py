"""
Test suite for parameter_registry.py

Validates the unified parameter registry including:
- Registry structure and validation
- Parameter roles (INPUT_ONLY, OUTPUT_ONLY, CONDITIONAL)
- Consistent snake_case naming
- No duplication between input and output definitions
- Correct metadata generation
"""

import pytest
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from parameter_registry import (
    PARAMETER_REGISTRY,
    ParameterRole,
    ParameterType,
    UnifiedParameter,
    InstrumentFamily,
    validate_registry
)


def test_registry_validates_on_import():
    """Test that registry validation runs successfully on import"""
    # If we got here, validation passed during module import
    assert len(PARAMETER_REGISTRY) > 0


def test_registry_has_expected_count():
    """Test registry contains expected number of parameters"""
    # Should have ~61 parameters total (21 input + ~38 output + 2 conditional)
    assert 55 <= len(PARAMETER_REGISTRY) <= 70


def test_all_keys_are_snake_case():
    """Test that all registry keys use lowercase_snake_case"""
    for key in PARAMETER_REGISTRY.keys():
        # Should be lowercase
        assert key == key.lower(), f"Key '{key}' is not lowercase"
        # Should not contain spaces
        assert ' ' not in key, f"Key '{key}' contains spaces"
        # Should not start/end with underscore
        assert not key.startswith('_'), f"Key '{key}' starts with underscore"
        assert not key.endswith('_'), f"Key '{key}' ends with underscore"


def test_no_title_case_keys():
    """Test that no keys use Title Case format"""
    for key in PARAMETER_REGISTRY.keys():
        # Should not have capital letters
        has_capitals = any(c.isupper() for c in key)
        assert not has_capitals, f"Key '{key}' contains capital letters"


def test_conditional_parameters_have_both_configs():
    """Test that CONDITIONAL parameters have both input and output configs"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.role == ParameterRole.CONDITIONAL:
            assert param.input_config is not None, \
                f"CONDITIONAL parameter '{key}' missing input_config"
            assert param.output_config is not None, \
                f"CONDITIONAL parameter '{key}' missing output_config"
            assert param.is_output_for is not None, \
                f"CONDITIONAL parameter '{key}' missing is_output_for"


def test_input_only_parameters_have_input_config():
    """Test that INPUT_ONLY parameters have input_config"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.role == ParameterRole.INPUT_ONLY:
            assert param.input_config is not None, \
                f"INPUT_ONLY parameter '{key}' missing input_config"
            assert param.output_config is None, \
                f"INPUT_ONLY parameter '{key}' should not have output_config"


def test_output_only_parameters_have_output_config():
    """Test that OUTPUT_ONLY parameters have output_config"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.role == ParameterRole.OUTPUT_ONLY:
            assert param.output_config is not None, \
                f"OUTPUT_ONLY parameter '{key}' missing output_config"
            assert param.input_config is None, \
                f"OUTPUT_ONLY parameter '{key}' should not have input_config"


def test_body_stop_is_conditional():
    """Test that body_stop is properly defined as CONDITIONAL"""
    assert 'body_stop' in PARAMETER_REGISTRY
    param = PARAMETER_REGISTRY['body_stop']

    assert param.role == ParameterRole.CONDITIONAL
    assert param.input_config is not None
    assert param.output_config is not None
    assert param.is_output_for is not None

    # Should be input for VIOLIN/VIOL, output for GUITAR_MANDOLIN
    assert param.is_output_for['VIOLIN'] == False
    assert param.is_output_for['VIOL'] == False
    assert param.is_output_for['GUITAR_MANDOLIN'] == True


def test_neck_stop_is_conditional():
    """Test that neck_stop is properly defined as CONDITIONAL"""
    assert 'neck_stop' in PARAMETER_REGISTRY
    param = PARAMETER_REGISTRY['neck_stop']

    assert param.role == ParameterRole.CONDITIONAL
    assert param.input_config is not None
    assert param.output_config is not None

    # Should be output for all families
    assert param.is_output_for['VIOLIN'] == True
    assert param.is_output_for['VIOL'] == True
    assert param.is_output_for['GUITAR_MANDOLIN'] == True


def test_enum_parameters_have_enum_class():
    """Test that ENUM parameters have enum_class defined"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.param_type == ParameterType.ENUM:
            assert param.enum_class is not None, \
                f"ENUM parameter '{key}' missing enum_class"


def test_string_parameters_have_max_length():
    """Test that STRING parameters have max_length defined"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.param_type == ParameterType.STRING:
            assert param.max_length is not None, \
                f"STRING parameter '{key}' missing max_length"
            assert param.max_length > 0, \
                f"STRING parameter '{key}' has invalid max_length"


def test_no_duplicate_display_names():
    """Test that display names are unique (helps with UI clarity)"""
    display_names = [p.display_name for p in PARAMETER_REGISTRY.values()]
    duplicates = [name for name in display_names if display_names.count(name) > 1]
    assert len(duplicates) == 0, f"Duplicate display names found: {set(duplicates)}"


def test_all_parameters_have_descriptions():
    """Test that all parameters have non-empty descriptions"""
    for key, param in PARAMETER_REGISTRY.items():
        assert param.description, f"Parameter '{key}' has empty description"
        assert len(param.description) > 10, \
            f"Parameter '{key}' has too short description: '{param.description}'"


def test_numeric_parameters_have_valid_ranges():
    """Test that NUMERIC parameters have valid min/max ranges"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.param_type == ParameterType.NUMERIC and param.input_config:
            config = param.input_config
            assert config.min_val < config.max_val, \
                f"Parameter '{key}' has invalid range: min={config.min_val}, max={config.max_val}"
            assert config.min_val <= config.default <= config.max_val, \
                f"Parameter '{key}' default {config.default} outside range [{config.min_val}, {config.max_val}]"


def test_output_metadata_generation():
    """Test that output metadata can be generated correctly"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.output_config:
            metadata = param.to_output_metadata()

            assert metadata['key'] == key
            assert metadata['display_name'] == param.display_name
            assert metadata['unit'] == param.unit
            assert metadata['decimals'] == param.output_config.decimals
            assert metadata['visible'] == param.output_config.visible
            assert 'description' in metadata
            assert 'category' in metadata
            assert 'order' in metadata


def test_input_metadata_generation():
    """Test that input metadata can be generated correctly"""
    for key, param in PARAMETER_REGISTRY.items():
        if param.input_config:
            metadata = param.to_input_metadata()

            assert metadata['name'] == key
            assert metadata['label'] == param.display_name
            assert metadata['description'] == param.description
            assert 'category' in metadata


def test_input_metadata_js_compatible_types():
    """
    Test that input metadata uses JavaScript-compatible type names.

    This is a regression test for the bug where Python used 'numeric'
    but JavaScript expected 'number', causing UI controls to not render.
    """
    valid_js_types = {'number', 'enum', 'boolean', 'string'}

    for key, param in PARAMETER_REGISTRY.items():
        if param.input_config:
            metadata = param.to_input_metadata()

            # Type must be JS-compatible (not Python enum values like 'numeric')
            assert metadata['type'] in valid_js_types, \
                f"Parameter '{key}' has type '{metadata['type']}' but JS expects one of {valid_js_types}"


def test_numeric_params_use_min_max_not_min_val_max_val():
    """
    Test that numeric parameters use 'min'/'max' keys, not 'min_val'/'max_val'.

    This is a regression test for the bug where Python used 'min_val'/'max_val'
    but JavaScript expected 'min'/'max' for HTML input element attributes.
    """
    for key, param in PARAMETER_REGISTRY.items():
        if param.input_config and param.param_type == ParameterType.NUMERIC:
            metadata = param.to_input_metadata()

            # Must use 'min' and 'max', not 'min_val' and 'max_val'
            assert 'min' in metadata, f"Parameter '{key}' missing 'min' key"
            assert 'max' in metadata, f"Parameter '{key}' missing 'max' key"
            assert 'min_val' not in metadata, f"Parameter '{key}' uses 'min_val' instead of 'min'"
            assert 'max_val' not in metadata, f"Parameter '{key}' uses 'max_val' instead of 'max'"


def test_format_value_methods():
    """Test that formatting methods work correctly"""
    # Test numeric parameter
    vsl = PARAMETER_REGISTRY['vsl']
    assert vsl.format_value(325.5) == "325.5"
    assert vsl.format_with_unit(325.5) == "325.5 mm"

    # Test parameter with more decimals
    neck_angle = PARAMETER_REGISTRY['neck_angle']
    formatted = neck_angle.format_value(5.12345)
    assert '5.1' in formatted  # Should have 1 decimal place


def test_is_input_in_mode_method():
    """Test that is_input_in_mode works correctly"""
    # Test INPUT_ONLY parameter
    vsl = PARAMETER_REGISTRY['vsl']
    assert vsl.is_input_in_mode('VIOLIN') == True
    assert vsl.is_input_in_mode('GUITAR_MANDOLIN') == True

    # Test OUTPUT_ONLY parameter
    neck_angle = PARAMETER_REGISTRY['neck_angle']
    assert neck_angle.is_input_in_mode('VIOLIN') == False

    # Test CONDITIONAL parameter
    body_stop = PARAMETER_REGISTRY['body_stop']
    assert body_stop.is_input_in_mode('VIOLIN') == True
    assert body_stop.is_input_in_mode('GUITAR_MANDOLIN') == False


def test_is_output_in_mode_method():
    """Test that is_output_in_mode works correctly"""
    # Test OUTPUT_ONLY parameter
    neck_angle = PARAMETER_REGISTRY['neck_angle']
    assert neck_angle.is_output_in_mode('VIOLIN') == True

    # Test INPUT_ONLY parameter
    vsl = PARAMETER_REGISTRY['vsl']
    assert vsl.is_output_in_mode('VIOLIN') == False

    # Test CONDITIONAL parameter
    body_stop = PARAMETER_REGISTRY['body_stop']
    assert body_stop.is_output_in_mode('VIOLIN') == False
    assert body_stop.is_output_in_mode('GUITAR_MANDOLIN') == True


def test_parameter_counts_by_role():
    """Test that parameter counts match expectations"""
    roles_count = {
        ParameterRole.INPUT_ONLY: 0,
        ParameterRole.OUTPUT_ONLY: 0,
        ParameterRole.CONDITIONAL: 0
    }

    for param in PARAMETER_REGISTRY.values():
        roles_count[param.role] += 1

    # Should have around 21 INPUT_ONLY, 30 OUTPUT_ONLY, 2 CONDITIONAL
    assert roles_count[ParameterRole.INPUT_ONLY] >= 15
    assert roles_count[ParameterRole.OUTPUT_ONLY] >= 25
    assert roles_count[ParameterRole.CONDITIONAL] >= 2


def test_instrument_family_enum_available():
    """Test that InstrumentFamily enum is available from registry"""
    # Should be able to import InstrumentFamily from parameter_registry
    assert hasattr(InstrumentFamily, 'VIOLIN')
    assert hasattr(InstrumentFamily, 'VIOL')
    assert hasattr(InstrumentFamily, 'GUITAR_MANDOLIN')


def test_validate_registry_function():
    """Test that validate_registry function works"""
    # Should not raise an exception
    validate_registry()


def test_tailpiece_height_parameter():
    """Test tailpiece_height input parameter exists with correct properties"""
    assert 'tailpiece_height' in PARAMETER_REGISTRY
    param = PARAMETER_REGISTRY['tailpiece_height']

    assert param.role == ParameterRole.INPUT_ONLY
    assert param.param_type == ParameterType.NUMERIC
    assert param.unit == 'mm'
    assert param.input_config is not None
    assert param.input_config.default == 0.0
    assert param.input_config.min_val == 0.0
    assert param.input_config.category == 'Advanced Geometry'


def test_string_break_angle_parameter():
    """Test string_break_angle output parameter exists with correct properties"""
    assert 'string_break_angle' in PARAMETER_REGISTRY
    param = PARAMETER_REGISTRY['string_break_angle']

    assert param.role == ParameterRole.OUTPUT_ONLY
    assert param.param_type == ParameterType.NUMERIC
    assert param.unit == '°'
    assert param.output_config is not None
    assert param.output_config.visible == True
    assert param.output_config.category == 'Geometry'


def test_viol_break_angle_display_name():
    """Test that break_angle parameter has updated display name"""
    assert 'break_angle' in PARAMETER_REGISTRY
    param = PARAMETER_REGISTRY['break_angle']

    assert param.display_name == 'Viol Back Break Angle'
    assert param.role == ParameterRole.INPUT_ONLY


def test_afterlength_angle_parameter():
    """Test afterlength_angle output parameter exists with correct properties"""
    assert 'afterlength_angle' in PARAMETER_REGISTRY
    param = PARAMETER_REGISTRY['afterlength_angle']

    assert param.role == ParameterRole.OUTPUT_ONLY
    assert param.param_type == ParameterType.NUMERIC
    assert param.unit == '°'
    assert param.output_config is not None
    assert param.output_config.visible == True
    assert param.output_config.category == 'Geometry'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
