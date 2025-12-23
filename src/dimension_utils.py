"""
Dimension Utilities for Instrument Geometry Generator

This module contains helper functions and constants for creating dimension lines,
arrows, and annotations in technical drawings.
"""

from build123d import Edge, Text, Location, Axis
import math

# ==================== Constants ====================

# Font configuration
font_url = "https://raw.githubusercontent.com/pzfreo/diagram-creator/main/src/Roboto.ttf"
font_file = "Roboto.ttf"
font_name = "Roboto"

# Points to millimeters conversion factor
PTS_MM = 0.352778

# Default dimension styling
DIMENSION_FONT_SIZE = 8 * PTS_MM
DIMENSION_OFFSET_DEFAULT = 8  # mm
DIMENSION_OFFSET_VERTICAL = 8  # mm
DIMENSION_OFFSET_HORIZONTAL = -10  # mm (negative = below)
DIMENSION_OFFSET_DIAGONAL = 8  # mm
DIMENSION_EXTENSION_LENGTH = 3  # mm
DIMENSION_ARROW_SIZE = 3.0  # mm


# ==================== Helper Functions ====================

def create_dimension_arrows(p1, p2, arrow_size=DIMENSION_ARROW_SIZE):
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


def create_vertical_dimension(feature_line, label, offset_x=DIMENSION_OFFSET_VERTICAL,
                              extension_length=DIMENSION_EXTENSION_LENGTH,
                              font_size=DIMENSION_FONT_SIZE,
                              arrow_size=DIMENSION_ARROW_SIZE):
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


def create_diagonal_dimension(feature_line, label, offset_distance=DIMENSION_OFFSET_DIAGONAL,
                             extension_length=DIMENSION_EXTENSION_LENGTH,
                             font_size=DIMENSION_FONT_SIZE,
                             arrow_size=DIMENSION_ARROW_SIZE):
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


def create_horizontal_dimension(feature_line, label, offset_y=DIMENSION_OFFSET_HORIZONTAL,
                                extension_length=0,
                                font_size=DIMENSION_FONT_SIZE,
                                arrow_size=DIMENSION_ARROW_SIZE):
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
                          font_size=DIMENSION_FONT_SIZE, line_extension=5):
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
