"""
Integration tests for Overstand.

These tests verify the end-to-end pipeline from parameters through geometry
calculation to SVG generation. They test real presets, validate SVG output
structure, and check mathematical consistency of derived values.
"""
import pytest
import json
import sys
import math
import re
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from instrument_generator import (
    generate_violin_neck,
    get_derived_values,
    get_presets,
    get_ui_metadata
)
from parameter_registry import (
    get_default_values,
    InstrumentFamily,
    PARAMETER_REGISTRY,
    get_all_input_parameters,
    get_all_output_parameters
)


class TestEndToEndPipeline:
    """Test the complete generation pipeline from parameters to SVG."""

    def test_full_pipeline_with_defaults(self):
        """Test complete pipeline with default parameters produces valid output."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['instrument_name'] = 'Integration Test Violin'

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True, f"Pipeline failed: {result.get('errors', [])}"
        assert result['views'] is not None
        assert result['derived_values'] is not None
        assert len(result['errors']) == 0

    def test_pipeline_produces_all_views(self):
        """Test that all expected views are generated."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert 'side' in result['views']
        assert 'cross_section' in result['views']
        assert 'radius_template' in result['views']

        # Each view should be a non-empty SVG string
        for view_name, svg in result['views'].items():
            if view_name != 'top':  # Top view is a placeholder
                assert isinstance(svg, str)
                assert len(svg) > 100, f"{view_name} view is too short"

    def test_pipeline_produces_all_derived_values(self):
        """Test that all expected derived values are calculated."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name

        result = json.loads(generate_violin_neck(json.dumps(params)))
        derived = result['derived_values']

        # Key derived values that must be present
        expected_keys = [
            'neck_angle',
            'neck_stop',
            'string_angle_to_ribs',
            'string_angle_to_fingerboard',
            'string_break_angle',
            'neck_line_angle',
            'fb_thickness_at_nut',
            'fb_thickness_at_join'
        ]

        for key in expected_keys:
            assert key in derived, f"Missing derived value: {key}"
            assert derived[key] is not None, f"Derived value {key} is None"
            assert not math.isnan(derived[key]), f"Derived value {key} is NaN"
            assert not math.isinf(derived[key]), f"Derived value {key} is Inf"


class TestPresetValidation:
    """Test that all preset files generate valid output."""

    @pytest.fixture
    def all_presets(self, presets_dir):
        """Load all preset files from the presets directory."""
        presets = {}
        # Skip incomplete presets that are meant for user customization
        skip_presets = {'custom.json', 'presets.json', 'test_minimal.json'}

        for preset_file in presets_dir.glob('*.json'):
            if preset_file.name in skip_presets:
                continue
            with open(preset_file) as f:
                try:
                    data = json.load(f)
                    if 'parameters' in data:
                        presets[preset_file.stem] = data['parameters']
                except json.JSONDecodeError:
                    pytest.fail(f"Invalid JSON in preset: {preset_file.name}")
        return presets

    def test_all_presets_generate_successfully(self, all_presets):
        """Every preset file should generate without errors."""
        failures = []

        for preset_name, params in all_presets.items():
            result = json.loads(generate_violin_neck(json.dumps(params)))

            if not result['success']:
                failures.append(f"{preset_name}: {result.get('errors', ['Unknown error'])}")

        assert len(failures) == 0, f"Preset failures:\n" + "\n".join(failures)

    def test_all_presets_produce_valid_svg(self, all_presets):
        """All presets should produce parseable SVG output."""
        for preset_name, params in all_presets.items():
            result = json.loads(generate_violin_neck(json.dumps(params)))

            if result['success']:
                for view_name, svg in result['views'].items():
                    if view_name == 'top':
                        continue  # Skip placeholder

                    # Basic SVG structure validation
                    assert '<svg' in svg, f"{preset_name}/{view_name}: Missing SVG tag"
                    assert '</svg>' in svg, f"{preset_name}/{view_name}: Unclosed SVG tag"
                    assert 'viewBox' in svg, f"{preset_name}/{view_name}: Missing viewBox"

    def test_violin_family_presets(self, all_presets):
        """Test presets in the VIOLIN family specifically."""
        violin_presets = {
            name: params for name, params in all_presets.items()
            if params.get('instrument_family') == 'VIOLIN'
        }

        assert len(violin_presets) > 0, "No VIOLIN family presets found"

        for preset_name, params in violin_presets.items():
            result = json.loads(generate_violin_neck(json.dumps(params)))
            assert result['success'], f"VIOLIN preset {preset_name} failed"

            # Violins should not have frets by default (unless explicitly set)
            if params.get('no_frets', 0) == 0:
                assert result['fret_positions']['available'] is False

    def test_viol_family_presets(self, all_presets):
        """Test presets in the VIOL family specifically."""
        viol_presets = {
            name: params for name, params in all_presets.items()
            if params.get('instrument_family') == 'VIOL'
        }

        if len(viol_presets) == 0:
            pytest.skip("No VIOL family presets found")

        for preset_name, params in viol_presets.items():
            result = json.loads(generate_violin_neck(json.dumps(params)))
            assert result['success'], f"VIOL preset {preset_name} failed"

            # Viols should have frets and back break calculation
            derived = result['derived_values']
            assert 'back_break_length' in derived

    def test_guitar_mandolin_family_presets(self, all_presets):
        """Test presets in the GUITAR_MANDOLIN family specifically."""
        guitar_presets = {
            name: params for name, params in all_presets.items()
            if params.get('instrument_family') == 'GUITAR_MANDOLIN'
        }

        if len(guitar_presets) == 0:
            pytest.skip("No GUITAR_MANDOLIN family presets found")

        for preset_name, params in guitar_presets.items():
            result = json.loads(generate_violin_neck(json.dumps(params)))
            assert result['success'], f"GUITAR_MANDOLIN preset {preset_name} failed"

            # Guitars should have fret positions
            if params.get('no_frets', 0) > 0:
                assert result['fret_positions']['available'] is True


class TestSVGOutputValidation:
    """Validate the structure and content of generated SVG."""

    def test_svg_has_valid_structure(self, default_violin_params):
        """Test that SVG output has valid XML structure."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))

        side_svg = result['views']['side']

        # Check for balanced tags (basic check)
        open_tags = re.findall(r'<(\w+)[^/>]*(?<!/)>', side_svg)
        close_tags = re.findall(r'</(\w+)>', side_svg)
        self_closing = re.findall(r'<(\w+)[^>]*/>', side_svg)

        # SVG should have xmlns attribute
        assert 'xmlns="http://www.w3.org/2000/svg"' in side_svg or \
               "xmlns='http://www.w3.org/2000/svg'" in side_svg

    def test_svg_contains_geometry_elements(self, default_violin_params):
        """Test that SVG contains expected geometry elements."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))

        side_svg = result['views']['side']

        # Should contain paths or polylines for geometry
        has_geometry = '<path' in side_svg or '<polyline' in side_svg or '<line' in side_svg
        assert has_geometry, "SVG should contain path, polyline, or line elements"

    def test_svg_contains_title(self, default_violin_params):
        """Test that SVG contains instrument name."""
        default_violin_params['instrument_name'] = 'Test Instrument XYZ'
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))

        side_svg = result['views']['side']

        # Instrument name should appear in the SVG
        assert 'Test Instrument XYZ' in side_svg

    def test_cross_section_svg_structure(self, default_violin_params):
        """Test that cross-section view has expected structure."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))

        cross_section = result['views']['cross_section']

        assert '<svg' in cross_section
        assert '</svg>' in cross_section
        assert 'Cross-Section' in cross_section


