# System Architecture Summary

## Overview

This is a parametric instrument neck geometry generator that calculates neck angles and generates technical diagrams for arched stringed instruments (violins, violas, cellos, viols, guitars, mandolins).

The system runs entirely in the browser using Pyodide (Python in WebAssembly) with a unified parameter registry as the single source of truth.

---

## Core Components

### Parameter Registry (`parameter_registry.py`)

The single source of truth for all 53+ parameters. Each parameter is defined once with:

- **UnifiedParameter** dataclass combining input and output metadata
- **InputConfig**: min/max values, defaults, step size, visibility conditions
- **OutputConfig**: decimal places, display category, visibility
- **ParameterRole**: INPUT_ONLY, OUTPUT_ONLY, or CONDITIONAL

```python
# Example: body_stop is input for violin/viol, output for guitar
UnifiedParameter(
    key='body_stop',
    role=ParameterRole.CONDITIONAL,
    is_output_for={'VIOLIN': False, 'VIOL': False, 'GUITAR_MANDOLIN': True},
    input_config=InputConfig(...),
    output_config=OutputConfig(...)
)
```

### Generation Pipeline

```
instrument_generator.py (Entry Point - called from JavaScript)
    │
    ├── validate_parameters()      # Validate input values
    │
    └── instrument_geometry.py (Orchestration)
        │
        ├── calculate_derived_values()
        │   ├── geometry_engine.calculate_fingerboard_thickness()
        │   ├── geometry_engine.calculate_string_angles_violin()
        │   ├── geometry_engine.calculate_string_angles_guitar()
        │   ├── geometry_engine.calculate_neck_geometry()
        │   └── geometry_engine.calculate_fingerboard_geometry()
        │
        └── generate_side_view_svg()
            ├── svg_renderer.draw_body()
            ├── svg_renderer.draw_neck()
            ├── svg_renderer.draw_fingerboard()
            ├── svg_renderer.draw_string_and_references()
            └── svg_renderer.add_dimensions()
```

### UI Layer

- **ui_metadata.py**: Defines UI sections and organization
- **preset_loader.py**: Loads instrument presets from JSON files
- **JavaScript** (web/app.js, web/ui.js): Renders UI from Python metadata

---

## Key Design Patterns

### 1. Separation of Concerns

| Module | Responsibility |
|--------|----------------|
| `geometry_engine.py` | Pure math (no UI, no rendering) |
| `svg_renderer.py` | SVG drawing (no calculation) |
| `instrument_geometry.py` | Orchestration layer |
| `instrument_generator.py` | JavaScript bridge, error handling |
| `parameter_registry.py` | Parameter definitions |
| `ui_metadata.py` | UI structure |

### 2. Unified Parameter Registry (DRY)

All parameter metadata is defined once in `PARAMETER_REGISTRY`. Functions generate different views:
- `get_all_input_parameters()` - For UI form generation
- `get_all_output_parameters()` - For derived value display
- `get_default_values()` - For initialization
- `validate_parameters()` - For input validation

### 3. Conditional Visibility

Parameters can be conditionally visible based on other parameter values:

```python
input_config=InputConfig(
    visible_when={'instrument_family': ['VIOL']}  # Only show for viols
)
```

### 4. Role-Based Parameters

Some parameters switch between input and output based on instrument family:
- **body_stop**: Input for violin/viol (user specifies), output for guitar (calculated)
- **neck_stop**: Output for violin/viol (calculated), input for guitar (derived from fret position)

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    JavaScript (Browser)                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  UI Forms   │───▶│   app.js    │───▶│  Display    │ │
│  └─────────────┘    └──────┬──────┘    └─────────────┘ │
└────────────────────────────┼────────────────────────────┘
                             │ JSON
┌────────────────────────────▼────────────────────────────┐
│                    Python (Pyodide)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              instrument_generator.py              │   │
│  │  • generate_violin_neck(params_json)             │   │
│  │  • get_parameter_definitions()                    │   │
│  │  • get_ui_metadata()                              │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │              instrument_geometry.py               │   │
│  │  • calculate_derived_values()                     │   │
│  │  • generate_side_view_svg()                       │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │     geometry_engine.py    │    svg_renderer.py    │   │
│  │     (pure math)           │    (SVG drawing)      │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Adding New Parameters

1. **Add to PARAMETER_REGISTRY** in `parameter_registry.py`:

```python
'my_new_param': UnifiedParameter(
    key='my_new_param',
    display_name='My New Parameter',
    param_type=ParameterType.NUMERIC,
    unit='mm',
    description='What this parameter controls',
    role=ParameterRole.INPUT_ONLY,
    input_config=InputConfig(
        min_val=0.0,
        max_val=100.0,
        default=50.0,
        step=1.0,
        category='Basic Dimensions'
    )
)
```

2. **Use in geometry calculations** (if needed):

```python
# In geometry_engine.py or instrument_geometry.py
my_value = params.get('my_new_param', 50.0)
```

3. **UI auto-generates** - No JavaScript changes needed!

---

## File Structure

```
src/
├── parameter_registry.py    # Single source of truth (1500+ lines)
├── instrument_generator.py  # Main entry point
├── instrument_geometry.py   # Geometry orchestration
├── geometry_engine.py       # Pure math calculations
├── svg_renderer.py          # SVG drawing
├── ui_metadata.py           # UI section definitions
├── preset_loader.py         # JSON preset loading
├── constants.py             # Default values
├── buildprimitives.py       # Drawing primitives
├── dimension_helpers.py     # Dimension annotations
├── radius_template.py       # Fingerboard radius templates
└── view_generator.py        # HTML view generation (fret tables)

web/
├── index.html               # Main interface
├── app.js                   # Application logic
├── ui.js                    # UI helpers
├── state.js                 # State management
├── pdf_export.js            # PDF generation
├── pwa_manager.js           # Service worker management
├── styles.css               # Styling
└── service-worker.js        # Offline support

presets/                     # JSON preset files (violin.json, etc.)
tests/                       # pytest tests (51 tests)
scripts/                     # Build and utility scripts
```

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html
```

Current test coverage: 51 tests across 3 files.
