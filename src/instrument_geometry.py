"""
Instrument Neck Geometry Generator

This is where your Build123d geometry expertise goes.
"""

from buildprimitives import *
from buildprimitives import FONT_NAME, TITLE_FONT_SIZE, FOOTER_FONT_SIZE, PTS_MM  # Font constants
from instrument_parameters import InstrumentFamily
import math
from typing import Dict, Any, Tuple
from dimension_helpers import (
    create_dimension_arrows,
    create_vertical_dimension,
    create_horizontal_dimension,
    create_diagonal_dimension,
    create_angle_dimension,
    DIMENSION_FONT_SIZE
)

# class NeckGeometry:
#     """
#     Generates neck geometry from validated parameters.
    
#     This class contains all the lutherie-specific geometry generation.
#     Each method focuses on one component (neck, scroll, pegbox, etc.)
#     """
    
#     def __init__(self, params: Dict[str, Any]):
#         """
#         Initialize with validated parameters.

#         Args:
#             params: Dictionary of parameter values from instrument_parameters.py
#         """
#         self.params = params


def calculate_sagitta(radius: float, width: float) -> float:
    """
    Calculate sagitta (height of arc) given radius and chord width.

    Args:
        radius: Radius of curvature in mm
        width: Chord width (fingerboard width) in mm

    Returns:
        Sagitta height in mm
    """
    if radius <= 0 or width <= 0:
        return 0.0

    # Use precise formula: sagitta = r - sqrt(r² - (w/2)²)
    half_width = width / 2.0

    # Avoid domain error if width > 2*radius
    if half_width >= radius:
        # Arc is more than semicircle, use approximation
        return width ** 2 / (8.0 * radius)

    return radius - math.sqrt(radius ** 2 - half_width ** 2)