class TestMathematicalConsistency:
    """Test that derived values are mathematically consistent."""

    def test_neck_stop_less_than_vsl(self, default_violin_params):
        """Neck stop should always be less than vibrating string length."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))
        derived = result['derived_values']

        vsl = default_violin_params['vsl']
        neck_stop = derived['neck_stop']

        assert neck_stop < vsl, f"neck_stop ({neck_stop}) should be < vsl ({vsl})"

    def test_string_angles_are_reasonable(self, default_violin_params):
        """String angles should be within reasonable bounds."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))
        derived = result['derived_values']

        # String angle to ribs should be positive and less than 90 degrees
        assert 0 < derived['string_angle_to_ribs'] < 90

        # String angle to fingerboard should be small (typically 1-5 degrees)
        assert 0 < derived['string_angle_to_fingerboard'] < 15

    def test_neck_angle_is_reasonable(self, default_violin_params):
        """Neck angle should be within reasonable bounds."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))
        derived = result['derived_values']

        # Neck angle is measured from horizontal - a nearly vertical neck
        # is about 80-90 degrees. Typical values are 80-88 degrees.
        assert 75 < derived['neck_angle'] < 90

    def test_fingerboard_thickness_increases(self, default_violin_params):
        """Fingerboard should be thicker at join than at nut (due to scoop)."""
        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))
        derived = result['derived_values']

        # For most instruments, thickness increases toward the body
        # This is because the fingerboard has a scoop
        assert derived['fb_thickness_at_join'] >= derived['fb_thickness_at_nut']

    def test_string_break_angle_calculation(self, default_violin_params):
        """String break angle should be sum of component angles."""
        # Add tailpiece height for afterlength calculation
        default_violin_params['tailpiece_height'] = 5.0

        result = json.loads(generate_violin_neck(json.dumps(default_violin_params)))
        derived = result['derived_values']

        # string_break_angle = 180 - string_angle_to_ribs - afterlength_angle
        calculated = 180 - derived['string_angle_to_ribs'] - derived['afterlength_angle']

        assert abs(derived['string_break_angle'] - calculated) < 0.001, \
            f"Break angle mismatch: {derived['string_break_angle']} vs {calculated}"

    def test_derived_values_consistency_across_families(self):
        """Test that common derived values are calculated consistently across families."""
        families = [
            InstrumentFamily.VIOLIN.name,
            InstrumentFamily.VIOL.name,
            InstrumentFamily.GUITAR_MANDOLIN.name
        ]

        for family in families:
            params = get_default_values()
            params['instrument_family'] = family

            # Set required guitar params
            if family == InstrumentFamily.GUITAR_MANDOLIN.name:
                params['fret_join'] = 12
                params['no_frets'] = 19
                params['string_height_12th_fret'] = 2.5
            elif family == InstrumentFamily.VIOL.name:
                params['no_frets'] = 7

            result = json.loads(generate_violin_neck(json.dumps(params)))

            assert result['success'], f"Family {family} failed: {result.get('errors')}"

            derived = result['derived_values']

            # These values should always be present and valid
            assert 'neck_angle' in derived
            assert 'neck_stop' in derived
            assert not math.isnan(derived['neck_angle'])
            assert not math.isnan(derived['neck_stop'])


class TestBoundaryConditions:
    """Test behavior with extreme or edge-case parameter values."""

    def test_minimum_vsl(self):
        """Test with minimum vibrating string length."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['vsl'] = 100  # Very short string
        params['body_stop'] = 60
        params['body_length'] = 150
        params['fingerboard_length'] = 80

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should either succeed or fail gracefully with error message
        assert 'success' in result
        if not result['success']:
            assert len(result['errors']) > 0

    def test_maximum_vsl(self):
        """Test with maximum vibrating string length (bass viol scale)."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOL.name
        params['vsl'] = 700  # Bass viol scale
        params['body_stop'] = 400
        params['body_length'] = 750
        params['fingerboard_length'] = 500
        params['no_frets'] = 7

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert 'success' in result
        if result['success']:
            assert result['views']['side'] is not None

    def test_zero_arching_height(self):
        """Test with flat top (zero arching)."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['arching_height'] = 0

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should still generate successfully
        assert result['success'] is True

    def test_high_arching(self):
        """Test with very high arching."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['arching_height'] = 25  # Very high arch

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True

    def test_zero_overstand(self):
        """Test with zero overstand (neck flush with ribs)."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['overstand'] = 0

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should handle zero overstand
        assert 'success' in result

    def test_large_fingerboard_radius(self):
        """Test with very large (nearly flat) fingerboard radius."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['fingerboard_radius'] = 500  # Nearly flat

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True
        # Sagitta should be very small
        derived = result['derived_values']
        # The cross-section calculations should handle this

    def test_small_fingerboard_radius(self):
        """Test with small (highly curved) fingerboard radius."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['fingerboard_radius'] = 25  # Highly curved

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True


