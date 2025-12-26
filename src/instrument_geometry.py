"""
Instrument Neck Geometry Generator

This is where your Build123d geometry expertise goes.
"""

from buildprimitives import *
import math
from typing import Dict, Any, Tuple

import js
import os

# 1. Define the correct raw URL
font_url = "https://raw.githubusercontent.com/pzfreo/diagram-creator/main/src/Roboto.ttf"
font_file = "Roboto.ttf"
font_name = "Roboto"
PTS_MM = 0.352778
# Set dimension font size for all dimensions
dim_font_size = 8*PTS_MM


def download_font_sync(url, filename):
    """Downloads a binary file synchronously (blocking), avoiding async/await issues."""
    try:
        # Create a browser XMLHttpRequest
        req = js.XMLHttpRequest.new()
        req.open("GET", url, False)  # False = Synchronous
        
        # TRICK: Tell browser to treat data as user-defined text (preserves byte values)
        req.overrideMimeType("text/plain; charset=x-user-defined")
        req.send(None)
        
        if req.status == 200:
            # Convert the "text" back to raw bytes
            # We take the lower 8 bits of each character code
            binary_data = bytes(ord(c) & 0xFF for c in req.responseText)
            
            with open(filename, "wb") as f:
                f.write(binary_data)
            print(f"✓ Downloaded {filename} successfully")
        else:
            print(f"✗ Failed to download. Status: {req.status}")
            
    except Exception as e:
        print(f"✗ Error during download: {e}")

# 2. Run the download immediately (No await needed!)
if not os.path.exists(font_file):
    print(f"Downloading {font_file}...")
    download_font_sync(font_url, font_file)

# Font is already available - buildprimitives uses SVG text with font-family
# No need to register fonts with OCP since we're generating SVG directly
print(f"✓ Font ready: {font_name}")

class NeckGeometry:
    """
    Generates neck geometry from validated parameters.
    
    This class contains all the lutherie-specific geometry generation.
    Each method focuses on one component (neck, scroll, pegbox, etc.)
    """
    
    def __init__(self, params: Dict[str, Any]):
        """
        Initialize with validated parameters.
        
        Args:
            params: Dictionary of parameter values from instrument_parameters.py
        """
        self.params = params
        
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def interpolate(self, start_key: str, end_key: str, t: float) -> float:
        """
        Interpolate between two parameter values with optional curve.
        
        Args:
            start_key: Parameter name for start value (e.g., 'width_at_nut')
            end_key: Parameter name for end value (e.g., 'width_at_heel')
            t: Position along length (0.0 = start, 1.0 = end)
            
        Returns:
            Interpolated value
        """
        start = self.params[start_key]
        end = self.params[end_key]
        curve = self.params.get('taper_curve', 1.0)
        
        # Apply taper curve: t^curve for convex, t^(1/curve) for concave
        t_curved = t ** curve
        
        return start + (end - start) * t_curved
    
    # def get_width_at(self, position: float) -> float:
    #     """Get neck width at position (0=nut, 1=heel)"""
    #     return self.interpolate('width_at_nut', 'width_at_heel', position)


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
    neck_stop = params.get('neck_stop') or 0
    body_stop = params.get('body_stop') or 0
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

    string_height_nut = params.get('string_height_nut') or 0    
    string_height_eof = params.get('string_height_eof') or 0
    string_height_at_join = (string_height_eof - string_height_nut) * (neck_stop/fingerboard_length) + string_height_nut    
    
    opposite = arching_height + bridge_height - overstand - fb_thickness_at_join - string_height_at_join
    string_angle_to_ribs = math.atan(opposite / body_stop) * 180 / math.pi
    opposite_string_to_fb = string_height_eof - string_height_nut
    string_angle_to_fb = math.atan(opposite_string_to_fb / fingerboard_length) * 180 / math.pi
    opposite_fb = fb_thickness_at_join - fb_thickness_at_nut
    fingerboard_angle = round(  math.atan(opposite_fb / neck_stop) * 180 / math.pi, 1)
    neck_angle = 90-(string_angle_to_ribs-string_angle_to_fb-fingerboard_angle)
    derived['Neck Angle'] = round(neck_angle,1)
    return derived
    
    

