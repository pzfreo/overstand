"""
Violin Neck Geometry Generator

This is where your Build123d geometry expertise goes.
Focus on creating accurate violin neck geometry based on parameters.
"""

from build123d import *
import math
from typing import Dict, Any, Tuple


class ViolinNeckGeometry:
    """
    Generates violin neck geometry from validated parameters.
    
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
    
    def get_width_at(self, position: float) -> float:
        """Get neck width at position (0=nut, 1=heel)"""
        return self.interpolate('width_at_nut', 'width_at_heel', position)
    
    def get_thickness_at(self, position: float) -> float:
        """Get neck thickness at position (0=nut, 1=heel)"""
        return self.interpolate('thickness_at_nut', 'thickness_at_heel', position)
    
    # ============================================
    # NECK PROFILE GENERATION
    # ============================================
    
    def create_neck_profile(self, position: float) -> Face:
        """
        Create neck cross-section profile at given position.
        
        Args:
            position: Position along neck length (0=nut, 1=heel)
            
        Returns:
            Face representing the neck cross-section
        """
        width = self.get_width_at(position)
        thickness = self.get_thickness_at(position)
        roundness = self.params.get('profile_roundness', 70.0) / 100.0
        profile_type = self.params.get('profile_type', 'C_SHAPE')
        
        # Create profile based on type
        if profile_type == 'C_SHAPE':
            return self._create_c_profile(width, thickness, roundness)
        elif profile_type == 'V_SHAPE':
            return self._create_v_profile(width, thickness)
        elif profile_type == 'D_SHAPE':
            return self._create_d_profile(width, thickness, roundness)
        else:
            return self._create_c_profile(width, thickness, roundness)
    
    def _create_c_profile(self, width: float, thickness: float, roundness: float) -> Face:
        """
        Create modern C-shaped neck profile.
        Rounded back, comfortable for modern playing technique.
        """
        with BuildSketch() as profile:
            # Front half (fingerboard side) - rectangular
            with BuildLine():
                l1 = Polyline(
                    (-width/2, 0),
                    (-width/2, thickness/2),
                    (width/2, thickness/2),
                    (width/2, 0)
                )
            make_face()
            
            # Back half - rounded C shape
            back_radius = (thickness / 2) / roundness
            
            with BuildSketch():
                with BuildLine():
                    # Create arc for back profile
                    center_y = -back_radius + thickness/2
                    
                    # Arc from left to right
                    arc = CenterArc(
                        (0, center_y),
                        back_radius,
                        start_angle=180 + math.degrees(math.asin((width/2) / back_radius)),
                        arc_size=-2 * math.degrees(math.asin((width/2) / back_radius))
                    )
                    
                    # Close the profile
                    Line(arc @ 1, (width/2, 0))
                    Line((width/2, 0), (-width/2, 0))
                    Line((-width/2, 0), arc @ 0)
                
                make_face()
        
        return profile.sketch.faces()[0]
    
    def _create_v_profile(self, width: float, thickness: float) -> Face:
        """
        Create baroque V-shaped neck profile.
        Angular back, historically accurate for baroque instruments.
        """
        with BuildSketch() as profile:
            # Create V-shaped profile
            with BuildLine():
                points = [
                    (-width/2, 0),                    # Left front
                    (-width/2, thickness/2),          # Left top
                    (width/2, thickness/2),           # Right top
                    (width/2, 0),                     # Right front
                    (width/4, -thickness/4),          # Right back angle
                    (0, -thickness/3),                # Center back point (V apex)
                    (-width/4, -thickness/4),         # Left back angle
                    (-width/2, 0)                     # Close
                ]
                Polyline(*points)
            make_face()
        
        return profile.sketch.faces()[0]
    
    def _create_d_profile(self, width: float, thickness: float, roundness: float) -> Face:
        """
        Create romantic D-shaped neck profile.
        Flatter back than C-shape, popular in 19th century.
        """
        with BuildSketch() as profile:
            # Front half
            with BuildLine():
                l1 = Polyline(
                    (-width/2, 0),
                    (-width/2, thickness/2),
                    (width/2, thickness/2),
                    (width/2, 0)
                )
            make_face()
            
            # Back - flattened arc
            back_radius = (thickness / 2) / (roundness * 0.6)  # Flatter than C
            
            with BuildSketch():
                with BuildLine():
                    center_y = -back_radius + thickness/2
                    
                    arc = CenterArc(
                        (0, center_y),
                        back_radius,
                        start_angle=180 + math.degrees(math.asin(min(1.0, (width/2) / back_radius))),
                        arc_size=-2 * math.degrees(math.asin(min(1.0, (width/2) / back_radius)))
                    )
                    
                    Line(arc @ 1, (width/2, 0))
                    Line((width/2, 0), (-width/2, 0))
                    Line((-width/2, 0), arc @ 0)
                
                make_face()
        
        return profile.sketch.faces()[0]
    
    # ============================================
    # NECK SHAFT GENERATION
    # ============================================
    
    def create_neck_shaft(self) -> Part:
        """
        Create the main neck shaft from nut to heel.
        Uses loft between profiles at different positions.
        
        Returns:
            3D solid representing the neck shaft
        """
        neck_length = self.params.get('neck_length', 130.0)
        
        # Create profiles at key positions
        positions = [0.0, 0.25, 0.5, 0.75, 1.0]
        profiles = []
        
        for pos in positions:
            profile = self.create_neck_profile(pos)
            # Position along length
            z_pos = pos * neck_length
            profiles.append(profile.moved(Location((0, 0, z_pos))))
        
        # Loft between profiles to create neck shaft
        # Note: In actual Build123d, you'd use loft. This is simplified.
        # For 2D template, we'll create a top view projection
        return None  # Placeholder for 3D
    
    def create_neck_template_2d(self) -> Face:
        """
        Create 2D template view of neck (top view).
        This is what lutheriers use for cutting templates.
        
        Returns:
            Face representing top-view template
        """
        neck_length = self.params.get('neck_length', 130.0)
        width_nut = self.params.get('width_at_nut', 24.0)
        width_heel = self.params.get('width_at_heel', 27.0)
        
        with BuildSketch() as template:
            # Create tapered rectangle for neck shaft
            with BuildLine():
                points = [
                    (-width_nut/2, 0),              # Left at nut
                    (-width_heel/2, neck_length),   # Left at heel
                    (width_heel/2, neck_length),    # Right at heel
                    (width_nut/2, 0),               # Right at nut
                    (-width_nut/2, 0)               # Close
                ]
                Polyline(*points)
            make_face()
        
        return template.sketch.faces()[0]
    
    # ============================================
    # SCROLL GENERATION
    # ============================================
    
    def create_scroll_spiral(self) -> Wire:
        """
        Create the scroll spiral curve.
        Uses Archimedean spiral for traditional appearance.
        
        Returns:
            Wire representing the scroll spiral
        """
        scroll_diameter = self.params.get('scroll_diameter', 58.0)
        scroll_turns = self.params.get('scroll_turns', 2.5)
        eye_diameter = self.params.get('scroll_eye_diameter', 8.0)
        
        # Archimedean spiral: r = a + b*theta
        # Where r increases linearly with angle
        
        start_radius = eye_diameter / 2
        end_radius = scroll_diameter / 2
        total_angle = scroll_turns * 2 * math.pi
        
        # Spiral coefficient
        b = (end_radius - start_radius) / total_angle
        
        # Generate spiral points
        points = []
        steps = int(scroll_turns * 50)  # 50 points per turn
        
        for i in range(steps + 1):
            theta = (i / steps) * total_angle
            r = start_radius + b * theta
            
            x = r * math.cos(theta)
            y = r * math.sin(theta)
            points.append((x, y))
        
        with BuildLine() as spiral:
            Spline(*points)
        
        return spiral.line
    
    def create_scroll_2d(self) -> Face:
        """
        Create 2D scroll template (side view).
        
        Returns:
            Face representing scroll outline
        """
        scroll_diameter = self.params.get('scroll_diameter', 58.0)
        eye_diameter = self.params.get('scroll_eye_diameter', 8.0)
        
        with BuildSketch() as scroll:
            # Outer circle for scroll
            Circle(scroll_diameter / 2)
            
            # Inner eye
            Circle(eye_diameter / 2, mode=Mode.SUBTRACT)
            
            # Add spiral path (for reference)
            add(self.create_scroll_spiral())
        
        return scroll.sketch.faces()[0]
    
    # ============================================
    # PEGBOX GENERATION
    # ============================================
    
    def create_pegbox_2d(self) -> Face:
        """
        Create 2D pegbox template.
        
        Returns:
            Face representing pegbox
        """
        pegbox_length = self.params.get('pegbox_length', 70.0)
        pegbox_width = self.params.get('pegbox_width', 22.0)
        
        with BuildSketch() as pegbox:
            # Simple rectangular pegbox (can be refined)
            Rectangle(pegbox_width, pegbox_length)
            
            # Add peg holes
            string_count_str = self.params.get('string_count', 'FOUR')
            num_strings = 4 if 'FOUR' in string_count_str else 5
            
            # Peg positions (simplified - alternating sides)
            peg_spacing = pegbox_length / (num_strings + 1)
            
            for i in range(num_strings):
                y_pos = -pegbox_length/2 + (i + 1) * peg_spacing
                x_pos = -pegbox_width/4 if i % 2 == 0 else pegbox_width/4
                
                # Peg hole (simplified as small circle)
                with Locations((x_pos, y_pos)):
                    Circle(1.5, mode=Mode.SUBTRACT)
        
        return pegbox.sketch.faces()[0]
    
    # ============================================
    # ASSEMBLY AND ANNOTATIONS
    # ============================================
    
    def create_complete_template(self) -> Face:
        """
        Assemble complete neck template with all components.
        This is the main output - a 2D cutting template.
        
        Returns:
            Complete template as single Face
        """
        neck_length = self.params.get('neck_length', 130.0)
        scroll_diameter = self.params.get('scroll_diameter', 58.0)
        pegbox_length = self.params.get('pegbox_length', 70.0)
        
        with BuildSketch() as complete:
            # Neck shaft (positioned at origin)
            add(self.create_neck_template_2d())
            
            # Scroll (positioned at end of neck)
            scroll = self.create_scroll_2d()
            scroll_pos = neck_length + scroll_diameter/2
            add(scroll.moved(Location((0, scroll_pos, 0))))
            
            # Pegbox (between neck and scroll)
            pegbox = self.create_pegbox_2d()
            pegbox_pos = neck_length + pegbox_length/2
            add(pegbox.moved(Location((0, pegbox_pos, 0))))
            
            # Add reference lines if enabled
            if self.params.get('show_centerline', True):
                self._add_centerline(neck_length + scroll_diameter)
            
            if self.params.get('show_reference_points', True):
                self._add_reference_points(neck_length)
        
        return complete.sketch
    
    def _add_centerline(self, total_length: float):
        """Add construction centerline"""
        with BuildLine():
            Line((0, -10), (0, total_length + 10))
    
    def _add_reference_points(self, neck_length: float):
        """Add reference point markers"""
        # Nut position
        with Locations((0, 0)):
            Circle(1.0, mode=Mode.PRIVATE)
        
        # Heel position
        with Locations((0, neck_length)):
            Circle(1.0, mode=Mode.PRIVATE)
    
    # ============================================
    # DIMENSION ANNOTATIONS
    # ============================================
    
    def add_dimension_annotations(self, sketch: Sketch) -> Sketch:
        """
        Add dimension lines and measurements to the template.
        
        Args:
            sketch: The base sketch to annotate
            
        Returns:
            Annotated sketch
        """
        if not self.params.get('show_measurements', True):
            return sketch
        
        # This would add dimension lines, arrows, and text
        # Simplified here - in practice, you'd use text and leader lines
        
        return sketch


def generate_neck_svg(params: Dict[str, Any]) -> str:
    """
    Main entry point for generating neck geometry.
    
    Args:
        params: Validated parameter dictionary
        
    Returns:
        SVG string of the complete neck template
    """
    generator = ViolinNeckGeometry(params)
    
    # Generate complete template
    template_sketch = generator.create_complete_template()
    
    # Export to SVG
    exporter = ExportSVG(scale=1.0)
    exporter.add_shape(template_sketch)
    
    # Write to temporary file and read back
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as tmp:
        temp_path = tmp.name
    
    try:
        exporter.write(temp_path)
        
        with open(temp_path, 'r') as f:
            svg_content = f.read()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    
    return svg_content


def generate_side_view_svg(params: Dict[str, Any]) -> str:
    """
    MOCK: Generates side view showing neck profile, angle, and body joint.

    In a real implementation, this would show:
    - Neck thickness profile from nut to heel
    - Neck angle relative to body
    - Joint detail where neck meets body
    - Side profile of scroll

    Args:
        params: Validated parameter dictionary

    Returns:
        SVG string of side view
    """
    neck_length = params.get('neck_length', 130.0)
    thickness_nut = params.get('thickness_at_nut', 19.0)
    thickness_heel = params.get('thickness_at_heel', 22.0)
    scroll_diameter = params.get('scroll_diameter', 58.0)

    # Mock: Create simple side profile
    with BuildSketch() as side_view:
        # Neck shaft (tapered thickness)
        with BuildLine():
            points = [
                (0, 0),                               # Top at nut
                (neck_length, 0),                     # Top at heel
                (neck_length, -thickness_heel),       # Bottom at heel
                (0, -thickness_nut),                  # Bottom at nut
                (0, 0)                                # Close
            ]
            Polyline(*points)
        make_face()

        # Scroll side profile (simple circle)
        with Locations((neck_length + scroll_diameter/2, -thickness_heel/2)):
            Circle(scroll_diameter/2)

        # Body joint indicator (simple rectangle)
        with Locations((neck_length + 10, -thickness_heel - 15)):
            Rectangle(20, 30)

    # Export to SVG
    exporter = ExportSVG(scale=1.0)
    exporter.add_shape(side_view.sketch)

    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as tmp:
        temp_path = tmp.name

    try:
        exporter.write(temp_path)
        with open(temp_path, 'r') as f:
            svg_content = f.read()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return svg_content


def generate_top_view_svg(params: Dict[str, Any]) -> str:
    """
    MOCK: Generates top view showing fingerboard outline.

    In a real implementation, this would show:
    - Tapered fingerboard from nut to body
    - Scroll from above
    - String positions
    - Reference centerline

    Args:
        params: Validated parameter dictionary

    Returns:
        SVG string of top view
    """
    # This is essentially what create_complete_template() does
    # For now, reuse that function
    generator = ViolinNeckGeometry(params)
    template_sketch = generator.create_complete_template()

    exporter = ExportSVG(scale=1.0)
    exporter.add_shape(template_sketch)

    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as tmp:
        temp_path = tmp.name

    try:
        exporter.write(temp_path)
        with open(temp_path, 'r') as f:
            svg_content = f.read()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return svg_content


def generate_cross_section_svg(params: Dict[str, Any]) -> str:
    """
    MOCK: Generates cross-section at heel where neck joins body.

    This is THE key diagram for neck shaping and joint fitting.

    In a real implementation, this would show:
    - Exact neck profile at the heel position
    - Mortise dimensions for body joint
    - Button placement
    - String spacing at this point

    Args:
        params: Validated parameter dictionary

    Returns:
        SVG string of cross-section view
    """
    width_heel = params.get('width_at_heel', 27.0)
    thickness_heel = params.get('thickness_at_heel', 22.0)
    profile_type = params.get('profile_type', 'C_SHAPE')

    # Generate the actual neck profile at heel position
    generator = ViolinNeckGeometry(params)
    profile_face = generator.create_neck_profile(position=1.0)  # 1.0 = heel

    # Add body joint context (mortise outline)
    with BuildSketch() as cross_section:
        # Add the neck profile
        add(profile_face)

        # Add mortise outline (where neck inserts into body)
        mortise_width = width_heel + 2
        mortise_depth = 15

        with Locations((0, -thickness_heel/2 - mortise_depth/2 - 2)):
            Rectangle(mortise_width, mortise_depth, mode=Mode.PRIVATE)

        # Add centerline reference
        with BuildLine():
            Line((0, thickness_heel), (0, -thickness_heel - mortise_depth - 5))

    exporter = ExportSVG(scale=1.0)
    exporter.add_shape(cross_section.sketch)

    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as tmp:
        temp_path = tmp.name

    try:
        exporter.write(temp_path)
        with open(temp_path, 'r') as f:
            svg_content = f.read()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return svg_content


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
        svg = generate_neck_svg(params)
        print(f"✓ Generated SVG ({len(svg)} bytes)")

        # Save test output
        with open('test_neck_template.svg', 'w') as f:
            f.write(svg)
        print("✓ Saved to test_neck_template.svg")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
