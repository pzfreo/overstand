# Overstand

A web-based tool for designing and calculating precise neck geometry for arched stringed instruments including violins, violas, cellos, viols, guitars, and mandolins.

## What It Does

The string length, neck angle, bridge position, bridge height, nut position, fingerboard shape, and overstand are all linked in a flexible geometry. This app helps you explore these relationships as you design new instruments or tweak existing designs.

- **For violins and viols**: The string length and body stop (along with other parameters) are used to calculate the neck angle and neck stop.
- **For guitars and mandolins**: The body stop is calculated based on which fret the body join is at (usually 12 or 14).

The app calculates neck angle and draws a diagram based on your measurements. You can download the diagram as a scale-accurate PDF for printing.

## Features

- **Browser-Based**: No installation needed - runs entirely in your browser using Pyodide (Python in WebAssembly)
- **Multiple Instruments**: Supports violins, violas, cellos, viols, archtop guitars, mandolins, and more
- **Real-Time Calculation**: Adjust parameters and see results instantly
- **Export Options**: Download diagrams as SVG or PDF for workshop use
- **Offline-Capable**: Works without internet connection after first load (PWA)
- **Preset Library**: Quick-start templates for common instruments

## Quick Start

### Option 1: Use Online (Recommended)

Visit **[https://overstand.tools](https://overstand.tools)** to use the tool immediately.

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/pzfreo/overstand.git
cd overstand

# Run local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/web
```

**Note**: First load takes 30-60 seconds to download Python runtime and libraries.

### Option 3: Vercel Deployment

See [VERCEL_SETUP.md](VERCEL_SETUP.md) for deployment instructions with automatic PR previews.

## Project Structure

```
overstand/
├── src/                         # Python source code
│   ├── parameter_registry.py    # Single source of truth for all parameters
│   ├── instrument_generator.py  # Main entry point (called from JavaScript)
│   ├── instrument_geometry.py   # Geometry orchestration
│   ├── geometry_engine.py       # Pure math calculations
│   ├── svg_renderer.py          # SVG drawing
│   ├── ui_metadata.py           # UI section definitions
│   ├── preset_loader.py         # Load JSON presets
│   ├── constants.py             # Default values
│   ├── buildprimitives.py       # Drawing primitives
│   ├── dimension_helpers.py     # Dimension annotations
│   ├── radius_template.py       # Fingerboard radius templates
│   └── view_generator.py        # HTML view generation
│
├── web/                         # Web interface
│   ├── index.html               # Main interface
│   ├── app.js                   # Application logic
│   ├── ui.js                    # UI helpers
│   ├── state.js                 # State management
│   ├── pdf_export.js            # PDF generation
│   └── styles.css               # Styling
│
├── presets/                     # Instrument preset JSON files
├── tests/                       # pytest test suite
├── scripts/                     # Build and utility scripts
└── public/                      # Built output for deployment
```

## Architecture

The system uses a **unified parameter registry** as the single source of truth:

```
JavaScript (Browser)
    │
    ▼ JSON parameters
Python (Pyodide)
    │
    ├── instrument_generator.py   ← Entry point
    │       │
    │       ▼
    ├── instrument_geometry.py    ← Orchestration
    │       │
    │       ├── geometry_engine.py   ← Pure math (no rendering)
    │       │
    │       └── svg_renderer.py      ← SVG drawing
    │
    ▼ SVG + derived values
JavaScript (Display)
```

See [src/complete_system_summary.md](src/complete_system_summary.md) for detailed architecture documentation.

## Testing

```bash
# Install test dependencies
pip install pytest

# Run all tests (51 tests)
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html
```

## CLI Usage

A command-line interface is available for batch processing:

```bash
# Generate side view SVG
python src/overstand-cli presets/violin.json --view side --output violin.svg

# Generate all views
python src/overstand-cli presets/violin.json --all --output-dir ./output
```

See [CLI_README.md](CLI_README.md) for full documentation.

## Adding New Parameters

1. Add to `PARAMETER_REGISTRY` in `src/parameter_registry.py`
2. Use in geometry calculations if needed
3. UI auto-generates - no JavaScript changes needed!

```python
'my_param': UnifiedParameter(
    key='my_param',
    display_name='My Parameter',
    param_type=ParameterType.NUMERIC,
    unit='mm',
    description='What this controls',
    role=ParameterRole.INPUT_ONLY,
    input_config=InputConfig(min_val=0, max_val=100, default=50)
)
```

## Dependencies

**Python (via Pyodide)**:
- numpy
- svgpathtools
- matplotlib

**JavaScript (CDN)**:
- Pyodide - Python runtime in WebAssembly
- jsPDF + svg2pdf.js - PDF generation
- SVG.js - Interactive SVG manipulation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

- Report issues at [GitHub Issues](https://github.com/pzfreo/overstand/issues)
- See [CODE_REVIEW_PLAN.md](CODE_REVIEW_PLAN.md) for known improvements

## Disclaimer

This tool is in development and not to be relied on with your precious luthiery project. Please double-check anything it tells you!

## Feedback

I'd love feedback - [paul@fremantle.org](mailto:paul@fremantle.org)

If you want to submit instrument measurements, I'm planning a database: please save the data and send me the .json file.

## Author

Created by [@pzfreo](https://github.com/pzfreo)

## License

This project is open source.
