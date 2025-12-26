"""
Minimal build123d shim for SVG generation

This module provides a minimal implementation of build123d classes
needed for generating SVG diagrams without requiring the full OCP/build123d stack.
"""

import math
from enum import Enum
from typing import Tuple, Optional, List, Dict, Any


class Point:
    """Simple 2D point with X, Y properties"""
    def __init__(self, x: float, y: float):
        self.X = x
        self.Y = y


class LineType(Enum):
    """SVG line types"""
    CONTINUOUS = "continuous"
    DASHED = "dashed"
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

    def to_svg_path(self) -> str:
        """Convert spline to SVG path using quadratic bezier curves"""
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
        else:
            # Multiple points - use quadratic bezier segments
            for i in range(1, len(self.points) - 1):
                path += f" Q {self.points[i][0]},{self.points[i][1]} {self.points[i+1][0]},{self.points[i+1][1]}"

        return path


class Polygon:
    """Represents a closed polygon"""

    def __init__(self, *vertices: Tuple[float, float]):
        self.vertices = vertices
        self.x = 0
        self.y = 0
        self.filled = False

    def move(self, location: 'Location') -> 'Polygon':
        """Move polygon to a location"""
        new_poly = Polygon(*self.vertices)
        new_poly.x = location.x
        new_poly.y = location.y
        new_poly.filled = self.filled
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

    def __init__(self, text: str, font_size: float, font: str = "Arial"):
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

    def to_svg(self, fill_color: Optional[Tuple[int, int, int]] = None) -> str:
        """Convert text to SVG element"""
        color = f"rgb({fill_color[0]},{fill_color[1]},{fill_color[2]})" if fill_color else "black"

        transform = ""
        if self.rotation != 0:
            # Rotate around the text position
            transform = f' transform="rotate({self.rotation} {self.rotation_center[0]} {self.rotation_center[1]})"'

        return (f'<text x="{self.x}" y="{self.y}" '
                f'font-family="{self.font}" font-size="{self.font_size}" '
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
            'line_color': line_color if line_color else (0, 0, 0),
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
            elif isinstance(shape, (Spline, Polygon)):
                points = shape.points if isinstance(shape, Spline) else shape.vertices
                for p in points:
                    px = p[0] + (shape.x if isinstance(shape, Polygon) else 0)
                    py = p[1] + (shape.y if isinstance(shape, Polygon) else 0)
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

    def write(self, filename: Optional[str] = None) -> str:
        """Generate SVG string"""
        min_x, min_y, max_x, max_y = self._calculate_bounds()
        width = max_x - min_x
        height = max_y - min_y

        # Start SVG with viewBox
        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{min_x} {min_y} {width} {height}" '
            f'width="{width}{self.unit.value}" height="{height}{self.unit.value}">'
        ]

        # Add shapes grouped by layer
        for shape, layer_name in self.shapes:
            if isinstance(shape, (Edge, Rectangle, Spline, Polygon)):
                style = self._get_stroke_style(layer_name)
                if 'stroke="none"' not in style:  # Skip invisible layers
                    # Check if shape should be filled (Polygon with filled=True)
                    if isinstance(shape, Polygon) and shape.filled:
                        # Get fill color from layer
                        if layer_name in self.layers:
                            fill_color = self.layers[layer_name].get('fill_color')
                            if fill_color:
                                fill = f'rgb({fill_color[0]},{fill_color[1]},{fill_color[2]})'
                            else:
                                fill = 'black'
                        else:
                            fill = 'black'
                        style = style.replace('fill="none"', f'fill="{fill}"')
                    svg_parts.append(f'<path d="{shape.to_svg_path()}" {style}/>')

            elif isinstance(shape, Text):
                if layer_name in self.layers:
                    fill_color = self.layers[layer_name].get('fill_color')
                    svg_parts.append(shape.to_svg(fill_color))
                else:
                    svg_parts.append(shape.to_svg())

        svg_parts.append('</svg>')

        svg_content = '\n'.join(svg_parts)

        if filename:
            with open(filename, 'w') as f:
                f.write(svg_content)

        return svg_content


# Export all commonly used items for "from buildprimitives import *"
__all__ = [
    'Edge',
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
