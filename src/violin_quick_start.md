# 🎻 Violin Neck Generator - Quick Start Guide

## What You Have

A complete, working system for generating parametric violin neck templates. Everything auto-generates from your parameter definitions.

## File Structure

```
diagram-creator/
├── src/
│   ├── violin_parameters.py    ← YOUR MAIN FILE (add parameters here)
│   ├── violin_geometry.py      ← YOUR GEOMETRY CODE (Build123d)
│   └── violin_generator.py     ← Orchestrator (rarely touch)
├── web/
│   └── violin_neck.html        ← Web UI (auto-generates from parameters)
└── tests/
    └── test_violin.py          ← Tests
```

## Getting Started (3 Steps)

### 1. Test Locally

```bash
# Navigate to project
cd diagram-creator

# Start web server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/web/violin_neck.html
```

**First load takes 1-2 minutes** (downloads Python + Build123d)

### 2. Add Your First Parameter

Open `src/violin_parameters.py` and add:

```python
'heel_button_diameter': NumericParameter(
    name='heel_button_diameter',
    label='Heel Button Diameter',
    unit='mm',
    default=12.0,
    min_val=10.0,
    max_val=16.0,
    description='Diameter of the heel button',
    category='Basic Dimensions',
    step=0.5
),
```

**That's it!** The input field appears automatically in the UI.

### 3. Use It In Geometry

Open `src/violin_geometry.py`:

```python
def create_complete_template(self):
    # Your new parameter is available:
    button_diameter = self.params['heel_button_diameter']
    
    # Use it in your geometry...
```

## Your Workflow

### Adding Parameters

**Numeric (sliders/inputs):**
```python
'my_dimension': NumericParameter(
    name='my_dimension',
    label='Display Name',
    unit='mm',
    default=10.0,
    min_val=5.0,
    max_val=20.0,
    description='What this controls',
    category='Basic Dimensions'
)
```

**Dropdown/Select:**
```python
class MyOption(Enum):
    OPTION_A = "Option A Label"
    OPTION_B = "Option B Label"

'my_choice': EnumParameter(
    name='my_choice',
    label='Choose Type',
    enum_class=MyOption,
    default=MyOption.OPTION_A,
    description='What this affects',
    category='Profile'
)
```

**Checkbox:**
```python
'show_something': BooleanParameter(
    name='show_something',
    label='Show Something',
    default=True,
    description='Whether to display this',
    category='Display Options'
)
```

### Adding Validation Rules

In `src/violin_parameters.py`, `validate_parameters()`:

```python
def validate_parameters(params: Dict[str, Any]) -> tuple[bool, List[str]]:
    errors = []
    
    # Your expert knowledge here:
    if params['heel_button_diameter'] > params['width_at_heel']:
        errors.append("Button diameter can't exceed heel width")
    
    return len(errors) == 0, errors
```

### Adding Geometry

In `src/violin_geometry.py`:

```python
def create_my_feature(self) -> Face:
    """Create a new geometric feature"""
    my_param = self.params['my_dimension']
    
    with BuildSketch() as feature:
        # Your Build123d code here
        Circle(my_param / 2)
    
    return feature.sketch.faces()[0]
```

Then use it in `create_complete_template()`:

```python
def create_complete_template(self):
    with BuildSketch() as complete:
        # Existing geometry...
        add(self.create_neck_template_2d())
        
        # Add your new feature
        my_feature = self.create_my_feature()
        add(my_feature.moved(Location((x, y, 0))))
    
    return complete.sketch
```

## Common Build123d Patterns for Lutherie

### 1. Curves and Profiles

```python
# Smooth curve through points
with BuildLine() as curve:
    Spline((0, 0), (10, 5), (20, 8), (30, 10))

# Arc segment
with BuildLine():
    CenterArc((0, 0), radius=50, start_angle=0, arc_size=90)

# Bezier curve (for scroll volutes)
with BuildLine():
    Bezier((0, 0), (10, 20), (30, 25), (50, 20))
```

### 2. Tapered Shapes

```python
# Linear taper
width_start = 24.0
width_end = 27.0
length = 130.0

with BuildSketch():
    with BuildLine():
        Polyline(
            (-width_start/2, 0),
            (-width_end/2, length),
            (width_end/2, length),
            (width_start/2, 0),
            (-width_start/2, 0)
        )
    make_face()
```

### 3. Archimedean Spiral (Scroll)

```python
def create_scroll_spiral(self, turns=2.5, start_r=4, end_r=29):
    points = []
    steps = int(turns * 50)
    total_angle = turns * 2 * math.pi
    b = (end_r - start_r) / total_angle
    
    for i in range(steps + 1):
        theta = (i / steps) * total_angle
        r = start_r + b * theta
        x = r * math.cos(theta)
        y = r * math.sin(theta)
        points.append((x, y))
    
    with BuildLine() as spiral:
        Spline(*points)
    
    return spiral.line
```

