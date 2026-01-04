# Instrument Generator CLI

Command-line interface for generating instrument diagrams from parameter files.

## Installation

The CLI is located at `src/instrument-gen-cli` and requires Python 3.

Install dependencies:
```bash
pip install -r requirements.txt
```

Make it executable (already done):
```bash
chmod +x src/instrument-gen-cli
```

## Usage

```bash
instrument-gen-cli INPUT_FILE [OPTIONS]
```

### Options

- `--view {side,top,cross_section,dimensions,pdf}` - Generate a specific view
- `--output FILE` or `-o FILE` - Output file (default: stdout, required for pdf)
- `--all` - Generate all available views (requires `--output-dir`)
- `--output-dir DIR` - Output directory for `--all` mode

## Examples

### Generate side view SVG
```bash
python src/instrument-gen-cli presets/basic_violin.json --view side --output my-violin-side.svg
```

### Generate side view as PDF
```bash
python src/instrument-gen-cli presets/basic_violin.json --view pdf --output my-violin.pdf
```

### Generate dimensions table HTML
```bash
python src/instrument-gen-cli presets/basic_violin.json --view dimensions --output dimensions.html
```

### Generate all views at once
```bash
python src/instrument-gen-cli presets/basic_violin.json --all --output-dir ./output
```

This creates:
- `Basic_Violin_side.svg` - Side view diagram
- `Basic_Violin_side.pdf` - Side view as PDF
- `Basic_Violin_dimensions.html` - Dimensions table

### Print to stdout (useful for piping)
```bash
python src/instrument-gen-cli presets/basic_violin.json --view side > diagram.svg
```

## Input File Format

The CLI accepts JSON files in the same format as the web UI's save/load feature:

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "description": "My Custom Instrument",
    "generator": "Instrument Neck Geometry Generator"
  },
  "parameters": {
    "instrument_name": "My Violin",
    "vsl": 328.5,
    "body_stop": 195.0,
    ...
  }
}
```

You can also use simplified format with just parameters:

```json
{
  "instrument_name": "My Violin",
  "vsl": 328.5,
  "body_stop": 195.0,
  ...
}
```

## Available Views

- **side** - Side view SVG diagram
- **pdf** - Side view as PDF (scale-accurate for printing)
- **dimensions** - Dimensions table HTML
- **top** - Top view SVG (coming soon)
- **cross_section** - Cross-section view SVG (coming soon)

## Output Files

### SVG Output
The side view generates a scalable vector graphic that can be:
- Opened in any SVG viewer or web browser
- Imported into CAD software
- Printed at any scale

### PDF Output
The PDF view generates a print-ready document:
- Uses svglib + reportlab for conversion
- Maintains scale accuracy for workshop use

### HTML Output
The dimensions table generates a standalone HTML file with:
- All parameter values organized by category
- Calculated/derived values
- Clean, printable formatting

## Tips

- Use preset files from `presets/` directory as starting points
- Save parameter configurations from the web UI to use with CLI
- Use `--all` mode to generate documentation for multiple instruments at once
- Pipe output to other tools for batch processing

## Troubleshooting

**Font warnings**: The CLI may show warnings about missing Roboto font. It will fall back to Arial, which works fine for most purposes.

**Missing parameters**: If a parameter is missing from your JSON file, the tool will use default values defined in `src/parameter_registry.py`.