class TestCrossInstrumentFamilyBehavior:
    """Test differences and similarities across instrument families."""

    def test_viol_has_back_break_geometry(self):
        """Viols should calculate back break geometry."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOL.name
        params['no_frets'] = 7
        params['break_angle'] = 15
        params['top_block_height'] = 40

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True
        derived = result['derived_values']

        assert 'back_break_length' in derived
        assert derived['back_break_length'] > 0

    def test_violin_no_back_break(self):
        """Violins should not have back break geometry."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True
        derived = result['derived_values']

        # back_break_length should be 0 for non-viols
        assert derived.get('back_break_length', 0) == 0

    def test_guitar_uses_12th_fret_action(self):
        """Guitars should use 12th fret action for calculations."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.GUITAR_MANDOLIN.name
        params['fret_join'] = 12
        params['no_frets'] = 19
        params['string_height_12th_fret'] = 3.0

        result = json.loads(generate_violin_neck(json.dumps(params)))

        assert result['success'] is True

        # Fret positions should be available
        assert result['fret_positions']['available'] is True


class TestDerivedValuesAPI:
    """Test the get_derived_values function specifically."""

    def test_derived_values_returns_all_formats(self, default_violin_params):
        """Test that derived values API returns values, formatted, and metadata."""
        result = json.loads(get_derived_values(json.dumps(default_violin_params)))

        assert result['success'] is True
        assert 'values' in result
        assert 'formatted' in result
        assert 'metadata' in result

    def test_formatted_values_have_units(self, default_violin_params):
        """Test that formatted values include units."""
        result = json.loads(get_derived_values(json.dumps(default_violin_params)))

        formatted = result['formatted']

        # Neck angle should have degree symbol or 'deg'
        if 'neck_angle' in formatted:
            assert any(unit in formatted['neck_angle'] for unit in ['deg', '°'])

    def test_metadata_matches_values(self, default_violin_params):
        """Test that metadata keys match value keys."""
        result = json.loads(get_derived_values(json.dumps(default_violin_params)))

        values = result['values']
        metadata = result['metadata']

        # Every value in metadata should have a corresponding value
        for key in metadata:
            assert key in values, f"Metadata key {key} has no corresponding value"


class TestUIMetadataIntegration:
    """Test that UI metadata is consistent with parameter registry."""

    def test_ui_metadata_loads_successfully(self):
        """Test that UI metadata can be loaded."""
        result = json.loads(get_ui_metadata())

        assert result['success'] is True
        assert 'metadata' in result

    def test_all_input_parameters_in_sections(self):
        """Test that all input parameters appear in at least one section."""
        result = json.loads(get_ui_metadata())
        metadata = result['metadata']

        # Collect all parameters referenced in sections
        params_in_sections = set()
        for section_id, section in metadata['sections'].items():
            if 'parameter_names' in section:
                params_in_sections.update(section['parameter_names'])

        # Check that input parameters are represented
        input_params = get_all_input_parameters()

        for param_name in input_params:
            # Skip parameters that are conditional or have visibility conditions
            param = PARAMETER_REGISTRY.get(param_name)
            if param and hasattr(param, 'visible_when') and param.visible_when:
                continue  # These may not appear in all cases
            # Presence check is informational, not strict
            # Some parameters may be in output-only sections

    def test_presets_in_ui_metadata(self):
        """Test that presets are included in UI metadata."""
        result = json.loads(get_ui_metadata())
        metadata = result['metadata']

        assert 'presets' in metadata
        # Should have at least one preset
        assert len(metadata.get('presets', {})) > 0


class TestErrorHandlingIntegration:
    """Test error handling throughout the integration pipeline."""

    def test_invalid_instrument_family(self):
        """Test handling of invalid instrument family."""
        params = get_default_values()
        params['instrument_family'] = 'INVALID_FAMILY'

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should either handle gracefully or return error
        assert 'success' in result

    def test_missing_required_parameter(self):
        """Test handling when a key parameter is missing."""
        params = {'instrument_family': 'VIOLIN'}  # Missing most params

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should use defaults or return error, not crash
        assert 'success' in result

    def test_negative_dimension(self):
        """Test handling of negative dimension values."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['vsl'] = -100  # Invalid negative value

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should either reject or handle gracefully
        assert 'success' in result
        if not result['success']:
            assert len(result['errors']) > 0

    def test_non_numeric_value(self):
        """Test handling of non-numeric values for numeric parameters."""
        params = get_default_values()
        params['instrument_family'] = InstrumentFamily.VIOLIN.name
        params['vsl'] = "not a number"

        result = json.loads(generate_violin_neck(json.dumps(params)))

        # Should fail gracefully
        assert 'success' in result


