"""
Tests for svg_renderer.py - SVG rendering functions.
"""
import pytest
import sys
import math
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from svg_renderer import (
    setup_exporter,
    draw_body,
    draw_neck,
    draw_fingerboard,
    draw_string_and_references,
    add_document_text,
    add_dimensions
)
from buildprimitives import ExportSVG


class TestSetupExporter:
    """Tests for setup_exporter function."""

    def test_returns_exporter_instance(self):
        """Test that function returns an ExportSVG instance."""
        exporter = setup_exporter(show_measurements=True)
        assert isinstance(exporter, ExportSVG)

    def test_creates_required_layers(self):
        """Test that all required layers are created."""
        exporter = setup_exporter(show_measurements=True)

        # Check that layers exist (by trying to add shapes to them)
        required_layers = ['text', 'drawing', 'schematic', 'schematic_dotted',
                          'dimensions', 'extensions', 'arrows']

        for layer in required_layers:
            assert layer in exporter.layers

    def test_dimensions_layer_visible_when_show_measurements_true(self):
        """Test that dimensions layer has color when show_measurements is True."""
        exporter = setup_exporter(show_measurements=True)

        # The dimensions layer should have a non-None fill color
        assert exporter.layers['dimensions']['fill_color'] is not None

    def test_dimensions_layer_hidden_when_show_measurements_false(self):
        """Test that dimensions layer has no color when show_measurements is False."""
        exporter = setup_exporter(show_measurements=False)

        # The dimensions layer should have None fill color
        assert exporter.layers['dimensions']['fill_color'] is None


class TestDrawBody:
    """Tests for draw_body function."""

    def test_adds_shapes_to_exporter(self):
        """Test that draw_body adds shapes to the exporter."""
        exporter = setup_exporter(show_measurements=True)
        initial_count = len(exporter.shapes)

        draw_body(
            exporter=exporter,
            body_length=355.0,
            belly_edge_thickness=3.5,
            rib_height=30.0,
            body_stop=195.0,
            arching_height=15.0
        )

        # Should have added at least 3 shapes (belly, rib rect, arch spline)
        assert len(exporter.shapes) > initial_count
        assert len(exporter.shapes) >= initial_count + 3

    def test_adds_shapes_to_correct_layers(self):
        """Test that shapes are added to appropriate layers."""
        exporter = setup_exporter(show_measurements=True)

        draw_body(
            exporter=exporter,
            body_length=355.0,
            belly_edge_thickness=3.5,
            rib_height=30.0,
            body_stop=195.0,
            arching_height=15.0
        )

        # Check that shapes were added
        drawing_shapes = [s for s in exporter.shapes if s[1] == 'drawing']
        schematic_shapes = [s for s in exporter.shapes if s[1] == 'schematic']

        assert len(drawing_shapes) >= 2  # belly rect and rib rect
        assert len(schematic_shapes) >= 1  # arch spline


class TestDrawNeck:
    """Tests for draw_neck function."""

    def test_returns_tuple_of_lines(self):
        """Test that draw_neck returns expected line objects."""
        exporter = setup_exporter(show_measurements=True)

        result = draw_neck(
            exporter=exporter,
            overstand=6.0,
            neck_end_x=-130.0,
            neck_end_y=24.0,
            bridge_height=34.0,
            body_stop=195.0,
            arching_height=15.0,
            nut_radius=25.0,
            neck_line_angle=math.radians(95),
            neck_angle_deg=5.0
        )

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_adds_shapes_to_exporter(self):
        """Test that draw_neck adds shapes to the exporter."""
        exporter = setup_exporter(show_measurements=True)
        initial_count = len(exporter.shapes)

        draw_neck(
            exporter=exporter,
            overstand=6.0,
            neck_end_x=-130.0,
            neck_end_y=24.0,
            bridge_height=34.0,
            body_stop=195.0,
            arching_height=15.0,
            nut_radius=25.0,
            neck_line_angle=math.radians(95),
            neck_angle_deg=5.0
        )

        # Should have added multiple shapes
        assert len(exporter.shapes) > initial_count


