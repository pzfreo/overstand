# TypeScript Port Plan

## Problem

The Overstand web app uses Pyodide (Python compiled to WebAssembly) to run the
geometry engine in the browser. This causes **30–60 second cold-start times**,
making the app unusable on mobile and frustrating on desktop. The root cause is
Pyodide's 7–10 MB WASM binary plus Python stdlib initialisation. No amount of
caching or loading-screen polish fixes this — the architecture is the problem.

## Solution

Replace the Python geometry engine with an equivalent TypeScript implementation.
TypeScript runs natively in the browser as a plain JS module — no WASM, no
runtime initialisation, no download overhead. Expected load time after the port:
**under 1 second**.

The CLI (`src/overstand-cli`) will also be ported to TypeScript/Node so there is
a single implementation of the geometry engine shared by both the web app and the
CLI.

---

## Key Decisions Already Made

### TypeScript, not Rust

Rust WASM would also solve the load time problem, but TypeScript is the better
fit here because:
- The geometry calculations are simple trigonometry — no CPU bottleneck that
  needs WASM performance
- The existing frontend is already JavaScript; TypeScript is the same language
- Porting Python→TypeScript is more mechanical than Python→Rust
- The parameter registry (1742 lines of Python dataclasses) is easier to express
  in TypeScript than Rust

### TypeScript types for the parameter registry, not JSON

The parameter registry defines 53+ instrument parameters with metadata: type,
min/max, defaults, units, visibility conditions, role per instrument family.

This will be a TypeScript `const` object validated with `satisfies`, not a JSON
file, because:
- Visibility conditions (`visibleWhen`) are functions — they cannot be expressed
  in JSON without inventing and maintaining a DSL
- TypeScript gives compile-time errors when a required field is missing from a
  new parameter definition
- `satisfies Record<string, ParameterDef>` catches mistakes at the definition
  site, not at runtime
- All parameter logic lives in one place — the definition and its conditions are
  colocated

```typescript
export const PARAMETER_REGISTRY = {
  string_length: {
    displayName: 'Vibrating String Length',
    type: ParameterType.NUMERIC,
    unit: 'mm',
    role: ParameterRole.INPUT_ONLY,
    input: {
      min: 200, max: 800, default: 325, step: 1,
      category: 'Basic Dimensions',
      visibleWhen: (_p: InstrumentParams) => true,
    }
  },
  // ...
} satisfies Record<string, ParameterDef>
```

### TypeScript CLI via Bun or Node

The Python CLI (`src/overstand-cli`) will be replaced with a TypeScript CLI.
`bun build --compile` can produce a single self-contained executable with no
runtime dependency. The CLI and web app share the same TypeScript geometry
engine — the whole point of the port.

### Frontend: JS now, TS later

The web frontend (`web/app.js`, `web/ui.js`, `web/state.js` — ~1200 lines) will
remain as JavaScript initially. The TypeScript geometry engine compiles to JS
ESM modules that the existing JS frontend imports directly. Once the geometry
engine is complete and verified, porting the frontend to TypeScript is a
separate lower-risk phase.

### Build tooling

A build step is required to compile TypeScript. Use **Vite** or **esbuild** —
both are fast and well-supported. The current project has no bundler; the build
script (`scripts/build.sh`) will need to be extended to compile TypeScript.
TypeScript source lives in `src-ts/`. Compiled output goes to `dist/`.

---

## Current Architecture

```
Browser
  └── app.js
        ├── loads Pyodide (~7MB WASM + Python stdlib)
        ├── loads Python source files into Pyodide
        ├── calls generate_violin_neck(params_json)   ← string eval into Python
        └── receives SVG + derived values as JSON

Python (Pyodide)
  ├── instrument_generator.py    ← JS bridge, entry point
  ├── instrument_geometry.py     ← orchestration
  ├── geometry_engine.py         ← pure math (trig, bezier, fret positions)
  ├── svg_renderer.py            ← SVG string generation
  ├── buildprimitives.py         ← drawing primitives
  ├── dimension_helpers.py       ← dimension annotation drawing
  ├── parameter_registry.py      ← 53+ parameter definitions (1742 lines)
  ├── radius_template.py         ← fingerboard radius template SVG
  ├── view_generator.py          ← fret table HTML
  └── preset_loader.py           ← JSON preset loading

CLI (Python)
  └── src/overstand-cli          ← calls the same Python modules above
```

## Target Architecture

