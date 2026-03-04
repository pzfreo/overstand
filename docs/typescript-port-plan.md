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

## Key Decisions

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

### Build tooling: Vite

A build step is required to compile TypeScript. Use **Vite** because:
- It handles TypeScript compilation, ESM bundling, and dev server in one tool
- It includes **Vitest**, a Jest-compatible test runner that avoids the painful
  `node --experimental-vm-modules` hack currently used for Jest ESM support
- Hot module replacement (HMR) for fast development feedback
- esbuild under the hood for fast builds
- Well-supported, large ecosystem, good TypeScript integration

The current project has no bundler. The build script (`scripts/build.sh`) will
need to be extended to run `vite build`. TypeScript source lives in `src-ts/`.
Compiled output goes to `dist/`.

**Concrete setup steps:**
1. `npm install --save-dev vite vitest typescript`
2. Create `tsconfig.json` with `strict: true`, `target: "ES2022"`,
   `module: "ESNext"`, `moduleResolution: "bundler"`
3. Create `vite.config.ts` with library mode for the geometry engine
4. Add npm scripts: `"build": "vite build"`, `"dev": "vite"`,
   `"test:ts": "vitest run"`, `"test:ts:watch": "vitest"`
5. Keep existing `npm test` (Jest) for JS tests during transition; migrate to
   Vitest once all modules are ported

### TypeScript CLI via Node (with Bun as stretch goal)

The Python CLI (`src/overstand-cli`) will be replaced with a TypeScript CLI that
runs via `npx tsx src-ts/cli.ts` during development and `node dist/cli.js` in
production. `bun build --compile` can produce a single self-contained executable
as a stretch goal, but is not required for the port to be complete.

### Frontend: JS now, TS later

The web frontend (`web/app.js`, `web/ui.js`, `web/state.js` — ~1200 lines) will
remain as JavaScript initially. The TypeScript geometry engine compiles to JS
ESM modules that the existing JS frontend imports directly. Once the geometry
engine is complete and verified, porting the frontend to TypeScript is a
separate lower-risk phase.

### PDF export: defer, do not drop

The CLI `--pdf` flag currently uses `svglib`/`weasyprint` (Python libraries).
These are not available in TypeScript. The web app uses `jspdf` + `svg2pdf.js`
(already in the frontend). Strategy:
- **Web app**: PDF export continues to work unchanged (uses `jspdf`, no Python)
- **CLI**: Defer `--pdf` support. Print a clear message: "PDF export not yet
  supported in the TypeScript CLI. Use the web app for PDF export." Do not
  silently drop the flag — accept it and show the message.
- **Future**: Can add CLI PDF via puppeteer/playwright if needed

### No external math libraries needed

The Python geometry engine uses **only** the standard `math` module (sin, cos,
sqrt, atan, atan2, log2, radians, pi). numpy, svgpathtools, and matplotlib are
installed into Pyodide but **not used by any geometry calculation code**:
- **numpy**: Only used in `generate_icons.py` (a build-time icon generator,
  not part of the runtime)
- **svgpathtools**: Installed but never imported by any source file
- **matplotlib**: Used only in `radius_template.py` for an optional text-to-
  bezier-path feature; degrades gracefully when unavailable. The TypeScript
  port will use `opentype.js` instead.

All TypeScript math uses the built-in `Math` object — no npm math libraries.

---

## Current Architecture

```
Browser
  └── app.js
        ├── loads Pyodide (~7MB WASM + Python stdlib)
        ├── installs micropip, numpy, svgpathtools, matplotlib
        ├── fetches 12 Python source files, writes to Pyodide FS
        ├── imports all Python modules
        ├── calls get_parameter_definitions()         → parameter schema JSON
        ├── calls get_derived_value_metadata()         → display metadata JSON
        ├── calls get_ui_metadata()                    → UI sections/presets JSON
        └── app ready

  └── generation.js (Pyodide bridge)
        ├── generateNeck()
        │     ├── calls generate_violin_neck(_params_json) via runPythonAsync
        │     └── updates state.views, state.derivedValues, state.fretPositions
        ├── updateDerivedValues()
        │     ├── calls get_derived_values(_params_json) via runPythonAsync
        │     └── updates metrics panel only (no SVG re-render)
        └── debouncedGenerate — 500ms debounce wrapper

  Two-call UX pattern:
    On parameter change → updateDerivedValues() runs immediately (fast metrics)
                        → debouncedGenerate() runs after 500ms idle (full SVG)

Python (Pyodide)
  ├── instrument_generator.py    ← JS bridge, entry point
  ├── instrument_geometry.py     ← orchestration
  ├── geometry_engine.py         ← pure math (trig, bezier, fret positions)
  ├── svg_renderer.py            ← SVG string generation
  ├── buildprimitives.py         ← SVG drawing primitives (build123d shim)
  ├── dimension_helpers.py       ← dimension annotation drawing
  ├── parameter_registry.py      ← 53+ parameter definitions (1742 lines)
  ├── ui_metadata.py             ← UI sections, presets, key measurements
  ├── radius_template.py         ← fingerboard radius template SVG
  ├── view_generator.py          ← fret table HTML
  ├── preset_loader.py           ← JSON preset discovery
  └── constants.py               ← shared constants

CLI (Python)
  └── src/overstand-cli          ← calls the same Python modules above
```