def exporter_to_svg(exp: ExportSVG) -> str:
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as tmp:
        temp_path = tmp.name

    try:
        exp.write(temp_path)
        with open(temp_path, 'r') as f:
            svg_content = f.read()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return svg_content


def generate_neck_svg(params: Dict[str, Any]) -> str:
    """
    Main entry point for generating neck geometry.
    
    Args:
        params: Validated parameter dictionary
        
    Returns:
        SVG string of the complete neck template
    """
    neck_length = params.get('neck_length')
    
    exporter = ExportSVG(scale=1.0)
    exporter.add_shape(Text("Neck view",12*PTS_MM, font=font_name))
    
    return exporter_to_svg(exporter)
    

def create_dimension_arrows(p1, p2, arrow_size=3.0):
    """
    Create arrowheads at both ends of a dimension line using edge-based arrows.

    Args:
        p1: Start point (x, y)
        p2: End point (x, y)
        arrow_size: Size of arrowhead in mm

    Returns:
        List of Edge shapes for the arrows
    """
    x1, y1 = p1
    x2, y2 = p2

    # Calculate angle of the dimension line
    dx = x2 - x1
    dy = y2 - y1
    import math
    angle = math.atan2(dy, dx)

    arrows = []

    # Arrow at start point (two lines forming a V pointing inward)
    arrow1_left = (x1 + arrow_size * math.cos(angle + 2.8),
                   y1 + arrow_size * math.sin(angle + 2.8))
    arrow1_right = (x1 + arrow_size * math.cos(angle - 2.8),
                    y1 + arrow_size * math.sin(angle - 2.8))
    arrows.append(Edge.make_line((x1, y1), arrow1_left))
    arrows.append(Edge.make_line((x1, y1), arrow1_right))

    # Arrow at end point (two lines forming a V pointing inward)
    arrow2_left = (x2 - arrow_size * math.cos(angle + 2.8),
                   y2 - arrow_size * math.sin(angle + 2.8))
    arrow2_right = (x2 - arrow_size * math.cos(angle - 2.8),
                    y2 - arrow_size * math.sin(angle - 2.8))
    arrows.append(Edge.make_line((x2, y2), arrow2_left))
    arrows.append(Edge.make_line((x2, y2), arrow2_right))

    return arrows


def create_vertical_dimension(feature_line, label, offset_x=8,
                              extension_length=3, font_size=8*PTS_MM, arrow_size=3.0):
    """
    Create vertical dimension shapes from a vertical feature line.

    Args:
        feature_line: Edge representing the feature being dimensioned (vertical line)
        label: Text label for the dimension (e.g., "15.0")
        offset_x: How far to offset the dimension line from the feature
        extension_length: Length of extension line beyond dimension line
        font_size: Font size for dimension text
        arrow_size: Size of arrowheads

    Returns:
        List of (shape, layer) tuples to add to exporter
    """
    # Get endpoints from the feature line
    x = feature_line.position_at(0).X
    y_start = feature_line.position_at(0).Y
    y_end = feature_line.position_at(1).Y

    shapes = []

    # Extension lines (from feature to dimension line)
    ext_x = x + offset_x
    ext1 = Edge.make_line((x, y_start), (ext_x + extension_length, y_start))
    shapes.append((ext1, "extensions"))
    ext2 = Edge.make_line((x, y_end), (ext_x + extension_length, y_end))
    shapes.append((ext2, "extensions"))

    # Dimension line (dashed)
    dim_p1 = (ext_x, y_start)
    dim_p2 = (ext_x, y_end)
    dim_line = Edge.make_line(dim_p1, dim_p2)
    shapes.append((dim_line, "dimensions"))

    # Arrows at both ends
    arrows = create_dimension_arrows(dim_p1, dim_p2, arrow_size)
    for arrow in arrows:
        shapes.append((arrow, "arrows"))

    # Dimension text (centered vertically)
    text = Text(label, font_size, font=font_name)
    text_offset = font_size  # Offset text to the right of dimension line
    text = text.move(Location((ext_x + text_offset, (y_start + y_end) / 2)))
    shapes.append((text, "extensions"))

    return shapes