```
Browser
  └── app.js (or app.ts in Phase 2)
        ├── imports geometry engine directly — no WASM, no init
        ├── calls generateViolin(params)
        └── receives SVG + derived values

TypeScript (compiled to JS ESM)
  ├── src-ts/instrument_generator.ts    ← entry point / bridge
  ├── src-ts/instrument_geometry.ts     ← orchestration
  ├── src-ts/geometry_engine.ts         ← pure math
  ├── src-ts/svg_renderer.ts            ← SVG generation
  ├── src-ts/buildprimitives.ts         ← drawing primitives
  ├── src-ts/dimension_helpers.ts       ← dimension annotations
  ├── src-ts/parameter_registry.ts      ← typed parameter definitions
  ├── src-ts/radius_template.ts         ← fingerboard template SVG
  ├── src-ts/view_generator.ts          ← fret table HTML
  └── src-ts/types.ts                   ← InstrumentParams, ParameterDef, etc.

CLI (TypeScript/Bun)
  └── src-ts/cli.ts                     ← replaces src/overstand-cli
```

---

## Pre-Work Already Completed

The following groundwork has been done in preparation for this port:

**Test coverage improvements:**
- `geometry_engine.py` coverage raised from 90% to 99%
- New tests for `evaluate_cubic_bezier`, `find_bezier_t_for_y`, `calculate_blend_curve`
- `radius_template.py` edge cases and compound-path branch now tested
- CLI utility functions (`sanitize_filename`, `get_unique_filename`) unit tested

**Parity testing infrastructure:**
- `scripts/generate_ts_fixtures.py` — generates JSON fixtures from Python
- `tests/fixtures/python_parity.json` — 13 presets across all three instrument
  families (VIOLIN, VIOL, GUITAR_MANDOLIN), each with 46–52 derived values and
  raw fret positions
- `web/ts-parity.test.js` — parity test with three commented sections; each
  section is activated as the corresponding TypeScript module is completed

**Python tests as specifications:**
The 252 existing Python tests (pytest) are the authoritative specification for
every function being ported. Read them before implementing each module.

---

## Port Order and Approach

Port modules in dependency order, test-first. For each module:

1. Port the Python pytest tests to TypeScript/Jest (they fail — red)
2. Create the TypeScript module stub (tests still fail — wrong values)
3. Implement until tests pass (green)
4. Activate the corresponding section in `web/ts-parity.test.js` and verify
   all 13 presets produce identical derived values to Python

### Phase 1 — Core geometry (no dependencies on other modules)

#### `geometry_engine.ts`

The highest priority. Pure mathematics — trigonometry, bezier curves, fret
position calculation. No rendering, no UI, no parameter registry. This is the
most critical module to get exactly right.

Key functions to port (see `src/geometry_engine.py` and
`tests/test_geometry_engine.py`):

- `calculateSagitta(radius, width)` — arc height calculation
- `evaluateCubicBezier(p0, cp1, cp2, p3, t)` — bezier evaluation
- `findBezierTForY(p0, cp1, cp2, p3, targetY)` — bisection root-finding
- `calculateBlendCurve(...)` — neck fillet curve
- `calculateFingerbordThickness(params)` — fingerboard cross-section geometry
- `calculateStringAnglesViolin(params, vsl, fbThicknessAtJoin)`
- `calculateStringAnglesGuitar(params, vsl, fretPositions, fbThicknessAtJoin)`
- `calculateNeckGeometry(params, vsl, neckStop, ...)`
- `calculateFingerboadGeometry(params, neckStop, ...)`
- `calculateStringHeightAndDimensions(params, ...)`
- `calculateFretPositions(vsl, noFrets)` — 12-TET equal temperament
- `calculateFingerboadThicknessAtFret(params, fretNumber)`
- `calculateViolBackBreak(params)`
- `calculateCrossSectionGeometry(params)`

After completing this module, activate **Step 1** in `web/ts-parity.test.js`.

#### `parameter_registry.ts`

The 53+ parameter definitions. Define `ParameterType`, `ParameterRole`,
`InstrumentFamily` enums, `InputConfig`, `OutputConfig`, `ParameterDef`
interfaces, and `InstrumentParams` (the typed params object used throughout the
geometry engine).

The `PARAMETER_REGISTRY` const should mirror `src/parameter_registry.py`
exactly. The `visibleWhen` fields are functions, not data. The `isOutputFor`
field is a function `(family: InstrumentFamily) => boolean`.

Key registry functions to port:
- `getDefaultValues()` — returns `InstrumentParams` with all defaults
- `getAllInputParameters(family)` — filtered view for UI generation
- `getAllOutputParameters(family)` — filtered view for output display
- `validateParameters(params)` — validation with error messages
- `formatValue(key, value)` — formatted display string