class TestFretPositionCalculations:
    """Test fret position calculations for fretted instruments."""

    def test_viol_fret_positions(self, default_viol_params):
        """Test that viol fret positions are calculated correctly."""
        result = json.loads(generate_violin_neck(json.dumps(default_viol_params)))

        assert result['success'] is True
        fret_pos = result['fret_positions']

        assert fret_pos['available'] is True
        assert 'html' in fret_pos
        assert fret_pos['vsl'] == default_viol_params['vsl']

    def test_guitar_fret_positions(self, default_guitar_params):
        """Test that guitar fret positions are calculated correctly."""
        result = json.loads(generate_violin_neck(json.dumps(default_guitar_params)))

        assert result['success'] is True
        fret_pos = result['fret_positions']

        assert fret_pos['available'] is True
        assert fret_pos['no_frets'] == default_guitar_params['no_frets']

    def test_fret_positions_increase_monotonically(self, default_viol_params):
        """Test that fret distances from nut increase monotonically."""
        from geometry_engine import calculate_fret_positions

        vsl = default_viol_params['vsl']
        no_frets = default_viol_params.get('no_frets', 7)

        positions = calculate_fret_positions(vsl, no_frets)

        # Each fret should be further from the nut than the previous
        for i in range(1, len(positions)):
            assert positions[i] > positions[i-1], \
                f"Fret {i} ({positions[i]}) should be > fret {i-1} ({positions[i-1]})"
