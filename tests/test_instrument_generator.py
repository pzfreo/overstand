"""
Tests for instrument_generator.py - the main orchestrator.
"""
import pytest
import json
import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from instrument_generator import (
    generate_violin_neck,
    get_derived_values,
    get_derived_value_metadata,
    get_parameter_definitions,
    get_ui_metadata,
    get_presets
)


class TestGenerateViolinNeck:
    """Tests for the main generate_violin_neck function."""

    def test_success_with_valid_params(self, default_violin_params):
        """Test successful generation with valid parameters."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(generate_violin_neck(params_json))

        assert result['success'] is True
        assert result['views'] is not None
        assert 'side' in result['views']
        assert 'errors' in result
        assert len(result['errors']) == 0

    def test_returns_all_views(self, default_violin_params):
        """Test that all view types are returned."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(generate_violin_neck(params_json))

        views = result['views']
        assert 'side' in views
        assert 'top' in views
        assert 'cross_section' in views

    def test_returns_derived_values(self, default_violin_params):
        """Test that derived values are included."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(generate_violin_neck(params_json))

        assert 'derived_values' in result
        assert result['derived_values'] is not None
        assert 'neck_angle' in result['derived_values']

    def test_returns_formatted_values(self, default_violin_params):
        """Test that formatted values are included."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(generate_violin_neck(params_json))

        assert 'derived_formatted' in result
        assert result['derived_formatted'] is not None

    def test_returns_fret_positions(self, default_viol_params):
        """Test that fret positions are returned for viols."""
        params_json = json.dumps(default_viol_params)
        result = json.loads(generate_violin_neck(params_json))

        assert 'fret_positions' in result
        fret_pos = result['fret_positions']
        assert fret_pos['available'] is True
        assert 'html' in fret_pos

    def test_fret_positions_not_available_for_violin_without_frets(self, default_violin_params):
        """Test that fret positions are not available for violins when no_frets is 0."""
        # Violins typically don't have frets - set no_frets=0 explicitly
        default_violin_params['no_frets'] = 0
        params_json = json.dumps(default_violin_params)
        result = json.loads(generate_violin_neck(params_json))

        fret_pos = result['fret_positions']
        assert fret_pos['available'] is False

    def test_invalid_json_returns_error(self):
        """Test that invalid JSON returns error."""
        result = json.loads(generate_violin_neck("not valid json"))

        assert result['success'] is False
        assert result['views'] is None
        assert len(result['errors']) > 0
        assert 'Invalid' in result['errors'][0] or 'JSON' in result['errors'][0]

    def test_works_with_viol_params(self, default_viol_params):
        """Test generation works with viol parameters."""
        params_json = json.dumps(default_viol_params)
        result = json.loads(generate_violin_neck(params_json))

        assert result['success'] is True
        assert result['views'] is not None

    def test_works_with_guitar_params(self, default_guitar_params):
        """Test generation works with guitar parameters."""
        params_json = json.dumps(default_guitar_params)
        result = json.loads(generate_violin_neck(params_json))

        assert result['success'] is True
        assert result['views'] is not None


class TestGetDerivedValues:
    """Tests for get_derived_values function."""

    def test_returns_success(self, default_violin_params):
        """Test that function returns success."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(get_derived_values(params_json))

        assert result['success'] is True

    def test_returns_raw_values(self, default_violin_params):
        """Test that raw numeric values are returned."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(get_derived_values(params_json))

        assert 'values' in result
        values = result['values']
        assert 'neck_angle' in values
        assert isinstance(values['neck_angle'], (int, float))

    def test_returns_formatted_values(self, default_violin_params):
        """Test that formatted strings are returned."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(get_derived_values(params_json))

        assert 'formatted' in result
        formatted = result['formatted']
        # Formatted values should be strings with units
        for key, value in formatted.items():
            assert isinstance(value, str)

    def test_returns_metadata(self, default_violin_params):
        """Test that metadata is returned."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(get_derived_values(params_json))

        assert 'metadata' in result

    def test_violin_derived_values(self, default_violin_params):
        """Test specific derived values for violin."""
        params_json = json.dumps(default_violin_params)
        result = json.loads(get_derived_values(params_json))

        values = result['values']
        assert 'string_angle_to_ribs' in values
        assert 'string_angle_to_fingerboard' in values
        assert 'neck_line_angle' in values

    def test_invalid_json_returns_error(self):
        """Test that invalid JSON returns error."""
        result = json.loads(get_derived_values("not valid json"))

        assert result['success'] is False
        assert 'errors' in result


class TestGetDerivedValueMetadata:
    """Tests for get_derived_value_metadata function."""

    def test_returns_success(self):
        """Test that function returns success."""
        result = json.loads(get_derived_value_metadata())

        assert result['success'] is True

    def test_returns_metadata_dict(self):
        """Test that metadata dictionary is returned."""
        result = json.loads(get_derived_value_metadata())

        assert 'metadata' in result
        assert isinstance(result['metadata'], dict)

    def test_metadata_has_expected_keys(self):
        """Test that metadata has expected output parameters."""
        result = json.loads(get_derived_value_metadata())

        metadata = result['metadata']
        # Should have key output parameters
        assert 'neck_angle' in metadata
        assert 'neck_stop' in metadata