Reference: `src/parameter_registry.py`, `tests/test_parameter_registry.py`.

### Phase 2 — Orchestration

#### `instrument_geometry.ts`

Calls `geometry_engine.ts` functions in the right sequence, accumulates derived
values. Depends on `geometry_engine.ts` and `parameter_registry.ts`.

Key functions:
- `calculateDerivedValues(params)` — main orchestration, calls all geometry
  functions and collects results into a flat derived-values dict
- `generateSideViewSvg(params, derivedValues)` — calls svg_renderer

Reference: `src/instrument_geometry.py`, `tests/test_instrument_geometry.py`.

After completing this module, activate **Step 2** in `web/ts-parity.test.js`.
This is the critical parity check — all 13 presets must produce numerically
identical derived values to Python (within 1e-4).

### Phase 3 — Rendering

#### `buildprimitives.ts` + `dimension_helpers.ts` + `svg_renderer.ts`

SVG string generation. No maths, pure string building. Port together as they
are tightly coupled (~1400 lines total across the three Python files).

These modules take pre-calculated geometry coordinates and produce SVG elements.
No floating-point arithmetic — just formatting numbers into SVG path strings.

Reference:
- `src/buildprimitives.py`, `src/dimension_helpers.py`, `src/svg_renderer.py`
- `tests/test_svg_renderer.py`

#### `radius_template.ts`

Use **opentype.js** to render text as bezier curves, matching the Python
matplotlib behaviour. This is required for 3D-printable cutouts — SVG `<text>`
elements would not produce physical holes when sliced.

Implementation notes:
- The font (`AllertaStencil-Regular.ttf`) is already used by the Python version
  and is served from GitHub Pages. Fetch it once and cache it.
- `opentype.js` `font.getPath(text, x, y, fontSize)` returns a path object;
  call `.toSVG()` to get the `d` attribute string.
- The Python version mirrors glyphs horizontally (negates x coordinates) so
  text is readable when the physical template is flipped over. Replicate this.
- opentype.js is available as an ES module: `import opentype from 'opentype.js'`
- Font loading is async; `radius_template.ts` entry point must be async or
  accept a pre-loaded font object.

The rest of the radius template geometry (arc calculation, viewBox, SVG
structure) is straightforward.

Reference: `src/radius_template.py`, `tests/test_radius_template.py`.

#### `view_generator.ts`

Generates the fret table HTML. Simple string template. Port last.

Reference: `src/view_generator.py`.

### Phase 4 — Entry point and CLI

#### `instrument_generator.ts`

The JS bridge. Calls `calculateDerivedValues` and the SVG generators, assembles
the result object. This is the function `app.js` will call instead of Pyodide.

Returns the same shape as the Python `generate_violin_neck()`:
```typescript
interface GenerationResult {
  success: boolean
  views: { side: string; crossSection: string; radiusTemplate: string; top: string }
  derivedValues: Record<string, number | null>
  derivedFormatted: Record<string, string>
  errors: string[]
}
```

After completing this module, activate **Step 3** in `web/ts-parity.test.js`.

Reference: `src/instrument_generator.py`, `tests/test_instrument_generator.py`.

#### `cli.ts`

Replace `src/overstand-cli` with a TypeScript CLI. Maintain identical behaviour:
- `--view side|cross_section|dimensions|top` — generate a single view
- `--all --output-dir DIR` — generate all views
- `--output FILE` — write to file instead of stdout
- `--pdf` — convert to PDF (keep svglib/weasyprint behaviour or drop)
- Auto-generated filenames matching web app convention (`sanitizeFilename`)
- Unique filename collision avoidance (`getUniqueFilename`)

Reference: `src/overstand-cli`, `tests/test_cli.py`.

#### Wire up `app.js`

Remove Pyodide initialisation. Replace the `runPythonAsync(...)` call with a
direct import of `instrument_generator.ts`. The JSON params object is already
assembled by the JS — it just goes to a different destination.

Remove `web/generation.js` Pyodide bridge code once TypeScript is wired in.

### Phase 5 (optional, lower priority)

Port the frontend JS to TypeScript (`app.js`, `ui.js`, `state.js`). Mechanical
work: rename to `.ts`, fix type errors the compiler reports. Worth doing for
consistency and to catch any latent bugs, but does not affect load time.

---

## Testing Strategy

### During the port

Each TypeScript module must have a corresponding Jest test file (`*.test.ts`)
that mirrors the Python pytest tests. The Python tests are the specification.

