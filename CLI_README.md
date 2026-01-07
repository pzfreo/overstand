# Overstand CLI

Command-line interface for generating instrument diagrams from parameter files.

## Installation

The CLI is located at `src/overstand-cli` and requires Python 3.

Install dependencies:
```bash
# Basic dependencies (SVG and HTML generation)
pip install -r requirements.txt

# For PDF generation (requires system Cairo library)
# macOS: brew install cairo
# Ubuntu: apt-get install libcairo2-dev
pip install -r requirements-cli.txt
```

Make it executable (already done):
```bash
chmod +x src/overstand-cli
```

## Usage

```bash
overstand-cli INPUT_FILE [OPTIONS]
```

### Options

- `--view {side,top,cross_section,dimensions}` - Generate a specific view
- `--pdf` - Output as PDF instead of native format (SVG/HTML)
- `--output FILE` or `-o FILE` - Output file (default: auto-generate for PDF, stdout for SVG/HTML)
- `--all` - Generate all available views (requires `--output-dir`)
- `--output-dir DIR` - Output directory for `--all` mode

When using `--pdf` without `--output`, the CLI auto-generates a filename based on the instrument name and view type (e.g., `Basic_Violin_side-view.pdf`). If the file already exists, an increment is added (e.g., `Basic_Violin_side-view_1.pdf`).

## Examples

### Generate side view SVG
```bash
python src/overstand-cli presets/basic_violin.json --view side --output my-violin-side.svg
```

### Generate side view as PDF (auto-filename)
```bash
python src/overstand-cli presets/basic_violin.json --view side --pdf
# → Creates: Basic_Violin_side-view.pdf
```

### Generate side view as PDF (custom filename)
```bash
python src/overstand-cli presets/basic_violin.json --view side --pdf --output my-violin.pdf
```

### Generate dimensions table HTML
```bash
python src/overstand-cli presets/basic_violin.json --view dimensions --output dimensions.html
```

### Generate dimensions table as PDF
```bash
python src/overstand-cli presets/basic_violin.json --view dimensions --pdf
# → Creates: Basic_Violin_dimensions.pdf
```

### Generate all views at once (native formats)
```bash
python src/overstand-cli presets/basic_violin.json --all --output-dir ./output
```

This creates:
- `Basic_Violin_side-view.svg` - Side view diagram
- `Basic_Violin_dimensions.html` - Dimensions table

### Generate all views as PDFs
```bash
python src/overstand-cli presets/basic_violin.json --all --pdf --output-dir ./output
```

This creates:
- `Basic_Violin_side-view.pdf` - Side view as PDF
- `Basic_Violin_dimensions.pdf` - Dimensions table as PDF

### Print to stdout (useful for piping)
```bash
python src/overstand-cli presets/basic_violin.json --view side > diagram.svg
```

## Input File Format

The CLI accepts JSON files in the same format as the web UI's save/load feature:

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "description": "My Custom Instrument",
    "generator": "Overstand"
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

- **side** - Side view diagram (SVG, or PDF with `--pdf`)
- **dimensions** - Dimensions table (HTML, or PDF with `--pdf`)
- **top** - Top view SVG (coming soon)
- **cross_section** - Cross-section view SVG (coming soon)

## Output Files

### SVG Output
The side view generates a scalable vector graphic that can be:
- Opened in any SVG viewer or web browser
- Imported into CAD software
- Printed at any scale

### PDF Output
The `--pdf` flag generates print-ready documents from any view:
- SVG views (side, top, cross_section) use svglib + reportlab for conversion
- HTML views (dimensions) use weasyprint for conversion
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
