import pytest
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from instrument_geometry import calculate_derived_values
from parameter_registry import get_default_values, InstrumentFamily


def test_calculate_derived_values_violin():
    """Test basic derived value calculation for violin"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'neck_stop' in result
    assert 'body_stop' in result
    assert result['neck_stop'] > 0
    assert result['body_stop'] > 0


def test_viol_derived_values():
    """Test basic derived value calculation for viol"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOL.name
    params['no_frets'] = 7
    result = calculate_derived_values(params)

    # Check that basic geometric values are calculated
    assert 'neck_stop' in result
    assert 'body_stop' in result
    assert result['neck_stop'] > 0
    assert result['body_stop'] > 0


def test_string_angle_calculation():
    """Test string angle calculations are in valid range"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'string_angle_to_ribs' in result
    assert 'string_angle_to_fingerboard' in result
    # String angles should be reasonable (between 0 and 90 degrees)
    assert 0 < result['string_angle_to_ribs'] < 90
    assert 0 < result['string_angle_to_fingerboard'] < 90


def test_neck_line_angle_calculation():
    """Test neck line angle is calculated and in valid range"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'neck_line_angle' in result
    # Neck line angle should be reasonable (typically -10 to +10 degrees)
    assert -10 < result['neck_line_angle'] < 10


def test_fingerboard_thickness():
    """Test fingerboard thickness calculations"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'fb_thickness_at_nut' in result
    assert 'fb_thickness_at_end' in result
    # Thickness values should be positive
    assert result['fb_thickness_at_nut'] > 0
    assert result['fb_thickness_at_end'] > 0
    # End thickness should be greater than nut thickness
    assert result['fb_thickness_at_end'] > result['fb_thickness_at_nut']
