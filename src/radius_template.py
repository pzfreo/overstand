"""
Fingerboard radius template generator for 3D printing.

Uses matplotlib TextPath to convert text to bezier curves for slicer-compatible cutouts.
"""

import math
from typing import Dict, Any
from constants import (
    TEMPLATE_WIDTH_MARGIN,
    MIN_FLAT_AREA_HEIGHT,
    ARC_POINT_RESOLUTION,
    TEXT_HEIGHT_FRACTION,
    TEXT_WIDTH_FACTOR,
    TEXT_MARGIN_FRACTION,
    SVG_MARGIN
)

# Font URL configuration for TextPath
# This will be served from GitHub Pages to avoid CORS issues
FONT_URL = "https://paulhermany.github.io/diagram-creator/fonts/AllertaStencil-Regular.ttf"


def _text_to_svg_path_with_textpath(text: str, x: float, y: float, font_size: float, font_url: str = None) -> str:
    """
    Convert text to SVG path using matplotlib TextPath with bezier curves.

    Args:
        text: Text string to convert (e.g., "41mm")
        x, y: Starting position for text
        font_size: Height of text in mm
        font_url: URL to font file (defaults to FONT_URL constant)

    Returns:
        SVG path string with M, L, C, Q commands (bezier curves), or None if matplotlib unavailable
    """
    if font_url is None:
        font_url = FONT_URL

    try:
        from matplotlib.textpath import TextPath
        from matplotlib.font_manager import FontProperties
        from matplotlib.path import Path as MplPath
        import os

        # Font should be pre-loaded by JavaScript into Pyodide filesystem
        font_filename = "AllertaStencil-Regular.ttf"
        font_path = f"/tmp/{font_filename}"

        # Check if font exists
        if not os.path.exists(font_path):
            print(f"Error: Font not found at {font_path}. Text cutouts will not be generated.")
            return None

        # Load font properties
        fp = FontProperties(fname=font_path)

        # Create TextPath - generates bezier curves
        text_path = TextPath((0, 0), text, size=font_size, prop=fp)

        # Convert matplotlib path to SVG path commands
        svg_commands = []

        for vertices, code in text_path.iter_segments():
            # Apply offset to position text
            # Mirror horizontally by negating x coordinates (so text is readable when flipped)
            if code == MplPath.MOVETO:
                vx, vy = -(vertices[0] + x), vertices[1] + y
                svg_commands.append(f"M {vx:.2f} {vy:.2f}")
            elif code == MplPath.LINETO:
                vx, vy = -(vertices[0] + x), vertices[1] + y
                svg_commands.append(f"L {vx:.2f} {vy:.2f}")
            elif code == MplPath.CURVE3:  # Quadratic bezier
                x1, y1 = -(vertices[0] + x), vertices[1] + y
                x2, y2 = -(vertices[2] + x), vertices[3] + y
                svg_commands.append(f"Q {x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f}")
            elif code == MplPath.CURVE4:  # Cubic bezier
                x1, y1 = -(vertices[0] + x), vertices[1] + y
                x2, y2 = -(vertices[2] + x), vertices[3] + y
                x3, y3 = -(vertices[4] + x), vertices[5] + y
                svg_commands.append(f"C {x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f} {x3:.2f} {y3:.2f}")
            elif code == MplPath.CLOSEPOLY:
                svg_commands.append("Z")

        return " ".join(svg_commands)

    except ImportError as e:
        print(f"Warning: matplotlib not available ({e}), text cutouts will not be generated")
        return None
    except Exception as e:
        print(f"Error generating text path: {e}")
        return None


