"""
Test suite for geometry_engine.py

Validates the geometry calculation functions including:
- Sagitta calculation
- Fingerboard thickness calculations
- String angle calculations
- Neck geometry calculations
- Fret position calculations
"""

import pytest
import math
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from geometry_engine import (
    calculate_sagitta,
    calculate_fingerboard_thickness,
    calculate_string_angles_violin,
    calculate_string_angles_guitar,
    calculate_neck_geometry,
    calculate_fingerboard_geometry,
    calculate_string_height_and_dimensions,
    calculate_fret_positions,
    calculate_viol_back_break
)


class TestCalculateSagitta:
    """Tests for calculate_sagitta function"""

    def test_zero_radius_returns_zero(self):
        """Sagitta should be zero when radius is zero"""
        assert calculate_sagitta(0, 10) == 0.0

    def test_zero_width_returns_zero(self):
        """Sagitta should be zero when width is zero"""
        assert calculate_sagitta(100, 0) == 0.0

    def test_negative_values_return_zero(self):
        """Sagitta should be zero for negative inputs"""
        assert calculate_sagitta(-100, 10) == 0.0
        assert calculate_sagitta(100, -10) == 0.0

    def test_known_values(self):
        """Test sagitta calculation with known values"""
        # For a circle with radius 100 and chord width 20:
        # sagitta = r - sqrt(r^2 - (w/2)^2) = 100 - sqrt(10000 - 100) ≈ 0.501
        result = calculate_sagitta(100, 20)
        assert abs(result - 0.501) < 0.01

    def test_wide_chord_approximation(self):
        """When chord width >= 2*radius, use approximation formula"""
        # When half_width >= radius, uses: width^2 / (8 * radius)
        result = calculate_sagitta(10, 30)  # half_width (15) > radius (10)
        expected = 30**2 / (8.0 * 10)  # = 11.25
        assert abs(result - expected) < 0.001

    def test_typical_violin_fingerboard(self):
        """Test with typical violin fingerboard values"""
        # Violin: radius ~41mm, width at nut ~24mm
        result = calculate_sagitta(41, 24)
        # Sagitta should be positive and reasonable (1-3mm range)
        assert 0.5 < result < 5.0


class TestCalculateFingerboadThickness:
    """Tests for calculate_fingerboard_thickness function"""

    def test_returns_expected_keys(self):
        """Should return dict with expected keys"""
        params = {
            'fingerboard_radius': 41,
            'fb_visible_height_at_nut': 4.0,
            'fb_visible_height_at_join': 6.0,
            'fingerboard_width_at_nut': 24,
            'fingerboard_width_at_end': 30
        }
        result = calculate_fingerboard_thickness(params)

        assert 'sagitta_at_nut' in result
        assert 'sagitta_at_join' in result
        assert 'fb_thickness_at_nut' in result
        assert 'fb_thickness_at_join' in result

    def test_thickness_includes_sagitta(self):
        """Thickness should equal visible height + sagitta"""
        params = {
            'fingerboard_radius': 41,
            'fb_visible_height_at_nut': 4.0,
            'fb_visible_height_at_join': 6.0,
            'fingerboard_width_at_nut': 24,
            'fingerboard_width_at_end': 30
        }
        result = calculate_fingerboard_thickness(params)

        expected_nut = 4.0 + result['sagitta_at_nut']
        expected_join = 6.0 + result['sagitta_at_join']

        assert abs(result['fb_thickness_at_nut'] - expected_nut) < 0.001
        assert abs(result['fb_thickness_at_join'] - expected_join) < 0.001

    def test_uses_defaults_for_missing_params(self):
        """Should use default values when params are missing"""
        result = calculate_fingerboard_thickness({})

        # Should not raise and should return valid values
        assert result['sagitta_at_nut'] >= 0
        assert result['fb_thickness_at_nut'] > 0