### Python module line counts

| Module | Lines | Notes |
|--------|-------|-------|
| `parameter_registry.py` | 1742 | Largest file — parameter definitions, validation |
| `svg_renderer.py` | 807 | Three view renderers |
| `geometry_engine.py` | 699 | Pure math — most critical to get right |
| `buildprimitives.py` | 606 | SVG primitives (Edge, Arc, Spline, Text, ExportSVG) |
| `ui_metadata.py` | 450 | 11 UI sections, key measurements config |
| `dimension_helpers.py` | 397 | Dimension arrows, labels, angle annotations |
| `instrument_generator.py` | 328 | Entry point, result assembly |
| `instrument_geometry.py` | 318 | Orchestration of geometry calculations |
| `overstand-cli` | 312 | CLI argument parsing and file output |
| `radius_template.py` | 238 | Fingerboard radius template SVG |
| `preset_loader.py` | 144 | Preset JSON file discovery |
| `view_generator.py` | 50 | Fret table HTML |
| `constants.py` | 34 | Constants (epsilon, template defaults) |
| **Total** | **~6125** | |

## Target Architecture

```
Browser
  └── app.js (unchanged JS, imports compiled TS modules)
        ├── import { generateViolin, getDerivedValues,
        │           getParameterDefinitions, getUiMetadata }
        │     from './dist/instrument_generator.js'
        ├── no Pyodide, no WASM, no init delay
        └── app ready in <1 second

  └── generation.js (simplified — no Pyodide bridge)
        ├── generateNeck()
        │     ├── calls generateViolin(params) directly (sync or fast async)
        │     └── updates state.views, state.derivedValues, state.fretPositions
        ├── updateDerivedValues()
        │     ├── calls getDerivedValues(params) directly
        │     └── updates metrics panel only
        └── debouncedGenerate — 500ms debounce (preserved)

TypeScript (compiled to JS ESM by Vite)
  src-ts/
  ├── types.ts                   ← InstrumentParams, ParameterDef, enums
  ├── constants.ts               ← shared constants
  ├── geometry_engine.ts         ← pure math
  ├── parameter_registry.ts      ← 53+ typed parameter definitions
  ├── ui_metadata.ts             ← sections, presets, key measurements
  ├── instrument_geometry.ts     ← orchestration
  ├── buildprimitives.ts         ← SVG primitives
  ├── dimension_helpers.ts       ← dimension annotations
  ├── svg_renderer.ts            ← SVG generation
  ├── radius_template.ts         ← fingerboard template SVG
  ├── view_generator.ts          ← fret table HTML
  ├── instrument_generator.ts    ← entry point
  └── cli.ts                     ← CLI (replaces src/overstand-cli)

CLI (TypeScript/Node)
  └── npx tsx src-ts/cli.ts      ← dev
  └── node dist/cli.js           ← production
```

---

## Pre-Work Already Completed

The following groundwork has been done in preparation for this port:

**Test coverage improvements:**
- `geometry_engine.py` coverage raised from 90% to 99%
- New tests for `evaluate_cubic_bezier`, `find_bezier_t_for_y`,
  `calculate_blend_curve`
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

1. Read the Python source file and its corresponding Python test file
2. Port the Python pytest tests to TypeScript/Vitest (they fail — red)
3. Create the TypeScript module stub (tests still fail — wrong values)
4. Implement until tests pass (green)
5. Activate the corresponding section in `web/ts-parity.test.js` and verify
   all 13 presets produce identical derived values to Python
6. Run both `pytest tests/` and `npm test` — both must be green

**Naming convention**: Python `snake_case` function names become TypeScript
`camelCase`. Example: `calculate_sagitta` → `calculateSagitta`. Parameter
object keys remain `snake_case` to match preset JSON files and the existing
JavaScript frontend.

**Test file location**: TypeScript test files go in `src-ts/__tests__/` with
the naming convention `module_name.test.ts`.

### Phase 0 — Project setup

Before writing any geometry code, set up the TypeScript build environment.

#### Step 0.1: Install dependencies

```bash
npm install --save-dev typescript vite vitest @types/node
npm install opentype.js   # for radius_template.ts text-to-bezier
```

#### Step 0.2: Create `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src-ts",
    "sourceMap": true
  },
  "include": ["src-ts/**/*.ts"],
  "exclude": ["src-ts/**/*.test.ts"]
}
```

#### Step 0.3: Create `vite.config.ts`

Configure Vite in library mode to build the geometry engine as an ES module:

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src-ts/instrument_generator.ts'),
      formats: ['es'],
      fileName: 'instrument_generator',
    },
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // Vitest config
    include: ['src-ts/**/*.test.ts'],
  },
})
```

#### Step 0.4: Add npm scripts to `package.json`

```json
{
  "scripts": {
    "build:ts": "vite build",
    "dev": "vite",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:ts": "vitest run",
    "test:ts:watch": "vitest",
    "test:all": "npm run test && npm run test:ts"
  }
}
```

Keep the existing `npm test` (Jest) for the JavaScript tests. New TypeScript
tests use `npm run test:ts` (Vitest). `npm run test:all` runs both.

#### Step 0.5: Create directory structure

```
src-ts/
├── __tests__/           ← test files go here
├── types.ts             ← start with enums and interfaces
└── constants.ts         ← port src/constants.py (34 lines)
```