def generate_radius_template_svg(params: Dict[str, Any]) -> str:
    """
    Generate fingerboard radius checking template for 3D printing.

    Creates a rectangle with circular arc cutout based on:
    - fingerboard_radius (radius of the arc)
    - fingerboard_width_at_end (chord width)
    - Template is 10mm wider than fingerboard, minimum 25mm high
    - Text appears as cutout holes using matplotlib TextPath (bezier curves)

    Args:
        params: Dictionary of instrument parameters

    Returns:
        SVG string of the template
    """
    # Extract parameters
    fingerboard_radius = params.get('fingerboard_radius', 41.0)
    fb_width_at_end = params.get('fingerboard_width_at_end', 42.0)

    # Calculate template dimensions
    template_width = fb_width_at_end + TEMPLATE_WIDTH_MARGIN
    half_template_width = template_width / 2.0

    # Calculate arc depth (sagitta for the template width, not fingerboard width)
    if half_template_width >= fingerboard_radius:
        # Edge case: radius too small for template width
        arc_depth = fingerboard_radius  # Approximate
        template_height = 20.0
    else:
        arc_depth = fingerboard_radius - math.sqrt(
            fingerboard_radius**2 - half_template_width**2
        )
        # Ensure minimum flat area for text
        template_height = arc_depth + MIN_FLAT_AREA_HEIGHT

    # Generate points for the template outline
    # Arc at BOTTOM, flat edge at TOP (readable when printed)
    points = []

    # Start from top-left, go clockwise
    top_left = (-half_template_width, template_height)
    top_right = (half_template_width, template_height)

    points.append(top_left)
    points.append(top_right)

    # Right side edge
    points.append((half_template_width, 0))

    # Arc along BOTTOM edge - CONCAVE (cutting into rectangle)
    # Arc center is BELOW the rectangle (negative y)
    if half_template_width >= fingerboard_radius:
        raise ValueError(
            f"Fingerboard radius ({fingerboard_radius:.1f}mm) must be larger than half the template width ({half_template_width:.1f}mm). "
            f"Increase fingerboard_radius or decrease fb_width_at_end."
        )

    arc_center_y = -math.sqrt(fingerboard_radius**2 - half_template_width**2)

    num_arc_points = ARC_POINT_RESOLUTION

    # Sweep from right to left along bottom arc
    for i in range(num_arc_points + 1):
        t = i / num_arc_points
        # Right corner angle (at bottom right: x=half_w, y=0)
        angle_right = math.atan2(0 - arc_center_y, half_template_width)
        # Left corner angle (at bottom left: x=-half_w, y=0)
        angle_left = math.atan2(0 - arc_center_y, -half_template_width)

        # Interpolate angle
        angle = angle_right + t * (angle_left - angle_right)

        x = fingerboard_radius * math.cos(angle)
        y = arc_center_y + fingerboard_radius * math.sin(angle)
        points.append((x, y))

    # Left side edge
    points.append((-half_template_width, 0))

    # Close back to start
    points.append(top_left)

    # Build rectangle path (will be part of compound path)
    rect_path_d = "M " + " L ".join([f"{x},{y}" for x, y in points]) + " Z"

    # Generate text cutouts using matplotlib TextPath
    # Text positioned at TOP (flat edge), readable orientation
    radius_str = f"{fingerboard_radius:.0f}mm"
    # Text height is fraction of flat area
    flat_area = template_height - arc_depth
    char_height = flat_area * TEXT_HEIGHT_FRACTION

    # Estimate text width for centering
    text_width = len(radius_str) * char_height * TEXT_WIDTH_FACTOR
    text_x = -text_width / 2
    # Position text baseline with margin from edge
    text_margin = char_height * TEXT_MARGIN_FRACTION
    text_y = template_height - char_height - text_margin

    # Get text as bezier curve paths
    text_path_d = _text_to_svg_path_with_textpath(radius_str, text_x, text_y, char_height)

    # Calculate bounds for SVG viewBox
    all_x = [p[0] for p in points]
    all_y = [p[1] for p in points]

    # Include text bounds in viewBox calculation
    if text_path_d:
        # Add text bounding box to viewBox calculation
        text_width_estimate = len(radius_str) * char_height * TEXT_WIDTH_FACTOR
        all_x.extend([text_x, text_x + text_width_estimate])
        all_y.extend([text_y, text_y + char_height])

    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)

    viewBox = f"{min_x - SVG_MARGIN} {min_y - SVG_MARGIN} {max_x - min_x + 2*SVG_MARGIN} {max_y - min_y + 2*SVG_MARGIN}"

    # Build compound SVG path using user's proven approach
    # Single path with fill-rule="evenodd" where text overlaps create holes
    if text_path_d:
        # Combine rectangle and text into single compound path
        # With evenodd fill rule, overlapping text creates cutout holes
        combined_path_d = f"{rect_path_d} {text_path_d}"

        # Apply 180° rotation transform to entire template
        # This makes it printable upside-down (arc at top, text at bottom but upside down)
        # When you flip the physical print, text is readable and arc is positioned correctly
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        transform = f"rotate(180, {center_x}, {center_y})"

        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewBox}" width="{max_x - min_x + 2*SVG_MARGIN}mm" height="{max_y - min_y + 2*SVG_MARGIN}mm">
  <path fill="black" stroke="none" fill-rule="evenodd" transform="{transform}" d="{combined_path_d}"/>
</svg>'''
    else:
        # Fallback: just the rectangle without text cutouts
        print("Warning: Text cutouts not generated, showing template outline only")
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewBox}" width="{max_x - min_x + 2*SVG_MARGIN}mm" height="{max_y - min_y + 2*SVG_MARGIN}mm">
  <path fill="black" stroke="black" stroke-width="0.5" d="{rect_path_d}"/>
</svg>'''

    return svg
