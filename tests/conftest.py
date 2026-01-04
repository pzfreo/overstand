"""
Shared pytest fixtures for all tests.
"""
import pytest
import sys
import json
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))


@pytest.fixture
def default_violin_params():
    """Return default parameter values for a violin."""
    from parameter_registry import get_default_values, InstrumentFamily
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOLIN.name
    return params


@pytest.fixture
def default_viol_params():
    """Return default parameter values for a viol."""
    from parameter_registry import get_default_values, InstrumentFamily
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.VIOL.name
    params['no_frets'] = 7
    return params


@pytest.fixture
def default_guitar_params():
    """Return default parameter values for a guitar."""
    from parameter_registry import get_default_values, InstrumentFamily
    params = get_default_values()
    params['instrument_family'] = InstrumentFamily.GUITAR_MANDOLIN.name
    params['fret_join'] = 12  # Guitar joins at 12th fret
    params['no_frets'] = 19   # Standard guitar frets
    params['string_height_12th_fret'] = 2.5  # Action at 12th fret
    return params


@pytest.fixture
def sample_preset_json(default_violin_params):
    """Return a sample preset JSON structure with complete parameters."""
    params = default_violin_params.copy()
    params['instrument_name'] = 'Test Violin'
    return {
        "metadata": {
            "version": "1.0",
            "timestamp": "2025-01-01T00:00:00.000Z",
            "description": "Test Violin",
            "generator": "Test"
        },
        "parameters": params
    }


@pytest.fixture
def sample_preset_path(tmp_path, sample_preset_json):
    """Create a temporary preset file and return its path."""
    preset_file = tmp_path / "test_preset.json"
    preset_file.write_text(json.dumps(sample_preset_json))
    return preset_file


@pytest.fixture
def simple_params_json(default_violin_params):
    """Return simple parameters without metadata wrapper."""
    params = default_violin_params.copy()
    params['instrument_name'] = 'Simple Test'
    return params


@pytest.fixture
def simple_params_path(tmp_path, simple_params_json):
    """Create a temporary simple params file and return its path."""
    params_file = tmp_path / "simple_params.json"
    params_file.write_text(json.dumps(simple_params_json))
    return params_file


@pytest.fixture
def invalid_json_path(tmp_path):
    """Create a file with invalid JSON and return its path."""
    invalid_file = tmp_path / "invalid.json"
    invalid_file.write_text("{ this is not valid json }")
    return invalid_file


@pytest.fixture
def cli_path():
    """Return the path to the CLI script."""
    return Path(__file__).parent.parent / 'src' / 'instrument-gen-cli'


@pytest.fixture
def presets_dir():
    """Return the path to the presets directory."""
    return Path(__file__).parent.parent / 'presets'


def has_cairo_deps():
    """Check if Cairo dependencies are available for PDF generation."""
    try:
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPDF
        return True
    except ImportError:
        return False


# Marker for tests that require Cairo
requires_cairo = pytest.mark.skipif(
    not has_cairo_deps(),
    reason="Requires Cairo dependencies (svglib, reportlab)"
)
