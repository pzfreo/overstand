"""
Build123d geometry generation logic.
Provides functions to create 2D diagrams and export them as SVG.
"""

from build123d import *
import sys

def generate_plate_svg(length: float, width: float, hole_radius: float) -> str:
    """
    Generates a 2D plate with a centered hole and returns the SVG string.
    
    Args:
        length: Length of the plate in mm (must be positive)
        width: Width of the plate in mm (must be positive)
        hole_radius: Radius of the center hole in mm (must be positive and smaller than plate dimensions)
    
    Returns:
        str: SVG representation of the plate
        
    Raises:
        ValueError: If any dimension is invalid
    """
    # Input validation
    if length <= 0:
        raise ValueError(f"Length must be positive, got {length}")
    if width <= 0:
        raise ValueError(f"Width must be positive, got {width}")
    if hole_radius <= 0:
        raise ValueError(f"Hole radius must be positive, got {hole_radius}")
    
    # Check if hole fits within the plate with reasonable margin
    min_dimension = min(length, width)
    if hole_radius * 2 >= min_dimension * 0.9:
        raise ValueError(
            f"Hole diameter ({hole_radius * 2}mm) is too large for plate "
            f"dimensions ({length}x{width}mm). Maximum recommended radius: {min_dimension * 0.45:.1f}mm"
        )
    
    try:
        # Create the geometry
        with BuildSketch() as builder:
            Rectangle(length, width)
            Circle(hole_radius, mode=Mode.SUBTRACT)
        
        # Export to SVG directly in memory (no temp files)
        exporter = ExportSVG(scale=1.0)
        exporter.add_shape(builder.sketch)

        # ExportSVG.write() can return SVG string directly without file I/O
        svg_text = exporter.write(filename=None)

        # Validate SVG output
        if not svg_text or not svg_text.strip().startswith('<'):
            raise RuntimeError("Generated SVG appears to be invalid")
        
        return svg_text
        
    except Exception as e:
        # Re-raise with more context
        raise RuntimeError(f"Failed to generate plate diagram: {str(e)}") from e


def validate_dimensions(length: float, width: float, hole_radius: float) -> dict:
    """
    Validates dimensions without generating the diagram.
    Useful for pre-validation in the UI.
    
    Args:
        length: Length of the plate in mm
        width: Width of the plate in mm
        hole_radius: Radius of the center hole in mm
    
    Returns:
        dict: {'valid': bool, 'errors': list of error messages}
    """
    errors = []
    
    try:
        length = float(length)
        width = float(width)
        hole_radius = float(hole_radius)
    except (ValueError, TypeError):
        return {'valid': False, 'errors': ['All dimensions must be valid numbers']}
    
    if length <= 0:
        errors.append(f"Length must be positive (got {length})")
    if width <= 0:
        errors.append(f"Width must be positive (got {width})")
    if hole_radius <= 0:
        errors.append(f"Hole radius must be positive (got {hole_radius})")
    
    if length > 0 and width > 0 and hole_radius > 0:
        min_dimension = min(length, width)
        max_hole_radius = min_dimension * 0.45
        
        if hole_radius * 2 >= min_dimension * 0.9:
            errors.append(
                f"Hole too large. Maximum radius for {length}x{width}mm plate: {max_hole_radius:.1f}mm"
            )
    
    # Additional sanity checks
    if length > 10000:
        errors.append("Length exceeds maximum (10000mm)")
    if width > 10000:
        errors.append("Width exceeds maximum (10000mm)")
    if hole_radius > 5000:
        errors.append("Hole radius exceeds maximum (5000mm)")
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }
