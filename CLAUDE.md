# Claude Code Instructions for Overstand

## Project Overview

Overstand is a parametric CAD tool for lutherie - generating precise neck templates for arched stringed instruments (violins, violas, cellos, viols, guitars, mandolins). It has a Python backend (geometry engine) running in Pyodide and a web frontend (PWA).

**Key architecture document**: See `src/complete_system_summary.md` for detailed system architecture.

## Critical Requirements

### Be a Critical Design Partner

Don't be a cheerleader. Be a thoughtful, constructive critic who helps make better decisions:

- **Challenge assumptions**: If a proposed approach seems suboptimal, say so. Explain why and suggest alternatives.
- **Question complexity**: Push back on over-engineered solutions. Ask "do we really need this?"
- **Identify trade-offs**: When there are multiple approaches, lay out the pros and cons honestly.
- **Flag risks**: Point out potential issues early - maintenance burden, performance concerns, edge cases.
- **Disagree respectfully**: It's better to voice concerns upfront than to implement something you think is wrong.
- **Ask clarifying questions**: If requirements are ambiguous, ask rather than assume.

The goal is better software, not validation. A good "no" or "have you considered..." is more valuable than blind agreement.

### CLI and Web Must Stay in Sync

The CLI (`src/overstand-cli`) and web app share the same Python codebase. Any changes to:
- `src/parameter_registry.py` - Parameter definitions
- `src/instrument_geometry.py` - Geometry calculations
- `src/geometry_engine.py` - Math functions
- `src/svg_renderer.py` - SVG generation
- `presets/*.json` - Preset files

**Must work identically in both CLI and web contexts.** After modifying shared Python code:
1. Run CLI tests: `pytest tests/`
2. Test web app manually
3. Verify preset files load correctly in both

### Single Source of Truth

The `parameter_registry.py` is the single source of truth for all 53+ parameters. When adding parameters:
1. Add to `PARAMETER_REGISTRY` in `src/parameter_registry.py`
2. Use in geometry calculations if needed
3. UI auto-generates - no JavaScript changes needed

See `src/complete_system_summary.md` for the "Adding New Parameters" guide.

## Development Workflow

### Always Use Feature Branches and PRs
- Never commit directly to main
- Create a feature branch for each change: `claude/descriptive-name-XXXXX`
- Push changes and create a PR for review
- Include a clear PR description with summary and test plan

### Testing Requirements

**Before committing any changes:**
1. Run Python tests: `pytest tests/`
2. Run JavaScript tests: `npm test`
3. If you modify shared Python code, test both CLI and web
4. Write tests for new functionality

### Code Quality
- Follow existing code patterns and style
- Don't over-engineer - make minimal changes needed
- Don't add features beyond what was requested
- Respect the separation of concerns:
  - `geometry_engine.py` - Pure math (no UI, no rendering)
  - `svg_renderer.py` - SVG drawing (no calculation)
  - `instrument_geometry.py` - Orchestration layer
  - `instrument_generator.py` - JavaScript bridge, error handling

### Commit Practices
- Write clear, descriptive commit messages explaining "why" not just "what"
- Make atomic commits - one logical change per commit
- Run tests before committing

## Architecture Overview

```
JavaScript (Browser)
    │
    ▼ JSON parameters
Python (Pyodide)
    │
    ├── instrument_generator.py   ← Entry point (JS bridge)
    │       │
    │       ▼
    ├── instrument_geometry.py    ← Orchestration
    │       │
    │       ├── geometry_engine.py   ← Pure math
    │       │
    │       └── svg_renderer.py      ← SVG drawing
    │
    ▼ SVG + derived values
JavaScript (Display)
```

The same Python modules are used by the CLI for batch processing.

## Commands Reference

```bash
# Python tests
pytest tests/
pytest tests/test_geometry_engine.py -v  # specific file

# JavaScript tests
npm test
npm run test:watch    # watch mode
npm run test:coverage # with coverage

# Build for production
./scripts/build.sh

# CLI usage
python src/overstand-cli presets/basic_violin.json --view side -o output.svg
python src/overstand-cli presets/basic_violin.json --all --output-dir ./output
```

## Project Structure

```
src/                           # Python geometry engine (shared by web + CLI)
├── parameter_registry.py      # Single source of truth for parameters
├── instrument_generator.py    # Main entry point
├── instrument_geometry.py     # Geometry orchestration
├── geometry_engine.py         # Pure math calculations
├── svg_renderer.py            # SVG drawing
├── overstand-cli              # CLI executable
└── complete_system_summary.md # Architecture documentation

web/                           # Frontend (HTML, CSS, JS)
├── app.js                     # Application logic
├── ui.js                      # UI generation
├── state.js                   # State management
└── styles.css                 # All styling

tests/                         # Python test files
presets/                       # Instrument preset JSON files
scripts/                       # Build and utility scripts
```

## Key Documentation

- `src/complete_system_summary.md` - System architecture and data flow
- `CODE_REVIEW_PLAN.md` - Code review status and known improvements
- `CLI_README.md` - CLI usage documentation
- `VERCEL_SETUP.md` - Deployment configuration
- `presets/README.md` - Preset file format and management

## Mobile/PWA Considerations

- Test changes on mobile viewport sizes
- The app has a 56px icon bar on the left on mobile
- Modals and overlays must be outside `.app-container` for proper z-index stacking
- Cache aggressively - use `?reset` URL parameter to clear cache when testing