### 4. Profile Interpolation

```python
def interpolate_profile(self, t):
    """t = 0 (nut) to 1 (heel)"""
    width = self.width_at_nut + t * (self.width_at_heel - self.width_at_nut)
    thickness = self.thick_at_nut + t * (self.thick_at_heel - self.thick_at_nut)
    
    # Apply curve (exponential, not linear)
    curve_factor = self.params.get('taper_curve', 1.0)
    t_curved = t ** curve_factor
    
    return width, thickness
```

## Testing Your Changes

### Test Parameters
```bash
python src/violin_parameters.py
```

Should output JSON and validation results.

### Test Generation
```bash
python src/violin_generator.py
```

Should generate test SVG.

### Full Integration Test
Open `web/violin_neck.html` in browser and click Generate.

## Tips for Lutherie Geometry

### 1. Work in Millimeters
All traditional lutherie measurements are in mm.

### 2. Use Historical References
```python
PRESETS = {
    'stradivari_1715': {
        'total_length': 130.0,
        'width_at_nut': 24.2,
        # ... measurements from actual instrument
    }
}
```

### 3. Add Reference Lines
```python
def _add_construction_lines(self):
    """Add centerline, reference marks"""
    with BuildLine():
        # Centerline
        Line((0, 0), (0, total_length))
    
    # Reference points
    with Locations((0, 0)):
        Circle(0.5, mode=Mode.PRIVATE)  # Nut position
```

### 4. Validate Proportions
```python
# Traditional proportion: scroll diameter ~2.15x heel width
scroll_d = params['scroll_diameter']
heel_w = params['width_at_heel']

if not (1.9 < scroll_d/heel_w < 2.5):
    errors.append(f"Scroll/heel ratio {scroll_d/heel_w:.2f} outside traditional range (1.9-2.5)")
```

## Common Issues

### "Failed to load logic.py"
- Make sure you're running the web server from project root
- Check file paths match structure above

### "Generation failed"
- Check browser console (F12) for Python errors
- Test `python src/violin_generator.py` directly
- Verify all parameters have valid defaults

### Slow Loading
- First load: 60-90 seconds (downloading Python/Build123d)
- Subsequent: 5-10 seconds (cached)
- Generation: 2-5 seconds per template

### Build123d Errors
- Check Build123d docs: https://build123d.readthedocs.io/
- Common issue: missing `make_face()` after BuildLine
- Use `with` contexts properly

## Next Steps

1. **Refine Geometry**: Improve neck profiles, scroll spirals
2. **Add Features**: Fingerboard, nut slots, peg holes
3. **Add Presets**: Historical instruments (Strad, Guarneri, Amati)
4. **Add Views**: Side view, front view templates
5. **Add Annotations**: Dimension lines, labels
6. **Export Options**: DXF for CNC, STL for 3D printing

## Getting Help

### Build123d Questions
- Docs: https://build123d.readthedocs.io/
- Examples: Check the API reference for sketching

### Python Questions
- The code is well-commented
- Each method has docstrings
- Start simple, add complexity gradually

### Git Questions
- Refer back to the Git guide
- Create branches for experiments
- Commit often with clear messages

## Your Advantage

As a lutherie expert, you know:
- **What** dimensions matter
- **Why** proportions are important  
- **How** they relate to playability

The system handles:
- **UI generation**
- **Validation feedback**
- **File export**
- **Web plumbing**

**Focus on your expertise.** The code structure keeps everything clean and maintainable.

## Example: Adding Fingerboard

1. **Add parameters** (`violin_parameters.py`):
```python
'fingerboard_length': NumericParameter(...),
'fingerboard_width_nut': NumericParameter(...),
'fingerboard_width_end': NumericParameter(...),
```

2. **Add geometry** (`violin_geometry.py`):
```python
def create_fingerboard_2d(self) -> Face:
    length = self.params['fingerboard_length']
    width_nut = self.params['fingerboard_width_nut']
    width_end = self.params['fingerboard_width_end']
    
    with BuildSketch() as fb:
        with BuildLine():
            Polyline(
                (-width_nut/2, 0),
                (-width_end/2, length),
                (width_end/2, length),
                (width_nut/2, 0),
                (-width_nut/2, 0)
            )
        make_face()
    
    return fb.sketch.faces()[0]
```

3. **Add to template**:
```python
def create_complete_template(self):
    with BuildSketch() as complete:
        add(self.create_neck_template_2d())
        add(self.create_fingerboard_2d())  # ← New!
        # ... rest of template
```

4. **Done!** Input fields appear automatically.

---

## You're Ready!

Open `web/violin_neck.html` and start designing. The system is built to let you focus on what you know best: violin geometry.

Happy lutherie! 🎻