class TestCalculateStringAnglesViolin:
    """Tests for calculate_string_angles_violin function"""

    def test_returns_expected_keys(self):
        """Should return dict with expected keys"""
        params = {
            'body_stop': 195,
            'arching_height': 15,
            'bridge_height': 33,
            'overstand': 12,
            'string_height_nut': 0.6,
            'string_height_eof': 4.0,
            'fingerboard_length': 270
        }
        result = calculate_string_angles_violin(params, vsl=325, fb_thickness_at_join=7.5)

        assert 'body_stop' in result
        assert 'neck_stop' in result
        assert 'string_angle_to_ribs' in result
        assert 'string_angle_to_fb' in result
        assert 'string_angle_to_fingerboard' in result

    def test_angles_are_reasonable(self):
        """String angles should be in reasonable range"""
        params = {
            'body_stop': 195,
            'arching_height': 15,
            'bridge_height': 33,
            'overstand': 12,
            'string_height_nut': 0.6,
            'string_height_eof': 4.0,
            'fingerboard_length': 270
        }
        result = calculate_string_angles_violin(params, vsl=325, fb_thickness_at_join=7.5)

        # String angle to ribs should be a few degrees (typically 1-10 degrees)
        assert 0 < result['string_angle_to_ribs'] < 20

    def test_neck_stop_is_positive(self):
        """Neck stop should be positive"""
        params = {
            'body_stop': 195,
            'arching_height': 15,
            'bridge_height': 33,
            'overstand': 12,
            'string_height_nut': 0.6,
            'string_height_eof': 4.0,
            'fingerboard_length': 270
        }
        result = calculate_string_angles_violin(params, vsl=325, fb_thickness_at_join=7.5)

        assert result['neck_stop'] > 0


class TestCalculateStringAnglesGuitar:
    """Tests for calculate_string_angles_guitar function"""

    def test_returns_expected_keys(self):
        """Should return dict with expected keys"""
        params = {
            'fret_join': 12,
            'string_height_nut': 0.6,
            'string_height_12th_fret': 4.0,
            'arching_height': 10,
            'bridge_height': 12,
            'overstand': 6
        }
        # Create fret positions for 14 frets
        fret_positions = calculate_fret_positions(650, 14)
        fret_positions.insert(0, 0)  # Add nut position

        result = calculate_string_angles_guitar(
            params, vsl=650, fret_positions=fret_positions, fb_thickness_at_join=8.0
        )

        assert 'body_stop' in result
        assert 'neck_stop' in result
        assert 'string_angle_to_ribs' in result

    def test_calculates_body_stop(self):
        """Guitar calculation should derive body_stop from fret_join"""
        params = {
            'fret_join': 12,
            'string_height_nut': 0.6,
            'string_height_12th_fret': 4.0,
            'arching_height': 10,
            'bridge_height': 12,
            'overstand': 6
        }
        fret_positions = calculate_fret_positions(650, 14)
        fret_positions.insert(0, 0)

        result = calculate_string_angles_guitar(
            params, vsl=650, fret_positions=fret_positions, fb_thickness_at_join=8.0
        )

        # Body stop should be positive and reasonable
        assert result['body_stop'] > 0
        assert result['body_stop'] < 650  # Less than total string length


class TestCalculateNeckGeometry:
    """Tests for calculate_neck_geometry function"""

    def test_returns_expected_keys(self):
        """Should return dict with expected keys"""
        params = {
            'arching_height': 15,
            'bridge_height': 33,
            'overstand': 12,
            'string_height_nut': 0.6,
            'body_stop': 195
        }
        result = calculate_neck_geometry(
            params,
            vsl=325,
            neck_stop=130,
            string_angle_to_ribs_rad=0.05,
            string_angle_to_fb=0.5,
            fb_thickness_at_nut=5.5,
            fb_thickness_at_join=7.5
        )

        assert 'neck_angle' in result
        assert 'neck_stop' in result
        assert 'neck_angle_rad' in result
        assert 'neck_end_x' in result
        assert 'neck_end_y' in result
        assert 'string_length' in result
        assert 'nut_relative_to_ribs' in result

    def test_neck_angle_in_reasonable_range(self):
        """Neck angle should be between 80-100 degrees typically"""
        params = {
            'arching_height': 15,
            'bridge_height': 33,
            'overstand': 12,
            'string_height_nut': 0.6,
            'body_stop': 195
        }
        result = calculate_neck_geometry(
            params,
            vsl=325,
            neck_stop=130,
            string_angle_to_ribs_rad=0.05,
            string_angle_to_fb=0.5,
            fb_thickness_at_nut=5.5,
            fb_thickness_at_join=7.5
        )

        assert 70 < result['neck_angle'] < 100