def create_diagonal_dimension(feature_line, label, offset_distance=8,
                             extension_length=3, font_size=8*PTS_MM, arrow_size=3.0):
    """
    Create diagonal dimension shapes from a diagonal feature line.

    Args:
        feature_line: Edge representing the feature being dimensioned (diagonal line)
        label: Text label for the dimension (e.g., "325.0")
        offset_distance: How far to offset the dimension line from the feature (perpendicular)
        extension_length: Length of extension line beyond dimension line
        font_size: Font size for dimension text
        arrow_size: Size of arrowheads

    Returns:
        List of (shape, layer) tuples to add to exporter
    """
    # Get endpoints from the feature line
    p1 = feature_line.position_at(0)
    p2 = feature_line.position_at(1)
    x1, y1 = p1.X, p1.Y
    x2, y2 = p2.X, p2.Y

    shapes = []

    # Calculate perpendicular direction (rotated 90 degrees counterclockwise)
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx**2 + dy**2)

    # Unit perpendicular vector (90 degrees counterclockwise)
    perp_x = -dy / length
    perp_y = dx / length

    # Offset points for dimension line
    offset_x1 = x1 + perp_x * offset_distance
    offset_y1 = y1 + perp_y * offset_distance
    offset_x2 = x2 + perp_x * offset_distance
    offset_y2 = y2 + perp_y * offset_distance

    # Extension lines (from feature to dimension line)
    ext1_end_x = offset_x1 + perp_x * extension_length
    ext1_end_y = offset_y1 + perp_y * extension_length
    ext1 = Edge.make_line((x1, y1), (ext1_end_x, ext1_end_y))
    shapes.append((ext1, "extensions"))

    ext2_end_x = offset_x2 + perp_x * extension_length
    ext2_end_y = offset_y2 + perp_y * extension_length
    ext2 = Edge.make_line((x2, y2), (ext2_end_x, ext2_end_y))
    shapes.append((ext2, "extensions"))

    # Dimension line (parallel to feature, but offset)
    dim_p1 = (offset_x1, offset_y1)
    dim_p2 = (offset_x2, offset_y2)
    dim_line = Edge.make_line(dim_p1, dim_p2)
    shapes.append((dim_line, "dimensions"))

    # Arrows at both ends
    arrows = create_dimension_arrows(dim_p1, dim_p2, arrow_size)
    for arrow in arrows:
        shapes.append((arrow, "arrows"))

    # Dimension text (centered along dimension line)
    # Position text perpendicular to dimension line, offset by font size
    center_x = (offset_x1 + offset_x2) / 2
    center_y = (offset_y1 + offset_y2) / 2

    # Offset text further perpendicular to dimension line
    text_offset = font_size * 0.5
    text_x = center_x + perp_x * text_offset
    text_y = center_y + perp_y * text_offset

    # Calculate rotation angle to align text with dimension line
    # Angle in degrees, with adjustments to keep text readable
    angle_rad = math.atan2(dy, dx)
    angle_deg = angle_rad * 180 / math.pi

    # Keep text readable (not upside down) by flipping if needed
    if angle_deg > 90:
        angle_deg -= 180
    elif angle_deg < -90:
        angle_deg += 180

    text = Text(label, font_size, font=font_name)
    # Move to position first, then rotate around that point
    text = text.move(Location((text_x, text_y)))
    # Rotate around the Z-axis at the text position
    text = text.rotate(Axis((text_x, text_y, 0), (0, 0, 1)), angle_deg)
    shapes.append((text, "extensions"))

    return shapes