def calculate_derived_values(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate derived values from parameters.

    Args:
        params: Dictionary of parameter values

    Returns:
        Dictionary of derived values (label -> value)
    """
    derived = {}

   

    # Extract values safely
    vsl = params.get('vsl') or 0
    instrument_family = params.get('instrument_family') or InstrumentFamily.VIOLIN.name

    # Get family-specific default for number of frets
    if params.get('no_frets') is not None:
        no_frets = params.get('no_frets')
    elif instrument_family == InstrumentFamily.VIOL.name:
        no_frets = 7
    elif instrument_family == InstrumentFamily.GUITAR_MANDOLIN.name:
        no_frets = 20
    else:
        no_frets = 0  # VIOLIN family has no frets

    fret_positions = calculate_fret_positions(vsl, no_frets)
    arching_height = params.get('arching_height') or 0
    overstand = params.get('overstand') or 0
    # body_length = params.get('body_length') or 0
    # rib_height = params.get('rib_height') or 0
    fingerboard_length = params.get('fingerboard_length') or 0

    # Extract new radius-based parameters
    fingerboard_radius = params.get('fingerboard_radius') or 41.0  # Typical violin
    fb_visible_height_at_nut = params.get('fb_visible_height_at_nut') or 3.2
    fb_visible_height_at_join = params.get('fb_visible_height_at_join') or 1.2

    # Get fingerboard widths (needed for sagitta calculation)
    fb_width_at_nut = params.get('fingerboard_width_at_nut') or 24.0  # Default violin nut width
    fb_width_at_join = params.get('fingerboard_width_at_end') or 42.0  # Default violin end width

    # Calculate sagitta at nut and join
    sagitta_at_nut = calculate_sagitta(fingerboard_radius, fb_width_at_nut)
    sagitta_at_join = calculate_sagitta(fingerboard_radius, fb_width_at_join)

    # Calculate total thickness (visible height + sagitta)
    fb_thickness_at_nut = fb_visible_height_at_nut + sagitta_at_nut
    fb_thickness_at_join = fb_visible_height_at_join + sagitta_at_join

    # Add sagitta values to derived values for display
    derived['Sagitta at Nut'] = sagitta_at_nut
    derived['Sagitta at Join'] = sagitta_at_join
    derived['Total FB Thickness at Nut'] = fb_thickness_at_nut
    derived['Total FB Thickness at Join'] = fb_thickness_at_join

    # neck_thickness_at_first = params.get('neck_thickness_at_first') or 0
    # neck_thickness_at_seventh = params.get('neck_thickness_at_seventh') or 0
    bridge_height = params.get('bridge_height') or 0
    # show_rib_reference = params.get('show_rib_reference', True)

    string_height_nut = params.get('string_height_nut') or 0

    string_height_at_join = 0
    bridge_top_x = 0 # see below
    bridge_top_y = arching_height + bridge_height
    body_stop = 0 # see below
    string_angle_to_ribs = 0 # see below
    string_angle_to_ribs_rad = 0 # see below
    string_nut_to_join = 0 # see below
    neck_stop = 0 # see below
    if instrument_family in (InstrumentFamily.VIOLIN.name, InstrumentFamily.VIOL.name):
        body_stop = params.get('body_stop') or 0
        string_height_eof = params.get('string_height_eof') or 0
        string_height_at_join = (string_height_eof - string_height_nut) * ((vsl-body_stop)/fingerboard_length) + string_height_nut #approximate
        opposite = arching_height + bridge_height - overstand - fb_thickness_at_join - string_height_at_join
        string_angle_to_ribs_rad = math.atan(opposite / body_stop)
        string_angle_to_ribs = string_angle_to_ribs_rad * 180 / math.pi
        string_to_join = math.sqrt(opposite**2 + body_stop**2)
        string_nut_to_join = vsl-string_to_join
        neck_stop = math.cos(string_angle_to_ribs_rad)*string_nut_to_join
        opposite_string_to_fb = string_height_eof - string_height_nut
        string_angle_to_fb = math.atan(opposite_string_to_fb / fingerboard_length) * 180 / math.pi
    elif instrument_family == InstrumentFamily.GUITAR_MANDOLIN.name:
        fret_join = params.get('fret_join') or 12
        string_height_12th_fret = params.get('string_height_12th_fret') or 0
        string_height_at_join = ((string_height_12th_fret-string_height_nut)*(fret_positions[fret_join]/fret_positions[12])) + string_height_nut
        hypotenuse = vsl-fret_positions[fret_join]
        opposite = arching_height + bridge_height - overstand - fb_thickness_at_join - string_height_at_join
        string_angle_to_ribs_rad = math.asin(opposite / hypotenuse)
        string_angle_to_ribs = string_angle_to_ribs_rad * 180 / math.pi
        string_nut_to_join = fret_positions[fret_join] 
        neck_stop = math.cos(string_angle_to_ribs_rad)*string_nut_to_join
        body_stop = math.cos(string_angle_to_ribs_rad)*hypotenuse
        print("body_stop", body_stop)
        print("neck_stop", neck_stop)
        opposite_string_to_join = string_height_at_join - string_height_nut
        string_angle_to_fb = math.atan(opposite_string_to_join / fret_positions[fret_join]) * 180 / math.pi
    else:
        raise ValueError("Invalid calculation mode")
    
    bridge_top_x = body_stop
    nut_top_x = -neck_stop
    nut_top_y = bridge_top_y - math.sin(string_angle_to_ribs_rad)*vsl
    print("nut_top_x, nut_top_y", nut_top_x, nut_top_y)

    opposite_fb = fb_thickness_at_join - fb_thickness_at_nut
    fingerboard_angle = math.atan(opposite_fb / neck_stop) * 180 / math.pi
    neck_angle = 90-(string_angle_to_ribs-string_angle_to_fb-fingerboard_angle)
    derived['Neck Angle'] = neck_angle

    # Calculate neck end position and nut position for string length
    neck_angle_rad = neck_angle * math.pi / 180
    neck_end_x = 0 - neck_stop + math.cos(neck_angle_rad)*fb_thickness_at_nut
    neck_end_y = overstand - neck_stop * math.cos(neck_angle_rad)
    derived['Body Stop'] = body_stop
    derived['Neck Stop'] = neck_stop
    derived['Neck Angle (rad)'] = neck_angle_rad
    derived['Neck End X'] = neck_end_x
    derived['Neck End Y'] = neck_end_y

    # Calculate nut position (top of nut)
    nut_draw_radius = fb_thickness_at_nut + string_height_nut
    neck_line_angle = math.atan2(neck_end_y - overstand, neck_end_x - 0)
    # nut_top_x = neck_end_x + nut_radius * math.cos(neck_line_angle - math.pi/2)
    # nut_top_y = neck_end_y + nut_radius * math.sin(neck_line_angle - math.pi/2)
    print("nut_top_x, nut_top_y", nut_top_x, nut_top_y) 

    derived['Nut Draw Radius'] = nut_draw_radius
    derived['Neck Line Angle'] = neck_line_angle
    derived['Nut Top X'] = nut_top_x
    derived['Nut Top Y'] = nut_top_y

    # Store bridge position (use variables from lines 100-102)
    derived['Bridge Top X'] = bridge_top_x
    derived['Bridge Top Y'] = bridge_top_y

    # Calculate string length
    string_length = math.sqrt((bridge_top_x - nut_top_x)**2 + (bridge_top_y - nut_top_y)**2)
    derived['String Length'] = string_length

    # Add nut position relative to ribs if rib reference is enabled
    derived['Nut Relative to Ribs'] = nut_top_y

    # Calculate fingerboard geometry
    fb_direction_angle = neck_line_angle + math.pi
    fb_bottom_end_x = neck_end_x + fingerboard_length * math.cos(fb_direction_angle)
    fb_bottom_end_y = neck_end_y + fingerboard_length * math.sin(fb_direction_angle)
    fb_thickness_at_end = fb_thickness_at_nut + (fb_thickness_at_join - fb_thickness_at_nut) * (fingerboard_length / neck_stop)

    derived['Fingerboard Direction Angle'] = fb_direction_angle
    derived['Fingerboard Bottom End X'] = fb_bottom_end_x
    derived['Fingerboard Bottom End Y'] = fb_bottom_end_y
    derived['Fingerboard Thickness at End'] = fb_thickness_at_end

    # Calculate fingerboard top right corner for string height calculation
    perp_angle = fb_direction_angle + math.pi/2
    fb_top_right_x = fb_bottom_end_x + fb_thickness_at_end * math.cos(perp_angle)
    fb_top_right_y = fb_bottom_end_y + fb_thickness_at_end * math.sin(perp_angle)

    # Calculate nut perpendicular distance (for dimension annotation)
    # Neck direction vector
    neck_dx = neck_end_x - 0
    neck_dy = neck_end_y - overstand

    # Perpendicular to neck (rotated 90 degrees counterclockwise)
    perp_neck_dx = -neck_dy
    perp_neck_dy = neck_dx

    # String direction vector
    string_dx = bridge_top_x - nut_top_x
    string_dy = bridge_top_y - nut_top_y

    # Find intersection of string line with perpendicular line at body join
    det = string_dx * perp_neck_dy - string_dy * perp_neck_dx

    if abs(det) > 1e-10:  # Lines are not parallel
        t = ((0 - nut_top_x) * perp_neck_dy - (overstand - nut_top_y) * perp_neck_dx) / det
        intersect_x = nut_top_x + t * string_dx
        intersect_y = nut_top_y + t * string_dy
        nut_to_perp_distance = math.sqrt(
            (intersect_x - nut_top_x)**2 + (intersect_y - nut_top_y)**2
        )
    else:
        intersect_x = 0.0
        intersect_y = 0.0
        nut_to_perp_distance = 0.0

    derived['Nut Perpendicular Intersection X'] = intersect_x
    derived['Nut Perpendicular Intersection Y'] = intersect_y
    derived['Nut to Perpendicular Distance'] = nut_to_perp_distance

    # Calculate string height above end of fingerboard
    # Vector from nut to fingerboard end
    fb_dx = fb_bottom_end_x - neck_end_x
    fb_dy = fb_bottom_end_y - neck_end_y

    # Find parameter t along string line for position above fingerboard end
    if string_dx != 0:
        t = fb_dx / string_dx
    else:
        t = fb_dy / string_dy if string_dy != 0 else 0

    string_x_at_fb_end = nut_top_x + t * string_dx
    string_y_at_fb_end = nut_top_y + t * string_dy

    # Calculate perpendicular distance from string point to fingerboard top surface
    vec_x = string_x_at_fb_end - fb_top_right_x
    vec_y = string_y_at_fb_end - fb_top_right_y

    # Perpendicular direction to fingerboard
    perp_dx = math.cos(perp_angle)
    perp_dy = math.sin(perp_angle)

    # Project vector onto perpendicular direction (dot product)
    string_height_at_fb_end = vec_x * perp_dx + vec_y * perp_dy

    # Point on fingerboard surface directly below string
    fb_surface_point_x = string_x_at_fb_end - string_height_at_fb_end * perp_dx
    fb_surface_point_y = string_y_at_fb_end - string_height_at_fb_end * perp_dy

    derived['String X at Fingerboard End'] = string_x_at_fb_end
    derived['String Y at Fingerboard End'] = string_y_at_fb_end
    derived['Fingerboard Surface Point X'] = fb_surface_point_x
    derived['Fingerboard Surface Point Y'] = fb_surface_point_y
    derived['String Height at Fingerboard End'] = string_height_at_fb_end

    return derived
    
def calculate_fret_positions(vsl: float, no_frets: int) -> list[float]:
    fret_positions = []
    for i in range(1, no_frets + 1):
        fret_positions.append(vsl -(vsl / (2 ** (i / 12))))
    return fret_positions


def generate_fret_positions_view(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate fret positions data for display."""
    vsl = params.get('vsl') or 0
    instrument_family = params.get('instrument_family') or InstrumentFamily.VIOLIN.name

    # Get number of frets (family-specific default)
    if params.get('no_frets') is not None:
        no_frets = params.get('no_frets')
    elif instrument_family == InstrumentFamily.VIOL.name:
        no_frets = 7
    elif instrument_family == InstrumentFamily.GUITAR_MANDOLIN.name:
        no_frets = 20
    else:
        no_frets = 0

    if no_frets == 0:
        return {'available': False, 'message': 'Fret positions not applicable for violin family'}

    fret_positions = calculate_fret_positions(vsl, no_frets)

    # Generate HTML table with scrollable container
    html = '<div class="fret-table-container">'
    html += '<table class="fret-table">'
    html += '<thead><tr><th>Fret</th><th>Distance from Nut (mm)</th><th>Distance from Previous Fret (mm)</th></tr></thead>'
    html += '<tbody>'

    prev_pos = 0  # Start from nut
    for i, pos in enumerate(fret_positions):
        fret_num = i + 1
        from_nut = pos
        from_prev = pos - prev_pos
        html += f'<tr><td>{fret_num}</td><td>{from_nut:.1f}</td><td>{from_prev:.1f}</td></tr>'
        prev_pos = pos

    html += '</tbody></table></div>'

    return {
        'available': True,
        'html': html,
        'vsl': vsl,
        'no_frets': no_frets
    }


def exporter_to_svg(exp: ExportSVG) -> str:
    """Convert ExportSVG to SVG string without temp files."""
    return exp.write(filename=None)


def _setup_exporter(show_measurements: bool) -> ExportSVG:
    """Create and configure SVG exporter with all necessary layers."""
    exporter = ExportSVG(scale=1.0, unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("text", fill_color=(0,0,255), line_type=LineType.HIDDEN)
    exporter.add_layer("drawing", fill_color=None, line_color=(0,0,0), line_type=LineType.CONTINUOUS)
    exporter.add_layer("schematic", fill_color=None, line_color=(0,0,0), line_type=LineType.DASHED)
    exporter.add_layer("schematic_dotted", fill_color=None, line_color=(100,100,100), line_type=LineType.DOTTED)

    # Dimension layers - invisible if show_measurements is False
    dim_color = (255,0,0) if show_measurements else None
    exporter.add_layer("dimensions", fill_color=dim_color, line_color=dim_color, line_type=LineType.DASHED)
    exporter.add_layer("extensions", fill_color=None, line_color=dim_color, line_type=LineType.CONTINUOUS)
    exporter.add_layer("arrows", fill_color=dim_color, line_color=dim_color, line_type=LineType.CONTINUOUS)

    return exporter


def _draw_body(exporter: ExportSVG, body_length: float, belly_edge_thickness: float,
               rib_height: float, body_stop: float, arching_height: float) -> None:
    """Draw body geometry: belly edge, ribs, and arched top."""
    # Add belly edge thickness rectangle at top
    belly_rect = Rectangle(width=body_length, height=belly_edge_thickness)
    belly_rect = belly_rect.move(Location((body_length/2, belly_edge_thickness/2)))
    exporter.add_shape(belly_rect, layer="drawing")

    # Add rectangle for body (ribs) with top at belly edge thickness
    rect = Rectangle(width=body_length, height=rib_height)
    rect = rect.move(Location((body_length/2, belly_edge_thickness - rib_height/2)))
    exporter.add_shape(rect, layer="drawing")

    # Add arched top as smooth interpolating spline
    arch_spline = Spline.interpolate_three_points(
        (0, belly_edge_thickness),           # Left edge
        (body_stop, arching_height),         # Peak (curve passes through here)
        (body_length, belly_edge_thickness)  # Right edge
    )
    exporter.add_shape(arch_spline, layer="schematic")


def _draw_neck(exporter: ExportSVG, overstand: float, neck_end_x: float, neck_end_y: float,
               bridge_height: float, body_stop: float, arching_height: float,
               nut_radius: float, neck_line_angle: float, neck_angle_deg: float) -> Tuple:
    """Draw neck structure including angles and nut. Returns neck lines for dimension annotation."""
    # Add vertical line from arch peak extending by bridge_height
    bridge_line = Edge.make_line((body_stop, arching_height), (body_stop, arching_height + bridge_height))
    exporter.add_shape(bridge_line, layer="drawing")

    # Add vertical line from ribs (y=0) extending to overstand
    neck_vertical_line = Edge.make_line((0, 0), (0, overstand))
    exporter.add_shape(neck_vertical_line, layer="drawing")

    # Add angled line from top of vertical line (ribs+overstand) to neck end
    neck_angled_line = Edge.make_line((0, overstand), (neck_end_x, neck_end_y))
    exporter.add_shape(neck_angled_line, layer="drawing")

    # Add nut as a quarter circle at the end of the neck
    start_angle = neck_line_angle - math.pi/2
    end_angle = start_angle + math.pi/2

    nut_arc = Arc.make_arc(
        center=(neck_end_x, neck_end_y),
        radius=nut_radius,
        start_angle=start_angle,
        end_angle=end_angle
    )
    exporter.add_shape(nut_arc, layer="schematic_dotted")

    # Add radial lines from center to arc endpoints
    arc_start_x = neck_end_x + nut_radius * math.cos(start_angle)
    arc_start_y = neck_end_y + nut_radius * math.sin(start_angle)
    arc_end_x = neck_end_x + nut_radius * math.cos(end_angle)
    arc_end_y = neck_end_y + nut_radius * math.sin(end_angle)

    radius_line_1 = Edge.make_line((neck_end_x, neck_end_y), (arc_start_x, arc_start_y))
    exporter.add_shape(radius_line_1, layer="schematic_dotted")

    radius_line_2 = Edge.make_line((neck_end_x, neck_end_y), (arc_end_x, arc_end_y))
    exporter.add_shape(radius_line_2, layer="schematic_dotted")

    # Add angle annotation between the two lines
    for shape, layer in create_angle_dimension(neck_vertical_line, neck_angled_line,
                                              label=f"{neck_angle_deg:.1f}°",
                                              arc_radius=15, font_size=DIMENSION_FONT_SIZE,
                                              text_inside=True):
        exporter.add_shape(shape, layer=layer)

    return neck_vertical_line, neck_angled_line


def _draw_fingerboard(exporter: ExportSVG, neck_end_x: float, neck_end_y: float,
                      fb_bottom_end_x: float, fb_bottom_end_y: float,
                      fb_thickness_at_nut: float, fb_thickness_at_end: float,
                      fb_direction_angle: float,
                      fb_visible_height_at_nut: float, fb_visible_height_at_join: float) -> Tuple:
    """Draw fingerboard with radiused top and hatched visible side. Returns top edge endpoints for dimension calculations."""
    # Calculate perpendicular direction (90° counterclockwise from fingerboard direction)
    perp_angle = fb_direction_angle + math.pi/2

    # Calculate visible side top edge (where hatching ends)
    visible_top_nut_x = neck_end_x + fb_visible_height_at_nut * math.cos(perp_angle)
    visible_top_nut_y = neck_end_y + fb_visible_height_at_nut * math.sin(perp_angle)

    visible_top_end_x = fb_bottom_end_x + fb_visible_height_at_join * math.cos(perp_angle)
    visible_top_end_y = fb_bottom_end_y + fb_visible_height_at_join * math.sin(perp_angle)

    # Calculate total thickness top edge (includes sagitta)
    fb_top_nut_x = neck_end_x + fb_thickness_at_nut * math.cos(perp_angle)
    fb_top_nut_y = neck_end_y + fb_thickness_at_nut * math.sin(perp_angle)

    fb_top_end_x = fb_bottom_end_x + fb_thickness_at_end * math.cos(perp_angle)
    fb_top_end_y = fb_bottom_end_y + fb_thickness_at_end * math.sin(perp_angle)

    # PART 1: Draw visible side with diagonal hatching
    visible_side_points = [
        (neck_end_x, neck_end_y),                      # Bottom left (nut, bottom)
        (fb_bottom_end_x, fb_bottom_end_y),           # Bottom right (join, bottom)
        (visible_top_end_x, visible_top_end_y),       # Top right (join, visible top)
        (visible_top_nut_x, visible_top_nut_y),       # Top left (nut, visible top)
    ]
    visible_side_polygon = Polygon(visible_side_points, filled=True, fill_pattern="diagonalHatch")
    exporter.add_shape(visible_side_polygon, layer="drawing")

    # PART 2: Draw radiused portion outline
    # Left edge of radiused portion (at nut)
    radius_left_edge = Edge.make_line(
        (visible_top_nut_x, visible_top_nut_y),
        (fb_top_nut_x, fb_top_nut_y)
    )
    exporter.add_shape(radius_left_edge, layer="drawing")

    # Right edge of radiused portion (at join)
    radius_right_edge = Edge.make_line(
        (visible_top_end_x, visible_top_end_y),
        (fb_top_end_x, fb_top_end_y)
    )
    exporter.add_shape(radius_right_edge, layer="drawing")

    # Top edge of radiused portion (curved surface in side view)
    radius_top_edge = Edge.make_line(
        (fb_top_nut_x, fb_top_nut_y),
        (fb_top_end_x, fb_top_end_y)
    )
    exporter.add_shape(radius_top_edge, layer="drawing")

    return fb_top_end_x, fb_top_end_y


def _draw_string_and_references(exporter: ExportSVG, nut_top_x: float, nut_top_y: float,
                                bridge_top_x: float, bridge_top_y: float) -> Tuple:
    """Draw string line and horizontal reference line. Returns reference line end x and string line."""
    # Add horizontal reference line from top of ribs (0,0) extending 20mm beyond nut
    reference_line_end_x = nut_top_x - 20
    reference_line = Edge.make_line((0, 0), (reference_line_end_x, 0))
    exporter.add_shape(reference_line, layer="extensions")

    # Draw string line
    string_line = Edge.make_line((nut_top_x, nut_top_y), (bridge_top_x, bridge_top_y))
    exporter.add_shape(string_line, layer="drawing")

    return reference_line_end_x, string_line


def _add_document_text(exporter: ExportSVG, instrument_name: str, generator_url: str,
                       body_length: float, rib_height: float, belly_edge_thickness: float,
                       arching_height: float, bridge_height: float) -> None:
    """Add document title and generator attribution."""
    # Title at top center
    title_text = Text(instrument_name, TITLE_FONT_SIZE, font=FONT_NAME)
    title_y = arching_height + bridge_height + 25
    title_x = body_length / 2
    title_text = title_text.move(Location((title_x, title_y)))
    exporter.add_shape(title_text, layer="text")

    # Footer at bottom
    footer_text = Text(generator_url, FOOTER_FONT_SIZE, font=FONT_NAME)
    footer_y = belly_edge_thickness - rib_height - 15
    footer_x = body_length / 2
    footer_text = footer_text.move(Location((footer_x, footer_y)))
    exporter.add_shape(footer_text, layer="text")


def _add_dimensions(exporter: ExportSVG, show_measurements: bool,
                    reference_line_end_x: float, nut_top_x: float, nut_top_y: float,
                    bridge_top_x: float, bridge_top_y: float, string_line,
                    string_length: float, neck_end_x: float, neck_end_y: float,
                    overstand: float, body_stop: float, arching_height: float,
                    bridge_height: float, body_length: float, rib_height: float,
                    belly_edge_thickness: float, fb_surface_point_x: float,
                    fb_surface_point_y: float, string_x_at_fb_end: float,
                    string_y_at_fb_end: float, string_height_at_fb_end: float,
                    intersect_x: float, intersect_y: float,
                    nut_to_perp_distance: float) -> None:
    """
    Add all dimension annotations to the drawing.

    Args:
        exporter: SVG exporter to add shapes to
        show_measurements: Whether to show certain measurements
        reference_line_end_x: X coordinate of reference line end
        nut_top_x, nut_top_y: Nut top coordinates
        bridge_top_x, bridge_top_y: Bridge top coordinates
        string_line: String line edge
        string_length: Calculated string length
        neck_end_x, neck_end_y: Neck end coordinates
        overstand: Overstand distance
        body_stop: Body stop position
        arching_height: Arching height
        bridge_height: Bridge height
        body_length: Total body length
        rib_height: Rib height
        belly_edge_thickness: Belly edge thickness
        fb_surface_point_x, fb_surface_point_y: Fingerboard surface point coordinates
        string_x_at_fb_end, string_y_at_fb_end: String position at fingerboard end
        string_height_at_fb_end: String height at fingerboard end
        intersect_x, intersect_y: Intersection point coordinates
        nut_to_perp_distance: Distance from nut to perpendicular
    """
    # Dimension: vertical distance from ribs (y=0) to top of nut
    if show_measurements:
        rib_to_nut_feature_line = Edge.make_line((reference_line_end_x, 0), (reference_line_end_x, nut_top_y))
        for shape, layer in create_vertical_dimension(rib_to_nut_feature_line,
                                                       f"{nut_top_y:.1f}",
                                                       offset_x=-8, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    # Add diagonal dimension for string length (using precomputed value from derived dictionary)
    for shape, layer in create_diagonal_dimension(string_line, f"{string_length:.1f}",
                                                   offset_distance=10, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Add dimension from nut to where string crosses a perpendicular to neck at body join
    if nut_to_perp_distance > 0:  # Only add if calculation succeeded
        nut_to_perp_line = Edge.make_line((nut_top_x, nut_top_y), (intersect_x, intersect_y))
        for shape, layer in create_diagonal_dimension(nut_to_perp_line,
                                                       f"{nut_to_perp_distance:.1f}",
                                                       offset_distance=20, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    # Dimension: string height above end of fingerboard (perpendicular)
    string_height_feature_line = Edge.make_line((fb_surface_point_x, fb_surface_point_y),
                                                 (string_x_at_fb_end, string_y_at_fb_end))
    for shape, layer in create_vertical_dimension(string_height_feature_line,
                                                   f"{string_height_at_fb_end:.1f}",
                                                   offset_x=8, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Dimension: horizontal distance from nut to x=0 (neck projection)
    # The nut is at (neck_end_x, neck_end_y), we want horizontal distance to (0, neck_end_y)
    nut_x_distance = abs(neck_end_x)  # This equals neck_stop
    nut_feature_line = Edge.make_line((neck_end_x, neck_end_y), (0, neck_end_y))
    for shape, layer in create_horizontal_dimension(nut_feature_line, f"{nut_x_distance:.1f}",
                                                     offset_y=-10, extension_length=3, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Dimension: overstand (vertical, from ribs to body join point)
    if overstand > 0:  # Only show if overstand is positive
        overstand_feature_line = Edge.make_line((0, 0), (0, overstand))
        for shape, layer in create_vertical_dimension(overstand_feature_line, f"{overstand:.1f}",
                                                       offset_x=8, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    # Dimension: arching_height (vertical, from top of belly to arch peak - includes belly thickness)
    arch_feature_line = Edge.make_line((body_stop, 0), (body_stop, arching_height))
    for shape, layer in create_vertical_dimension(arch_feature_line, f"{arching_height:.1f}",
                                                   offset_x=8, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Dimension: body_stop (horizontal, with extension lines below body)
    bottom_y = belly_edge_thickness - rib_height
    body_stop_feature_line = Edge.make_line((0, bottom_y), (body_stop, bottom_y))
    for shape, layer in create_horizontal_dimension(body_stop_feature_line, f"{body_stop:.1f}",
                                                     offset_y=-15, extension_length=3, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Dimension: body_length (horizontal, further below with extension lines)
    body_length_feature_line = Edge.make_line((0, bottom_y), (body_length, bottom_y))
    for shape, layer in create_horizontal_dimension(body_length_feature_line, f"{body_length:.1f}",
                                                     offset_y=-30, extension_length=3, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Dimension: rib_height (vertical, on right side)
    rib_dim_x = body_length + 10
    dim_p1 = (rib_dim_x, belly_edge_thickness)
    dim_p2 = (rib_dim_x, belly_edge_thickness - rib_height)
    rib_dim_line = Edge.make_line(dim_p1, dim_p2)
    exporter.add_shape(rib_dim_line, layer="dimensions")
    for arrow in create_dimension_arrows(dim_p1, dim_p2, 3.0):
        exporter.add_shape(arrow, layer="arrows")
    rib_text = Text(f"{rib_height:.1f}", DIMENSION_FONT_SIZE, font=FONT_NAME)
    rib_text = rib_text.move(Location((rib_dim_x + DIMENSION_FONT_SIZE, belly_edge_thickness - rib_height/2)))
    exporter.add_shape(rib_text, layer="extensions")

    # Dimension: belly_edge_thickness (vertical, on right side above ribs)
    belly_dim_x = body_length + 10
    dim_p1 = (belly_dim_x, 0)
    dim_p2 = (belly_dim_x, belly_edge_thickness)
    belly_dim_line = Edge.make_line(dim_p1, dim_p2)
    exporter.add_shape(belly_dim_line, layer="dimensions")
    for arrow in create_dimension_arrows(dim_p1, dim_p2, 3.0):
        exporter.add_shape(arrow, layer="arrows")
    belly_text = Text(f"{belly_edge_thickness:.1f}", DIMENSION_FONT_SIZE, font=FONT_NAME)
    belly_text = belly_text.move(Location((belly_dim_x + DIMENSION_FONT_SIZE, belly_edge_thickness/2)))
    exporter.add_shape(belly_text, layer="extensions")

    # Dimension: bridge_height (vertical, from arch peak to top of bridge)
    bridge_feature_line = Edge.make_line((body_stop, arching_height), (body_stop, arching_height + bridge_height))
    for shape, layer in create_vertical_dimension(bridge_feature_line, f"{bridge_height:.1f}",
                                                   offset_x=15, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)


def generate_side_view_svg(params: Dict[str, Any]) -> str:
    """
    Generate side view SVG of instrument neck geometry.

    Orchestrates the drawing of body, neck, fingerboard, string,
    dimensions, and document text by calling specialized helper functions.

    Args:
        params: Dictionary of instrument parameters

    Returns:
        SVG string representation of the side view
    """
    # Extract parameters
    instrument_name = params.get('instrument_name', 'Instrument')
    generator_url = params.get('_generator_url', 'https://github.com/pzfreo/diagram-creator')
    show_measurements = params.get('show_measurements', True)

    # Calculate derived values
    derived = calculate_derived_values(params)
    body_stop = derived.get('Body Stop', params.get('body_stop'))
    neck_angle_deg = derived.get('Neck Angle', 0)
    string_length = derived.get('String Length', 0)

    # Extract geometry values from derived dictionary
    neck_end_x = derived.get('Neck End X', 0)
    neck_end_y = derived.get('Neck End Y', 0)
    nut_radius = derived.get('Nut Draw Radius', 0)
    neck_line_angle = derived.get('Neck Line Angle', 0)
    nut_top_x = derived.get('Nut Top X', 0)
    nut_top_y = derived.get('Nut Top Y', 0)
    bridge_top_x = derived.get('Bridge Top X', 0)
    bridge_top_y = derived.get('Bridge Top Y', 0)
    fb_direction_angle = derived.get('Fingerboard Direction Angle', 0)
    fb_bottom_end_x = derived.get('Fingerboard Bottom End X', 0)
    fb_bottom_end_y = derived.get('Fingerboard Bottom End Y', 0)
    fb_thickness_at_end = derived.get('Fingerboard Thickness at End', 0)

    # Extract parameter values needed for drawing
    body_length = params.get('body_length')
    belly_edge_thickness = params.get('belly_edge_thickness', 3.5)
    rib_height = params.get('rib_height')
    arching_height = params.get('arching_height')
    bridge_height = params.get('bridge_height')
    overstand = params.get('overstand', 0)

    # Extract fingerboard visible heights and calculate total thickness
    fb_visible_height_at_nut = params.get('fb_visible_height_at_nut', 3.2)
    fb_visible_height_at_join = params.get('fb_visible_height_at_join', 1.2)

    # Get total thickness from derived values (includes sagitta)
    fb_thickness_at_nut = derived.get('Total FB Thickness at Nut', 5.0)
    fb_thickness_at_join_derived = derived.get('Total FB Thickness at Join', 7.0)

    # Setup exporter with layers
    exporter = _setup_exporter(show_measurements)

    # Draw components in order
    _draw_body(exporter, body_length, belly_edge_thickness, rib_height,
               body_stop, arching_height)

    neck_vertical_line, neck_angled_line = _draw_neck(
        exporter, overstand, neck_end_x, neck_end_y, bridge_height,
        body_stop, arching_height, nut_radius, neck_line_angle, neck_angle_deg
    )

    fb_top_right_x, fb_top_right_y = _draw_fingerboard(
        exporter, neck_end_x, neck_end_y, fb_bottom_end_x, fb_bottom_end_y,
        fb_thickness_at_nut, fb_thickness_at_end, fb_direction_angle,
        fb_visible_height_at_nut, fb_visible_height_at_join
    )

    reference_line_end_x, string_line = _draw_string_and_references(
        exporter, nut_top_x, nut_top_y, bridge_top_x, bridge_top_y
    )

    # Extract calculated dimension values from derived dictionary
    intersect_x = derived.get('Nut Perpendicular Intersection X', 0)
    intersect_y = derived.get('Nut Perpendicular Intersection Y', 0)
    nut_to_perp_distance = derived.get('Nut to Perpendicular Distance', 0)
    string_x_at_fb_end = derived.get('String X at Fingerboard End', 0)
    string_y_at_fb_end = derived.get('String Y at Fingerboard End', 0)
    fb_surface_point_x = derived.get('Fingerboard Surface Point X', 0)
    fb_surface_point_y = derived.get('Fingerboard Surface Point Y', 0)
    string_height_at_fb_end = derived.get('String Height at Fingerboard End', 0)

    # Add dimensions
    _add_dimensions(
        exporter, show_measurements, reference_line_end_x,
        nut_top_x, nut_top_y, bridge_top_x, bridge_top_y, string_line,
        string_length, neck_end_x, neck_end_y, overstand,
        body_stop, arching_height, bridge_height, body_length,
        rib_height, belly_edge_thickness, fb_surface_point_x,
        fb_surface_point_y, string_x_at_fb_end, string_y_at_fb_end,
        string_height_at_fb_end, intersect_x, intersect_y,
        nut_to_perp_distance
    )

    # Add document text
    _add_document_text(exporter, instrument_name, generator_url,
                       body_length, rib_height, belly_edge_thickness,
                       arching_height, bridge_height)

    # Generate and return SVG
    return exporter_to_svg(exporter)
    

def generate_top_view_svg(params: Dict[str, Any]) -> str:
  

    exporter = ExportSVG(scale=1.0)
    text_shape = Text("Top View", 10, font=FONT_NAME)
    exporter.add_shape(text_shape)
    return exporter_to_svg(exporter)
    

def generate_cross_section_svg(params: Dict[str, Any]) -> str:
    """

    Args:
        params: Validated parameter dictionary

    Returns:
        SVG string of cross-section view
    """
    exporter = ExportSVG(scale=1.0)
    exporter.add_shape(Text("Cross section",10,font=FONT_NAME))
    return exporter_to_svg(exporter)


def generate_radius_template_svg(params: Dict[str, Any]) -> str:
    """
    Generate fingerboard radius checking template for 3D printing.

    Creates a rectangle with circular arc cutout based on:
    - fingerboard_radius (radius of the arc)
    - fingerboard_width_at_end (chord width)
    - Template is 10mm wider than fingerboard, minimum 25mm high

    Args:
        params: Dictionary of instrument parameters

    Returns:
        SVG string of the template
    """
    # Extract parameters
    fingerboard_radius = params.get('fingerboard_radius', 41.0)
    fb_width_at_end = params.get('fingerboard_width_at_end', 42.0)

    # Calculate template dimensions
    template_width = fb_width_at_end + 10.0
    half_template_width = template_width / 2.0

    # Calculate arc depth (sagitta for the template width, not fingerboard width)
    if half_template_width >= fingerboard_radius:
        # Edge case: radius too small for template width
        arc_depth = fingerboard_radius  # Approximate
        template_height = 25.0
    else:
        arc_depth = fingerboard_radius - math.sqrt(
            fingerboard_radius**2 - half_template_width**2
        )
        # Ensure minimum 25mm height
        template_height = max(25.0, arc_depth + 5.0)

    # Setup SVG exporter
    exporter = ExportSVG(scale=1.0, unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("drawing", fill_color=None, line_color=(0, 0, 0))
    exporter.add_layer("text", fill_color=(0, 0, 0), line_color=None)

    # Generate points for the template outline
    points = []

    # Define corners (before rotation)
    bottom_left = (-half_template_width, 0)
    bottom_right = (half_template_width, 0)
    top_right = (half_template_width, template_height)
    top_left = (-half_template_width, template_height)

    # Bottom and side edges
    points.append(bottom_left)
    points.append(bottom_right)
    points.append(top_right)

    # Arc along top edge - CONCAVE (cutting into rectangle)
    # For a concave arc, the center must be ABOVE the rectangle
    # Arc center positioned so it passes through the top corners
    arc_center_y = template_height + math.sqrt(fingerboard_radius**2 - half_template_width**2)

    num_arc_points = 50  # More points for smoother arc

    for i in range(num_arc_points + 1):
        t = i / num_arc_points
        # Calculate angle from arc center
        # Right corner angle
        angle_right = math.atan2(template_height - arc_center_y, half_template_width)
        # Left corner angle
        angle_left = math.atan2(template_height - arc_center_y, -half_template_width)

        # Interpolate angle (sweeping counter-clockwise from right to left)
        angle = angle_right + t * (angle_left - angle_right)

        x = fingerboard_radius * math.cos(angle)
        y = arc_center_y + fingerboard_radius * math.sin(angle)
        points.append((x, y))

    # Close back to start
    points.append(bottom_left)

    # Rotate all points 180 degrees around center (0, template_height/2)
    # For 180° rotation: (x, y) -> (-x, template_height - y)
    rotated_points = [(-x, template_height - y) for x, y in points]

    # Create polygon outline with rotated points
    template_polygon = Polygon(rotated_points, filled=False)
    exporter.add_shape(template_polygon, layer="drawing")

    # Add radius label centered near top (smaller text)
    # Keep text upright (not rotated with the shape)
    # After 180° rotation, flat edge is at top, so position text there
    radius_text = Text(f"{fingerboard_radius:.0f}mm", font_size=6.0, font=FONT_NAME)
    radius_text = radius_text.move(Location((0, template_height - 8)))
    exporter.add_shape(radius_text, layer="text")

    return exporter_to_svg(exporter)


def generate_multi_view_svg(params: Dict[str, Any]) -> dict:
    """
    Generates all views for violin neck including radius template.

    Args:
        params: Validated parameter dictionary

    Returns:
        Dictionary with:
        {
            'side': SVG string,
            'top': SVG string,
            'cross_section': SVG string,
            'radius_template': SVG string
        }
    """
    return {
        'side': generate_side_view_svg(params),
        'top': generate_top_view_svg(params),
        'cross_section': generate_cross_section_svg(params),
        'radius_template': generate_radius_template_svg(params)
    }


if __name__ == '__main__':
    # Test with default parameters
    from instrument_parameters import get_default_values

    params = get_default_values()

    print("Generating test template...")
    try:
        derived = calculate_derived_values(params)
        print(derived)
        svg = generate_side_view_svg(params)
        print(f"✓ Generated SVG ({len(svg)} bytes)")

        # Save test output
        with open('test_neck_template.svg', 'w') as f:
            f.write(svg)
        print("✓ Saved to test_neck_template.svg")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