#### Step 0.6: Verify the setup

Write one trivial test in `src-ts/__tests__/constants.test.ts` that imports
from `constants.ts` and asserts a value. Run `npm run test:ts` and confirm
it passes. Run `npm run build:ts` and confirm it produces `dist/` output.

**Do not proceed to Phase 1 until `npm run test:ts` and `npm run build:ts`
both work.**

### Phase 1 — Core geometry (no dependencies on other modules)

#### Step 1.1: `types.ts`

Define the shared types and enums used across all modules:

```typescript
// Enums
export enum InstrumentFamily { VIOLIN = 'VIOLIN', VIOL = 'VIOL', GUITAR_MANDOLIN = 'GUITAR_MANDOLIN' }
export enum ParameterType { NUMERIC = 'numeric', BOOLEAN = 'boolean', SELECT = 'select' }
export enum ParameterRole { INPUT_ONLY = 'input_only', OUTPUT_ONLY = 'output_only', CONDITIONAL = 'conditional' }

// The params object passed to all geometry functions.
// Keys are snake_case to match preset JSON files.
export interface InstrumentParams {
  instrument_family: InstrumentFamily
  vsl: number
  body_length: number
  // ... all 53+ parameters with their types
  [key: string]: number | boolean | string | null | undefined
}

// Parameter definition for the registry
export interface InputConfig { min: number; max: number; default: number | boolean | string; step?: number; ... }
export interface OutputConfig { decimals: number; unit?: string; ... }
export interface ParameterDef { displayName: string; type: ParameterType; role: ParameterRole; ... }
```

**Critical detail**: The `InstrumentParams` interface must list every parameter
used in `geometry_engine.py` as a typed field. Do not rely solely on the index
signature. Read `src/parameter_registry.py` to get the complete list. The index
signature `[key: string]` is a fallback for forward compatibility only.

Reference: `src/parameter_registry.py` lines 1–100 for enum definitions,
lines 100–200 for dataclass definitions.

#### Step 1.2: `constants.ts`

Port `src/constants.py` (34 lines). Straightforward — just named constants.

Reference: `src/constants.py`.

#### Step 1.3: `geometry_engine.ts`

The highest priority module. Pure mathematics — trigonometry, bezier curves,
fret position calculation. No rendering, no UI, no parameter registry. This is
the most critical module to get exactly right.

**Port approach:**
1. Read `src/geometry_engine.py` (699 lines) end to end
2. Read `tests/test_geometry_engine.py` (60 tests) end to end
3. Write `src-ts/__tests__/geometry_engine.test.ts` — port all 60 Python tests
4. Create `src-ts/geometry_engine.ts` stub with all function signatures
5. Implement each function. Use `Math.*` equivalents for Python's `math.*`:
   - `math.sqrt` → `Math.sqrt`
   - `math.sin` / `math.cos` → `Math.sin` / `Math.cos`
   - `math.atan2` → `Math.atan2`
   - `math.radians(deg)` → `(deg * Math.PI / 180)`
   - `math.degrees(rad)` → `(rad * 180 / Math.PI)`
   - `math.log2` → `Math.log2`
   - `math.pi` → `Math.PI`

Key functions to port (in dependency order within the file):

- `calculateSagitta(radius, width)` — arc height calculation
- `evaluateCubicBezier(p0, cp1, cp2, p3, t)` — bezier evaluation
- `findBezierTForY(p0, cp1, cp2, p3, targetY)` — bisection root-finding
- `calculateBlendCurve(...)` — neck fillet curve
- `calculateFretPositions(vsl, noFrets)` — 12-TET equal temperament
- `calculateFingerbordThickness(params)` — fingerboard cross-section
- `calculateStringAnglesViolin(params, vsl, fbThicknessAtJoin)`
- `calculateStringAnglesGuitar(params, vsl, fretPositions, fbThicknessAtJoin)`
- `calculateNeckGeometry(params, vsl, neckStop, ...)`
- `calculateFingerboadGeometry(params, neckStop, ...)`
- `calculateStringHeightAndDimensions(params, ...)`
- `calculateFingerboadThicknessAtFret(params, fretNumber)`
- `calculateViolBackBreak(params)`
- `calculateCrossSectionGeometry(params)`

**Numerical precision**: Python `float` and JavaScript `number` are both IEEE
754 double-precision. Results should match exactly (within floating-point
representation). If any test fails by more than 1e-10, there is a logic bug —
do not adjust tolerances, find and fix the bug.

After all 60 tests pass, activate **Step 1** in `web/ts-parity.test.js` and
verify fret positions for all 13 presets match Python to 6 decimal places.

Reference: `src/geometry_engine.py`, `tests/test_geometry_engine.py`.

#### Step 1.4: `parameter_registry.ts`

The 53+ parameter definitions. Port approach:

1. Read `src/parameter_registry.py` (1742 lines) end to end
2. Read `tests/test_parameter_registry.py` (28 tests)
3. Write `src-ts/__tests__/parameter_registry.test.ts`
4. Implement `parameter_registry.ts`