def create_horizontal_dimension(feature_line, label, offset_y=-10,
                                extension_length=0, font_size=8*PTS_MM, arrow_size=3.0):
    """
    Create horizontal dimension shapes from a horizontal feature line.

    Args:
        feature_line: Edge representing the feature being dimensioned (horizontal line)
        label: Text label for the dimension (e.g., "195.0")
        offset_y: Y-offset for the dimension line (negative = below)
        extension_length: Length of extension lines (0 = no extensions needed)
        font_size: Font size for dimension text
        arrow_size: Size of arrowheads

    Returns:
        List of (shape, layer) tuples to add to exporter
    """
    # Get endpoints from the feature line
    x_start = feature_line.position_at(0).X
    x_end = feature_line.position_at(1).X
    y = feature_line.position_at(0).Y

    shapes = []

    # Extension lines (optional - only if offset is needed)
    if extension_length > 0:
        ext1 = Edge.make_line((x_start, y), (x_start, y + offset_y + extension_length))
        shapes.append((ext1, "extensions"))
        ext2 = Edge.make_line((x_end, y), (x_end, y + offset_y + extension_length))
        shapes.append((ext2, "extensions"))

    # Dimension line (dashed)
    dim_y = y + offset_y if extension_length > 0 else y
    dim_p1 = (x_start, dim_y)
    dim_p2 = (x_end, dim_y)
    dim_line = Edge.make_line(dim_p1, dim_p2)
    shapes.append((dim_line, "dimensions"))

    # Arrows at both ends
    arrows = create_dimension_arrows(dim_p1, dim_p2, arrow_size)
    for arrow in arrows:
        shapes.append((arrow, "arrows"))

    # Dimension text (centered horizontally)
    text = Text(label, font_size, font=font_name)
    text_offset = font_size  # Offset text below dimension line
    text = text.move(Location(((x_start + x_end) / 2 - 10, dim_y - text_offset)))
    shapes.append((text, "extensions"))

    return shapes


def create_angle_dimension(line1, line2, label=None, arc_radius=15,
                          font_size=8*PTS_MM, line_extension=5):
    """
    Create angle dimension shapes from two lines that meet at a junction point.

    Args:
        line1: First Edge (line)
        line2: Second Edge (line)
        label: Text label for the angle (e.g., "90.0°"). If None, angle is calculated.
        arc_radius: Radius of the arc showing the angle
        font_size: Font size for dimension text
        line_extension: How far to extend the lines beyond their endpoints

    Returns:
        List of (shape, layer) tuples to add to exporter
    """
    shapes = []

    # Get endpoints of both lines
    line1_p1 = (line1.position_at(0).X, line1.position_at(0).Y)
    line1_p2 = (line1.position_at(1).X, line1.position_at(1).Y)
    line2_p1 = (line2.position_at(0).X, line2.position_at(0).Y)
    line2_p2 = (line2.position_at(1).X, line2.position_at(1).Y)

    # Find the junction point (the common point between the two lines)
    # Check which endpoints are closest to determine the junction
    def dist(p1, p2):
        return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

    # Find the junction point (the point that appears in both lines)
    tolerance = 0.01
    if dist(line1_p1, line2_p1) < tolerance:
        junction = line1_p1
        dir1_point = line1_p2
        dir2_point = line2_p2
    elif dist(line1_p1, line2_p2) < tolerance:
        junction = line1_p1
        dir1_point = line1_p2
        dir2_point = line2_p1
    elif dist(line1_p2, line2_p1) < tolerance:
        junction = line1_p2
        dir1_point = line1_p1
        dir2_point = line2_p2
    elif dist(line1_p2, line2_p2) < tolerance:
        junction = line1_p2
        dir1_point = line1_p1
        dir2_point = line2_p1
    else:
        # Lines don't share a common endpoint, try to find intersection
        # For now, use line1_p2 as default
        junction = line1_p2
        dir1_point = line1_p1
        dir2_point = line2_p1

    jx, jy = junction

    # Calculate angles of both lines from the junction
    angle1 = math.atan2(dir1_point[1] - jy, dir1_point[0] - jx)
    angle2 = math.atan2(dir2_point[1] - jy, dir2_point[0] - jx)

    # Calculate the angle between them (in radians)
    angle_diff = angle2 - angle1

    # Normalize to 0-360 degrees
    angle_deg = (angle_diff * 180 / math.pi) % 360
    if angle_deg > 180:
        angle_deg = 360 - angle_deg

    # If no label provided, create one from the calculated angle
    if label is None:
        label = f"{angle_deg:.1f}°"

    # Extend the lines slightly beyond their endpoints for clarity
    if line_extension > 0:
        # Extend line 1
        dx1 = dir1_point[0] - jx
        dy1 = dir1_point[1] - jy
        len1 = math.sqrt(dx1**2 + dy1**2)
        if len1 > 0:
            ext1_point = (dir1_point[0] + (dx1/len1)*line_extension,
                         dir1_point[1] + (dy1/len1)*line_extension)
            ext_line1 = Edge.make_line(junction, ext1_point)
            shapes.append((ext_line1, "extensions"))

        # Extend line 2
        dx2 = dir2_point[0] - jx
        dy2 = dir2_point[1] - jy
        len2 = math.sqrt(dx2**2 + dy2**2)
        if len2 > 0:
            ext2_point = (dir2_point[0] + (dx2/len2)*line_extension,
                         dir2_point[1] + (dy2/len2)*line_extension)
            ext_line2 = Edge.make_line(junction, ext2_point)
            shapes.append((ext_line2, "extensions"))

    # Draw an arc to show the angle
    # Determine start and end angles for the arc
    start_angle = min(angle1, angle2)
    end_angle = max(angle1, angle2)

    # If the angle is > 180, we need to swap to get the smaller arc
    if (end_angle - start_angle) > math.pi:
        start_angle, end_angle = end_angle, start_angle + 2*math.pi

    # Create arc using Edge.make_three_point_arc or by approximating with line segments
    # Build123d can create arcs, but we'll approximate with line segments for simplicity
    num_segments = 12
    arc_points = []
    for i in range(num_segments + 1):
        t = i / num_segments
        angle = start_angle + t * (end_angle - start_angle)
        px = jx + arc_radius * math.cos(angle)
        py = jy + arc_radius * math.sin(angle)
        arc_points.append((px, py))

    # Create arc as a series of line segments
    for i in range(len(arc_points) - 1):
        arc_segment = Edge.make_line(arc_points[i], arc_points[i+1])
        shapes.append((arc_segment, "dimensions"))

    # Position text near the middle of the arc
    mid_angle = (start_angle + end_angle) / 2
    text_radius = arc_radius + font_size * 1.5
    text_x = jx + text_radius * math.cos(mid_angle)
    text_y = jy + text_radius * math.sin(mid_angle)

    text = Text(label, font_size, font=font_name)
    # Center the text approximately (rough centering based on typical character width)
    text_width_approx = len(label) * font_size * 0.6
    text = text.move(Location((text_x - text_width_approx/2, text_y - font_size/2)))
    shapes.append((text, "extensions"))

    return shapes


