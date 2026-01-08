"""
Overstand - SVG Renderer

This module handles the conversion of geometric models into SVG elements.
"""

from buildprimitives import *
from buildprimitives import FONT_NAME, TITLE_FONT_SIZE, FOOTER_FONT_SIZE
from dimension_helpers import (
    create_dimension_arrows,
    create_vertical_dimension,
    create_horizontal_dimension,
    create_diagonal_dimension,
    create_angle_dimension,
    DIMENSION_FONT_SIZE
)
import math
from typing import Tuple

def setup_exporter(show_measurements: bool) -> ExportSVG:
    """Create and configure SVG exporter with all necessary layers."""
    exporter = ExportSVG(scale=1.0, unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("text", fill_color=(0,0,255), line_type=LineType.HIDDEN)
    exporter.add_layer("drawing", fill_color=None, line_color=(0,0,0), line_type=LineType.CONTINUOUS)
    exporter.add_layer("schematic", fill_color=None, line_color=(0,0,0), line_type=LineType.DASHED)
    exporter.add_layer("schematic_dotted", fill_color=None, line_color=(100,100,100), line_type=LineType.DOTTED)

    dim_color = (255,0,0) if show_measurements else None
    exporter.add_layer("dimensions", fill_color=dim_color, line_color=dim_color, line_type=LineType.DASHED)
    exporter.add_layer("extensions", fill_color=None, line_color=dim_color, line_type=LineType.CONTINUOUS)
    exporter.add_layer("arrows", fill_color=dim_color, line_color=dim_color, line_type=LineType.CONTINUOUS)

    return exporter

def draw_body(exporter: ExportSVG, body_length: float, belly_edge_thickness: float,
             rib_height: float, body_stop: float, arching_height: float) -> None:
    """Draw body geometry."""
    belly_rect = Rectangle(width=body_length, height=belly_edge_thickness)
    belly_rect = belly_rect.move(Location((body_length/2, belly_edge_thickness/2)))
    exporter.add_shape(belly_rect, layer="drawing")

    rect = Rectangle(width=body_length, height=rib_height)
    rect = rect.move(Location((body_length/2, belly_edge_thickness - rib_height/2)))
    exporter.add_shape(rect, layer="drawing")

    arch_spline = Spline.interpolate_three_points(
        (0, belly_edge_thickness),
        (body_stop, arching_height),
        (body_length, belly_edge_thickness)
    )
    exporter.add_shape(arch_spline, layer="schematic")

def draw_neck(exporter: ExportSVG, overstand: float, neck_end_x: float, neck_end_y: float,
             bridge_height: float, body_stop: float, arching_height: float,
             nut_radius: float, neck_line_angle: float, neck_angle_deg: float) -> Tuple:
    """Draw neck structure."""
    bridge_line = Edge.make_line((body_stop, arching_height), (body_stop, arching_height + bridge_height))
    exporter.add_shape(bridge_line, layer="drawing")

    neck_vertical_line = Edge.make_line((0, 0), (0, overstand))
    exporter.add_shape(neck_vertical_line, layer="drawing")

    neck_angled_line = Edge.make_line((0, overstand), (neck_end_x, neck_end_y))
    exporter.add_shape(neck_angled_line, layer="drawing")

    start_angle = neck_line_angle - math.pi/2
    end_angle = start_angle + math.pi/2

    nut_arc = Arc.make_arc(
        center=(neck_end_x, neck_end_y),
        radius=nut_radius,
        start_angle=start_angle,
        end_angle=end_angle
    )
    exporter.add_shape(nut_arc, layer="schematic_dotted")

    arc_start_x = neck_end_x + nut_radius * math.cos(start_angle)
    arc_start_y = neck_end_y + nut_radius * math.sin(start_angle)
    arc_end_x = neck_end_x + nut_radius * math.cos(end_angle)
    arc_end_y = neck_end_y + nut_radius * math.sin(end_angle)

    radius_line_1 = Edge.make_line((neck_end_x, neck_end_y), (arc_start_x, arc_start_y))
    exporter.add_shape(radius_line_1, layer="schematic_dotted")

    radius_line_2 = Edge.make_line((neck_end_x, neck_end_y), (arc_end_x, arc_end_y))
    exporter.add_shape(radius_line_2, layer="schematic_dotted")

    for shape, layer in create_angle_dimension(neck_vertical_line, neck_angled_line,
                                            label=f"{neck_angle_deg:.1f}°",
                                            arc_radius=15, font_size=DIMENSION_FONT_SIZE,
                                            text_inside=True):
        exporter.add_shape(shape, layer=layer)

    return neck_vertical_line, neck_angled_line

def draw_fingerboard(exporter: ExportSVG, neck_end_x: float, neck_end_y: float,
                    fb_bottom_end_x: float, fb_bottom_end_y: float,
                    fb_thickness_at_nut: float, fb_thickness_at_end: float,
                    fb_direction_angle: float,
                    fb_visible_height_at_nut: float, fb_visible_height_at_join: float) -> Tuple:
    """Draw fingerboard."""
    perp_angle = fb_direction_angle + math.pi/2

    visible_top_nut_x = neck_end_x + fb_visible_height_at_nut * math.cos(perp_angle)
    visible_top_nut_y = neck_end_y + fb_visible_height_at_nut * math.sin(perp_angle)

    visible_top_end_x = fb_bottom_end_x + fb_visible_height_at_join * math.cos(perp_angle)
    visible_top_end_y = fb_bottom_end_y + fb_visible_height_at_join * math.sin(perp_angle)

    fb_top_nut_x = neck_end_x + fb_thickness_at_nut * math.cos(perp_angle)
    fb_top_nut_y = neck_end_y + fb_thickness_at_nut * math.sin(perp_angle)

    fb_top_end_x = fb_bottom_end_x + fb_thickness_at_end * math.cos(perp_angle)
    fb_top_end_y = fb_bottom_end_y + fb_thickness_at_end * math.sin(perp_angle)

    visible_side_points = [
        (neck_end_x, neck_end_y),
        (fb_bottom_end_x, fb_bottom_end_y),
        (visible_top_end_x, visible_top_end_y),
        (visible_top_nut_x, visible_top_nut_y),
    ]
    visible_side_polygon = Polygon(visible_side_points, filled=True, fill_pattern="diagonalHatch")
    exporter.add_shape(visible_side_polygon, layer="drawing")

    radius_left_edge = Edge.make_line((visible_top_nut_x, visible_top_nut_y), (fb_top_nut_x, fb_top_nut_y))
    exporter.add_shape(radius_left_edge, layer="drawing")

    radius_right_edge = Edge.make_line((visible_top_end_x, visible_top_end_y), (fb_top_end_x, fb_top_end_y))
    exporter.add_shape(radius_right_edge, layer="drawing")

    radius_top_edge = Edge.make_line((fb_top_nut_x, fb_top_nut_y), (fb_top_end_x, fb_top_end_y))
    exporter.add_shape(radius_top_edge, layer="drawing")

    return fb_top_end_x, fb_top_end_y

def draw_string_and_references(exporter: ExportSVG, nut_top_x: float, nut_top_y: float,
                              bridge_top_x: float, bridge_top_y: float) -> Tuple:
    """Draw string and references."""
    reference_line_end_x = nut_top_x - 20
    reference_line = Edge.make_line((0, 0), (reference_line_end_x, 0))
    exporter.add_shape(reference_line, layer="extensions")

    string_line = Edge.make_line((nut_top_x, nut_top_y), (bridge_top_x, bridge_top_y))
    exporter.add_shape(string_line, layer="drawing")

    return reference_line_end_x, string_line

def add_document_text(exporter: ExportSVG, instrument_name: str, generator_url: str,
                     body_length: float, rib_height: float, belly_edge_thickness: float,
                     arching_height: float, bridge_height: float, neck_end_x: float) -> None:
    """Add document metadata text."""
    title_text = Text(instrument_name, TITLE_FONT_SIZE, font=FONT_NAME)
    title_y = arching_height + bridge_height + 25
    title_x = body_length / 2
    title_text = title_text.move(Location((title_x, title_y)))
    exporter.add_shape(title_text, layer="text")

    footer_text = Text(generator_url, FOOTER_FONT_SIZE, font=FONT_NAME)
    footer_y = belly_edge_thickness - rib_height - 35
    footer_x = neck_end_x
    footer_text = footer_text.move(Location((footer_x, footer_y)))
    exporter.add_shape(footer_text, layer="text")

def add_dimensions(exporter: ExportSVG, show_measurements: bool,
                  reference_line_end_x: float, nut_top_x: float, nut_top_y: float,
                  bridge_top_x: float, bridge_top_y: float, string_line,
                  string_length: float, neck_end_x: float, neck_end_y: float,
                  overstand: float, body_stop: float, arching_height: float,
                  bridge_height: float, body_length: float, rib_height: float,
                  belly_edge_thickness: float, fb_surface_point_x: float,
                  fb_surface_point_y: float, string_x_at_fb_end: float,
                  string_y_at_fb_end: float, string_height_at_fb_end: float,
                  intersect_x: float, intersect_y: float,
                  nut_to_perp_distance: float, tailpiece_height: float = 0.0,
                  string_break_angle: float = 0.0) -> None:
    """Add dimension annotations."""
    if show_measurements:
        rib_to_nut_feature_line = Edge.make_line((reference_line_end_x, 0), (reference_line_end_x, nut_top_y))
        for shape, layer in create_vertical_dimension(rib_to_nut_feature_line,
                                                   f"{nut_top_y:.1f}",
                                                   offset_x=-8, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    for shape, layer in create_diagonal_dimension(string_line, f"{string_length:.1f}",
                                               offset_distance=10, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    if nut_to_perp_distance > 0:
        nut_to_perp_line = Edge.make_line((nut_top_x, nut_top_y), (intersect_x, intersect_y))
        for shape, layer in create_diagonal_dimension(nut_to_perp_line,
                                                   f"{nut_to_perp_distance:.1f}",
                                                   offset_distance=20, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    string_height_feature_line = Edge.make_line((fb_surface_point_x, fb_surface_point_y),
                                             (string_x_at_fb_end, string_y_at_fb_end))
    for shape, layer in create_vertical_dimension(string_height_feature_line,
                                               f"{string_height_at_fb_end:.1f}",
                                               offset_x=8, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    nut_x_distance = abs(neck_end_x)
    nut_feature_line = Edge.make_line((neck_end_x, neck_end_y), (0, neck_end_y))
    for shape, layer in create_horizontal_dimension(nut_feature_line, f"{nut_x_distance:.1f}",
                                                 offset_y=-10, extension_length=3, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    if overstand > 0:
        overstand_feature_line = Edge.make_line((0, 0), (0, overstand))
        for shape, layer in create_vertical_dimension(overstand_feature_line, f"{overstand:.1f}",
                                                   offset_x=8, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    arch_feature_line = Edge.make_line((body_stop, 0), (body_stop, arching_height))
    for shape, layer in create_vertical_dimension(arch_feature_line, f"{arching_height:.1f}",
                                               offset_x=8, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    bottom_y = belly_edge_thickness - rib_height
    body_stop_feature_line = Edge.make_line((0, bottom_y), (body_stop, bottom_y))
    for shape, layer in create_horizontal_dimension(body_stop_feature_line, f"{body_stop:.1f}",
                                                 offset_y=-15, extension_length=3, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    body_length_feature_line = Edge.make_line((0, bottom_y), (body_length, bottom_y))
    for shape, layer in create_horizontal_dimension(body_length_feature_line, f"{body_length:.1f}",
                                                 offset_y=-30, extension_length=3, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    rib_dim_x = body_length + 10
    dim_p1 = (rib_dim_x, belly_edge_thickness)
    dim_p2 = (rib_dim_x, belly_edge_thickness - rib_height)
    rib_dim_line = Edge.make_line(dim_p1, dim_p2)
    exporter.add_shape(rib_dim_line, layer="dimensions")
    for arrow in create_dimension_arrows(dim_p1, dim_p2, 3.0):
        exporter.add_shape(arrow, layer="arrows")
    rib_text = Text(f"{rib_height:.1f}", DIMENSION_FONT_SIZE, font=FONT_NAME)
    rib_text = rib_text.move(Location((rib_dim_x + DIMENSION_FONT_SIZE, belly_edge_thickness - rib_height/2)))
    exporter.add_shape(rib_text, layer="text")

    # Tailpiece to bridge line (string path to tailpiece)
    tailpiece_base_y = belly_edge_thickness
    tailpiece_top_y = belly_edge_thickness + tailpiece_height

    # Always draw dotted line from tailpiece attachment to bridge top
    tailpiece_to_bridge_line = Edge.make_line(
        (body_length, tailpiece_top_y),
        (bridge_top_x, bridge_top_y)
    )
    exporter.add_shape(tailpiece_to_bridge_line, layer="schematic_dotted")

    # Draw the string break angle dimension at the bridge
    if string_break_angle > 0:
        for shape, layer in create_angle_dimension(
            string_line, tailpiece_to_bridge_line,
            label=f"{string_break_angle:.1f}°",
            arc_radius=20, font_size=DIMENSION_FONT_SIZE,
            text_inside=True
        ):
            exporter.add_shape(shape, layer=layer)

    # Only show height reference and dimension when tailpiece_height > 0
    if tailpiece_height > 0:
        # Dotted reference line showing tailpiece height
        tailpiece_ref_line = Edge.make_line(
            (body_length, tailpiece_base_y),
            (body_length, tailpiece_top_y)
        )
        exporter.add_shape(tailpiece_ref_line, layer="schematic_dotted")

        # Dimension with arrows and label
        tailpiece_dim_x = body_length + 20
        dim_p1 = (tailpiece_dim_x, tailpiece_base_y)
        dim_p2 = (tailpiece_dim_x, tailpiece_top_y)
        tailpiece_dim_line = Edge.make_line(dim_p1, dim_p2)
        exporter.add_shape(tailpiece_dim_line, layer="dimensions")
        for arrow in create_dimension_arrows(dim_p1, dim_p2, 3.0):
            exporter.add_shape(arrow, layer="arrows")
        tailpiece_text = Text(f"{tailpiece_height:.1f}", DIMENSION_FONT_SIZE, font=FONT_NAME)
        tailpiece_text = tailpiece_text.move(Location((tailpiece_dim_x + DIMENSION_FONT_SIZE, tailpiece_base_y + tailpiece_height/2)))
        exporter.add_shape(tailpiece_text, layer="text")
