import pytest
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from instrument_geometry import calculate_derived_values
from instrument_parameters import get_default_values, InstrumentFamily


def test_calculate_derived_values_violin():
    """Test basic derived value calculation for violin"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'neck_stop' in result
    assert 'body_stop' in result
    assert result['neck_stop'] > 0
    assert result['body_stop'] > 0


def test_fret_positions_viol():
    """Test fret position calculation for viol"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOL.name
    params['no_frets'] = 7
    result = calculate_derived_values(params)

    assert 'fret_positions' in result
    assert len(result['fret_positions']) == 7
    # Fret positions should be increasing
    for i in range(1, len(result['fret_positions'])):
        assert result['fret_positions'][i] > result['fret_positions'][i-1]


def test_string_angle_calculation():
    """Test string angle calculations are in valid range"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'String Angle to Ribs' in result
    assert 'String Angle to Fingerboard' in result
    # String angles should be reasonable (between 0 and 90 degrees)
    assert 0 < result['String Angle to Ribs'] < 90
    assert 0 < result['String Angle to Fingerboard'] < 90


def test_neck_angle_calculation():
    """Test neck angle is calculated and in valid range"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'Neck Angle' in result
    # Neck angle should be reasonable (typically 0-10 degrees)
    assert -10 < result['Neck Angle'] < 15


def test_fingerboard_dimensions():
    """Test fingerboard width calculations"""
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    result = calculate_derived_values(params)

    assert 'Fingerboard Width at Nut' in result
    assert 'Fingerboard Width at End' in result
    # End should be wider than nut
    assert result['Fingerboard Width at End'] > result['Fingerboard Width at Nut']
