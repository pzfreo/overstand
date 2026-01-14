"""
Minimal build123d shim for SVG generation

This module provides a minimal implementation of build123d classes
needed for generating SVG diagrams without requiring the full OCP/build123d stack.
"""

import math
from enum import Enum
from typing import Tuple, Optional, List, Dict, Any


# ============================================================================
# Font Configuration
# ============================================================================

# Points to millimeters conversion factor
PTS_MM = 0.352778

# Font name - browser will use Roboto if available, fallback to Arial/sans-serif
FONT_NAME = "Roboto"

# Standard font sizes (in millimeters)
DIMENSION_FONT_SIZE = 8 * PTS_MM   # ≈ 2.82 mm for dimension annotations
TITLE_FONT_SIZE = 14 * PTS_MM      # ≈ 4.94 mm for instrument name
FOOTER_FONT_SIZE = 6 * PTS_MM      # ≈ 2.12 mm for generator URL


class Point:
    """Simple 2D point with X, Y properties"""
    def __init__(self, x: float, y: float):
        self.X = x
        self.Y = y


class LineType(Enum):
    """SVG line types"""
    CONTINUOUS = "continuous"
    DASHED = "dashed"
    DOTTED = "dotted"
    HIDDEN = "hidden"


class Unit(Enum):
    """Measurement units"""
    MM = "mm"


class Edge:
    """Represents a line segment"""

    def __init__(self, p1: Tuple[float, float], p2: Tuple[float, float]):
        self.p1 = p1
        self.p2 = p2

    @staticmethod
    def make_line(p1: Tuple[float, float], p2: Tuple[float, float]) -> 'Edge':
        """Create a line edge from two points"""
        return Edge(p1, p2)

    def position_at(self, t: float) -> Point:
        """Get position along the edge (t=0 is start, t=1 is end)"""
        if t == 0:
            return Point(self.p1[0], self.p1[1])
        else:
            return Point(self.p2[0], self.p2[1])

    def to_svg_path(self) -> str:
        """Convert edge to SVG path data"""
        return f"M {self.p1[0]},{self.p1[1]} L {self.p2[0]},{self.p2[1]}"


class Arc:
    """Represents a circular arc segment"""

    def __init__(self, center: Tuple[float, float], radius: float,
                 start_angle: float, end_angle: float):
        """
        Create an arc.

        Args:
            center: Center point (x, y)
            radius: Arc radius
            start_angle: Start angle in radians
            end_angle: End angle in radians
        """
        self.center = center
        self.radius = radius
        self.start_angle = start_angle
        self.end_angle = end_angle

    @staticmethod
    def make_arc(center: Tuple[float, float], radius: float,
                 start_angle: float, end_angle: float) -> 'Arc':
        """Create an arc from center, radius, and angles"""
        return Arc(center, radius, start_angle, end_angle)

    def position_at(self, t: float) -> Point:
        """Get position along the arc (t=0 is start, t=1 is end)"""
        angle = self.start_angle + t * (self.end_angle - self.start_angle)
        x = self.center[0] + self.radius * math.cos(angle)
        y = self.center[1] + self.radius * math.sin(angle)
        return Point(x, y)

    def to_svg_path(self) -> str:
        """Convert arc to SVG path data using arc command"""
        # Calculate start and end points
        start_x = self.center[0] + self.radius * math.cos(self.start_angle)
        start_y = self.center[1] + self.radius * math.sin(self.start_angle)
        end_x = self.center[0] + self.radius * math.cos(self.end_angle)
        end_y = self.center[1] + self.radius * math.sin(self.end_angle)

        # Determine if this is a large arc (> 180 degrees)
        angle_diff = self.end_angle - self.start_angle
        # Normalize to 0-2π range
        while angle_diff < 0:
            angle_diff += 2 * math.pi
        while angle_diff > 2 * math.pi:
            angle_diff -= 2 * math.pi

        large_arc_flag = 1 if angle_diff > math.pi else 0
        sweep_flag = 1  # Always sweep in positive angle direction

        # SVG arc command: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
        return f"M {start_x},{start_y} A {self.radius},{self.radius} 0 {large_arc_flag} {sweep_flag} {end_x},{end_y}"


