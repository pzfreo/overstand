# Overstand Code Review Report

**Date:** 2026-02-16
**Scope:** Code quality, testing, tech debt

---

## Test Results

- **Python:** 193 passed, 3 skipped (Cairo/PDF deps)
- **JavaScript:** 35 passed
- **Total:** 228 tests passing

---

## 1. SECURITY (High Priority)

### 1.1 Python code injection via string interpolation
**File:** `web/app.js:340-342`
```js
generate_violin_neck('${paramsJson.replace(/'/g, "\\'")}')
```
User-controlled JSON is interpolated into Python code via `runPythonAsync`. The single-quote escape is insufficient -- backslashes, newlines, or crafted strings could break out. **Use Pyodide's `globals`/`toPy()` API to pass data safely** instead of string templating. Same pattern at line 389.

### 1.2 innerHTML usage without sanitization
39 occurrences across 7 files. Most are static HTML templates (low risk), but `ui.js` and `app.js` render user-facing data via innerHTML. Should audit each and use `textContent` for user data.

### 1.3 Markdown parser XSS
`web/markdown-parser.js` converts markdown to HTML without escaping. Low risk today (content is static `about.md`), but fragile if content source ever changes.

---

## 2. CODE QUALITY (Medium Priority)

### 2.1 `app.js` is 1,579 lines -- biggest maintainability issue
The `DOMContentLoaded` handler alone is ~340 lines. Key duplicated patterns:
- Parameter loading logic appears 4 times (preset, file load, cloud load, share URL)
- Modal/overlay close logic appears 3 times
- These should be extracted into reusable functions.

### 2.2 Duplicate `escapeHtml()`
Implemented in both `app.js:1094` and `modal.js:62`. Should live in one place.

### 2.3 Error swallowing
Multiple `catch` blocks in `app.js` just `console.warn` without user feedback (lines 73, 76, 243, 434). Failures in preset loading, derived value updates, etc. are silent.

### 2.4 Python: generic exception handling
`instrument_generator.py` catches broad `Exception` at the JS boundary. Fine as a last resort, but should catch specific exceptions first (`ValueError`, `KeyError`) with better messages.

### 2.5 Magic numbers
Scattered throughout: `setTimeout(..., 2000)`, polling interval `300ms`, timeout `5*60*1000`, bisection guard `0.001`. Should be named constants.

### 2.6 Python: missing return type hints
Multiple functions in `geometry_engine.py` lack return type hints:
- `calculate_fingerboard_thickness()`
- `calculate_string_angles_violin()`
- `calculate_string_angles_guitar()`
- `calculate_viol_back_break()`
- `calculate_cross_section_geometry()`

### 2.7 Python: param extraction duplication
The pattern `params.get('key') or 0` is repeated 7+ times across `geometry_engine.py`.

---

## 3. TEST COVERAGE (Medium Priority)

### 3.1 JavaScript coverage is thin
Only `modal.js` and `state.js` have tests. These modules have **zero test coverage**:
- `app.js` (1,579 lines -- the biggest file)
- `auth.js`, `cloud_presets.js`, `analytics.js`
- `ui.js`, `markdown-parser.js`, `pdf_export.js`
- `pwa_manager.js`, `constants.js`

### 3.2 Python coverage is strong
196 tests across 7 files covering geometry engine, SVG renderer, parameter registry, CLI, integration, and instrument geometry. Good boundary condition tests. Gaps:
- `buildprimitives.py` -- no dedicated tests (606 LOC)
- `dimension_helpers.py` -- no dedicated tests (397 LOC)
- `view_generator.py` -- no dedicated tests
- `radius_template.py` -- only tested indirectly (238 LOC)

### 3.3 No test for Pyodide bridge
The string interpolation in `app.js` that passes JSON to Python is untested. This is where the security issue lives.

### 3.4 Coverage by component

