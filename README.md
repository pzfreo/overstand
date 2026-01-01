# 🔧 Build123d Diagram Generator

A web-based parametric 2D CAD diagram generator powered by Build123d and Pyodide. Create technical drawings directly in your browser without any installation required.

## ✨ Features

- **Browser-Based**: No installation needed - runs entirely in your web browser
- **Parametric Design**: Adjust dimensions in real-time with instant preview
- **Multiple Export Formats**: Download your diagrams as SVG or PDF
- **Python-Powered**: Uses Build123d CAD library via Pyodide (Python in WebAssembly)
- **Offline-Capable**: Once loaded, works without internet connection

## 🚀 Quick Start

### Option 1: Vercel Deployment (Recommended)

1. Fork this repository
2. Connect to Vercel at https://vercel.com
3. Vercel will auto-deploy with preview URLs for all PRs
4. Visit your production URL at `https://overstand.tools`

See `VERCEL_SETUP.md` for detailed setup instructions.

### Option 2: GitHub Pages

1. Fork this repository
2. Enable GitHub Pages in repository Settings → Pages
3. Set source to `main` branch and `/web` folder
4. Visit `https://yourusername.github.io/diagram-creator`

### Option 3: Local Development

```bash
# Clone the repository
git clone https://github.com/pzfreo/diagram-creator.git
cd diagram-creator

# Run local server (Python 3)
python3 -m http.server 8000

# Or use the provided script
./setup.sh
```

Then open http://localhost:8000/web in your browser.

## 📁 Project Structure

```
diagram-creator/
├── src/
│   └── logic.py          # Build123d geometry generation logic
├── web/
│   └── index.html        # Web interface
├── tests/
│   └── test_logic.py     # Unit tests
├── requirements.txt      # Python dependencies (for local testing)
├── run_web.py           # Local development server
└── setup.sh             # Quick setup script
```

## 🛠️ How It Works

1. **Pyodide** loads Python and Build123d into the browser using WebAssembly
2. **logic.py** contains the parametric geometry generation code
3. **index.html** provides the UI and orchestrates the generation process
4. Generated diagrams can be downloaded as SVG or converted to PDF

## 📊 Current Example

The included example generates a rectangular plate with a centered circular hole. Parameters:

- **Length**: Plate length in millimeters
- **Width**: Plate width in millimeters  
- **Hole Radius**: Radius of the center hole

## 🔧 Extending the Generator

### Adding New Shapes

1. Add a new function to `src/logic.py`:

```python
def generate_bracket_svg(height: float, width: float, thickness: float) -> str:
    """Generate an L-bracket shape"""
    with BuildSketch() as builder:
        # Your geometry here
        pass
    # Export logic...
    return svg_text
```

2. Update `index.html` to call your new function:

```javascript
const code = `logic.generate_bracket_svg(${h}, ${w}, ${t})`;
```

### Input Validation

The improved version includes comprehensive input validation:

```python
def validate_dimensions(length, width, hole_radius):
    """Pre-validates dimensions without generating"""
    errors = []
    # Validation logic...
    return {'valid': bool, 'errors': list}
```

## 🧪 Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
python -m pytest tests/

# Run with coverage
python -m pytest tests/ --cov=src --cov-report=html
```

## ⚡ Performance Notes

- **First Load**: ~30-60 seconds (downloads Python runtime + libraries)
- **Subsequent Loads**: ~5-10 seconds (cached in browser)
- **Generation**: ~1-2 seconds per diagram
- **Large Diagrams**: May take longer depending on complexity

## 🐛 Troubleshooting

### "Failed to load logic.py"
- Ensure you're running from the project root
- Check that `src/logic.py` or `web/logic.py` exists
- Try using a local web server instead of opening HTML directly

### "Generation failed"
- Check browser console for detailed error messages
- Verify all dimensions are positive numbers
- Ensure hole fits within plate dimensions

### Slow Loading
- First load requires downloading ~50MB of dependencies
- Subsequent loads use browser cache
- Check network tab in browser dev tools

## 📝 Code Improvements

### What's Been Improved

1. **Error Handling**
   - Comprehensive try-catch blocks
   - User-friendly error messages
   - Detailed validation feedback

2. **Code Organization**
   - Modular functions with clear responsibilities
   - Separated concerns (generation, validation, export)
   - Consistent naming conventions

3. **UI/UX**
   - Loading states with spinners
   - Input validation with visual feedback
   - Better status messages
   - Responsive design

4. **Performance**
   - Reduced file I/O operations
   - Better memory management
   - Cached state management

5. **Documentation**
   - Comprehensive docstrings
   - Type hints
   - Inline comments for complex logic

## 🗺️ Future Enhancements

- [ ] Multiple shape library (gears, brackets, flanges)
- [ ] Dimension annotations on diagrams
- [ ] Multi-shape compositions
- [ ] DXF export support
- [ ] 3D view option
- [ ] Template system
- [ ] Share/save designs
- [ ] Dark mode
- [ ] Undo/redo functionality

## 📚 Dependencies

- **Build123d**: CAD library for parametric modeling
- **Pyodide**: Python runtime in WebAssembly
- **jsPDF**: PDF generation
- **svg2pdf.js**: SVG to PDF conversion

## 📄 License

This project is open source. Please add your chosen license.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🔗 Resources

- [Build123d Documentation](https://build123d.readthedocs.io/)
- [Pyodide Documentation](https://pyodide.org/)
- [CadQuery OCP.wasm](https://github.com/yeicor/OCP.wasm)

## 👤 Author

Created by [@pzfreo](https://github.com/pzfreo)

## ⭐ Star History

If you find this useful, please consider giving it a star!