class TestCalculateFingerboadGeometry:
    """Tests for calculate_fingerboard_geometry function"""

    def test_returns_expected_keys(self):
        """Should return dict with expected keys"""
        params = {'fingerboard_length': 270}
        result = calculate_fingerboard_geometry(
            params,
            neck_stop=130,
            neck_end_x=-125,
            neck_end_y=10,
            neck_line_angle=-0.1,
            fb_thickness_at_nut=5.5,
            fb_thickness_at_join=7.5
        )

        assert 'fb_direction_angle' in result
        assert 'fb_bottom_end_x' in result
        assert 'fb_bottom_end_y' in result
        assert 'fb_thickness_at_end' in result

    def test_direction_angle_is_opposite_neck(self):
        """Fingerboard direction should be opposite to neck line"""
        params = {'fingerboard_length': 270}
        neck_line_angle = -0.1
        result = calculate_fingerboard_geometry(
            params,
            neck_stop=130,
            neck_end_x=-125,
            neck_end_y=10,
            neck_line_angle=neck_line_angle,
            fb_thickness_at_nut=5.5,
            fb_thickness_at_join=7.5
        )

        expected = neck_line_angle + math.pi
        assert abs(result['fb_direction_angle'] - expected) < 0.001


class TestCalculateFretPositions:
    """Tests for calculate_fret_positions function"""

    def test_returns_correct_count(self):
        """Should return correct number of fret positions"""
        result = calculate_fret_positions(325, 7)
        assert len(result) == 7

    def test_frets_are_increasing(self):
        """Fret positions should increase from nut"""
        result = calculate_fret_positions(325, 12)
        for i in range(1, len(result)):
            assert result[i] > result[i-1]

    def test_12th_fret_is_half_length(self):
        """12th fret should be at half the string length"""
        vsl = 650
        result = calculate_fret_positions(vsl, 12)
        # 12th fret position should be vsl/2 from nut
        assert abs(result[11] - vsl/2) < 0.001

    def test_empty_for_zero_frets(self):
        """Should return empty list for zero frets"""
        result = calculate_fret_positions(325, 0)
        assert result == []

    def test_known_fret_ratios(self):
        """Verify fret positions follow equal temperament ratios"""
        vsl = 1000  # Use 1000 for easier math
        result = calculate_fret_positions(vsl, 12)

        # First fret should be at vsl - vsl/2^(1/12)
        expected_first = vsl - (vsl / (2 ** (1/12)))
        assert abs(result[0] - expected_first) < 0.001


