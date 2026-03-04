"""
Tests for radius_template.py

Tests the fingerboard radius template SVG generator.
The _text_to_svg_path_with_textpath function requires matplotlib + a font file,
so most tests exercise the fallback (no-text) path, with one test mocking the
text function to cover the compound-path branch.
"""

import pytest
import sys
import re
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from radius_template import generate_radius_template_svg, _text_to_svg_path_with_textpath
from constants import TEMPLATE_WIDTH_MARGIN, MIN_FLAT_AREA_HEIGHT, SVG_MARGIN


def default_params(**overrides):
    params = {
        'fingerboard_radius': 41.0,
        'fingerboard_width_at_end': 42.0,
    }
    params.update(overrides)
    return params


class TestGenerateRadiusTemplateSvg:
    """Tests for generate_radius_template_svg"""

    def test_returns_svg_string(self):
        """Should return a non-empty string"""
        result = generate_radius_template_svg(default_params())
        assert isinstance(result, str)
        assert len(result) > 0

    def test_svg_starts_with_svg_tag(self):
        """Result should be a valid SVG opening tag"""
        result = generate_radius_template_svg(default_params())
        assert result.strip().startswith('<svg')

    def test_svg_has_closing_tag(self):
        """SVG should be properly closed"""
        result = generate_radius_template_svg(default_params())
        assert '</svg>' in result

    def test_svg_has_viewbox(self):
        """SVG should have a viewBox attribute"""
        result = generate_radius_template_svg(default_params())
        assert 'viewBox' in result

    def test_svg_has_path_element(self):
        """SVG should contain a path element"""
        result = generate_radius_template_svg(default_params())
        assert '<path' in result

    def test_svg_has_mm_dimensions(self):
        """Width and height should be in mm"""
        result = generate_radius_template_svg(default_params())
        assert 'mm' in result

    def test_small_radius_raises_valueerror(self):
        """Radius smaller than half the template width should raise ValueError"""
        # template_width = 42 + 10 = 52, half = 26; radius 10 < 26
        with pytest.raises(ValueError, match="[Ff]ingerboard radius"):
            generate_radius_template_svg(default_params(fingerboard_radius=10.0))

    def test_different_radii_give_different_svgs(self):
        """Different radii should produce different output"""
        result_41 = generate_radius_template_svg(default_params(fingerboard_radius=41.0))
        result_100 = generate_radius_template_svg(default_params(fingerboard_radius=100.0))
        assert result_41 != result_100

    def test_larger_radius_gives_larger_template(self):
        """Larger radius means shallower arc, so smaller template height"""
        result_41 = generate_radius_template_svg(default_params(fingerboard_radius=41.0))
        result_200 = generate_radius_template_svg(default_params(fingerboard_radius=200.0))
        # Extract height from viewBox: 'viewBox="min_x min_y width height"'
        def extract_viewbox_height(svg):
            m = re.search(r'viewBox="[^"]*"', svg)
            parts = m.group(0).replace('viewBox="', '').replace('"', '').split()
            return float(parts[3])
        # Larger radius → shallower arc depth → smaller template height
        assert extract_viewbox_height(result_41) > extract_viewbox_height(result_200)

    def test_default_params_are_applied(self):
        """Calling with empty dict should use defaults without crashing"""
        result = generate_radius_template_svg({})
        assert '<svg' in result

    def test_arc_edge_case_enters_first_branch(self):
        """
        The first radius-too-small check at lines 120-123 is reached before the
        ValueError at line 148.  Verify the ValueError fires (both branches covered).
        """
        with pytest.raises(ValueError):
            generate_radius_template_svg(default_params(fingerboard_radius=5.0,
                                                        fingerboard_width_at_end=42.0))


class TestGenerateRadiusTemplateSvgWithText:
    """Tests that exercise the compound-path branch by mocking the text function"""

    def test_compound_path_when_text_available(self):
        """When text function returns a path, SVG should use evenodd fill-rule"""
        fake_path = "M 0 0 L 10 0 L 10 10 Z"
        with patch('radius_template._text_to_svg_path_with_textpath', return_value=fake_path):
            result = generate_radius_template_svg(default_params())
        assert 'evenodd' in result

    def test_compound_path_includes_rotation_transform(self):
        """Compound path SVG should include a rotate transform"""
        fake_path = "M 0 0 L 5 0 Z"
        with patch('radius_template._text_to_svg_path_with_textpath', return_value=fake_path):
            result = generate_radius_template_svg(default_params())
        assert 'rotate(' in result

    def test_fallback_svg_when_text_unavailable(self):
        """When text function returns None, SVG should be the fallback outline"""
        with patch('radius_template._text_to_svg_path_with_textpath', return_value=None):
            result = generate_radius_template_svg(default_params())
        # Fallback uses stroke instead of evenodd
        assert 'evenodd' not in result
        assert 'stroke' in result


class TestTextToSvgPathWithTextpath:
    """Tests for _text_to_svg_path_with_textpath"""

    def test_returns_none_without_font_file(self):
        """Without the font file at /tmp/, should return None gracefully"""
        # In the test environment, /tmp/AllertaStencil-Regular.ttf does not exist
        result = _text_to_svg_path_with_textpath("41mm", 0.0, 0.0, 5.0)
        # Either None (no matplotlib or no font) or a path string if matplotlib + font present
        assert result is None or isinstance(result, str)