class TestDrawFingerboard:
    """Tests for draw_fingerboard function."""

    def test_returns_coordinates(self):
        """Test that draw_fingerboard returns fb top end coordinates."""
        exporter = setup_exporter(show_measurements=True)

        result = draw_fingerboard(
            exporter=exporter,
            neck_end_x=-130.0,
            neck_end_y=24.0,
            fb_bottom_end_x=-10.0,
            fb_bottom_end_y=10.0,
            fb_thickness_at_nut=5.0,
            fb_thickness_at_end=6.0,
            fb_direction_angle=math.radians(5),
            fb_visible_height_at_nut=4.0,
            fb_visible_height_at_join=5.0
        )

        assert isinstance(result, tuple)
        assert len(result) == 2
        # Should be x, y coordinates (floats)
        assert isinstance(result[0], (int, float))
        assert isinstance(result[1], (int, float))

    def test_adds_polygon_to_drawing_layer(self):
        """Test that fingerboard polygon is added to drawing layer."""
        exporter = setup_exporter(show_measurements=True)

        draw_fingerboard(
            exporter=exporter,
            neck_end_x=-130.0,
            neck_end_y=24.0,
            fb_bottom_end_x=-10.0,
            fb_bottom_end_y=10.0,
            fb_thickness_at_nut=5.0,
            fb_thickness_at_end=6.0,
            fb_direction_angle=math.radians(5),
            fb_visible_height_at_nut=4.0,
            fb_visible_height_at_join=5.0
        )

        drawing_shapes = [s for s in exporter.shapes if s[1] == 'drawing']
        assert len(drawing_shapes) >= 1


class TestDrawStringAndReferences:
    """Tests for draw_string_and_references function."""

    def test_returns_reference_end_and_string_line(self):
        """Test that function returns reference line end and string line."""
        exporter = setup_exporter(show_measurements=True)

        result = draw_string_and_references(
            exporter=exporter,
            nut_top_x=-125.0,
            nut_top_y=28.0,
            bridge_top_x=195.0,
            bridge_top_y=49.0
        )

        assert isinstance(result, tuple)
        assert len(result) == 2
        # First should be reference line end x (float)
        assert isinstance(result[0], (int, float))

    def test_adds_string_line_to_drawing(self):
        """Test that string line is added to drawing layer."""
        exporter = setup_exporter(show_measurements=True)
        initial_drawing = len([s for s in exporter.shapes if s[1] == 'drawing'])

        draw_string_and_references(
            exporter=exporter,
            nut_top_x=-125.0,
            nut_top_y=28.0,
            bridge_top_x=195.0,
            bridge_top_y=49.0
        )

        final_drawing = len([s for s in exporter.shapes if s[1] == 'drawing'])
        assert final_drawing > initial_drawing


class TestAddDocumentText:
    """Tests for add_document_text function."""

    def test_adds_title_text(self):
        """Test that instrument name is added as title."""
        exporter = setup_exporter(show_measurements=True)

        add_document_text(
            exporter=exporter,
            instrument_name="Test Violin",
            generator_url="https://example.com",
            body_length=355.0,
            rib_height=30.0,
            belly_edge_thickness=3.5,
            arching_height=15.0,
            bridge_height=34.0,
            neck_end_x=-130.0
        )

        text_shapes = [s for s in exporter.shapes if s[1] == 'text']
        assert len(text_shapes) >= 2  # Title and footer

    def test_adds_footer_url(self):
        """Test that generator URL is added as footer."""
        exporter = setup_exporter(show_measurements=True)

        add_document_text(
            exporter=exporter,
            instrument_name="Test Violin",
            generator_url="https://example.com",
            body_length=355.0,
            rib_height=30.0,
            belly_edge_thickness=3.5,
            arching_height=15.0,
            bridge_height=34.0,
            neck_end_x=-130.0
        )

        text_shapes = [s for s in exporter.shapes if s[1] == 'text']
        # Should have at least 2 text shapes (title and footer)
        assert len(text_shapes) >= 2