class TestIntegration:
    """Integration tests combining multiple functions"""

    def test_full_violin_calculation_pipeline(self):
        """Test full calculation pipeline for violin parameters"""
        # Standard violin parameters
        params = {
            'vsl': 325,
            'body_stop': 195,
            'fingerboard_length': 270,
            'arching_height': 15,
            'bridge_height': 33,
            'overstand': 12,
            'string_height_nut': 0.6,
            'string_height_eof': 4.0,
            'fingerboard_radius': 41,
            'fb_visible_height_at_nut': 4.0,
            'fb_visible_height_at_join': 6.0,
            'fingerboard_width_at_nut': 24,
            'fingerboard_width_at_end': 30
        }

        # Step 1: Calculate fingerboard thickness
        fb_result = calculate_fingerboard_thickness(params)
        assert fb_result['fb_thickness_at_nut'] > params['fb_visible_height_at_nut']

        # Step 2: Calculate string angles
        string_result = calculate_string_angles_violin(
            params,
            vsl=params['vsl'],
            fb_thickness_at_join=fb_result['fb_thickness_at_join']
        )
        assert string_result['neck_stop'] > 0

        # Step 3: Calculate neck geometry
        neck_result = calculate_neck_geometry(
            params,
            vsl=params['vsl'],
            neck_stop=string_result['neck_stop'],
            string_angle_to_ribs_rad=string_result['string_angle_to_ribs_rad'],
            string_angle_to_fb=string_result['string_angle_to_fb'],
            fb_thickness_at_nut=fb_result['fb_thickness_at_nut'],
            fb_thickness_at_join=fb_result['fb_thickness_at_join']
        )
        assert 'neck_angle' in neck_result

        # Step 4: Calculate fingerboard geometry
        fb_geom_result = calculate_fingerboard_geometry(
            params,
            neck_stop=string_result['neck_stop'],
            neck_end_x=neck_result['neck_end_x'],
            neck_end_y=neck_result['neck_end_y'],
            neck_line_angle=neck_result['neck_line_angle'],
            fb_thickness_at_nut=fb_result['fb_thickness_at_nut'],
            fb_thickness_at_join=fb_result['fb_thickness_at_join']
        )
        assert 'fb_direction_angle' in fb_geom_result


class TestCalculateViolBackBreak:
    """Tests for calculate_viol_back_break function"""

    def test_returns_expected_keys(self):
        """Should return dict with expected keys"""
        params = {
            'break_angle': 15.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        assert 'back_break_length' in result
        assert 'break_start_x' in result
        assert 'break_start_y' in result
        assert 'break_end_x' in result
        assert 'break_end_y' in result
        assert 'break_angle_rad' in result

    def test_back_break_length_calculation(self):
        """Back break length should be body_length minus horizontal distance of break"""
        params = {
            'break_angle': 15.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        # remaining_drop = rib_height - top_block_height = 60
        # break_horizontal = 60 / tan(15°) ≈ 223.9
        # back_break_length = 480 - 223.9 ≈ 256.1
        remaining_drop = 100.0 - 40.0
        break_horizontal = remaining_drop / math.tan(math.radians(15.0))
        expected = 480.0 - break_horizontal

        assert abs(result['back_break_length'] - expected) < 0.1

    def test_break_start_is_at_top_block_height(self):
        """Break should start at top_block_height below belly"""
        params = {
            'break_angle': 15.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        # Break starts at x=0, y = belly_y - top_block_height
        assert result['break_start_x'] == 0
        expected_y = 3.5 - 40.0  # belly_y - top_block_height
        assert abs(result['break_start_y'] - expected_y) < 0.01

    def test_break_end_is_at_back_level(self):
        """Break should end at back level (bottom of ribs)"""
        params = {
            'break_angle': 15.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        # Break ends at y = belly_y - rib_height (back level)
        expected_y = 3.5 - 100.0
        assert abs(result['break_end_y'] - expected_y) < 0.01

    def test_zero_angle_handled(self):
        """Zero break angle should not cause division by zero"""
        params = {
            'break_angle': 0.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        # With zero angle, break_horizontal goes to body_length (clamped)
        assert result['back_break_length'] == 0  # body_length - body_length

    def test_large_angle_small_break_length(self):
        """Larger angle should result in smaller back_break_length"""
        params_small_angle = {
            'break_angle': 10.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        params_large_angle = {
            'break_angle': 30.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }

        result_small = calculate_viol_back_break(params_small_angle)
        result_large = calculate_viol_back_break(params_large_angle)

        # Larger angle = steeper break = shorter horizontal distance = longer back_break_length
        assert result_large['back_break_length'] > result_small['back_break_length']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