| Component | LOC | Tests | Coverage | Risk |
|-----------|-----|-------|----------|------|
| Parameter Registry | 1,677 | 28 | ~60% | LOW |
| Geometry Engine | 652 | 30 | ~80% | LOW |
| SVG Renderer | 748 | 26 | ~50% | MOD |
| Buildprimitives | 606 | 0 | 0% | MOD |
| Instrument Generator | 328 | 36 | ~70% | LOW |
| Dimension Helpers | 397 | 5 | ~10% | MOD |
| **app.js** | **1,579** | **0** | **0%** | **HIGH** |
| **ui.js** | **617** | **0** | **0%** | **HIGH** |
| auth.js | 252 | 0 | 0% | MOD |
| state.js | 46 | 17 | 100% | LOW |
| modal.js | 66 | 18 | ~95% | LOW |

---

## 4. TECH DEBT (Lower Priority)

### 4.1 No JS linting/formatting
No ESLint or Prettier configured. Python has Ruff (good), but JS has no automated quality gates.

### 4.2 Loose Python dependency pinning
`requirements.txt` uses `>=` without upper bounds. `matplotlib>=3.5.0` could jump to a breaking 4.x release. Pin to ranges: `matplotlib>=3.5.0,<4.0`.

### 4.3 No `.nvmrc`
Node version not locked. `package.json` says `>=18.0.0` which spans multiple major versions.

### 4.4 Console logging in production
40+ `console.log/warn` calls across web files. Should use a debug flag or structured logging.

### 4.5 CSS z-index sprawl
Values scattered: 340, 348, 1001, 2000, 10000. No system. Define a z-index scale in CSS variables.

### 4.6 Inconsistent async patterns
Mix of `.then()` and `async/await` across modules (especially `auth.js` vs `app.js`).

### 4.7 `InstrumentPreset.icon` marked deprecated
In `ui_metadata.py:60` but still in the dataclass and serialized.

### 4.8 Build script fragility
`scripts/build.sh` (220 lines) has hardcoded GitHub owner/slug, fragile `sed` commands, and no input validation. Silent failures possible.

### 4.9 Service worker cache versioning
Uses timestamp-based build ID -- every build invalidates all caches even for minor changes. Content-hash would be better.

### 4.10 No pre-commit hooks
Developers can commit code that fails linting/tests. Consider Husky + lint-staged.

### 4.11 Missing package.json scripts
Only `test`, `test:watch`, `test:coverage`. Missing: `build`, `dev`, `lint`, `format`, `start`.

### 4.12 Supabase migration incomplete
Single migration file, no versioning system, no rollback strategy documented.

---

## 5. WHAT'S GOOD

- Clean Python architecture with proper separation of concerns
- Parameter registry as single source of truth -- excellent design
- All 12+ presets generate valid SVG across all views
- Strong math validation (geometric constraints, trig bounds)
- Proper `.gitignore`, no secrets committed
- XSS prevention in modal system with tests
- Comprehensive integration tests with boundary conditions
- Well-structured fixtures in `conftest.py`
- Good CLI test coverage including subprocess integration
- Vercel deployment automation working

---

## 6. RECOMMENDED PRIORITY

| Priority | Item | Effort |
|----------|------|--------|
| **P0** | Fix Pyodide string injection (1.1) | 1-2 hrs |
| **P1** | Extract duplicated patterns in app.js (2.1) | 3-4 hrs |
| **P1** | Add JS test coverage for app.js core paths (3.1) | 4-6 hrs |
| **P2** | Add ESLint + Prettier (4.1) | 1-2 hrs |
| **P2** | Consolidate escapeHtml, audit innerHTML (1.2, 2.2) | 2 hrs |
| **P2** | Pin Python deps (4.2) | 30 min |
| **P2** | Add .nvmrc (4.3) | 15 min |
| **P3** | Named constants for magic numbers (2.5) | 1 hr |
| **P3** | Structured logging to replace console.log (4.4) | 1-2 hrs |
| **P3** | CSS z-index system (4.5) | 1 hr |
| **P3** | Add missing package.json scripts (4.11) | 30 min |
| **P3** | Pre-commit hooks (4.10) | 1 hr |