class Rectangle:
    """Represents a rectangle (centered by default)"""

    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height
        self.x = 0  # Center position
        self.y = 0

    def move(self, location: 'Location') -> 'Rectangle':
        """Move rectangle to a location (center point)"""
        new_rect = Rectangle(self.width, self.height)
        new_rect.x = location.x
        new_rect.y = location.y
        return new_rect

    def to_svg_path(self) -> str:
        """Convert rectangle to SVG path data"""
        # Rectangle is centered at (x, y)
        x1 = self.x - self.width / 2
        y1 = self.y - self.height / 2
        x2 = self.x + self.width / 2
        y2 = self.y + self.height / 2
        return f"M {x1},{y1} L {x2},{y1} L {x2},{y2} L {x1},{y2} Z"


class Spline:
    """Represents a smooth curve through points"""

    def __init__(self, *points: Tuple[float, float]):
        self.points = points
        self._is_cubic = False  # Track if this is a cubic Bezier

    @staticmethod
    def interpolate_three_points(p0: Tuple[float, float],
                                  p1: Tuple[float, float],
                                  p2: Tuple[float, float]) -> 'Spline':
        """
        Create a quadratic Bezier spline that passes through all three points.

        The curve passes through p0 at t=0, p1 at t=0.5, and p2 at t=1.
        Calculates the control point needed to achieve this.

        Args:
            p0: Start point
            p1: Middle point (curve will pass through this)
            p2: End point

        Returns:
            Spline with calculated control point
        """
        # Calculate control point: Q1 = 2*P1 - 0.5*P0 - 0.5*P2
        control_x = 2 * p1[0] - 0.5 * p0[0] - 0.5 * p2[0]
        control_y = 2 * p1[1] - 0.5 * p0[1] - 0.5 * p2[1]

        # Return spline with: start, control, end
        return Spline(p0, (control_x, control_y), p2)

    @staticmethod
    def cubic_bezier(p0: Tuple[float, float],
                     cp1: Tuple[float, float],
                     cp2: Tuple[float, float],
                     p3: Tuple[float, float]) -> 'Spline':
        """
        Create a cubic Bezier curve with two control points.

        The curve:
        - Starts at p0 with tangent direction toward cp1
        - Ends at p3 with tangent direction from cp2

        Args:
            p0: Start point
            cp1: First control point (determines start tangent)
            cp2: Second control point (determines end tangent)
            p3: End point

        Returns:
            Spline configured for cubic Bezier rendering
        """
        spline = Spline(p0, cp1, cp2, p3)
        spline._is_cubic = True
        return spline

    def to_svg_path(self) -> str:
        """Convert spline to SVG path using quadratic or cubic bezier curves"""
        if len(self.points) < 2:
            return ""

        # Start at first point
        path = f"M {self.points[0][0]},{self.points[0][1]}"

        # For a simple smooth curve, use quadratic bezier through control points
        if len(self.points) == 2:
            # Just a line
            path += f" L {self.points[1][0]},{self.points[1][1]}"
        elif len(self.points) == 3:
            # Perfect for quadratic bezier: start, control, end
            path += f" Q {self.points[1][0]},{self.points[1][1]} {self.points[2][0]},{self.points[2][1]}"
        elif len(self.points) == 4 and self._is_cubic:
            # Cubic bezier: start, cp1, cp2, end
            path += f" C {self.points[1][0]},{self.points[1][1]} {self.points[2][0]},{self.points[2][1]} {self.points[3][0]},{self.points[3][1]}"
        else:
            # Multiple points - use quadratic bezier segments
            for i in range(1, len(self.points) - 1):
                path += f" Q {self.points[i][0]},{self.points[i][1]} {self.points[i+1][0]},{self.points[i+1][1]}"

        return path


class Polygon:
    """Represents a closed polygon"""

    def __init__(self, points, filled: bool = False, fill_pattern: str = None):
        # Support both list of points and varargs for backwards compatibility
        if isinstance(points, (list, tuple)) and len(points) > 0 and isinstance(points[0], (tuple, list)):
            self.vertices = points
        else:
            # Old style: varargs
            self.vertices = (points,) if not isinstance(points, (list, tuple)) else points
        self.x = 0
        self.y = 0
        self.filled = filled
        self.fill_pattern = fill_pattern

    def move(self, location: 'Location') -> 'Polygon':
        """Move polygon to a location"""
        new_poly = Polygon(self.vertices, filled=self.filled, fill_pattern=self.fill_pattern)
        new_poly.x = location.x
        new_poly.y = location.y
        return new_poly

    def to_svg_path(self) -> str:
        """Convert polygon to SVG path data"""
        if len(self.vertices) < 3:
            return ""

        # Apply offset
        path = f"M {self.vertices[0][0] + self.x},{self.vertices[0][1] + self.y}"
        for v in self.vertices[1:]:
            path += f" L {v[0] + self.x},{v[1] + self.y}"
        path += " Z"  # Close path
        return path