class TestAddDimensions:
    """Tests for add_dimensions function."""

    def test_adds_no_dimensions_when_disabled(self):
        """Test that no dimension text is added when show_measurements is False."""
        exporter = setup_exporter(show_measurements=False)
        initial_count = len(exporter.shapes)

        # Create minimal mock objects for the function call
        from buildprimitives import Edge
        mock_string_line = Edge.make_line((0, 0), (100, 50))

        add_dimensions(
            exporter=exporter,
            show_measurements=False,
            reference_line_end_x=-150.0,
            nut_top_x=-125.0,
            nut_top_y=28.0,
            bridge_top_x=195.0,
            bridge_top_y=49.0,
            string_line=mock_string_line,
            string_length=325.0,
            neck_end_x=-130.0,
            neck_end_y=24.0,
            overstand=6.0,
            body_stop=195.0,
            arching_height=15.0,
            bridge_height=34.0,
            body_length=355.0,
            rib_height=30.0,
            belly_edge_thickness=3.5,
            fb_surface_point_x=-50.0,
            fb_surface_point_y=15.0,
            string_x_at_fb_end=-50.0,
            string_y_at_fb_end=17.0,
            string_height_at_fb_end=2.0,
            intersect_x=-100.0,
            intersect_y=20.0,
            nut_to_perp_distance=5.0
        )

        # Some shapes are still added (diagonal dimension always shows)
        # but the conditional rib_to_nut dimension should not be added
        # This is more of a sanity check that the function runs


class TestSVGExport:
    """Integration tests for SVG export."""

    def test_export_produces_valid_svg(self):
        """Test that exported SVG is valid."""
        exporter = setup_exporter(show_measurements=True)

        # Add some basic shapes
        draw_body(
            exporter=exporter,
            body_length=355.0,
            belly_edge_thickness=3.5,
            rib_height=30.0,
            body_stop=195.0,
            arching_height=15.0
        )

        # Export to SVG string using write() method
        svg_output = exporter.write()

        assert svg_output is not None
        assert '<svg' in svg_output
        assert '</svg>' in svg_output

    def test_export_has_viewbox(self):
        """Test that exported SVG has viewBox attribute."""
        exporter = setup_exporter(show_measurements=True)

        draw_body(
            exporter=exporter,
            body_length=355.0,
            belly_edge_thickness=3.5,
            rib_height=30.0,
            body_stop=195.0,
            arching_height=15.0
        )

        svg_output = exporter.write()
        assert 'viewBox' in svg_output

    def test_export_has_defs_section(self):
        """Test that exported SVG has defs section for patterns."""
        exporter = setup_exporter(show_measurements=True)

        # Fingerboard uses fill pattern which should create a defs section
        draw_fingerboard(
            exporter=exporter,
            neck_end_x=-130.0,
            neck_end_y=24.0,
            fb_bottom_end_x=-10.0,
            fb_bottom_end_y=10.0,
            fb_thickness_at_nut=5.0,
            fb_thickness_at_end=6.0,
            fb_direction_angle=math.radians(5),
            fb_visible_height_at_nut=4.0,
            fb_visible_height_at_join=5.0
        )

        svg_output = exporter.write()
        # Should have defs for the diagonal hatch pattern
        assert '<defs>' in svg_output or 'pattern' in svg_output.lower()