The `PARAMETER_REGISTRY` const should mirror `src/parameter_registry.py`
exactly. Port every parameter definition, preserving:
- `displayName`, `type`, `unit`, `role`
- `input.min`, `input.max`, `input.default`, `input.step`
- `input.category`
- `input.visibleWhen` — these are functions, port the logic exactly
- `input.options` — for `SELECT` type parameters
- `output.decimals`, `output.unit`
- `isOutputFor` — function `(family: InstrumentFamily) => boolean`

Key registry functions to port:
- `getDefaultValues()` — returns `InstrumentParams` with all defaults filled in
- `getAllInputParameters(family)` — returns parameters visible as inputs for a
  given family. Must respect `visibleWhen` conditions.
- `getAllOutputParameters(family)` — returns output parameter definitions
- `validateParameters(params)` — validation against min/max with error messages
- `formatValue(key, value)` — formatted display string with unit and decimals
- `toInputMetadata()` — export parameter def in input format (with type, min,
  max). **Critical**: CONDITIONAL parameters must be exported in input format,
  not output format. See `test_metadata_parameters_use_input_format` test.

Reference: `src/parameter_registry.py`, `tests/test_parameter_registry.py`.

### Phase 2 — Orchestration and UI metadata

#### Step 2.1: `instrument_geometry.ts`

Calls `geometry_engine.ts` functions in the right sequence, accumulates derived
values. Depends on `geometry_engine.ts` and `parameter_registry.ts`.

Key functions:
- `calculateDerivedValues(params)` — main orchestration. Calls geometry
  functions in order and collects results into a flat `Record<string, number |
  null>`. This is the core of the engine.
- `generateSideViewSvg(params, derivedValues)` — calls svg_renderer (stubbed
  until Phase 3; return empty SVG string for now)

Port approach:
1. Read `src/instrument_geometry.py` (318 lines)
2. Read `tests/test_instrument_geometry.py` (8 tests)
3. Port tests, implement module
4. For any svg_renderer calls, create a stub that returns a placeholder SVG

After all tests pass, activate **Step 2** in `web/ts-parity.test.js`.
This is the critical parity check — all 13 presets must produce numerically
identical derived values to Python (within 1e-4).

Reference: `src/instrument_geometry.py`, `tests/test_instrument_geometry.py`.

#### Step 2.2: `ui_metadata.ts`

Port the UI section definitions and metadata bundle. This module is needed for
the web app to generate its UI — it defines:
- 11 UI sections (which parameters go in which collapsible panel)
- Key measurements config (4 metrics shown prominently)
- Preset metadata discovery

The web app calls `get_ui_metadata()` at startup (via
`instrument_generator.get_ui_metadata()` in Python). The TypeScript version
must return the same JSON structure.

Key items to port:

```typescript
// Section types
export enum SectionType { INPUT_BASIC, INPUT_ADVANCED, OUTPUT_CORE, OUTPUT_DETAILED }

// Section definition
export interface SectionDefinition {
  id: string; title: string; type: SectionType; icon: string;
  defaultExpanded: boolean; order: number;
  parameterNames: string[]; description: string;
}

// The 11 sections — port from SECTIONS dict in ui_metadata.py
export const SECTIONS: Record<string, SectionDefinition> = { ... }

// Key measurements config — port from KEY_MEASUREMENTS list
export const KEY_MEASUREMENTS = [
  { key: 'neck_angle', primary: true },
  { key: 'neck_stop', keyConditional: { GUITAR_MANDOLIN: 'body_stop' } },
  { key: 'nut_relative_to_ribs' },
  { key: 'string_break_angle' },
]

// Bundle function — returns metadata for the web app
export function getUiMetadataBundle(): UiMetadataBundle
```

The `getUiMetadataBundle()` function must return an object with these keys:
- `sections` — the 11 section definitions
- `parameters` — all input parameters in **input format** (with `type`, `min`,
  `max`, `step`). Call `toInputMetadata()` on each parameter.
- `derived_values` — all output parameters in output format
- `presets` — preset metadata (id, display_name, family, icon, description)
- `key_measurements` — the KEY_MEASUREMENTS config

**Critical detail about preset loading in the web app**: The web app loads
presets in two ways:
1. Metadata (id, display_name, family) comes from `get_ui_metadata()` at init
2. Full parameter values are fetched from `presets/*.json` files via `fetch()`
   when the user selects a preset

In TypeScript, preset metadata loading replaces `preset_loader.py`. For the
**web app**, preset JSON files are fetched via HTTP (same as now). For the
**CLI**, preset JSON files are read from disk with `fs.readFileSync`. In both
cases, the loader just reads JSON — no `preset_loader.py` port is needed as
a separate module. Instead, `ui_metadata.ts` and `cli.ts` each handle their
own preset loading inline.

Reference: `src/ui_metadata.py` (450 lines), `src/preset_loader.py` (144 lines).

### Phase 3 — Rendering

#### Step 3.1: `buildprimitives.ts`

Port the SVG drawing primitives. This file is a shim for the `build123d` CAD
library, adapted for SVG-only output. Not all items are used.