Run both test suites continuously:
```bash
pytest tests/ -q          # Python reference — must stay green throughout
npm test                  # JS + TypeScript — grows as modules are added
```

### Parity verification

After each phase, activate the corresponding section in `web/ts-parity.test.js`:

| Phase complete | Activate | Tests added |
|---|---|---|
| `geometry_engine.ts` | Step 1 | Fret positions for 13 presets |
| `instrument_geometry.ts` | Step 2 | 46–52 derived values × 13 presets |
| `instrument_generator.ts` | Step 3 | Full pipeline × 13 presets |

Regenerate fixtures if the Python implementation changes:
```bash
python scripts/generate_ts_fixtures.py
```

### SVG validation

Do not compare SVG strings directly — whitespace and attribute ordering will
differ. Instead verify:
- SVG output begins with `<svg` and ends with `</svg>`
- SVG contains `<path` elements
- `viewBox` attribute is present
- Key derived values driving the geometry match to 4 decimal places

---

## Success Criteria

The port is complete when all of the following are true:

**Performance**
- [ ] Cold-start load time in browser: < 1 second (from click to interactive)
- [ ] Pyodide is not loaded, not referenced in `app.js` or any web source file
- [ ] No `runPythonAsync` calls remain in any JS/TS file

**Correctness**
- [ ] All 252 Python tests continue to pass (the Python implementation remains
      as a reference during and after the port)
- [ ] All 13 × 3 parity test blocks pass (geometry, derived values, full pipeline)
- [ ] Each derived value matches Python to at least 4 decimal places
- [ ] Fret positions match Python to at least 6 decimal places

**Feature parity**
- [ ] All three instrument families work: VIOLIN, VIOL, GUITAR_MANDOLIN
- [ ] All 13 presets load and generate correctly
- [ ] All views render: side, cross_section, radius_template, top (placeholder)
- [ ] All derived values are present and displayed in the output panel
- [ ] CLI produces identical output to the Python CLI for all presets and views
- [ ] `--all`, `--view`, `--output`, `--output-dir` flags all work

**Code quality**
- [ ] TypeScript compiles with `strict: true`, zero type errors
- [ ] No `any` types except where genuinely unavoidable with a comment explaining why
- [ ] New Jest test file for each TypeScript module, mirroring the Python pytest tests
- [ ] `npm test` and `pytest tests/` both pass in CI

**Regression**
- [ ] Existing JS tests (`web/*.test.js`) all pass
- [ ] PWA/service worker still works (offline support unaffected)
- [ ] Supabase auth and cloud save/load unaffected
- [ ] PDF export still works (or is explicitly deferred)

---

## Out of Scope

- Changing any instrument geometry calculations — the TypeScript must produce
  identical results to the Python, not improved results
- Changing the UI design or adding features
- Porting `scripts/` tooling (export_presets_to_json.py etc.)
- Frontend TypeScript migration (Phase 5) is optional
- The matplotlib text-as-bezier-curves feature in `radius_template.py` — decide
  approach separately, do not block the main port on it

---

## Reference Files

| File | Purpose |
|---|---|
| `src/geometry_engine.py` | Port target — pure math |
| `src/parameter_registry.py` | Port target — parameter definitions |
| `src/instrument_geometry.py` | Port target — orchestration |
| `src/svg_renderer.py` | Port target — SVG generation |
| `src/buildprimitives.py` | Port target — drawing primitives |
| `src/dimension_helpers.py` | Port target — dimension annotations |
| `src/radius_template.py` | Port target — fingerboard template |
| `src/instrument_generator.py` | Port target — entry point |
| `src/overstand-cli` | Port target — CLI |
| `tests/test_geometry_engine.py` | Specification for geometry_engine.ts |
| `tests/test_parameter_registry.py` | Specification for parameter_registry.ts |
| `tests/test_instrument_geometry.py` | Specification for instrument_geometry.ts |
| `tests/test_svg_renderer.py` | Specification for svg_renderer.ts |
| `tests/test_instrument_generator.py` | Specification for instrument_generator.ts |
| `tests/test_cli.py` | Specification for cli.ts |
| `tests/fixtures/python_parity.json` | Numerical reference outputs for parity tests |
| `web/ts-parity.test.js` | Parity test — activate sections as modules complete |
| `scripts/generate_ts_fixtures.py` | Regenerate parity fixtures from Python |
| `src/complete_system_summary.md` | Architecture overview |
| `src/constants.py` | Constants to port to `src-ts/constants.ts` |