class TestGetParameterDefinitions:
    """Tests for get_parameter_definitions function."""

    def test_returns_valid_json(self):
        """Test that function returns valid JSON."""
        result = get_parameter_definitions()
        data = json.loads(result)

        assert isinstance(data, dict)

    def test_contains_parameters(self):
        """Test that parameters are included."""
        result = json.loads(get_parameter_definitions())

        assert 'parameters' in result

    def test_contains_input_parameters(self):
        """Test that input parameters are defined."""
        result = json.loads(get_parameter_definitions())

        params = result['parameters']
        assert 'vsl' in params
        assert 'body_stop' in params
        assert 'body_length' in params

    def test_only_contains_input_parameters(self):
        """Test that only input parameters are defined (output params are separate)."""
        result = json.loads(get_parameter_definitions())

        params = result['parameters']
        # Output-only params like neck_angle should NOT be in this export
        assert 'neck_angle' not in params
        # Input params should be present
        assert 'vsl' in params
        assert 'body_stop' in params


class TestGetUIMetadata:
    """Tests for get_ui_metadata function."""

    def test_returns_success(self):
        """Test that function returns success."""
        result = json.loads(get_ui_metadata())

        assert result['success'] is True

    def test_returns_metadata_bundle(self):
        """Test that metadata bundle is returned."""
        result = json.loads(get_ui_metadata())

        assert 'metadata' in result

    def test_metadata_has_sections(self):
        """Test that sections are included in metadata."""
        result = json.loads(get_ui_metadata())

        metadata = result['metadata']
        assert 'sections' in metadata

    def test_metadata_has_presets(self):
        """Test that presets are included in metadata."""
        result = json.loads(get_ui_metadata())

        metadata = result['metadata']
        assert 'presets' in metadata

    def test_metadata_parameters_use_input_format(self):
        """
        Test that all parameters in metadata use input format, not output format.

        This is a regression test for the bug where CONDITIONAL parameters
        (body_stop, neck_stop) were exported in output format because to_dict()
        checked output_config first. UI needs input format with type/min/max.
        """
        result = json.loads(get_ui_metadata())
        parameters = result['metadata']['parameters']

        for name, param in parameters.items():
            # Input format has 'type', output format has 'key'
            assert 'type' in param, \
                f"Parameter '{name}' missing 'type' - likely using output format instead of input format"
            assert param['type'] in ('number', 'enum', 'boolean', 'string'), \
                f"Parameter '{name}' has invalid type '{param['type']}'"

            # Numeric params must have min/max for HTML input validation
            if param['type'] == 'number':
                assert 'min' in param, f"Numeric parameter '{name}' missing 'min'"
                assert 'max' in param, f"Numeric parameter '{name}' missing 'max'"

    def test_all_section_parameters_exist_in_metadata(self):
        """
        Test that all parameters referenced in sections exist in parameters dict.

        This catches cases where parameters are added to sections but not exported.
        """
        result = json.loads(get_ui_metadata())
        metadata = result['metadata']
        sections = metadata['sections']
        parameters = metadata['parameters']

        for section_id, section in sections.items():
            # Only check input sections (not output sections)
            if section['type'] in ('input_basic', 'input_advanced'):
                for param_name in section['parameter_names']:
                    assert param_name in parameters, \
                        f"Section '{section_id}' references parameter '{param_name}' but it's not in parameters dict"

    def test_metadata_has_key_measurements(self):
        """Test that key_measurements config is included in metadata."""
        result = json.loads(get_ui_metadata())
        metadata = result['metadata']

        assert 'key_measurements' in metadata, "key_measurements missing from metadata"
        key_measurements = metadata['key_measurements']

        assert isinstance(key_measurements, list), "key_measurements should be a list"
        assert len(key_measurements) > 0, "key_measurements should not be empty"

        # Check expected key measurements are present
        keys = [m['key'] for m in key_measurements]
        assert 'neck_angle' in keys, "neck_angle should be in key_measurements"
        assert 'string_break_angle' in keys, "string_break_angle should be in key_measurements"

        # Check first item has primary flag
        assert key_measurements[0].get('primary') is True, "First key measurement should be primary"


class TestGetPresets:
    """Tests for get_presets function."""

    def test_returns_valid_json(self):
        """Test that function returns valid JSON."""
        result = get_presets()
        data = json.loads(result)

        assert isinstance(data, dict)

    def test_finds_preset_files(self, presets_dir):
        """Test that preset files are found."""
        result = json.loads(get_presets())

        # Should find at least one preset
        assert len(result) > 0

    def test_preset_has_name(self, presets_dir):
        """Test that each preset has a name."""
        result = json.loads(get_presets())

        for preset_id, preset_data in result.items():
            assert 'name' in preset_data

    def test_preset_has_parameters(self, presets_dir):
        """Test that each preset has parameters."""
        result = json.loads(get_presets())

        for preset_id, preset_data in result.items():
            assert 'parameters' in preset_data
            assert isinstance(preset_data['parameters'], dict)

    def test_violin_preset_exists(self, presets_dir):
        """Test that violin preset exists."""
        result = json.loads(get_presets())

        # Should have at least one preset with 'violin' in the name
        violin_presets = [k for k in result.keys() if 'violin' in k.lower()]
        assert len(violin_presets) > 0


class TestErrorHandling:
    """Tests for error handling in the generator."""

    def test_empty_params_handled(self):
        """Test that empty parameters are handled gracefully."""
        result = json.loads(generate_violin_neck("{}"))

        # Should return a result (may succeed with defaults or fail with validation errors)
        assert 'success' in result

    def test_null_params_returns_error(self):
        """Test that null params returns error."""
        result = json.loads(generate_violin_neck("null"))

        # Should handle null gracefully
        assert 'success' in result