def make_face(shape):
    """Convert a shape to a filled face"""
    if isinstance(shape, Polygon):
        new_shape = Polygon(*shape.vertices)
        new_shape.x = shape.x
        new_shape.y = shape.y
        new_shape.filled = True
        return new_shape
    return shape


class Text:
    """Represents text with position and rotation"""

    def __init__(self, text: str, font_size: float, font: str = FONT_NAME):
        self.text = text
        self.font_size = font_size
        self.font = font
        self.x = 0
        self.y = 0
        self.rotation = 0  # degrees
        self.rotation_center = (0, 0)

    def move(self, location: 'Location') -> 'Text':
        """Move text to a location"""
        new_text = Text(self.text, self.font_size, self.font)
        new_text.x = location.x
        new_text.y = location.y
        new_text.rotation = self.rotation
        new_text.rotation_center = self.rotation_center
        return new_text

    def rotate(self, axis: 'Axis', angle: float) -> 'Text':
        """Rotate text around an axis"""
        new_text = Text(self.text, self.font_size, self.font)
        new_text.x = self.x
        new_text.y = self.y
        new_text.rotation = angle
        new_text.rotation_center = (axis.position[0], axis.position[1])
        return new_text

    def to_svg(self, fill_color: Optional[Tuple[int, int, int]] = None, y_flipped: bool = False) -> str:
        """Convert text to SVG element"""
        color = f"rgb({fill_color[0]},{fill_color[1]},{fill_color[2]})" if fill_color else "black"

        transforms = []

        # If the coordinate system is Y-flipped, flip text back to be readable
        if y_flipped:
            transforms.append(f"translate({self.x} {self.y})")
            transforms.append("scale(1 -1)")
            if self.rotation != 0:
                transforms.append(f"rotate({self.rotation})")
            transform_str = f' transform="{" ".join(transforms)}"'
            # When using transform with translate, position at origin
            return (f'<text x="0" y="0" '
                    f'font-family="{self.font}, Arial, sans-serif" font-size="{self.font_size}" '
                    f'fill="{color}" text-anchor="middle" dominant-baseline="middle"'
                    f'{transform_str}>{self.text}</text>')
        else:
            # Original behavior without Y-flip
            transform = ""
            if self.rotation != 0:
                # Rotate around the text position
                transform = f' transform="rotate({self.rotation} {self.rotation_center[0]} {self.rotation_center[1]})"'

            return (f'<text x="{self.x}" y="{self.y}" '
                    f'font-family="{self.font}, Arial, sans-serif" font-size="{self.font_size}" '
                    f'fill="{color}" text-anchor="middle" dominant-baseline="middle"'
                    f'{transform}>{self.text}</text>')


class Location:
    """Represents a position in 2D space"""

    def __init__(self, position: Tuple[float, float]):
        self.x = position[0]
        self.y = position[1]


class Axis:
    """Represents a rotation axis (simplified for 2D)"""

    def __init__(self, position: Tuple[float, float, float], direction: Tuple[float, float, float]):
        self.position = position
        self.direction = direction


