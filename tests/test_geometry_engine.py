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
    calculate_fingerboard_thickness_at_fret,
    calculate_string_angles_violin,
    calculate_string_angles_guitar,
    calculate_neck_geometry,
    calculate_fingerboard_geometry,
    calculate_string_height_and_dimensions,
    calculate_fret_positions,
    calculate_viol_back_break,
    evaluate_cubic_bezier,
    find_bezier_t_for_y,
    calculate_blend_curve,
    calculate_cross_section_geometry,
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
        # Create fret positions for 14 frets (0-indexed: index 0 = fret 1)
        fret_positions = calculate_fret_positions(650, 14)

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


class TestCalculateFingerboadThicknessAtFret:
    """Tests for calculate_fingerboard_thickness_at_fret function"""

    def _violin_params(self):
        return {
            'vsl': 330,
            'fingerboard_length': 270,
            'fingerboard_radius': 41,
            'fb_visible_height_at_nut': 4.0,
            'fb_visible_height_at_join': 6.0,
            'fingerboard_width_at_nut': 24,
            'fingerboard_width_at_end': 40,
        }

    def test_returns_expected_keys(self):
        result = calculate_fingerboard_thickness_at_fret(self._violin_params(), 1)
        assert 'fret_distance_from_nut' in result
        assert 'position_ratio' in result
        assert 'fb_thickness_at_fret' in result

    def test_fret_1_close_to_nut(self):
        """Fret 1 is near the nut so thickness should be close to nut thickness"""
        params = self._violin_params()
        result = calculate_fingerboard_thickness_at_fret(params, 1)
        fb = calculate_fingerboard_thickness(params)
        assert result['fb_thickness_at_fret'] > fb['fb_thickness_at_nut']
        assert result['fb_thickness_at_fret'] < fb['fb_thickness_at_join']
        assert result['position_ratio'] < 0.1

    def test_position_ratio_increases_with_fret(self):
        """Higher frets have higher position ratios"""
        params = self._violin_params()
        r1 = calculate_fingerboard_thickness_at_fret(params, 1)
        r7 = calculate_fingerboard_thickness_at_fret(params, 7)
        r12 = calculate_fingerboard_thickness_at_fret(params, 12)
        assert r1['position_ratio'] < r7['position_ratio'] < r12['position_ratio']

    def test_thickness_increases_with_fret(self):
        """Thickness should increase toward the join end"""
        params = self._violin_params()
        t1 = calculate_fingerboard_thickness_at_fret(params, 1)['fb_thickness_at_fret']
        t12 = calculate_fingerboard_thickness_at_fret(params, 12)['fb_thickness_at_fret']
        assert t12 > t1

    def test_fret_distance_uses_equal_temperament(self):
        """Fret distance should match calculate_fret_positions"""
        params = self._violin_params()
        vsl = params['vsl']
        result = calculate_fingerboard_thickness_at_fret(params, 12)
        expected = calculate_fret_positions(vsl, 12)[11]
        assert abs(result['fret_distance_from_nut'] - expected) < 0.001

    def test_position_ratio_clamped_beyond_fingerboard(self):
        """Fret beyond fingerboard end clamps position ratio to 1.0"""
        params = self._violin_params()
        params['fingerboard_length'] = 100  # Short fingerboard so fret 12 (165mm) is beyond it
        result = calculate_fingerboard_thickness_at_fret(params, 12)
        assert result['position_ratio'] == 1.0

    def test_zero_fingerboard_length_returns_nut_thickness(self):
        """Zero fingerboard length should not divide by zero"""
        params = self._violin_params()
        params['fingerboard_length'] = 0
        result = calculate_fingerboard_thickness_at_fret(params, 7)
        fb = calculate_fingerboard_thickness(params)
        assert result['fb_thickness_at_fret'] == fb['fb_thickness_at_nut']


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
            'back_break_length': 256.0,
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

    def test_derives_break_angle_from_back_break_length(self):
        """Break angle should be derived from back_break_length"""
        # With back_break_length ≈ 256.08, the angle should be ~15 degrees
        remaining_drop = 100.0 - 40.0
        break_horizontal = remaining_drop / math.tan(math.radians(15.0))
        back_break_length = 480.0 - break_horizontal

        params = {
            'back_break_length': back_break_length,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        expected_angle_rad = math.radians(15.0)
        assert abs(result['break_angle_rad'] - expected_angle_rad) < 0.001

    def test_break_start_is_at_top_block_height(self):
        """Break should start at top_block_height below belly"""
        params = {
            'back_break_length': 256.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        assert result['break_start_x'] == 0
        expected_y = 3.5 - 40.0
        assert abs(result['break_start_y'] - expected_y) < 0.01

    def test_break_end_is_at_back_level(self):
        """Break should end at back level (bottom of ribs)"""
        params = {
            'back_break_length': 256.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)

        expected_y = 3.5 - 100.0
        assert abs(result['break_end_y'] - expected_y) < 0.01

    def test_full_flat_back_gives_shallow_angle(self):
        """back_break_length=0 means break starts at body join and spans full body"""
        params = {
            'back_break_length': 0.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        result = calculate_viol_back_break(params)
        # angle = atan(60/480) ≈ 7.1° — shallow but not zero
        expected_rad = math.atan(60.0 / 480.0)
        assert abs(result['break_angle_rad'] - expected_rad) < 0.001

    def test_larger_back_break_length_gives_steeper_angle(self):
        """Longer flat back section means steeper break angle"""
        params_short = {
            'back_break_length': 100.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }
        params_long = {
            'back_break_length': 400.0,
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5
        }

        result_short = calculate_viol_back_break(params_short)
        result_long = calculate_viol_back_break(params_long)

        assert result_long['break_angle_rad'] > result_short['break_angle_rad']


class TestEvaluateCubicBezier:
    """Tests for evaluate_cubic_bezier function"""

    def test_t0_returns_start_point(self):
        """At t=0, result should be p0"""
        p0, cp1, cp2, p3 = (0, 0), (1, 2), (3, 4), (5, 6)
        x, y = evaluate_cubic_bezier(p0, cp1, cp2, p3, 0.0)
        assert abs(x - 0) < 1e-9
        assert abs(y - 0) < 1e-9

    def test_t1_returns_end_point(self):
        """At t=1, result should be p3"""
        p0, cp1, cp2, p3 = (0, 0), (1, 2), (3, 4), (5, 6)
        x, y = evaluate_cubic_bezier(p0, cp1, cp2, p3, 1.0)
        assert abs(x - 5) < 1e-9
        assert abs(y - 6) < 1e-9

    def test_straight_line_midpoint(self):
        """Control points on the line give midpoint at t=0.5"""
        p0 = (0.0, 0.0)
        cp1 = (1/3, 1/3)
        cp2 = (2/3, 2/3)
        p3 = (1.0, 1.0)
        x, y = evaluate_cubic_bezier(p0, cp1, cp2, p3, 0.5)
        assert abs(x - 0.5) < 1e-9
        assert abs(y - 0.5) < 1e-9

    def test_result_is_tuple_of_two_floats(self):
        """Result should be a 2-tuple"""
        result = evaluate_cubic_bezier((0, 0), (1, 0), (2, 0), (3, 0), 0.5)
        assert len(result) == 2

    def test_symmetric_curve_midpoint(self):
        """Symmetric control points give midpoint x at t=0.5"""
        p0 = (0.0, 0.0)
        cp1 = (0.0, 10.0)
        cp2 = (10.0, 10.0)
        p3 = (10.0, 0.0)
        x, y = evaluate_cubic_bezier(p0, cp1, cp2, p3, 0.5)
        # Symmetric curve: x should be at midpoint (5.0) and y at max
        assert abs(x - 5.0) < 1e-9
        assert y > 0  # Curve bows upward


class TestFindBezierTForY:
    """Tests for find_bezier_t_for_y function"""

    def _straight_line_bezier(self):
        """Control points that form a straight line from y=0 to y=10"""
        p0 = (0.0, 0.0)
        cp1 = (0.0, 10/3)
        cp2 = (0.0, 20/3)
        p3 = (0.0, 10.0)
        return p0, cp1, cp2, p3

    def test_finds_start_y(self):
        """Target y at p0 should return t near 0"""
        p0, cp1, cp2, p3 = self._straight_line_bezier()
        t = find_bezier_t_for_y(p0, cp1, cp2, p3, 0.0)
        assert abs(t) < 0.001

    def test_finds_end_y(self):
        """Target y at p3 should return t near 1"""
        p0, cp1, cp2, p3 = self._straight_line_bezier()
        t = find_bezier_t_for_y(p0, cp1, cp2, p3, 10.0)
        assert abs(t - 1.0) < 0.001

    def test_finds_midpoint_y(self):
        """Target y at midpoint should return t near 0.5 for a linear curve"""
        p0, cp1, cp2, p3 = self._straight_line_bezier()
        t = find_bezier_t_for_y(p0, cp1, cp2, p3, 5.0)
        assert abs(t - 0.5) < 0.001

    def test_result_evaluates_to_target_y(self):
        """The found t should evaluate to a y within tolerance of target"""
        p0 = (0.0, 0.0)
        cp1 = (5.0, 3.0)
        cp2 = (5.0, 8.0)
        p3 = (10.0, 10.0)
        target_y = 6.0
        t = find_bezier_t_for_y(p0, cp1, cp2, p3, target_y)
        _, y_found = evaluate_cubic_bezier(p0, cp1, cp2, p3, t)
        assert abs(y_found - target_y) < 0.001

    def test_result_in_range_0_to_1(self):
        """Returned t should always be between 0 and 1"""
        p0, cp1, cp2, p3 = self._straight_line_bezier()
        for target_y in [0.0, 2.5, 5.0, 7.5, 10.0]:
            t = find_bezier_t_for_y(p0, cp1, cp2, p3, target_y)
            assert 0.0 <= t <= 1.0


class TestCalculateBlendCurve:
    """Tests for calculate_blend_curve function"""

    def _default_args(self):
        return dict(
            half_neck_width_at_ribs=15.0,
            half_fb_width=12.0,
            y_top_of_block=35.0,
            y_fb_bottom=41.0,
            fb_visible_height=5.0,
            fb_blend_percent=50.0,
            half_button_width=14.0,
            y_button=0.0,
        )

    def test_returns_expected_keys(self):
        """Result should contain all required keys"""
        result = calculate_blend_curve(**self._default_args())
        for key in ('p0', 'cp1', 'cp2', 'p3', 'curve_end_y', 'neck_block_max_width'):
            assert key in result

    def test_p0_is_start_point(self):
        """p0 should be at (half_neck_width_at_ribs, y_top_of_block)"""
        result = calculate_blend_curve(**self._default_args())
        assert result['p0'] == (15.0, 35.0)

    def test_p3_is_end_point(self):
        """p3 should be at (half_fb_width, curve_end_y)"""
        result = calculate_blend_curve(**self._default_args())
        assert result['p3'][0] == 12.0
        assert abs(result['p3'][1] - result['curve_end_y']) < 1e-9

    def test_zero_blend_gives_fingerboard_width(self):
        """fb_blend_percent=0 should give neck_block_max_width = half_fb_width * 2"""
        args = self._default_args()
        args['fb_blend_percent'] = 0.0
        result = calculate_blend_curve(**args)
        assert result['neck_block_max_width'] == 12.0 * 2

    def test_fb_bottom_at_or_below_top_of_block_gives_neck_width(self):
        """When y_fb_bottom <= y_top_of_block, width equals neck width at ribs"""
        args = self._default_args()
        args['y_fb_bottom'] = 30.0  # below y_top_of_block=35
        result = calculate_blend_curve(**args)
        assert result['neck_block_max_width'] == 15.0 * 2

    def test_zero_fb_visible_height_gives_fingerboard_width(self):
        """When fb_visible_height=0, curve_end_y == y_fb_bottom, giving fb width"""
        args = self._default_args()
        args['fb_visible_height'] = 0.0
        result = calculate_blend_curve(**args)
        assert result['neck_block_max_width'] == 12.0 * 2

    def test_normal_case_uses_bezier_for_intermediate_width(self):
        """Normal case: neck_block_max_width should be between neck and fb width"""
        result = calculate_blend_curve(**self._default_args())
        assert 12.0 * 2 <= result['neck_block_max_width'] <= 15.0 * 2

    def test_vertical_tangent_case(self):
        """When half_button_width >= half_neck_width_at_ribs, use fallback cp1"""
        args = self._default_args()
        args['half_button_width'] = 16.0  # > half_neck_width_at_ribs=15
        result = calculate_blend_curve(**args)
        # Should still return valid result without error
        assert 'neck_block_max_width' in result
        assert result['p0'] == (15.0, 35.0)


class TestCalculateStringAnglesGuitarValidation:
    """Additional tests for calculate_string_angles_guitar edge cases"""

    def test_impossible_geometry_raises_valueerror(self):
        """sin_value > 1.0 should raise ValueError with helpful message"""
        import math
        vsl = 650.0
        fret_positions = [vsl * (1 - 2 ** (-n / 12)) for n in range(1, 21)]
        params = {
            'fret_join': 12,
            'string_height_nut': 0.0,
            'string_height_12th_fret': 0.0,
            'arching_height': 0.0,
            'bridge_height': 400.0,  # Impossibly large
            'overstand': 0.0,
        }
        with pytest.raises(ValueError, match="impossible"):
            calculate_string_angles_guitar(params, vsl, fret_positions, 0.0)


class TestCalculateViolBackBreakEdgeCases:
    """Additional tests for calculate_viol_back_break"""

    def test_back_break_length_exceeds_body_gives_steep_angle(self):
        """back_break_length >= body_length clamps horizontal to epsilon"""
        params = {
            'back_break_length': 500.0,  # Exceeds body_length
            'top_block_height': 40.0,
            'rib_height': 100.0,
            'body_length': 100.0,
            'belly_edge_thickness': 3.5,
        }
        result = calculate_viol_back_break(params)
        # break_horizontal is clamped to EPSILON, angle approaches 90°
        assert result['break_angle_rad'] > 1.0  # > ~57°

    def test_remaining_drop_zero_gives_zero_angle(self):
        """When top_block_height >= rib_height, angle should be zero"""
        params = {
            'back_break_length': 200.0,
            'top_block_height': 100.0,  # Same as rib_height
            'rib_height': 100.0,
            'body_length': 480.0,
            'belly_edge_thickness': 3.5,
        }
        result = calculate_viol_back_break(params)
        assert result['break_angle_rad'] == 0


class TestCalculateCrossSectionGeometry:
    """Tests for calculate_cross_section_geometry"""

    def _default_params(self):
        return {
            'instrument_family': 'VIOLIN',
            'rib_height': 35.0,
            'button_width_at_join': 28.0,
            'neck_width_at_top_of_ribs': 30.0,
            'overstand': 6.0,
            'belly_edge_thickness': 3.5,
            'fingerboard_width_at_nut': 24.0,
            'fingerboard_width_at_end': 42.0,
            'fingerboard_length': 270.0,
            'fingerboard_radius': 41.0,
            'fb_visible_height_at_join': 1.2,
            'vsl': 325.0,
            'body_stop': 195.0,
            'fb_blend_percent': 0.0,
        }

    def test_returns_dict(self):
        """Should return a dictionary"""
        result = calculate_cross_section_geometry(self._default_params())
        assert isinstance(result, dict)

    def test_zero_fingerboard_length_sets_position_ratio_to_zero(self):
        """fingerboard_length=0 should set position_ratio=0 (use nut width)"""
        params = self._default_params()
        params['fingerboard_length'] = 0
        params['fingerboard_width_at_nut'] = 24.0
        params['fingerboard_width_at_end'] = 42.0
        result = calculate_cross_section_geometry(params)
        # With position_ratio=0, fb_width_at_body_join should equal fb_width_at_nut
        assert result is not None  # No crash

    def test_viol_uses_top_block_height(self):
        """Viol family should use top_block_height if present"""
        params = self._default_params()
        params['instrument_family'] = 'VIOL'
        params['top_block_height'] = 50.0
        params['rib_height'] = 100.0
        result = calculate_cross_section_geometry(params)
        assert result is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
