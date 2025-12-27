"""
Instrument Neck Geometry Generator

This is where your Build123d geometry expertise goes.
"""

from buildprimitives import *
from buildprimitives import FONT_NAME, TITLE_FONT_SIZE, FOOTER_FONT_SIZE, PTS_MM  # Font constants
from instrument_parameters import CalculationMode
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
    fret_positions = calculate_fret_positions(vsl, params.get('no_frets') or 24)
    arching_height = params.get('arching_height') or 0
    overstand = params.get('overstand') or 0
    # body_length = params.get('body_length') or 0
    # rib_height = params.get('rib_height') or 0
    fingerboard_length = params.get('fingerboard_length') or 0
    fb_thickness_at_join = params.get('fb_thickness_at_join') or 0
    fb_thickness_at_nut = params.get('fb_thickness_at_nut') or 0
    # neck_thickness_at_first = params.get('neck_thickness_at_first') or 0
    # neck_thickness_at_seventh = params.get('neck_thickness_at_seventh') or 0
    bridge_height = params.get('bridge_height') or 0
    # show_rib_reference = params.get('show_rib_reference', True)

    string_height_nut = params.get('string_height_nut') or 0
    
    calculation_mode = params.get('calculation_mode') or CalculationMode.BODY_STOP_DRIVEN
    string_height_at_join = 0
    bridge_top_x = 0 # see below
    bridge_top_y = arching_height + bridge_height
    body_stop = 0 # see below
    string_angle_to_ribs = 0 # see below
    string_angle_to_ribs_rad = 0 # see below
    string_nut_to_join = 0 # see below
    neck_stop = 0 # see below
    if (calculation_mode == CalculationMode.BODY_STOP_DRIVEN.name):
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
    elif (calculation_mode == CalculationMode.FRET_JOIN_DRIVEN.name):
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

    return derived
    
def calculate_fret_positions(vsl: float, no_frets: int) -> list[float]:
    fret_positions = []
    for i in range(no_frets):
        fret_positions.append(vsl -(vsl / (2 ** (i / 12))))
    return fret_positions


def exporter_to_svg(exp: ExportSVG) -> str:
    """Convert ExportSVG to SVG string without temp files."""
    return exp.write(filename=None)