**Used items** (must port):
| Item | Usages | Used by |
|------|--------|---------|
| `ExportSVG` | Core | svg_renderer (layer management, shape collection, SVG write) |
| `Edge` | 71 | svg_renderer, dimension_helpers (line segments) |
| `Text` | 16 | svg_renderer, dimension_helpers (labels, titles) |
| `Location` | 18 | svg_renderer, dimension_helpers, instrument_geometry |
| `Arc` | 3 | svg_renderer, dimension_helpers (arcs) |
| `Spline` | 5 | svg_renderer (bezier curves) |
| `Rectangle` | 2 | svg_renderer (belly, rib outlines) |
| `Polygon` | 2 | svg_renderer (arrowheads, filled shapes) |
| `LineType` | 8 | svg_renderer (CONTINUOUS, DASHED, DOTTED, HIDDEN) |
| `Unit` | 1 | svg_renderer (MM constant) |
| `Axis` | 1 | dimension_helpers (rotation axis) |

**Dead code** (do not port):
| Item | Reason |
|------|--------|
| `Point` class | Never instantiated externally |
| `make_face()` function | Never called by any module |

Port approach:
1. Read `src/buildprimitives.py` (606 lines)
2. Port only the used items listed above
3. Focus on `ExportSVG.write()` — this produces the final SVG string. Its
   output format must match Python exactly (layer structure, styling, viewBox).

`ExportSVG` manages layers with different styles (line width, color, dash
pattern). Its `add_shape()` method collects shapes, and `write()` serializes
them to an SVG string. Understand the layer system before implementing.

Reference: `src/buildprimitives.py`.

#### Step 3.2: `dimension_helpers.ts`

Port the dimension annotation helpers. These draw measurement arrows, labels,
and angle indicators on the SVG views.

Key functions:
- `addDimensionLine(...)` — horizontal/vertical dimension with arrows and text
- `addAngleDimension(...)` — arc with angle label
- Various helper functions for arrow positioning

Reference: `src/dimension_helpers.py` (397 lines).

#### Step 3.3: `svg_renderer.ts`

Port the SVG view renderers. This is the largest rendering module (807 lines)
and depends on `buildprimitives.ts` and `dimension_helpers.ts`.

Key functions:
- `renderSideView(params, derivedValues)` — side profile SVG
- `renderCrossSectionView(params, derivedValues)` — cross-section SVG
- `renderTopView(params, derivedValues)` — top view SVG (placeholder/partial)

Each renderer creates an `ExportSVG` instance, adds layers, draws shapes using
Edge/Arc/Spline/Text/etc., and calls `write()` to produce the SVG string.

Port together with `buildprimitives.ts` and `dimension_helpers.ts` as they are
tightly coupled (~1810 lines total across the three Python files).

Reference: `src/svg_renderer.py`, `tests/test_svg_renderer.py` (26 tests).

#### Step 3.4: `radius_template.ts`

Fingerboard radius template SVG generation. This is a standalone view that
produces a template for checking the fingerboard's curvature.

**Text-to-bezier rendering**: The Python version uses matplotlib's `TextPath`
to convert text into SVG bezier curves. This is needed for 3D-printable
cutouts — SVG `<text>` elements don't produce physical holes when 3D-printed.

In TypeScript, use **opentype.js** instead:

```typescript
import opentype from 'opentype.js'

// Load font (async — do once, cache the result)
const font = await opentype.load('fonts/AllertaStencil-Regular.ttf')

// Convert text to SVG path
const path = font.getPath(text, x, y, fontSize)
const svgPathData = path.toPathData()  // the "d" attribute string
```

Implementation notes:
- `opentype.js` is already listed as a dependency (installed in Phase 0)
- The font (`AllertaStencil-Regular.ttf`) is in `fonts/` directory
- The Python version mirrors glyphs horizontally (negates x coordinates) so
  text is readable when the physical template is flipped over. Replicate this.
- Font loading is async. Accept a pre-loaded font object as a parameter to
  keep the main template function sync. Load the font once in the entry point.
