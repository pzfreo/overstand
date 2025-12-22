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
MAGIC_COLOR = Color(0x123456)

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

    # sort out text
    filled_style = 'fill="black" stroke="none"'
    svg_content = svg_content.replace('stroke="#123456"', filled_style)
    svg_content = svg_content.replace('stroke="rgb(18,52,86)"', filled_style)    


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
    exporter.add_shape(Text("Neck view",10, font=font_name))
    
    return exporter_to_svg(exporter)
    

def generate_side_view_svg(params: Dict[str, Any]) -> str:
    vsl = params.get('vsl')
    neck_stop = params.get('neck_stop')
    body_stop = params.get('body_stop')
    arching_height = params.get('arching_height')
    body_length = params.get('body_length')
    rib_height = params.get('rib_height')
    neck_thickness_at_first = params.get('neck_thickness_at_first')
    neck_thickness_at_seventh = params.get('neck_thickness_at_seventh')
    
    # Export to SVG
    exporter = ExportSVG(scale=1.0,unit=Unit.MM, line_weight=0.5)
    exporter.add_layer("text",fill_color=(0,0,0),line_type=LineType.HIDDEN)
    exporter.add_layer("drawing",fill_color=None, line_color=(255,0,0),line_type=LineType.CONTINUOUS)
    exporter.add_shape(Rectangle(width=body_length,height=-rib_height),layer="drawing")
    exporter.add_shape(Text("Side View", 10, font=font_name),layer="text")
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