class ExportSVG:
    """SVG exporter that collects shapes and generates SVG"""

    def __init__(self, scale: float = 1.0, unit: Unit = Unit.MM, line_weight: float = 0.5):
        self.scale = scale
        self.unit = unit
        self.line_weight = line_weight
        self.layers: Dict[str, Dict[str, Any]] = {}
        self.shapes: List[Tuple[Any, str]] = []  # (shape, layer_name)
        self.view_box = None
        self.margin = 20  # mm

    def add_layer(self, name: str,
                  fill_color: Optional[Tuple[int, int, int]] = None,
                  line_color: Optional[Tuple[int, int, int]] = None,
                  line_type: LineType = LineType.CONTINUOUS):
        """Add a layer with styling"""
        self.layers[name] = {
            'fill_color': fill_color,
            'line_color': line_color,
            'line_type': line_type
        }

    def add_shape(self, shape: Any, layer: str = "default"):
        """Add a shape to a specific layer"""
        self.shapes.append((shape, layer))

    def _get_stroke_style(self, layer_name: str) -> str:
        """Get SVG stroke style for a layer"""
        if layer_name not in self.layers:
            return f'stroke="black" stroke-width="{self.line_weight}" fill="none"'

        layer = self.layers[layer_name]
        line_color = layer.get('line_color')

        # If line_color is None, the layer is invisible
        if line_color is None:
            return 'stroke="none" fill="none"'

        color = f"rgb({line_color[0]},{line_color[1]},{line_color[2]})"

        stroke_dasharray = ""
        if layer['line_type'] == LineType.DASHED:
            stroke_dasharray = ' stroke-dasharray="5,3"'
        elif layer['line_type'] == LineType.DOTTED:
            stroke_dasharray = ' stroke-dasharray="1,2"'
        elif layer['line_type'] == LineType.HIDDEN:
            stroke_dasharray = ' stroke-dasharray="2,2"'

        return f'stroke="{color}" stroke-width="{self.line_weight}" fill="none"{stroke_dasharray}'

    def _calculate_bounds(self) -> Tuple[float, float, float, float]:
        """Calculate bounding box of all shapes"""
        min_x, min_y = float('inf'), float('inf')
        max_x, max_y = float('-inf'), float('-inf')

        for shape, layer in self.shapes:
            if isinstance(shape, Edge):
                min_x = min(min_x, shape.p1[0], shape.p2[0])
                max_x = max(max_x, shape.p1[0], shape.p2[0])
                min_y = min(min_y, shape.p1[1], shape.p2[1])
                max_y = max(max_y, shape.p1[1], shape.p2[1])
            elif isinstance(shape, Rectangle):
                x1 = shape.x - shape.width / 2
                x2 = shape.x + shape.width / 2
                y1 = shape.y - shape.height / 2
                y2 = shape.y + shape.height / 2
                min_x = min(min_x, x1, x2)
                max_x = max(max_x, x1, x2)
                min_y = min(min_y, y1, y2)
                max_y = max(max_y, y1, y2)
            elif isinstance(shape, Spline):
                points = shape.points
                if len(points) == 4 and hasattr(shape, '_is_cubic') and shape._is_cubic:
                    # Sample cubic Bezier curve for bounds
                    for t in [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
                        # De Casteljau's algorithm for cubic Bezier
                        mt = 1 - t
                        mt2 = mt * mt
                        mt3 = mt2 * mt
                        t2 = t * t
                        t3 = t2 * t
                        px = mt3 * points[0][0] + 3*mt2*t * points[1][0] + 3*mt*t2 * points[2][0] + t3 * points[3][0]
                        py = mt3 * points[0][1] + 3*mt2*t * points[1][1] + 3*mt*t2 * points[2][1] + t3 * points[3][1]
                        min_x = min(min_x, px)
                        max_x = max(max_x, px)
                        min_y = min(min_y, py)
                        max_y = max(max_y, py)
                else:
                    # Quadratic or other splines - use control points
                    for p in points:
                        min_x = min(min_x, p[0])
                        max_x = max(max_x, p[0])
                        min_y = min(min_y, p[1])
                        max_y = max(max_y, p[1])
            elif isinstance(shape, Polygon):
                for p in shape.vertices:
                    px = p[0] + shape.x
                    py = p[1] + shape.y
                    min_x = min(min_x, px)
                    max_x = max(max_x, px)
                    min_y = min(min_y, py)
                    max_y = max(max_y, py)
            elif isinstance(shape, Arc):
                # Calculate bounds of arc by checking start, end, and potential extrema
                points = []
                # Start and end points
                points.append((shape.center[0] + shape.radius * math.cos(shape.start_angle),
                               shape.center[1] + shape.radius * math.sin(shape.start_angle)))
                points.append((shape.center[0] + shape.radius * math.cos(shape.end_angle),
                               shape.center[1] + shape.radius * math.sin(shape.end_angle)))

                # Check if arc crosses 0°, 90°, 180°, or 270° (extrema points)
                for critical_angle in [0, math.pi/2, math.pi, 3*math.pi/2]:
                    # Normalize angles to same range
                    start = shape.start_angle % (2*math.pi)
                    end = shape.end_angle % (2*math.pi)
                    crit = critical_angle % (2*math.pi)

                    # Check if critical angle is within arc range
                    if start <= end:
                        if start <= crit <= end:
                            points.append((shape.center[0] + shape.radius * math.cos(critical_angle),
                                          shape.center[1] + shape.radius * math.sin(critical_angle)))
                    else:  # Arc wraps around 0
                        if crit >= start or crit <= end:
                            points.append((shape.center[0] + shape.radius * math.cos(critical_angle),
                                          shape.center[1] + shape.radius * math.sin(critical_angle)))

                for px, py in points:
                    min_x = min(min_x, px)
                    max_x = max(max_x, px)
                    min_y = min(min_y, py)
                    max_y = max(max_y, py)
            elif isinstance(shape, Text):
                # Rough text bounds estimation
                text_width = len(shape.text) * shape.font_size * 0.6
                text_height = shape.font_size
                min_x = min(min_x, shape.x - text_width/2)
                max_x = max(max_x, shape.x + text_width/2)
                min_y = min(min_y, shape.y - text_height/2)
                max_y = max(max_y, shape.y + text_height/2)

        # Add margin
        min_x -= self.margin
        min_y -= self.margin
        max_x += self.margin
        max_y += self.margin

        return min_x, min_y, max_x, max_y

    def _get_pattern_defs(self) -> str:
        """Generate SVG pattern definitions for hatching."""
        return '''<defs>
    <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="2" height="2">
        <path d="M0,2 L2,0" stroke="black" stroke-width="0.3" />
    </pattern>
</defs>'''

    def write(self, filename: Optional[str] = None) -> str:
        """Generate SVG string"""
        min_x, min_y, max_x, max_y = self._calculate_bounds()
        width = max_x - min_x
        height = max_y - min_y

        # Start SVG with viewBox
        # Note: We flip the Y-axis to match standard mathematical coordinates (Y up)
        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{min_x} {-max_y} {width} {height}" '
            f'width="{width}{self.unit.value}" height="{height}{self.unit.value}">',
            self._get_pattern_defs(),
            f'<g transform="scale(1,-1)">'
        ]

        # Add shapes grouped by layer
        for shape, layer_name in self.shapes:
            # Check if layer is invisible (skip all shapes on invisible layers)
            if layer_name in self.layers:
                layer = self.layers[layer_name]
                fill_color = layer.get('fill_color')
                line_color = layer.get('line_color')

                # Skip entire shape if layer is invisible (both colors are None)
                if fill_color is None and line_color is None:
                    continue

            if isinstance(shape, (Edge, Arc, Rectangle, Spline, Polygon)):
                style = self._get_stroke_style(layer_name)
                # Check if shape should be filled (Polygon with filled=True)
                if isinstance(shape, Polygon) and shape.filled:
                    # Check for fill pattern first
                    if hasattr(shape, 'fill_pattern') and shape.fill_pattern:
                        fill = f'url(#{shape.fill_pattern})'
                    else:
                        # Get fill color from layer
                        if layer_name in self.layers:
                            layer_fill_color = self.layers[layer_name].get('fill_color')
                            if layer_fill_color:
                                fill = f'rgb({layer_fill_color[0]},{layer_fill_color[1]},{layer_fill_color[2]})'
                            else:
                                fill = 'black'
                        else:
                            fill = 'black'
                    style = style.replace('fill="none"', f'fill="{fill}"')
                svg_parts.append(f'<path d="{shape.to_svg_path()}" {style}/>')

            elif isinstance(shape, Text):
                # Render text with layer's color
                if layer_name in self.layers:
                    layer = self.layers[layer_name]
                    fill_color = layer.get('fill_color')
                    line_color = layer.get('line_color')
                    # Use fill_color if available, otherwise line_color
                    text_color = fill_color if fill_color else line_color
                    svg_parts.append(shape.to_svg(text_color, y_flipped=True))
                else:
                    svg_parts.append(shape.to_svg(y_flipped=True))

        svg_parts.append('</g>')  # Close the transform group
        svg_parts.append('</svg>')

        svg_content = '\n'.join(svg_parts)

        if filename:
            with open(filename, 'w') as f:
                f.write(svg_content)

        return svg_content


# Export all commonly used items for "from buildprimitives import *"
__all__ = [
    'Edge',
    'Arc',
    'Rectangle',
    'Spline',
    'Polygon',
    'Text',
    'Location',
    'Axis',
    'ExportSVG',
    'LineType',
    'Unit',
    'Point',
    'make_face'
]
