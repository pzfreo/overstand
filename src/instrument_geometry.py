"""
Overstand - Instrument Geometry Orchestrator

This module acts as an orchestrator, combining logic from:
- geometry_engine.py: Pure mathematical calculations
- svg_renderer.py: SVG drawing and rendering
- view_generator.py: HTML view generation
"""

from buildprimitives import *
import geometry_engine
import svg_renderer
import view_generator
from parameter_registry import InstrumentFamily
from radius_template import generate_radius_template_svg
from constants import (
    DEFAULT_FB_WIDTH_AT_NUT,
    DEFAULT_FB_WIDTH_AT_END,
    DEFAULT_FRETS_VIOL,
    DEFAULT_FRETS_GUITAR,
    DEFAULT_FRETS_VIOLIN
)
import math
from typing import Dict, Any, Tuple, List

# Re-export key functions for backward compatibility
from geometry_engine import calculate_sagitta, calculate_fret_positions
from view_generator import generate_fret_positions_view

def calculate_derived_values(params: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate derived values by orchestrating engine functions."""
    derived = {}
    vsl = params.get('vsl') or 0
    instrument_family = params.get('instrument_family') or InstrumentFamily.VIOLIN.name

    if params.get('no_frets') is not None:
        no_frets = params.get('no_frets')
    elif instrument_family == InstrumentFamily.VIOL.name:
        no_frets = DEFAULT_FRETS_VIOL
    elif instrument_family == InstrumentFamily.GUITAR_MANDOLIN.name:
        no_frets = DEFAULT_FRETS_GUITAR
    else:
        no_frets = DEFAULT_FRETS_VIOLIN

    fret_positions = geometry_engine.calculate_fret_positions(vsl, no_frets)

    fb_result = geometry_engine.calculate_fingerboard_thickness(params)
    derived.update(fb_result)
    fb_thickness_at_nut = fb_result['fb_thickness_at_nut']
    fb_thickness_at_join = fb_result['fb_thickness_at_join']

    if instrument_family in (InstrumentFamily.VIOLIN.name, InstrumentFamily.VIOL.name):
        angle_result = geometry_engine.calculate_string_angles_violin(params, vsl, fb_thickness_at_join)
    elif instrument_family == InstrumentFamily.GUITAR_MANDOLIN.name:
        angle_result = geometry_engine.calculate_string_angles_guitar(params, vsl, fret_positions, fb_thickness_at_join)
    else:
        raise ValueError("Invalid calculation mode")

    derived.update(angle_result)
    neck_stop = angle_result['neck_stop']
    string_angle_to_ribs_rad = angle_result['string_angle_to_ribs_rad']
    string_angle_to_fb = angle_result['string_angle_to_fb']

    neck_result = geometry_engine.calculate_neck_geometry(
        params, vsl, neck_stop, string_angle_to_ribs_rad, string_angle_to_fb,
        fb_thickness_at_nut, fb_thickness_at_join,
        body_stop=angle_result['body_stop']
    )
    neck_result['body_stop'] = angle_result['body_stop']
    derived.update(neck_result)

    fb_geom_result = geometry_engine.calculate_fingerboard_geometry(
        params, neck_stop,
        derived['neck_end_x'], derived['neck_end_y'],
        derived['neck_line_angle'],
        fb_thickness_at_nut, fb_thickness_at_join
    )
    derived.update(fb_geom_result)

    string_height_result = geometry_engine.calculate_string_height_and_dimensions(
        params,
        derived['neck_end_x'], derived['neck_end_y'],
        derived['nut_top_x'], derived['nut_top_y'],
        derived['bridge_top_x'], derived['bridge_top_y'],
        derived['fb_bottom_end_x'], derived['fb_bottom_end_y'],
        derived['fb_direction_angle'],
        derived['fb_thickness_at_end']
    )
    derived.update(string_height_result)

    # Add degree versions of internal angles for display
    derived['neck_line_angle_deg'] = derived['neck_line_angle'] * 180 / math.pi
    derived['fb_direction_angle_deg'] = derived['fb_direction_angle'] * 180 / math.pi

    # Calculate afterlength angle (angle of string from bridge to tailpiece relative to ribs)
    # Positive angle indicates downward slope from bridge to tailpiece
    body_length = params.get('body_length', 0)
    belly_edge_thickness = params.get('belly_edge_thickness', 0)
    tailpiece_height = params.get('tailpiece_height', 0)

    dx = body_length - derived['bridge_top_x']
    dy = derived['bridge_top_y'] - (belly_edge_thickness + tailpiece_height)
    derived['afterlength_angle'] = math.atan2(dy, dx) * 180 / math.pi

    # Calculate string break angle at the bridge
    derived['string_break_angle'] = 180 - derived['string_angle_to_ribs'] - derived['afterlength_angle']

    # Calculate percentage of string tension pushing downward on the belly
    # Convert angles from degrees to radians for sin calculation
    string_angle_rad = derived['string_angle_to_ribs'] * math.pi / 180
    afterlength_angle_rad = derived['afterlength_angle'] * math.pi / 180
    derived['downward_force_percent'] = (math.sin(string_angle_rad) + math.sin(afterlength_angle_rad)) * 100

    # Calculate viol-specific back break geometry
    if instrument_family == InstrumentFamily.VIOL.name:
        back_break_result = geometry_engine.calculate_viol_back_break(params)
        derived.update(back_break_result)
    else:
        derived['back_break_length'] = 0

    return derived

def generate_multi_view_svg(params: Dict[str, Any]) -> Dict[str, str]:
    """
    Main entry point for generating all SVG views.
    Restored for backward compatibility with instrument_generator.py.
    """
    side_svg = generate_side_view_svg(params)
    radius_template = generate_radius_template_svg(params)
    
    # Placeholder views for now (as in original code)
    return {
        'side': side_svg,
        'top': "Top View Placeholder",
        'cross_section': "Cross-Section Placeholder",
        'radius_template': radius_template
    }

def generate_side_view_svg(params: Dict[str, Any], show_measurements: bool = True) -> str:
    """Orchestrate full side view SVG generation."""
    derived = calculate_derived_values(params)

    exporter = svg_renderer.setup_exporter(show_measurements)

    # Check instrument family for viol-specific drawing
    instrument_family = params.get('instrument_family', InstrumentFamily.VIOLIN.name)

    # For viols, pass break coordinates to skip drawing rectangle below break
    if instrument_family == InstrumentFamily.VIOL.name:
        svg_renderer.draw_body(
            exporter, params.get('body_length', 0), params.get('belly_edge_thickness', 0),
            params.get('rib_height', 0), derived['body_stop'], params.get('arching_height', 0),
            viol_break_end_x=derived['break_end_x'], viol_break_end_y=derived['break_end_y']
        )
    else:
        svg_renderer.draw_body(
            exporter, params.get('body_length', 0), params.get('belly_edge_thickness', 0),
            params.get('rib_height', 0), derived['body_stop'], params.get('arching_height', 0)
        )

    # Draw viol-specific back break geometry
    if instrument_family == InstrumentFamily.VIOL.name:
        svg_renderer.draw_viol_back(
            exporter, params.get('body_length', 0), params.get('belly_edge_thickness', 0),
            params.get('rib_height', 0), params.get('top_block_height', 40),
            derived['break_start_x'], derived['break_start_y'],
            derived['break_end_x'], derived['break_end_y']
        )

    svg_renderer.draw_neck(
        exporter, params.get('overstand', 0), derived['neck_end_x'], derived['neck_end_y'],
        params.get('bridge_height', 0), derived['body_stop'], params.get('arching_height', 0),
        derived['nut_draw_radius'], derived['neck_line_angle'], derived['neck_angle']
    )
    
    svg_renderer.draw_fingerboard(
        exporter, derived['neck_end_x'], derived['neck_end_y'],
        derived['fb_bottom_end_x'], derived['fb_bottom_end_y'],
        derived['fb_thickness_at_nut'], derived['fb_thickness_at_end'],
        derived['fb_direction_angle'],
        params.get('fb_visible_height_at_nut', 0) or 4.5,
        params.get('fb_visible_height_at_join', 0) or 4.5
    )
    
    reference_line_end_x, string_line = svg_renderer.draw_string_and_references(
        exporter, derived['nut_top_x'], derived['nut_top_y'],
        derived['bridge_top_x'], derived['bridge_top_y']
    )
    
    svg_renderer.add_document_text(
        exporter, params.get('instrument_name', 'Instrument'), "https://github.com/pzfreo/diagram-creator",
        params.get('body_length', 0), params.get('rib_height', 0), params.get('belly_edge_thickness', 0),
        params.get('arching_height', 0), params.get('bridge_height', 0), derived['neck_end_x']
    )
    
    svg_renderer.add_dimensions(
        exporter, show_measurements,
        reference_line_end_x, derived['nut_top_x'], derived['nut_top_y'],
        derived['bridge_top_x'], derived['bridge_top_y'], string_line,
        derived['string_length'], derived['neck_end_x'], derived['neck_end_y'],
        params.get('overstand', 0), derived['body_stop'], params.get('arching_height', 0),
        params.get('bridge_height', 0), params.get('body_length', 0), params.get('rib_height', 0),
        params.get('belly_edge_thickness', 0), derived['fb_surface_point_x'],
        derived['fb_surface_point_y'], derived['string_x_at_fb_end'],
        derived['string_y_at_fb_end'], derived['string_height_at_fb_end'],
        derived['nut_perpendicular_intersection_x'], derived['nut_perpendicular_intersection_y'],
        derived['nut_to_perpendicular_distance'],
        tailpiece_height=params.get('tailpiece_height', 0),
        string_break_angle=derived['string_break_angle'],
        downward_force_percent=derived['downward_force_percent']
    )

    # Add viol-specific back break dimensions
    if instrument_family == InstrumentFamily.VIOL.name:
        svg_renderer.add_viol_back_dimensions(
            exporter, show_measurements,
            params.get('body_length', 0), params.get('belly_edge_thickness', 0),
            params.get('rib_height', 0), params.get('top_block_height', 40),
            params.get('break_angle', 15), derived['back_break_length'],
            derived['break_start_x'], derived['break_start_y'],
            derived['break_end_x'], derived['break_end_y']
        )

    return exporter.write(filename=None)