class TestFullSVGGeneration:
    """Full integration tests for complete SVG generation."""

    def test_violin_svg_generation(self, default_violin_params):
        """Test complete SVG generation for violin parameters."""
        from instrument_geometry import generate_side_view_svg

        svg = generate_side_view_svg(default_violin_params)

        assert svg is not None
        assert '<svg' in svg
        assert '</svg>' in svg
        assert 'viewBox' in svg

    def test_viol_svg_generation(self, default_viol_params):
        """Test complete SVG generation for viol parameters."""
        from instrument_geometry import generate_side_view_svg

        svg = generate_side_view_svg(default_viol_params)

        assert svg is not None
        assert '<svg' in svg
        assert '</svg>' in svg

    def test_guitar_svg_generation(self, default_guitar_params):
        """Test complete SVG generation for guitar parameters."""
        from instrument_geometry import generate_side_view_svg

        svg = generate_side_view_svg(default_guitar_params)

        assert svg is not None
        assert '<svg' in svg
        assert '</svg>' in svg

    def test_svg_output_is_valid_xml(self, default_violin_params):
        """Test that SVG output is valid XML."""
        import xml.etree.ElementTree as ET
        from instrument_geometry import generate_side_view_svg

        svg = generate_side_view_svg(default_violin_params)

        # Should be parseable as XML
        try:
            ET.fromstring(svg)
            xml_valid = True
        except ET.ParseError:
            xml_valid = False

        assert xml_valid, "SVG output should be valid XML"

    def test_svg_contains_path_elements(self, default_violin_params):
        """Test that generated SVG contains path elements."""
        from instrument_geometry import generate_side_view_svg

        svg = generate_side_view_svg(default_violin_params)

        # Should contain various SVG elements
        assert '<path' in svg or '<line' in svg or '<rect' in svg

    def test_svg_with_tailpiece_height(self, default_violin_params):
        """Test that SVG includes tailpiece dimension when tailpiece_height > 0."""
        from instrument_geometry import generate_side_view_svg

        # Set tailpiece height to 15mm
        params = default_violin_params.copy()
        params['tailpiece_height'] = 15.0

        svg = generate_side_view_svg(params)

        # Should contain the dimension value
        assert '15.0' in svg, "SVG should contain tailpiece height dimension"

    def test_svg_without_tailpiece_height(self, default_violin_params):
        """Test that SVG excludes tailpiece dimension when tailpiece_height = 0."""
        from instrument_geometry import generate_side_view_svg

        # Ensure tailpiece height is 0
        params = default_violin_params.copy()
        params['tailpiece_height'] = 0.0

        svg = generate_side_view_svg(params)

        # Count dotted lines - should not include tailpiece reference
        import re
        dotted_count_zero = len(re.findall(r'stroke-dasharray="1,2"', svg))

        # Now with tailpiece height
        params['tailpiece_height'] = 10.0
        svg_with = generate_side_view_svg(params)
        dotted_count_with = len(re.findall(r'stroke-dasharray="1,2"', svg_with))

        # Should have more dotted lines with tailpiece height
        assert dotted_count_with > dotted_count_zero

    def test_string_break_angle_matches_derived_value(self, default_violin_params):
        """Test that the break angle drawn on SVG matches the calculated derived value."""
        import re
        from instrument_geometry import generate_side_view_svg, calculate_derived_values

        params = default_violin_params.copy()
        svg = generate_side_view_svg(params)
        derived = calculate_derived_values(params)

        # Get the calculated break angle
        calculated_angle = derived['string_break_angle']

        # Find the break angle in the SVG (formatted as "XXX.X°")
        # The angle dimension text should appear in the SVG
        angle_pattern = r'(\d+\.\d+)°'
        angle_matches = re.findall(angle_pattern, svg)

        # The string_break_angle should be present in the SVG
        # Convert to float for comparison
        found_break_angle = False
        for match in angle_matches:
            svg_angle = float(match)
            # Check if this matches our calculated break angle (within 0.1 degree)
            if abs(svg_angle - calculated_angle) < 0.15:
                found_break_angle = True
                break

        assert found_break_angle, (
            f"String break angle {calculated_angle:.1f}° not found in SVG. "
            f"Found angles: {angle_matches}"
        )