def generate_side_view_svg(params: Dict[str, Any]) -> str:
    vsl = params.get('vsl')
    # neck_stop = params.get('neck_stop')
    body_stop = params.get('body_stop')
    arching_height = params.get('arching_height')
    body_length = params.get('body_length')
    rib_height = params.get('rib_height')
    neck_thickness_at_first = params.get('neck_thickness_at_first')
    neck_thickness_at_seventh = params.get('neck_thickness_at_seventh')
    bridge_height = params.get('bridge_height')
    belly_edge_thickness = params.get('belly_edge_thickness', 3.5)  # Default to 3.5mm if not provided
    body_width = params.get('body_width')
    overstand = params.get('overstand', 0)
    fb_thickness_at_nut = params.get('fb_thickness_at_nut', 5.0)
    fb_thickness_at_join = params.get('fb_thickness_at_join', 7.0)
    string_height_nut = params.get('string_height_nut', 0.5)
    string_height_eof = params.get('string_height_eof', 4.0)
    fingerboard_length = params.get('fingerboard_length', 270.0)
    instrument_name = params.get('instrument_name', 'Instrument')
    generator_url = params.get('_generator_url', 'https://github.com/pzfreo/diagram-creator')
    show_measurements = params.get('show_measurements', True)
    show_rib_reference = params.get('show_rib_reference', True)

    derived = calculate_derived_values(params)
    body_stop = derived.get('Body Stop', body_stop) #calculated body_stop should work for Mandolins
    neck_angle_deg = derived.get('Neck Angle', 0)
    neck_stop = derived.get('Neck Stop', 0)
    string_length = derived.get('String Length', 0)
    nut_top_y = derived.get('Nut Relative to Ribs', 0)

    # Extract geometry values from derived dictionary
    neck_angle_rad = derived.get('Neck Angle (rad)', 0)
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

    

    # Export to SVG
    exporter = ExportSVG(scale=1.0,unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("text",fill_color=(0,0,255),line_type=LineType.HIDDEN)
    exporter.add_layer("drawing",fill_color=None, line_color=(0,0,0),line_type=LineType.CONTINUOUS)
    exporter.add_layer("schematic",fill_color=None, line_color=(0,0,0),line_type=LineType.DASHED)

    # Reference layer - dotted line, invisible if show_rib_reference is False
    ref_color = (0,0,0) if show_rib_reference else None
    exporter.add_layer("reference",fill_color=None, line_color=ref_color,line_type=LineType.HIDDEN)

    # Dimension layers - invisible if show_measurements is False
    dim_color = (255,0,0) if show_measurements else None
    exporter.add_layer("dimensions",fill_color=dim_color, line_color=dim_color,line_type=LineType.DASHED)
    exporter.add_layer("extensions",fill_color=None, line_color=dim_color,line_type=LineType.CONTINUOUS)
    exporter.add_layer("arrows",fill_color=dim_color, line_color=dim_color,line_type=LineType.CONTINUOUS)

    # Add belly edge thickness rectangle at top
    belly_rect = Rectangle(width=body_length, height=belly_edge_thickness)
    belly_rect = belly_rect.move(Location((body_length/2, belly_edge_thickness/2)))
    exporter.add_shape(belly_rect, layer="drawing")

    # Add rectangle for body (ribs) with top at belly edge thickness
    # Rectangle is centered by default, so we need to move it
    rect = Rectangle(width=body_length, height=rib_height)
    rect = rect.move(Location((body_length/2, belly_edge_thickness - rib_height/2)))
    exporter.add_shape(rect, layer="drawing")

    # Add arched top as simple line segments (schematic representation):
    # The arch rises from the top of the belly to peak at arching_height (measured from ribs)
    # Using straight lines instead of spline to ensure arch actually reaches the peak height
    arch_left = Edge.make_line((0, belly_edge_thickness), (body_stop, arching_height))
    arch_right = Edge.make_line((body_stop, arching_height), (body_length, belly_edge_thickness))
    exporter.add_shape(arch_left, layer="schematic")
    exporter.add_shape(arch_right, layer="schematic")

    # Add vertical line from arch peak extending by bridge_height
    bridge_line = Edge.make_line((body_stop, arching_height), (body_stop, arching_height + bridge_height))
    exporter.add_shape(bridge_line, layer="drawing")

    # Add neck angle reference lines
    # Line 1: Vertical from (0, 0) to (0, overstand)
    neck_vertical_line = Edge.make_line((0, 0), (0, overstand))
    exporter.add_shape(neck_vertical_line, layer="drawing")

    # Line 2: From (0, overstand) at neck_angle, going down and left for length neck_stop
    # Using precomputed values from derived dictionary
    neck_angled_line = Edge.make_line((0, overstand), (neck_end_x, neck_end_y))
    exporter.add_shape(neck_angled_line, layer="drawing")

    # Add nut as a quarter circle at the end of the neck
    # The quarter circle is centered at the nut position and extends perpendicular to the neck surface
    # Using precomputed nut_radius and neck_line_angle from derived dictionary

    # The quarter circle extends perpendicular to the neck surface, away from body and above neck
    # Rotated 180 degrees to extend away from body (left) and above the neck
    start_angle = neck_line_angle - math.pi/2  # Perpendicular outward (rotated 180°)
    end_angle = start_angle + math.pi/2  # Quarter circle (90 degrees)

    # Create the quarter circle using line segments
    num_segments = 12
    nut_arc_points = []
    for i in range(num_segments + 1):
        t = i / num_segments
        angle = start_angle + t * (end_angle - start_angle)
        px = neck_end_x + nut_radius * math.cos(angle)
        py = neck_end_y + nut_radius * math.sin(angle)
        nut_arc_points.append((px, py))

    # Create arc as a series of line segments on schematic layer
    # Draw every other segment to create a dashed effect
    for i in range(len(nut_arc_points) - 1):
        if i % 2 == 0:  # Only draw even-indexed segments for dashed effect
            nut_segment = Edge.make_line(nut_arc_points[i], nut_arc_points[i+1])
            exporter.add_shape(nut_segment, layer="schematic")

    # Add radial lines from center to arc endpoints to complete the pie slice
    radius_line_1 = Edge.make_line((neck_end_x, neck_end_y), nut_arc_points[0])
    exporter.add_shape(radius_line_1, layer="schematic")
    radius_line_2 = Edge.make_line((neck_end_x, neck_end_y), nut_arc_points[-1])
    exporter.add_shape(radius_line_2, layer="schematic")

    # Add angle annotation between the two lines (use rounded value for display)
    for shape, layer in create_angle_dimension(neck_vertical_line, neck_angled_line,
                                              label=f"{neck_angle_deg:.1f}°",
                                              arc_radius=12, line_extension=0, text_inside=True):
        exporter.add_shape(shape, layer=layer)

    # Add fingerboard
    # Fingerboard bottom: runs along the neck surface from nut toward body for length fingerboard_length
    # Using precomputed fingerboard geometry from derived dictionary
    fb_bottom_line = Edge.make_line((neck_end_x, neck_end_y), (fb_bottom_end_x, fb_bottom_end_y))
    exporter.add_shape(fb_bottom_line, layer="drawing")

    # Fingerboard left edge (at nut): perpendicular to bottom, length fb_thickness_at_nut
    fb_top_left_x = neck_end_x + fb_thickness_at_nut * math.cos(fb_direction_angle + math.pi/2)
    fb_top_left_y = neck_end_y + fb_thickness_at_nut * math.sin(fb_direction_angle + math.pi/2)
    fb_left_edge = Edge.make_line((neck_end_x, neck_end_y), (fb_top_left_x, fb_top_left_y))
    exporter.add_shape(fb_left_edge, layer="drawing")

    # Fingerboard top edge: using precomputed thickness at end

    # Top right corner: offset perpendicular from bottom right corner
    fb_top_right_x = fb_bottom_end_x + fb_thickness_at_end * math.cos(fb_direction_angle + math.pi/2)
    fb_top_right_y = fb_bottom_end_y + fb_thickness_at_end * math.sin(fb_direction_angle + math.pi/2)
    fb_top_edge = Edge.make_line((fb_top_left_x, fb_top_left_y), (fb_top_right_x, fb_top_right_y))
    exporter.add_shape(fb_top_edge, layer="drawing")

    # Fingerboard right edge: closes the rectangle
    fb_right_edge = Edge.make_line((fb_bottom_end_x, fb_bottom_end_y), (fb_top_right_x, fb_top_right_y))
    exporter.add_shape(fb_right_edge, layer="drawing")

    # Add strings from top of nut to top of bridge
    # Using precomputed nut_top and bridge_top positions from derived dictionary

    # Add horizontal reference line from top of ribs (0,0) extending 20mm beyond nut
    # This is a dotted reference line (controlled by show_rib_reference parameter)
    reference_line_end_x = nut_top_x - 20
    reference_line = Edge.make_line((0, 0), (reference_line_end_x, 0))
    exporter.add_shape(reference_line, layer="reference")

    # Draw string line
    string_line = Edge.make_line((nut_top_x, nut_top_y), (bridge_top_x, bridge_top_y))
    exporter.add_shape(string_line, layer="drawing")


    # Dimension: vertical distance from ribs (y=0) to top of nut
    # Only show if both measurements and rib reference are enabled
    if show_measurements and show_rib_reference:
        rib_to_nut_feature_line = Edge.make_line((reference_line_end_x, 0), (reference_line_end_x, nut_top_y))
        for shape, layer in create_vertical_dimension(rib_to_nut_feature_line,
                                                       f"{nut_top_y:.1f}",
                                                       offset_x=-8, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    # Add diagonal dimension for string length (using precomputed value from derived dictionary)
    for shape, layer in create_diagonal_dimension(string_line, f"{string_length:.1f} Calculated",
                                                   offset_distance=10, font_size=DIMENSION_FONT_SIZE):
        exporter.add_shape(shape, layer=layer)

    # Add dimension from nut to where string crosses a perpendicular to neck at body join
    # The perpendicular is at (0, overstand) and perpendicular to the neck surface
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
    # String: P = (nut_top_x, nut_top_y) + t * (string_dx, string_dy)
    # Perpendicular: Q = (0, overstand) + s * (perp_neck_dx, perp_neck_dy)
    # Solve: nut_top_x + t*string_dx = 0 + s*perp_neck_dx
    #        nut_top_y + t*string_dy = overstand + s*perp_neck_dy

    # Using Cramer's rule to solve the 2x2 system
    det = string_dx * perp_neck_dy - string_dy * perp_neck_dx

    if abs(det) > 1e-10:  # Lines are not parallel
        t = ((0 - nut_top_x) * perp_neck_dy - (overstand - nut_top_y) * perp_neck_dx) / det

        # Calculate intersection point
        intersect_x = nut_top_x + t * string_dx
        intersect_y = nut_top_y + t * string_dy

        # Calculate distance along string from nut to intersection
        nut_to_perp_distance = math.sqrt(
            (intersect_x - nut_top_x)**2 + (intersect_y - nut_top_y)**2
        )

        # Create dimension line along this portion of the string (above the full string dimension)
        nut_to_perp_line = Edge.make_line((nut_top_x, nut_top_y), (intersect_x, intersect_y))
        for shape, layer in create_diagonal_dimension(nut_to_perp_line,
                                                       f"{nut_to_perp_distance:.1f}",
                                                       offset_distance=20, font_size=DIMENSION_FONT_SIZE):
            exporter.add_shape(shape, layer=layer)

    # Calculate string height above end of fingerboard (perpendicular to fingerboard surface)
    # Find the position along the fingerboard bottom at fingerboard_length
    # This is the same as fb_bottom_end position

    # Find where the string crosses at this position along the fingerboard
    # We need to find the intersection or projection
    # String line goes from (nut_top_x, nut_top_y) to (bridge_top_x, bridge_top_y)
    # We want to find the string position at the same distance along the fingerboard as fb_bottom_end

    # Use parametric approach: find string position at the x,y position of fingerboard end
    # Calculate where string intersects with perpendicular from fingerboard end
    string_dx = bridge_top_x - nut_top_x
    string_dy = bridge_top_y - nut_top_y

    # Vector from nut to fingerboard end (along fingerboard)
    fb_dx = fb_bottom_end_x - neck_end_x
    fb_dy = fb_bottom_end_y - neck_end_y

    # Find parameter t along string line for the position above fingerboard end
    # Project the fingerboard endpoint onto the string line direction
    if string_dx != 0:
        t = fb_dx / string_dx
    else:
        t = fb_dy / string_dy if string_dy != 0 else 0

    string_x_at_fb_end = nut_top_x + t * string_dx
    string_y_at_fb_end = nut_top_y + t * string_dy

    # Calculate perpendicular distance from string point to fingerboard top surface
    # Vector from fingerboard top surface to string
    vec_x = string_x_at_fb_end - fb_top_right_x
    vec_y = string_y_at_fb_end - fb_top_right_y

    # Perpendicular direction to fingerboard (fb_direction_angle + pi/2)
    perp_angle = fb_direction_angle + math.pi/2
    perp_dx = math.cos(perp_angle)
    perp_dy = math.sin(perp_angle)

    # Project vector onto perpendicular direction (dot product)
    string_height_at_fb_end = vec_x * perp_dx + vec_y * perp_dy

    # Point on fingerboard surface directly below string (for dimension line)
    fb_surface_point_x = string_x_at_fb_end - string_height_at_fb_end * perp_dx
    fb_surface_point_y = string_y_at_fb_end - string_height_at_fb_end * perp_dy

    # Add dimension annotations using helper functions
    # (DIMENSION_FONT_SIZE already defined above)

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

    # Title text - centered horizontally, 2.5cm above the highest point
    # Highest point is the top of the bridge line (plus some margin for dimension text)
    max_y = arching_height + bridge_height
    title_gap = 25  # 2.5cm gap to account for dimension lines and text
    title_text = Text(instrument_name, TITLE_FONT_SIZE, font=FONT_NAME)
    # Center the title (approximate centering based on character width)
    title_width_approx = len(instrument_name) * TITLE_FONT_SIZE * 0.6
    title_text = title_text.move(Location((body_length/2 - title_width_approx/2, max_y + title_gap)))
    exporter.add_shape(title_text, layer="text")

    # Find the minimum y coordinate to place footer below everything
    # The lowest point is from the dimension lines below the body
    bottom_y = belly_edge_thickness - rib_height
    min_y = bottom_y - 30 - 15  # Below the body_length dimension line (-30) and gap (-15)

    # Footer text - small text with generator URL
    footer_text = Text(f"Generated by {generator_url}", FOOTER_FONT_SIZE, font=FONT_NAME)
    footer_text = footer_text.move(Location((0, min_y)))
    exporter.add_shape(footer_text, layer="text")

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
    
    


def generate_multi_view_svg(params: Dict[str, Any]) -> dict:
    """
    Generates all three views for violin neck.

    Args:
        params: Validated parameter dictionary

    Returns:
        Dictionary with:
        {
            'side': SVG string,
            'top': SVG string,
            'cross_section': SVG string
        }
    """
    return {
        'side': generate_side_view_svg(params),
        'top': generate_top_view_svg(params),
        'cross_section': generate_cross_section_svg(params)
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