def generate_side_view_svg(params: Dict[str, Any]) -> str:
    vsl = params.get('vsl')
    neck_stop = params.get('neck_stop')
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

    # Calculate neck angle precisely (without rounding) for accurate geometry
    string_height_at_join = (string_height_eof - string_height_nut) * (neck_stop / fingerboard_length) + string_height_nut
    opposite = arching_height + bridge_height - overstand - fb_thickness_at_join - string_height_at_join
    string_angle_to_ribs = math.atan(opposite / body_stop) * 180 / math.pi
    opposite_string_to_fb = string_height_eof - string_height_nut
    string_angle_to_fb = math.atan(opposite_string_to_fb / fingerboard_length) * 180 / math.pi
    opposite_fb = fb_thickness_at_join - fb_thickness_at_nut
    fingerboard_angle = math.atan(opposite_fb / neck_stop) * 180 / math.pi
    neck_angle_deg = 90 - (string_angle_to_ribs - string_angle_to_fb - fingerboard_angle)

    # Get rounded value for display only
    derived = calculate_derived_values(params)
    neck_angle_deg_display = derived.get('Neck Angle', 0)

    # Export to SVG
    exporter = ExportSVG(scale=1.0,unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("text",fill_color=(0,0,255),line_type=LineType.HIDDEN)
    exporter.add_layer("drawing",fill_color=None, line_color=(0,0,0),line_type=LineType.CONTINUOUS)
    exporter.add_layer("schematic",fill_color=None, line_color=(0,0,0),line_type=LineType.DASHED)

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

    # Add arched top curve through three points (schematic/approximate):
    # - Start from bottom of belly: (0, belly_edge_thickness)
    # - Peak at body_stop: (body_stop, arching_height)
    # - End at bottom of belly: (body_length, belly_edge_thickness)
    # Note: Using dashed line to indicate this is an approximate representation
    arch_points = [
        (0, belly_edge_thickness),
        (body_stop, arching_height),
        (body_length, belly_edge_thickness)
    ]
    arch_curve = Spline(*arch_points)
    exporter.add_shape(arch_curve, layer="schematic")

    # Add vertical line from arch peak extending by bridge_height
    bridge_line = Edge.make_line((body_stop, arching_height), (body_stop, arching_height + bridge_height))
    exporter.add_shape(bridge_line, layer="drawing")

    # Add leader line pointing up to the peak
    leader_start = (body_stop, arching_height - 10)
    leader_end = (body_stop, arching_height)
    leader_line = Edge.make_line(leader_start, leader_end)
    exporter.add_shape(leader_line, layer="extensions")

    # Add leader arrowhead (small filled triangle)
    arrow_size = 2
    arrowhead_vertices = [
        (body_stop, arching_height),
        (body_stop - arrow_size, arching_height - arrow_size),
        (body_stop + arrow_size, arching_height - arrow_size)
    ]

    arrowhead = make_face(Polygon(*arrowhead_vertices))
    arrowhead = arrowhead.move(Location((body_stop,arching_height-(arrow_size/2))))
    exporter.add_shape(arrowhead, layer="arrows")

    # Add neck angle reference lines
    # Line 1: Vertical from (0, 0) to (0, overstand)
    neck_vertical_line = Edge.make_line((0, 0), (0, overstand))
    exporter.add_shape(neck_vertical_line, layer="drawing")

    # Line 2: From (0, overstand) at neck_angle, going down and left for length neck_stop
    # Convert neck angle from degrees to radians
    neck_angle_rad = neck_angle_deg * math.pi / 180

    # Calculate endpoint: going down and to the left at neck_angle from vertical
    neck_end_x = 0 - neck_stop
    neck_end_y = overstand - neck_stop * math.cos(neck_angle_rad)
    neck_angled_line = Edge.make_line((0, overstand), (neck_end_x, neck_end_y))
    exporter.add_shape(neck_angled_line, layer="drawing")

    # Add nut as a quarter circle at the end of the neck
    # The quarter circle is centered at the nut position and extends perpendicular to the neck surface
    nut_radius = fb_thickness_at_nut + string_height_nut

    # Calculate the angle of the neck line (from horizontal)
    neck_line_angle = math.atan2(neck_end_y - overstand, neck_end_x - 0)

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
                                              label=f"{neck_angle_deg_display:.1f}°",
                                              arc_radius=12, line_extension=0):
        exporter.add_shape(shape, layer=layer)

    # Add fingerboard
    # Fingerboard bottom: runs along the neck surface from nut toward body for length fingerboard_length
    # Need to reverse direction (add π) since neck_line_angle points from body to nut
    fb_direction_angle = neck_line_angle + math.pi
    fb_bottom_end_x = neck_end_x + fingerboard_length * math.cos(fb_direction_angle)
    fb_bottom_end_y = neck_end_y + fingerboard_length * math.sin(fb_direction_angle)
    fb_bottom_line = Edge.make_line((neck_end_x, neck_end_y), (fb_bottom_end_x, fb_bottom_end_y))
    exporter.add_shape(fb_bottom_line, layer="drawing")

    # Fingerboard left edge (at nut): perpendicular to bottom, length fb_thickness_at_nut
    fb_top_left_x = neck_end_x + fb_thickness_at_nut * math.cos(fb_direction_angle + math.pi/2)
    fb_top_left_y = neck_end_y + fb_thickness_at_nut * math.sin(fb_direction_angle + math.pi/2)
    fb_left_edge = Edge.make_line((neck_end_x, neck_end_y), (fb_top_left_x, fb_top_left_y))
    exporter.add_shape(fb_left_edge, layer="drawing")

    # Fingerboard top edge: extrapolate thickness from nut to join, then continue to end
    # At join (neck_stop distance), thickness = fb_thickness_at_join
    # At end (fingerboard_length), extrapolate linearly
    fb_thickness_at_end = fb_thickness_at_nut + (fb_thickness_at_join - fb_thickness_at_nut) * (fingerboard_length / neck_stop)

    # Top right corner: offset perpendicular from bottom right corner
    fb_top_right_x = fb_bottom_end_x + fb_thickness_at_end * math.cos(fb_direction_angle + math.pi/2)
    fb_top_right_y = fb_bottom_end_y + fb_thickness_at_end * math.sin(fb_direction_angle + math.pi/2)
    fb_top_edge = Edge.make_line((fb_top_left_x, fb_top_left_y), (fb_top_right_x, fb_top_right_y))
    exporter.add_shape(fb_top_edge, layer="drawing")

    # Fingerboard right edge: closes the rectangle
    fb_right_edge = Edge.make_line((fb_bottom_end_x, fb_bottom_end_y), (fb_top_right_x, fb_top_right_y))
    exporter.add_shape(fb_right_edge, layer="drawing")

    # Add strings from top of nut to top of bridge
    # Top of nut: the outermost point of the nut quarter circle (perpendicular to neck surface)
    # Using the same direction as the rotated nut (neck_line_angle - math.pi/2)
    nut_top_x = neck_end_x + nut_radius * math.cos(neck_line_angle - math.pi/2)
    nut_top_y = neck_end_y + nut_radius * math.sin(neck_line_angle - math.pi/2)

    # Add horizontal reference line from top of ribs (0,0) extending 20mm beyond nut
    # This is a dashed schematic line (dashing handled by SVG layer style)
    reference_line_end_x = nut_top_x - 20
    reference_line = Edge.make_line((0, 0), (reference_line_end_x, 0))
    exporter.add_shape(reference_line, layer="schematic")

    # Top of bridge: at (body_stop, arching_height + bridge_height)
    bridge_top_x = body_stop
    bridge_top_y = arching_height + bridge_height

    # Draw string line
    string_line = Edge.make_line((nut_top_x, nut_top_y), (bridge_top_x, bridge_top_y))
    exporter.add_shape(string_line, layer="drawing")

    
    # Dimension: vertical distance from ribs (y=0) to top of nut
    # Position this dimension at the end of the reference line
    rib_to_nut_feature_line = Edge.make_line((reference_line_end_x, 0), (reference_line_end_x, nut_top_y))
    for shape, layer in create_vertical_dimension(rib_to_nut_feature_line,
                                                   f"{nut_top_y:.1f}",
                                                   offset_x=-8, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Calculate string length
    string_length = math.sqrt((bridge_top_x - nut_top_x)**2 + (bridge_top_y - nut_top_y)**2)

    # Add diagonal dimension for string length
    for shape, layer in create_diagonal_dimension(string_line, f"{string_length:.1f} Calculated",
                                                   offset_distance=10, font_size=dim_font_size):
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
                                                       offset_distance=20, font_size=dim_font_size):
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
    # (dim_font_size already defined above)

    # Dimension: string height above end of fingerboard (perpendicular)
    string_height_feature_line = Edge.make_line((fb_surface_point_x, fb_surface_point_y),
                                                 (string_x_at_fb_end, string_y_at_fb_end))
    for shape, layer in create_vertical_dimension(string_height_feature_line,
                                                   f"{string_height_at_fb_end:.1f}",
                                                   offset_x=8, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Dimension: horizontal distance from nut to x=0 (neck projection)
    # The nut is at (neck_end_x, neck_end_y), we want horizontal distance to (0, neck_end_y)
    nut_x_distance = abs(neck_end_x)  # This equals neck_stop
    nut_feature_line = Edge.make_line((neck_end_x, neck_end_y), (0, neck_end_y))
    for shape, layer in create_horizontal_dimension(nut_feature_line, f"{nut_x_distance:.1f}",
                                                     offset_y=-10, extension_length=3, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Dimension: arching_height (vertical, from top of belly to arch peak - includes belly thickness)
    arch_feature_line = Edge.make_line((body_stop, 0), (body_stop, arching_height))
    for shape, layer in create_vertical_dimension(arch_feature_line, f"{arching_height:.1f}",
                                                   offset_x=8, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Dimension: body_stop (horizontal, with extension lines below body)
    bottom_y = belly_edge_thickness - rib_height
    body_stop_feature_line = Edge.make_line((0, bottom_y), (body_stop, bottom_y))
    for shape, layer in create_horizontal_dimension(body_stop_feature_line, f"{body_stop:.1f}",
                                                     offset_y=-15, extension_length=3, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Dimension: body_length (horizontal, further below with extension lines)
    body_length_feature_line = Edge.make_line((0, bottom_y), (body_length, bottom_y))
    for shape, layer in create_horizontal_dimension(body_length_feature_line, f"{body_length:.1f}",
                                                     offset_y=-30, extension_length=3, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Dimension: rib_height (vertical, on right side)
    rib_dim_x = body_length + 10
    dim_p1 = (rib_dim_x, belly_edge_thickness)
    dim_p2 = (rib_dim_x, belly_edge_thickness - rib_height)
    rib_dim_line = Edge.make_line(dim_p1, dim_p2)
    exporter.add_shape(rib_dim_line, layer="dimensions")
    for arrow in create_dimension_arrows(dim_p1, dim_p2, 3.0):
        exporter.add_shape(arrow, layer="arrows")
    rib_text = Text(f"{rib_height:.1f}", dim_font_size, font=font_name)
    rib_text = rib_text.move(Location((rib_dim_x + dim_font_size, belly_edge_thickness - rib_height/2)))
    exporter.add_shape(rib_text, layer="extensions")

    # Dimension: belly_edge_thickness (vertical, on right side above ribs)
    belly_dim_x = body_length + 10
    dim_p1 = (belly_dim_x, 0)
    dim_p2 = (belly_dim_x, belly_edge_thickness)
    belly_dim_line = Edge.make_line(dim_p1, dim_p2)
    exporter.add_shape(belly_dim_line, layer="dimensions")
    for arrow in create_dimension_arrows(dim_p1, dim_p2, 3.0):
        exporter.add_shape(arrow, layer="arrows")
    belly_text = Text(f"{belly_edge_thickness:.1f}", dim_font_size, font=font_name)
    belly_text = belly_text.move(Location((belly_dim_x + dim_font_size, belly_edge_thickness/2)))
    exporter.add_shape(belly_text, layer="extensions")

    # Dimension: bridge_height (vertical, from arch peak to top of bridge)
    bridge_feature_line = Edge.make_line((body_stop, arching_height), (body_stop, arching_height + bridge_height))
    for shape, layer in create_vertical_dimension(bridge_feature_line, f"{bridge_height:.1f}",
                                                   offset_x=15, font_size=dim_font_size):
        exporter.add_shape(shape, layer=layer)

    # Title text - centered horizontally, 2.5cm above the highest point
    # Highest point is the top of the bridge line (plus some margin for dimension text)
    max_y = arching_height + bridge_height
    title_gap = 25  # 2.5cm gap to account for dimension lines and text
    title_font_size = 14*PTS_MM
    title_text = Text(instrument_name, title_font_size, font=font_name)
    # Center the title (approximate centering based on character width)
    title_width_approx = len(instrument_name) * title_font_size * 0.6
    title_text = title_text.move(Location((body_length/2 - title_width_approx/2, max_y + title_gap)))
    exporter.add_shape(title_text, layer="text")

    # Find the minimum y coordinate to place footer below everything
    # The lowest point is from the dimension lines below the body
    bottom_y = belly_edge_thickness - rib_height
    min_y = bottom_y - 30 - 15  # Below the body_length dimension line (-30) and gap (-15)

    # Footer text - small text with generator URL
    footer_font_size = 6*PTS_MM
    footer_text = Text(f"Generated by {generator_url}", footer_font_size, font=font_name)
    footer_text = footer_text.move(Location((0, min_y)))
    exporter.add_shape(footer_text, layer="text")

    return exporter_to_svg(exporter)
    

def generate_top_view_svg(params: Dict[str, Any]) -> str:
  

    exporter = ExportSVG(scale=1.0)
    text_shape = Text("Top View", 10, font=font_name)
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
    exporter.add_shape(Text("Cross section",10,font=font_name))
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
