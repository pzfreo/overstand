"""
Instrument Neck Geometry Generator

This is where your Build123d geometry expertise goes.
"""

from build123d import *
import math
from typing import Dict, Any, Tuple

import js
import os

# 1. Define the correct raw URL
font_url = "https://raw.githubusercontent.com/pzfreo/diagram-creator/main/src/Roboto.ttf"
font_file = "Roboto.ttf"
font_name = "Roboto"
PTS_MM = 0.352778

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

roboto = os.path.abspath(font_file)

from OCP.TCollection import TCollection_AsciiString
from OCP.Font import Font_FontMgr, Font_FA_Regular, Font_StrictLevel

# 1. Get the absolute path

# 2. Manually register with the OCP Kernel
mgr = Font_FontMgr.GetInstance_s()

# 3. Load the font from the file
#    FIX: Pass 'font_path' as a simple Python string. Do not use TCollection_AsciiString.
font_handle = mgr.CheckFont(font_file)

# 4. Register the font with the manager
#    This makes it available to the 3D text engine.
#    Arguments: (Font Handle, Override_if_exists=True)
if font_handle:
    mgr.RegisterFont(font_handle, True)
    print(f"✓ Successfully registered font: {font_handle.FontName().ToCString()}")
else:
    print("✗ Failed to load font file.")

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

    # Export to SVG
    exporter = ExportSVG(scale=1.0,unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("text",fill_color=(0,0,255),line_type=LineType.HIDDEN)
    exporter.add_layer("drawing",fill_color=None, line_color=(0,0,0),line_type=LineType.CONTINUOUS)
    exporter.add_layer("schematic",fill_color=None, line_color=(0,0,0),line_type=LineType.DASHED)
    exporter.add_layer("dimensions",fill_color=(255,0,0), line_color=(255,0,0),line_type=LineType.DASHED)
    exporter.add_layer("extensions",fill_color=None, line_color=(255,0,0),line_type=LineType.CONTINUOUS)
    exporter.add_layer("arrows",fill_color=(255,0,0), line_color=(255,0,0),line_type=LineType.CONTINUOUS)

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

    # Add dimension annotations using helper functions
    dim_font_size = 8*PTS_MM

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

    # Title text - centered horizontally, 1cm above the highest point
    # Highest point is the top of the bridge line
    max_y = arching_height + bridge_height
    title_gap = 10  # 1cm gap
    title_text = Text("Side View", 12*PTS_MM, font=font_name)
    # Rough centering: "Side View" at 12pt is ~30mm wide, so offset by ~15mm
    title_text = title_text.move(Location((body_length/2 - 15, max_y + title_gap)))
    exporter.add_shape(title_text, layer="text")

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
