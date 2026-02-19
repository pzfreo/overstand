# Plan: CaneCalc-Inspired UI Polish

Reference: https://canecalc.com/designer

## Goal
Match the density, professionalism, and "tool-not-toy" feel of CaneCalc's designer UI while keeping Overstand's identity (light theme, indigo brand).

## Current State (after PR #90 work so far)
- Top toolbar with actions ✅
- Unified dropdown menu ✅
- Left params / right preview split ✅
- Horizontal param rows (label left, input right) ✅
- Accordion sections with minimal dividers ✅
- Descriptions hidden by default ✅
- Auto-generate (no generate button visible) ✅

## Remaining Gaps (comparing screenshot to CaneCalc)

### 1. Parameter Panel Density
**Problem**: Our params still feel spacious compared to CaneCalc's tight rows.
**CaneCalc**: ~25px per row, label and input on same line, no gaps between rows.
**Us**: ~35-40px per row due to padding, borders, flex-wrap.

**Fix**:
- Reduce `.param-group` padding from `0.35rem 0.75rem` to `0.25rem 0.5rem`
- Use `border-bottom` only on `.param-group`, no extra gaps
- Ensure labels never wrap — use `text-overflow: ellipsis` if needed
- Number inputs: reduce from 100px to 80px width

### 2. Selects/Dropdowns Inline
**Problem**: Our selects are 140px fixed width, but the instrument_family select has long text that gets truncated.
**CaneCalc**: Uses compact dropdowns that size to content, sometimes 2-column layouts for related fields (Pieces + Geometry side by side).

**Fix**:
- Let selects auto-size with `width: auto; min-width: 80px; max-width: 160px`
- Consider 2-column grid for related short fields within a section

### 3. Core Metrics Panel
**Problem**: Currently a gradient banner with 3 columns. Takes space and is visually heavy.
**CaneCalc**: Shows "Estimated: ~5 wt" as a small inline summary, not a banner.

**Fix**:
- Restyle as a compact row or small table, not a gradient banner
- Keep it always-visible (sticky at top of scrollable area) but minimal
- Grey background, monospace values, small text — like CaneCalc's station data

### 4. Profile Description Textarea
**Problem**: Always visible, takes up vertical space even when empty.
**CaneCalc**: No equivalent (uses design name in toolbar).

**Fix**:
- Collapse to single-line input or hide behind a "Notes" button
- Show as expandable only when it has content or user clicks to add

### 5. Sticky Generate Section
**Problem**: Even though generate button is hidden, the sticky section still takes space (holds hidden preset select and file input).

**Fix**:
- Remove or collapse `.sticky-generate-section` entirely — its children are all hidden anyway
- Move the hidden `<select>` and `<input type="file">` outside the visible flow

### 6. Preview Panel
**Problem**: Preview placeholder with large icon feels empty. CaneCalc shows useful content immediately.
**Us**: Need Pyodide to load before anything appears.

**Fix**:
- Show a skeleton/loading state with approximate layout lines instead of the shield icon
- Or show the default instrument's static SVG as placeholder while Pyodide loads

### 7. Checkbox Layout
**Problem**: Checkboxes use a nested `.checkbox-group` inside `.param-group`, alignment may be off.

**Fix**:
- Ensure checkboxes align right (like other inputs) with label on left
- Match the row height of other params

### 8. Help Tooltips (replacing descriptions)
**Problem**: Descriptions are now hidden. CaneCalc uses small ⓘ icons with hover tooltips.

**Fix**:
- Add a small help icon (ⓘ) after the label for params that have descriptions
- Show description as a title attribute or CSS tooltip on hover
- This gives access to the info without consuming vertical space

### 9. Footer Visibility
**Problem**: Footer "Privacy Policy · Terms" is inside `.app-container` with `overflow: hidden`, may get clipped on some viewports.

**Fix**:
- Move footer outside `.app-container` (after it, inside body)
- Or accept it's hidden when content fills viewport (acceptable — it's not critical)

## Implementation Order
1. Items 4+5 (collapse description textarea, remove sticky section) — quick wins, free up most space
2. Item 1 (tighten param row density)
3. Item 3 (compact core metrics)
4. Item 8 (help tooltips)
5. Item 2 (select sizing)
6. Item 7 (checkbox alignment)
7. Items 6+9 (preview placeholder, footer) — lower priority

## Out of Scope
- Dark theme (CaneCalc's dark theme is nice but ours stays light by default)
- Data table view in params panel (CaneCalc's station table is domain-specific)
- Chart/graph in preview (we have SVG templates, different domain)
