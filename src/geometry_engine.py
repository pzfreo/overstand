"""
Overstand - Geometry Engine

This module contains pure mathematical calculations for instrument geometry,
independent of any drawing or UI logic.
"""

import math
from typing import Dict, Any, List
from constants import (
    DEFAULT_FINGERBOARD_RADIUS,
    DEFAULT_FB_VISIBLE_HEIGHT_AT_NUT,
    DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN,
    DEFAULT_FB_WIDTH_AT_NUT,
    DEFAULT_FB_WIDTH_AT_END,
    DEFAULT_FRETS_VIOL,
    DEFAULT_FRETS_GUITAR,
    DEFAULT_FRETS_VIOLIN,
    EPSILON
)
from parameter_registry import InstrumentFamily

def calculate_sagitta(radius: float, width: float) -> float:
    """
    Calculate sagitta (height of arc) given radius and chord width.
    """
    if radius <= 0 or width <= 0:
        return 0.0

    half_width = width / 2.0
    if half_width >= radius:
        return width ** 2 / (8.0 * radius)

    return radius - math.sqrt(radius ** 2 - half_width ** 2)

def calculate_fingerboard_thickness(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate fingerboard thickness including sagitta for radiused fingerboard.
    """
    result = {}

    fingerboard_radius = params.get('fingerboard_radius') or DEFAULT_FINGERBOARD_RADIUS
    fb_visible_height_at_nut = params.get('fb_visible_height_at_nut') or DEFAULT_FB_VISIBLE_HEIGHT_AT_NUT
    fb_visible_height_at_join = params.get('fb_visible_height_at_join') or DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN
    fb_width_at_nut = params.get('fingerboard_width_at_nut') or DEFAULT_FB_WIDTH_AT_NUT
    fb_width_at_join = params.get('fingerboard_width_at_end') or DEFAULT_FB_WIDTH_AT_END

    sagitta_at_nut = calculate_sagitta(fingerboard_radius, fb_width_at_nut)
    sagitta_at_join = calculate_sagitta(fingerboard_radius, fb_width_at_join)

    fb_thickness_at_nut = fb_visible_height_at_nut + sagitta_at_nut
    fb_thickness_at_join = fb_visible_height_at_join + sagitta_at_join

    result['sagitta_at_nut'] = sagitta_at_nut
    result['sagitta_at_join'] = sagitta_at_join
    result['fb_thickness_at_nut'] = fb_thickness_at_nut
    result['fb_thickness_at_join'] = fb_thickness_at_join

    return result

def calculate_string_angles_violin(params: Dict[str, Any], vsl: float, fb_thickness_at_join: float) -> Dict[str, Any]:
    """
    Calculate string angles for violin/viol family instruments.
    """
    result = {}

    body_stop = params.get('body_stop') or 0
    arching_height = params.get('arching_height') or 0
    bridge_height = params.get('bridge_height') or 0
    overstand = params.get('overstand') or 0
    string_height_nut = params.get('string_height_nut') or 0
    string_height_eof = params.get('string_height_eof') or 0
    fingerboard_length = params.get('fingerboard_length') or 0

    string_height_at_join = (string_height_eof - string_height_nut) * ((vsl - body_stop) / fingerboard_length) + string_height_nut
    opposite = arching_height + bridge_height - overstand - fb_thickness_at_join - string_height_at_join
    string_angle_to_ribs_rad = math.atan(opposite / body_stop)
    string_angle_to_ribs = string_angle_to_ribs_rad * 180 / math.pi
    string_to_join = math.sqrt(opposite**2 + body_stop**2)
    string_nut_to_join = vsl - string_to_join
    neck_stop = math.cos(string_angle_to_ribs_rad) * string_nut_to_join
    opposite_string_to_fb = string_height_eof - string_height_nut
    string_angle_to_fb = math.atan(opposite_string_to_fb / fingerboard_length) * 180 / math.pi

    result['body_stop'] = body_stop
    result['neck_stop'] = neck_stop
    result['string_angle_to_ribs_rad'] = string_angle_to_ribs_rad
    result['string_angle_to_fb'] = string_angle_to_fb
    result['string_angle_to_ribs'] = string_angle_to_ribs
    result['string_angle_to_fingerboard'] = string_angle_to_fb

    return result

def calculate_string_angles_guitar(params: Dict[str, Any], vsl: float, fret_positions: List[float], fb_thickness_at_join: float) -> Dict[str, Any]:
    """
    Calculate string angles for guitar/mandolin family instruments.
    """
    result = {}

    fret_join = params.get('fret_join') or 12
    string_height_nut = params.get('string_height_nut') or 0
    string_height_12th_fret = params.get('string_height_12th_fret') or 0
    arching_height = params.get('arching_height') or 0
    bridge_height = params.get('bridge_height') or 0
    overstand = params.get('overstand') or 0

    string_height_at_join = ((string_height_12th_fret - string_height_nut) * (fret_positions[fret_join] / fret_positions[12])) + string_height_nut
    hypotenuse = vsl - fret_positions[fret_join]
    opposite = arching_height + bridge_height - overstand - fb_thickness_at_join - string_height_at_join
    string_angle_to_ribs_rad = math.asin(opposite / hypotenuse)
    string_angle_to_ribs = string_angle_to_ribs_rad * 180 / math.pi
    string_nut_to_join = fret_positions[fret_join]
    neck_stop = math.cos(string_angle_to_ribs_rad) * string_nut_to_join
    body_stop = math.cos(string_angle_to_ribs_rad) * hypotenuse
    opposite_string_to_join = string_height_at_join - string_height_nut
    string_angle_to_fb = math.atan(opposite_string_to_join / fret_positions[fret_join]) * 180 / math.pi

    result['body_stop'] = body_stop
    result['neck_stop'] = neck_stop
    result['string_angle_to_ribs_rad'] = string_angle_to_ribs_rad
    result['string_angle_to_fb'] = string_angle_to_fb
    result['string_angle_to_ribs'] = string_angle_to_ribs
    result['string_angle_to_fingerboard'] = string_angle_to_fb

    return result

def calculate_neck_geometry(params: Dict[str, Any], vsl: float, neck_stop: float, string_angle_to_ribs_rad: float,
                          string_angle_to_fb: float, fb_thickness_at_nut: float, fb_thickness_at_join: float,
                          body_stop: float = None) -> Dict[str, Any]:
    """
    Calculate neck angle and nut position.

    Args:
        body_stop: The body stop position. For GUITAR_MANDOLIN this is derived from fret
                   positions, so must be passed explicitly. Falls back to params if not provided.
    """
    result = {}

    arching_height = params.get('arching_height') or 0
    bridge_height = params.get('bridge_height') or 0
    overstand = params.get('overstand') or 0
    string_height_nut = params.get('string_height_nut') or 0

    # Use passed body_stop (for GUITAR_MANDOLIN) or fall back to params (for VIOLIN/VIOL)
    bridge_top_x = body_stop if body_stop is not None else params.get('body_stop', 0)
    bridge_top_y = arching_height + bridge_height
    nut_top_x = -neck_stop
    nut_top_y = bridge_top_y - math.sin(string_angle_to_ribs_rad) * vsl

    opposite_fb = fb_thickness_at_join - fb_thickness_at_nut
    fingerboard_angle = math.atan(opposite_fb / neck_stop) * 180 / math.pi
    neck_angle = 90 - (string_angle_to_ribs_rad * 180 / math.pi - string_angle_to_fb - fingerboard_angle)
    neck_angle_rad = neck_angle * math.pi / 180

    neck_end_x = 0 - neck_stop + math.cos(neck_angle_rad) * fb_thickness_at_nut
    neck_end_y = overstand - neck_stop * math.cos(neck_angle_rad)
    nut_draw_radius = fb_thickness_at_nut + string_height_nut
    neck_line_angle = math.atan2(neck_end_y - overstand, neck_end_x - 0)

    result['neck_angle'] = neck_angle
    result['neck_stop'] = neck_stop
    result['neck_angle_rad'] = neck_angle_rad
    result['neck_end_x'] = neck_end_x
    result['neck_end_y'] = neck_end_y
    result['nut_draw_radius'] = nut_draw_radius
    result['neck_line_angle'] = neck_line_angle
    result['nut_top_x'] = nut_top_x
    result['nut_top_y'] = nut_top_y
    result['bridge_top_x'] = bridge_top_x
    result['bridge_top_y'] = bridge_top_y

    string_length = math.sqrt((bridge_top_x - nut_top_x)**2 + (bridge_top_y - nut_top_y)**2)
    result['string_length'] = string_length
    result['nut_relative_to_ribs'] = nut_top_y

    return result

def calculate_fingerboard_geometry(params: Dict[str, Any], neck_stop: float, neck_end_x: float, neck_end_y: float,
                                 neck_line_angle: float, fb_thickness_at_nut: float, fb_thickness_at_join: float) -> Dict[str, Any]:
    """
    Calculate fingerboard geometry including direction angle and end position.
    """
    result = {}

    fingerboard_length = params.get('fingerboard_length') or 0

    fb_direction_angle = neck_line_angle + math.pi
    fb_bottom_end_x = neck_end_x + fingerboard_length * math.cos(fb_direction_angle)
    fb_bottom_end_y = neck_end_y + fingerboard_length * math.sin(fb_direction_angle)
    fb_thickness_at_end = fb_thickness_at_nut + (fb_thickness_at_join - fb_thickness_at_nut) * (fingerboard_length / neck_stop)

    result['fb_direction_angle'] = fb_direction_angle
    result['fb_bottom_end_x'] = fb_bottom_end_x
    result['fb_bottom_end_y'] = fb_bottom_end_y
    result['fb_thickness_at_end'] = fb_thickness_at_end

    return result

def calculate_string_height_and_dimensions(params: Dict[str, Any], neck_end_x: float, neck_end_y: float,
                                         nut_top_x: float, nut_top_y: float, bridge_top_x: float, bridge_top_y: float,
                                         fb_bottom_end_x: float, fb_bottom_end_y: float, fb_direction_angle: float,
                                         fb_thickness_at_end: float) -> Dict[str, Any]:
    """
    Calculate string height at fingerboard end and dimension points.
    """
    result = {}

    overstand = params.get('overstand') or 0

    perp_angle = fb_direction_angle + math.pi / 2
    fb_top_right_x = fb_bottom_end_x + fb_thickness_at_end * math.cos(perp_angle)
    fb_top_right_y = fb_bottom_end_y + fb_thickness_at_end * math.sin(perp_angle)

    neck_dx = neck_end_x - 0
    neck_dy = neck_end_y - overstand
    perp_neck_dx = -neck_dy
    perp_neck_dy = neck_dx

    string_dx = bridge_top_x - nut_top_x
    string_dy = bridge_top_y - nut_top_y

    det = string_dx * perp_neck_dy - string_dy * perp_neck_dx

    if abs(det) > EPSILON:
        t = ((0 - nut_top_x) * perp_neck_dy - (overstand - nut_top_y) * perp_neck_dx) / det
        intersect_x = nut_top_x + t * string_dx
        intersect_y = nut_top_y + t * string_dy
        nut_to_perp_distance = math.sqrt((intersect_x - nut_top_x)**2 + (intersect_y - nut_top_y)**2)
    else:
        intersect_x = 0.0
        intersect_y = 0.0
        nut_to_perp_distance = 0.0

    result['nut_perpendicular_intersection_x'] = intersect_x
    result['nut_perpendicular_intersection_y'] = intersect_y
    result['nut_to_perpendicular_distance'] = nut_to_perp_distance

    fb_dx = fb_bottom_end_x - neck_end_x
    fb_dy = fb_bottom_end_y - neck_end_y

    if string_dx != 0:
        t = fb_dx / string_dx
    else:
        t = fb_dy / string_dy if string_dy != 0 else 0

    string_x_at_fb_end = nut_top_x + t * string_dx
    string_y_at_fb_end = nut_top_y + t * string_dy

    vec_x = string_x_at_fb_end - fb_top_right_x
    vec_y = string_y_at_fb_end - fb_top_right_y

    perp_dx = math.cos(perp_angle)
    perp_dy = math.sin(perp_angle)

    string_height_at_fb_end = vec_x * perp_dx + vec_y * perp_dy

    fb_surface_point_x = string_x_at_fb_end - string_height_at_fb_end * perp_dx
    fb_surface_point_y = string_y_at_fb_end - string_height_at_fb_end * perp_dy

    result['string_x_at_fb_end'] = string_x_at_fb_end
    result['string_y_at_fb_end'] = string_y_at_fb_end
    result['fb_surface_point_x'] = fb_surface_point_x
    result['fb_surface_point_y'] = fb_surface_point_y
    result['string_height_at_fb_end'] = string_height_at_fb_end

    return result

def calculate_fret_positions(vsl: float, no_frets: int) -> List[float]:
    """Calculate fret positions from nut."""
    fret_positions = []
    for i in range(1, no_frets + 1):
        fret_positions.append(vsl - (vsl / (2 ** (i / 12))))
    return fret_positions


def calculate_viol_back_break(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate viol back break geometry.

    Viols have a flat back that "breaks" at an angle near the neck. The geometry has
    three sections:
    1. Vertical section: From belly down for top_block_height at x=0
    2. Break line: From bottom of vertical, angled at break_angle to meet back
    3. Flat back: From break point to tail

    Args:
        params: Dictionary containing:
            - break_angle: Angle of back break in degrees
            - top_block_height: Vertical distance from top of ribs to start of break
            - rib_height: Total rib height
            - body_length: Body length
            - belly_edge_thickness: Thickness of belly edge

    Returns:
        Dictionary with:
            - back_break_length: Distance from tail to break point
            - break_start_x/y: Start of break line (bottom of vertical section)
            - break_end_x/y: End of break line (on back)
    """
    result = {}

    break_angle_deg = params.get('break_angle', 15.0)
    top_block_height = params.get('top_block_height', 40.0)
    rib_height = params.get('rib_height', 100.0)
    body_length = params.get('body_length', 355.0)
    belly_edge_thickness = params.get('belly_edge_thickness', 3.5)

    # Convert angle to radians
    break_angle_rad = math.radians(break_angle_deg)

    # Y coordinates (belly is at belly_edge_thickness, back is at belly_edge_thickness - rib_height)
    belly_y = belly_edge_thickness
    back_y = belly_edge_thickness - rib_height

    # Break start: bottom of vertical section at x=0
    break_start_x = 0
    break_start_y = belly_y - top_block_height

    # Calculate remaining vertical drop to the back
    remaining_drop = rib_height - top_block_height

    # Calculate horizontal distance of break line
    # tan(angle) = opposite/adjacent = remaining_drop/break_horizontal
    if break_angle_rad < 0.001:  # Guard against zero/tiny angles
        break_horizontal = body_length  # Effectively horizontal
    else:
        break_horizontal = remaining_drop / math.tan(break_angle_rad)

    # Clamp break_horizontal to body_length
    if break_horizontal > body_length:
        break_horizontal = body_length

    # Break end point (on the back)
    break_end_x = break_horizontal
    break_end_y = back_y

    # Back break length is from tail to break point
    back_break_length = body_length - break_horizontal

    result['back_break_length'] = back_break_length
    result['break_start_x'] = break_start_x
    result['break_start_y'] = break_start_y
    result['break_end_x'] = break_end_x
    result['break_end_y'] = break_end_y
    result['break_angle_rad'] = break_angle_rad

    return result


def calculate_cross_section_geometry(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate geometry for the neck cross-section view at the body join.

    The cross-section is symmetrical about the Y-axis (X=0 is centerline).
    Y=0 is at the back plate level (button).

    Returns coordinates for:
    - Button (thin slice at back plate)
    - Neck sides (straight angled from button to top of block)
    - Fillet curve (from top of block to fingerboard width)
    - Fingerboard (full thickness with radiused top)
    """
    result = {}

    # Get instrument family to determine block height
    instrument_family = params.get('instrument_family', 'VIOLIN')

    # Block height varies by instrument family
    if instrument_family == InstrumentFamily.VIOL.name:
        block_height = params.get('top_block_height', params.get('rib_height', 35.0))
    else:
        block_height = params.get('rib_height', 35.0)

    # Get width parameters
    button_width = params.get('button_width_at_join', 28.0)
    neck_width_at_ribs = params.get('neck_width_at_top_of_ribs', 30.0)
    overstand = params.get('overstand', 6.0)

    # Fingerboard parameters
    fb_width_at_nut = params.get('fingerboard_width_at_nut', DEFAULT_FB_WIDTH_AT_NUT)
    fb_width_at_end = params.get('fingerboard_width_at_end', DEFAULT_FB_WIDTH_AT_END)
    fingerboard_length = params.get('fingerboard_length', 270.0)
    fingerboard_radius = params.get('fingerboard_radius', DEFAULT_FINGERBOARD_RADIUS)
    fb_visible_height_at_join = params.get('fb_visible_height_at_join', DEFAULT_FB_VISIBLE_HEIGHT_AT_JOIN)

    # Calculate neck_stop to determine position along fingerboard
    # For this, we need to get neck_stop from derived values or calculate it
    # Using body_stop and vsl to estimate neck_stop = vsl - body_stop
    vsl = params.get('vsl', 330.0)
    body_stop = params.get('body_stop', 195.0)
    neck_stop = vsl - body_stop

    # Interpolate fingerboard width at body join
    # Position along fingerboard as ratio (0 = nut, 1 = end)
    if fingerboard_length > 0:
        position_ratio = min(neck_stop / fingerboard_length, 1.0)
    else:
        position_ratio = 0.0

    fb_width_at_body_join = fb_width_at_nut + (fb_width_at_end - fb_width_at_nut) * position_ratio

    # Calculate fingerboard thickness at body join (including sagitta for curve)
    sagitta_at_join = calculate_sagitta(fingerboard_radius, fb_width_at_body_join)
    fb_thickness_at_join = fb_visible_height_at_join + sagitta_at_join

    # Y coordinates (from bottom to top)
    y_button = 0.0
    y_top_of_block = block_height
    y_fb_bottom = block_height + overstand
    y_fb_top = y_fb_bottom + fb_thickness_at_join

    # Half-widths (for symmetrical drawing about X=0)
    half_button_width = button_width / 2.0
    half_neck_width_at_ribs = neck_width_at_ribs / 2.0
    half_fb_width = fb_width_at_body_join / 2.0

    # Store results
    result['block_height'] = block_height
    result['overstand'] = overstand
    result['button_width'] = button_width
    result['neck_width_at_ribs'] = neck_width_at_ribs
    result['fb_width_at_body_join'] = fb_width_at_body_join
    result['fb_thickness_at_join'] = fb_thickness_at_join
    result['sagitta_at_join'] = sagitta_at_join
    result['fingerboard_radius'] = fingerboard_radius

    # Y coordinates
    result['y_button'] = y_button
    result['y_top_of_block'] = y_top_of_block
    result['y_fb_bottom'] = y_fb_bottom
    result['y_fb_top'] = y_fb_top

    # Half-widths for symmetrical drawing
    result['half_button_width'] = half_button_width
    result['half_neck_width_at_ribs'] = half_neck_width_at_ribs
    result['half_fb_width'] = half_fb_width

    return result