- If font loading fails, degrade gracefully — generate the template without
  text cutouts (matching Python's fallback behaviour).

Reference: `src/radius_template.py` (238 lines),
`tests/test_radius_template.py` (15 tests).

#### Step 3.5: `view_generator.ts`

Generates the fret position table HTML. 50 lines of Python — straightforward
string template. Port last among the renderers.

Reference: `src/view_generator.py`.

### Phase 4 — Entry point, wiring, and CLI

#### Step 4.1: `instrument_generator.ts`

The entry point. Replaces the Python `instrument_generator.py` which served as
the JS↔Python bridge. In TypeScript, this module is imported directly by the
JavaScript frontend — no bridge needed.

Must export these functions (matching the current Python API surface):

```typescript
// Main generation — called by generation.js generateNeck()
export function generateViolin(paramsJson: string): string
// Returns JSON string: { success, views, fret_positions,
//   derived_values, derived_formatted, derived_metadata, errors }

// Quick derived values — called by generation.js updateDerivedValues()
export function getDerivedValues(paramsJson: string): string
// Returns JSON string: { success, values, formatted, metadata }

// Startup metadata — called by app.js during init
export function getParameterDefinitions(): string
// Returns JSON string: parameter schema for UI generation

export function getDerivedValueMetadata(): string
// Returns JSON string: { success, metadata }

export function getUiMetadata(): string
// Returns JSON string: { success, metadata }
// Calls ui_metadata.getUiMetadataBundle()
```

**Important**: These functions accept and return **JSON strings**, not objects.
This matches the current Python API and avoids changing the JavaScript call
sites. The JSON parse/stringify happens inside these functions.

**Important**: The `getDerivedValues` function must exist as a separate fast
path. The web app calls it on every parameter change for instant metric
feedback, separately from the debounced full SVG generation. In TypeScript
this will be fast enough that the separation may seem unnecessary, but the
two-call pattern must be preserved because `generation.js` relies on it.

After completing this module, activate **Step 3** in `web/ts-parity.test.js`.

Reference: `src/instrument_generator.py` (328 lines),
`tests/test_instrument_generator.py` (36 tests).

#### Step 4.2: Wire up `app.js` and `generation.js`

Replace Pyodide initialisation in `app.js` with direct TypeScript module
imports. This is the moment the load time drops from 30–60 seconds to <1 second.

**Changes to `app.js` `initializePython()` function** (lines 172–271):

Remove:
- Pyodide loading (`loadPyodide()`)
- micropip installation (`loadPackage('micropip')`)
- numpy/svgpathtools/matplotlib installation
- Python source file fetching (the 12-file loop)
- Python module importing (`import constants, buildprimitives, ...`)
- Font file writing to Pyodide FS
- All `runPythonAsync` calls for metadata

Replace with:
```javascript
import { getParameterDefinitions, getDerivedValueMetadata,
         getUiMetadata } from './dist/instrument_generator.js'

async function initializeEngine() {
  ui.setStatus('loading', 'Initializing...')

  // Direct function calls — no Pyodide, no async init
  const paramDefsJson = getParameterDefinitions()
  state.parameterDefinitions = JSON.parse(paramDefsJson)

  const derivedMetaJson = getDerivedValueMetadata()
  const derivedMetaResult = JSON.parse(derivedMetaJson)
  if (derivedMetaResult.success) state.derivedMetadata = derivedMetaResult.metadata

  const uiMetaJson = getUiMetadata()
  const uiMetaResult = JSON.parse(uiMetaJson)
  if (uiMetaResult.success) state.uiMetadata = uiMetaResult.metadata

  // Presets are still loaded via fetch (unchanged)
  state.presets = await loadPresetsFromDirectory()

  ui.generateUI(UI_CALLBACKS)
  ui.populatePresets()
  // ... rest of init (unchanged)
}
```

**Changes to `generation.js`**:

Remove:
- All `state.pyodide.globals.set(...)` calls
- All `state.pyodide.runPythonAsync(...)` calls

Replace with:
```javascript
import { generateViolin, getDerivedValues }
  from './dist/instrument_generator.js'

// In generateNeck():
const resultJson = generateViolin(paramsJson)  // sync call, no await needed

// In updateDerivedValues():
const resultJson = getDerivedValues(paramsJson)  // sync call, no await needed
```

The guard `if (!state.pyodide)` becomes unnecessary — remove it. The functions
are always available after import.

**Remove from `app.js`:**
- The `<script src="pyodide.js">` tag from `index.html`
- Any Pyodide feature detection or error handling

#### Step 4.3: Update service worker

The service worker (`web/service-worker.js`) currently caches:
- 12 Python `.py` module files
- Pyodide runtime (pyodide.js, pyodide.asm.js, pyodide.asm.wasm) in a
  dedicated `pyodide-runtime-v2` cache
- CDN URLs for numpy, svgpathtools, matplotlib packages

After the port, update the service worker:

**Remove from app shell cache list:**
- All `.py` file entries (`constants.py`, `buildprimitives.py`, etc.)

**Remove entirely:**
- The `pyodide-runtime-v2` cache and its fetch handler
- The Pyodide CDN URL matching logic

**Add to app shell cache list:**
- `dist/instrument_generator.js` (the compiled TypeScript bundle)
- Any other JS chunks if Vite code-splits

**Keep unchanged:**
- CDN library caching (SVG.js, jspdf, Supabase — still used)
- Preset caching (network-first strategy)
- Supabase API handling (network-only)
- The `SKIP_WAITING` message handler

Also remove the `<script>` tag loading Pyodide from CDN in `index.html`:
```html
<!-- REMOVE THIS LINE -->
<script src="https://cdn.jsdelivr.net/pyodide/v0.29.1/full/pyodide.js"></script>
```

#### Step 4.4: `cli.ts`

Replace `src/overstand-cli` with a TypeScript CLI. Use Node.js built-in
modules (`fs`, `path`, `process`) — no CLI framework needed (the Python
version uses `argparse` which is simple enough to replicate manually).

Maintain identical behaviour:
- `--view side|cross_section|dimensions|top|radius_template` — single view
- `--all --output-dir DIR` — generate all views
- `--output FILE` — write to file instead of stdout
- `--pdf` — accept the flag but print a message: "PDF export is not yet
  supported in the TypeScript CLI. Use the web app for PDF export."
- Auto-generated filenames matching web app convention (`sanitizeFilename`)
- Unique filename collision avoidance (`getUniqueFilename`)
- Exit codes: 0 for success, 1 for errors
- Preset JSON loading from disk via `fs.readFileSync`

**Font loading for radius template**: The CLI must load
`fonts/AllertaStencil-Regular.ttf` from disk for the radius template view.
Use `opentype.js` with `opentype.loadSync()` (Node-compatible sync API) or
read the file into a buffer and use `opentype.parse()`.

Reference: `src/overstand-cli` (312 lines), `tests/test_cli.py` (37 tests).

### Phase 5 — Cleanup and verification

#### Step 5.1: Final parity verification

Run the complete parity test suite:
```bash
npm run test:all               # All JS + TS tests
pytest tests/ -q               # All Python tests (reference)
```

All three parity test blocks in `web/ts-parity.test.js` must pass:
- Step 1: Fret positions for 13 presets (6 decimal places)
- Step 2: 46–52 derived values × 13 presets (4 decimal places)
- Step 3: Full pipeline × 13 presets (SVG structure + derived values)

#### Step 5.2: Manual smoke test

Open the web app in a browser and verify:
- [ ] App loads in under 1 second (no Pyodide loading indicator)
- [ ] Default preset generates correctly
- [ ] Switch between all 13 presets — each renders without errors
- [ ] Switch between all views (side, cross-section, radius template, top)
- [ ] Change parameters — derived values update immediately
- [ ] Change parameters — SVG updates after 500ms debounce
- [ ] Output panel shows all derived values with correct formatting
- [ ] PDF export works (web app — uses jspdf, not Python)
- [ ] Mobile viewport works correctly
- [ ] Offline mode works (service worker caches the new bundle)
- [ ] Supabase auth and cloud save/load still work

#### Step 5.3: Remove Pyodide references

Search the entire codebase and verify no Pyodide references remain:
```bash
grep -r "pyodide\|runPythonAsync\|loadPyodide\|micropip" web/ --include="*.js" --include="*.html"
```

This must return zero results (excluding test files that verify Pyodide
removal).

Update `scripts/build.sh` to:
- Remove Python module copying logic (no longer needed for web deployment)
- Add `npm run build:ts` step to compile TypeScript
- Copy `dist/` output to the build directory

#### Step 5.4: Update `index.html`

- Remove the Pyodide CDN `<script>` tag
- Add `<script type="module" src="dist/instrument_generator.js"></script>` or
  let `app.js` handle the import (depending on how Vite bundles the output)

### Phase 6 — Python removal (after production verification)

**Do not execute this phase immediately.** Wait until the TypeScript version
has been deployed to production and verified working for at least 2 weeks.

After confidence is established:
1. Remove Python source files from `src/` (geometry engine modules only —
   keep `scripts/` Python utilities)
2. Remove `src/overstand-cli`
3. Remove Pyodide-related entries from service worker
4. Remove `micropip`, `numpy`, `svgpathtools`, `matplotlib` references
5. Update `CLAUDE.md` to reflect the TypeScript architecture
6. Update `src/complete_system_summary.md`
7. Keep `tests/` Python tests archived in a `tests/python-reference/` directory
   for historical reference, or delete them if the TypeScript test coverage is
   equivalent

### Phase 7 (optional, lower priority) — Frontend TypeScript migration

Port the frontend JS to TypeScript (`app.js`, `ui.js`, `state.js`). Mechanical
work: rename to `.ts`, fix type errors the compiler reports. Worth doing for
consistency and to catch any latent bugs, but does not affect load time.

---

## Testing Strategy

### During the port

Each TypeScript module must have a corresponding test file
(`src-ts/__tests__/module_name.test.ts`) that mirrors the Python pytest tests.
The Python tests are the specification.

Run both test suites continuously:
```bash
pytest tests/ -q           # Python reference — must stay green throughout
npm run test:ts            # TypeScript — grows as modules are added
npm test                   # Existing JS tests — must stay green throughout
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
- [ ] No `<script>` tag loading Pyodide CDN in `index.html`

**Correctness**
- [ ] All 252 Python tests continue to pass (reference, not modified)
- [ ] All 13 × 3 parity test blocks pass (geometry, derived values, pipeline)
- [ ] Each derived value matches Python to at least 4 decimal places
- [ ] Fret positions match Python to at least 6 decimal places

**Feature parity**
- [ ] All three instrument families work: VIOLIN, VIOL, GUITAR_MANDOLIN
- [ ] All 13 presets load and generate correctly
- [ ] All views render: side, cross_section, radius_template, top (placeholder)
- [ ] All derived values are present and displayed in the output panel
- [ ] Two-call UX pattern preserved: instant metrics + debounced SVG
- [ ] CLI produces identical output to the Python CLI for all presets and views
- [ ] `--all`, `--view`, `--output`, `--output-dir` flags all work
- [ ] CLI `--pdf` flag accepted with informative deferral message

**Code quality**
- [ ] TypeScript compiles with `strict: true`, zero type errors
- [ ] No `any` types except where genuinely unavoidable with a comment
- [ ] `noUncheckedIndexedAccess: true` enabled in tsconfig
- [ ] Test file for each TypeScript module, mirroring the Python tests
- [ ] `npm run test:all` and `pytest tests/` both pass

**Regression**
- [ ] Existing JS tests (`web/*.test.js`) all pass
- [ ] PWA/service worker caches new bundle (not old Python files)
- [ ] Supabase auth and cloud save/load unaffected
- [ ] PDF export works in web app (uses jspdf, unchanged)
- [ ] Offline mode works with updated service worker cache

---

## Out of Scope

- Changing any instrument geometry calculations — the TypeScript must produce
  identical results to the Python, not improved results
- Changing the UI design or adding features
- Porting `scripts/` Python tooling (export_presets_to_json.py,
  generate_ts_fixtures.py, etc.)
- Frontend TypeScript migration (Phase 7) is optional
- CLI PDF export (deferred — see PDF export decision above)

---

## Dependency Graph

```
types.ts ─────────────────────────────────┐
constants.ts ─────────────────────────────┤
                                          │
geometry_engine.ts ───────────────────────┤ (imports types, constants)
                                          │
parameter_registry.ts ────────────────────┤ (imports types)
                                          │
ui_metadata.ts ───────────────────────────┤ (imports types, parameter_registry)
                                          │
instrument_geometry.ts ───────────────────┤ (imports geometry_engine,
                                          │  parameter_registry)
                                          │
buildprimitives.ts ───────────────────────┤ (imports types only)
                                          │
dimension_helpers.ts ─────────────────────┤ (imports buildprimitives)
                                          │
svg_renderer.ts ──────────────────────────┤ (imports buildprimitives,
                                          │  dimension_helpers, geometry_engine)
                                          │
radius_template.ts ───────────────────────┤ (imports geometry_engine,
                                          │  opentype.js)
                                          │
view_generator.ts ────────────────────────┤ (standalone)
                                          │
instrument_generator.ts ──────────────────┘ (imports ALL above)

cli.ts ── imports instrument_generator.ts + Node fs/path
```

No circular dependencies. Port in top-to-bottom order.

---

## Reference Files

| File | Purpose |
|---|---|
| `src/geometry_engine.py` | Port target — pure math (699 lines) |
| `src/parameter_registry.py` | Port target — parameter definitions (1742 lines) |
| `src/instrument_geometry.py` | Port target — orchestration (318 lines) |
| `src/svg_renderer.py` | Port target — SVG generation (807 lines) |
| `src/buildprimitives.py` | Port target — drawing primitives (606 lines) |
| `src/dimension_helpers.py` | Port target — dimension annotations (397 lines) |
| `src/ui_metadata.py` | Port target — UI sections/presets (450 lines) |
| `src/radius_template.py` | Port target — fingerboard template (238 lines) |
| `src/view_generator.py` | Port target — fret table HTML (50 lines) |
| `src/instrument_generator.py` | Port target — entry point (328 lines) |
| `src/preset_loader.py` | Reference only — logic absorbed into ui_metadata.ts and cli.ts |
| `src/overstand-cli` | Port target — CLI (312 lines) |
| `src/constants.py` | Port target — constants (34 lines) |
| `tests/test_geometry_engine.py` | Specification for geometry_engine.ts (60 tests) |
| `tests/test_parameter_registry.py` | Specification for parameter_registry.ts (28 tests) |
| `tests/test_instrument_geometry.py` | Specification for instrument_geometry.ts (8 tests) |
| `tests/test_svg_renderer.py` | Specification for svg_renderer.ts (26 tests) |
| `tests/test_instrument_generator.py` | Specification for instrument_generator.ts (36 tests) |
| `tests/test_cli.py` | Specification for cli.ts (37 tests) |
| `tests/fixtures/python_parity.json` | Numerical reference outputs for parity tests |
| `web/ts-parity.test.js` | Parity test — activate sections as modules complete |
| `web/generation.js` | Pyodide bridge — rewrite to import TS modules |
| `web/app.js` | App init — remove Pyodide, import TS modules |
| `web/service-worker.js` | Update cache lists (remove .py, add .js bundle) |
| `scripts/generate_ts_fixtures.py` | Regenerate parity fixtures from Python |
| `src/complete_system_summary.md` | Architecture overview |

---

## Common Pitfalls

These are specific things that could cause subtle bugs during the port:

1. **Python `dict.get(key, default)` vs TypeScript**: Python's `dict.get()`
   returns the default when the key is missing OR when the value is `None`
   only if you don't distinguish. In TypeScript, `obj[key] ?? default` handles
   `null` and `undefined`, but `obj[key] || default` also catches `0` and
   `false`. Use `??` not `||` for numeric defaults.

2. **Python integer division `//`**: Python's `//` does floor division.
   TypeScript has no equivalent operator — use `Math.floor(a / b)`.

3. **Python `math.atan2(y, x)` argument order**: Same in JS (`Math.atan2(y, x)`)
   but easy to accidentally swap when porting.

4. **Python `range(start, stop)` is exclusive of stop**: Same as a `for` loop
   with `i < stop` in TypeScript, but watch for off-by-one errors.

5. **Python negative indexing `arr[-1]`**: Use `arr[arr.length - 1]` or
   `arr.at(-1)` in TypeScript.

6. **Python tuple unpacking `a, b = func()`**: TypeScript equivalent is
   destructuring: `const [a, b] = func()`.

7. **Python `None` vs TypeScript `null`/`undefined`**: The Python code uses
   `None` for missing derived values. In TypeScript, use `null` (not
   `undefined`) to match the JSON serialization behaviour — `JSON.stringify`
   preserves `null` but drops `undefined`.

8. **Floating-point string formatting**: Python `f"{value:.4f}"` formats to
   exactly 4 decimal places. TypeScript equivalent: `value.toFixed(4)`.

9. **Python `isinstance()` checks**: Replace with TypeScript type guards or
   discriminated unions, not `typeof` (which only distinguishes primitives).

10. **The `_generator_url` parameter**: `generation.js` adds `_generator_url`
    (the current page URL) to params before calling the generator. This is
    used in SVG metadata. Preserve this behaviour.
