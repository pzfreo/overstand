# Cross-Section Geometry Design Specification

This document describes the neck cross-section geometry at the body join, including the blended fingerboard profile feature.

## Overview

The cross-section view shows a slice through the neck where it meets the instrument body. This view is critical for luthiers who need precise measurements for:
- Neck root shaping
- Fingerboard fitting
- Template creation

## Coordinate System

- **X-axis**: Horizontal, with X=0 at the centerline. The profile is symmetrical about this axis.
- **Y-axis**: Vertical, with Y=0 at the back plate level (button).
- All widths are measured as full width (not half-width), though internally half-widths are used for symmetrical drawing.

## Vertical Layers (Bottom to Top)

```
Y increases upward
│
│  ┌─────────────────────┐ ← y_fb_top (top of fingerboard, includes sagitta)
│  │   Fingerboard Arc   │   (radiused playing surface)
│  │                     │
│  │  Fingerboard Side   │ ← vertical or partially curved (see blend below)
│  │                     │
│  ├─────────────────────┤ ← y_fb_bottom (bottom of fingerboard)
│  │     Overstand       │   (gap between belly and fingerboard)
│  ├─────────────────────┤ ← y_top_of_block (top of belly/ribs)
│  │                     │
│  │    Neck Block       │   (within the ribs)
│  │                     │
│  └─────────────────────┘ ← y_button = 0 (back plate level)
```

### Y-Coordinates

| Coordinate | Formula | Description |
|------------|---------|-------------|
| `y_button` | 0 | Back plate level, bottom of cross-section |
| `y_top_of_block` | `block_height` | Top of ribs/belly. For VIOL family, uses `top_block_height`; others use `rib_height` |
| `y_fb_bottom` | `y_top_of_block + overstand` | Bottom surface of fingerboard |
| `y_fb_top` | `y_fb_bottom + fb_thickness_at_join` | Top of fingerboard (center point of arc) |

### Fingerboard Thickness

The fingerboard thickness at the body join is calculated as:

```
fb_thickness_at_join = fb_visible_height_at_join + sagitta_at_join
```

Where:
- `fb_visible_height_at_join`: The edge thickness of the fingerboard (constant parameter)
- `sagitta_at_join`: The arc height of the radiused top surface, calculated from the fingerboard radius and width

## Horizontal Widths (Always Increasing Upward)

The profile flares outward from bottom to top. Widths at each level:

| Level | Width Parameter | Typical Value (Violin) |
|-------|-----------------|------------------------|
| Button | `button_width_at_join` | 28mm |
| Top of block | `neck_width_at_top_of_ribs` | 30mm |
| Fingerboard | `fb_width_at_body_join` | ~42mm (interpolated) |

**Critical constraint**: `button_width <= neck_width_at_ribs <= fb_width`

The fingerboard width at body join is interpolated from `fingerboard_width_at_nut` and `fingerboard_width_at_end` based on the position along the fingerboard length.

## Profile Segments (Bottom to Top)

### 1. Button Line
- Horizontal line at Y=0
- Width: `button_width_at_join`

### 2. Straight Angled Sides
- From: `(half_button_width, y_button)`
- To: `(half_neck_width_at_ribs, y_top_of_block)`
- These are straight lines that angle outward

### 3. Fillet Curve (Shoulder Transition)
- Smooth curve transitioning from neck width to fingerboard width
- Starts at: `(half_neck_width_at_ribs, y_top_of_block)`
- The curve bulges outward, always increasing in width as Y increases

### 4. Fingerboard Sides
- Vertical lines from the curve endpoint to the fingerboard top arc
- At full fingerboard width: `half_fb_width`

### 5. Fingerboard Top Arc
- Radiused arc representing the curved playing surface
- Center of arc is below the edge level
- Arc passes through the top corners of the fingerboard sides

## Blended Fingerboard Profile

### Concept

Traditionally, the fillet curve ends exactly at `y_fb_bottom` with a vertical tangent, and the fingerboard sides are purely vertical. However, luthiers sometimes smooth the curve to continue partway up the fingerboard side, creating a "blended" profile.

### Parameter

**`fb_blend_percent`**: Percentage of fingerboard visible height that the curve extends into (0-100, default 0)

- **0%**: Traditional profile - curve ends at `y_fb_bottom`, fingerboard sides are fully vertical
- **50%**: Curve continues to halfway up the fingerboard side
- **100%**: Curve extends to the top of the fingerboard (no vertical portion remains)

### Geometry with Blend

When `fb_blend_percent > 0`:

```
                    ____arc____
                   |           |
                   |           | ← vertical portion (remaining %)
  curve_end_y →    /           \
                  /             \ ← curve ends with vertical tangent
                 /               \   at (fb_width, curve_end_y)
                /                 \
               /                   \ ← smooth curve from top of belly
              /                     \
             /_______________________\ ← top of belly (y_top_of_block)
             |                       |
             |_______________________| ← button
```

The curve endpoint Y-coordinate:

```
curve_end_y = y_fb_bottom + (fb_blend_percent / 100) * fb_visible_height
```

Where `fb_visible_height = y_fb_top - sagitta_at_join - y_fb_bottom`

### Curve Requirements

The fillet/blend curve must satisfy these mathematical constraints:

1. **Start point**: `(half_neck_width_at_ribs, y_top_of_block)`
2. **End point**: `(half_fb_width, curve_end_y)`
3. **Start tangent**: Must be continuous with the incoming straight line from button. The slope is:
   ```
   slope = (y_top_of_block - y_button) / (half_neck_width_at_ribs - half_button_width)
   ```
   The curve must have this exact slope at the start point (G1 continuity).
4. **End tangent**: Must be vertical (slope = infinity, i.e., dx/dy = 0) to smoothly join the remaining vertical fingerboard side. This ensures G1 continuity at the top.
5. **Monotonic in Y**: As Y increases, X must always increase (or stay constant) - never decrease. This ensures no "waist" or inward bulge. Mathematically: `dX/dY >= 0` for all points on the curve.
6. **Smooth (C1 continuous)**: The curve itself must be smooth with no kinks or discontinuities.
7. **Natural path**: The curve does NOT need to pass through `(half_fb_width, y_fb_bottom)` - it should take the smoothest natural path that satisfies the above constraints.

### Width at Fingerboard Bottom

**Important derived value**: When blend > 0%, the profile width at `y_fb_bottom` is LESS than `fb_width_at_body_join` because the curve hasn't yet reached full fingerboard width at that Y level.

This "width at fb_bottom" is a useful measurement for luthiers - it represents the **maximum width of the neck block** and should be calculated and exposed as a derived value:

```
neck_block_max_width = width of curve at y_fb_bottom (when blend > 0)
                     = fb_width_at_body_join (when blend = 0)
```

To calculate this, evaluate the curve's X position at `y = y_fb_bottom`.

## Dimension Annotations

The cross-section view includes dimension annotations:

### Horizontal Dimensions
1. **Button width**: Full width at Y=0
2. **Neck width at ribs**: Full width at top of block
3. **Fingerboard width**: Full width at fb_bottom level
4. **Neck block max width** (when blend > 0): Actual profile width at fb_bottom

### Vertical Dimensions
1. **Block height**: From button to top of block
2. **Overstand**: From top of block to fingerboard bottom

## Implementation Notes

### Curve Implementation

The fillet/blend curve must satisfy the tangent constraints at both endpoints while remaining monotonic and smooth. A cubic Bezier curve is recommended as it provides sufficient degrees of freedom:

**Cubic Bezier approach:**
- P0 (start): `(half_neck_width_at_ribs, y_top_of_block)`
- P3 (end): `(half_fb_width, curve_end_y)`
- P1 (control 1): Along the incoming tangent direction from P0
- P2 (control 2): Directly below P3 (same X) to ensure vertical end tangent

The control point distances along their respective tangent lines affect the curve shape. These should be tuned to:
1. Maintain monotonicity (no X decrease as Y increases)
2. Produce a visually pleasing, natural curve
3. Work correctly across the range of valid parameter combinations

**Evaluating curve at y_fb_bottom:**
To calculate `neck_block_max_width`, the curve must be evaluated at `y = y_fb_bottom`. For a Bezier curve, this requires solving for the parameter t where the Y coordinate equals y_fb_bottom, then computing the corresponding X coordinate.

### Edge Cases

1. **Invalid geometry** (`fb_width <= neck_width_at_ribs`): Fall back to straight lines. This shouldn't happen with valid parameters but must be handled gracefully.

2. **Blend = 100%**: The curve extends all the way to the fingerboard top. No vertical fingerboard side remains. The curve must end with a vertical tangent that meets the arc smoothly.

3. **Very small overstand**: With minimal overstand, the curve has little room. The blend calculation should still work but the visual effect will be subtle.

### Symmetry

All calculations are done for the left side (negative X) and mirrored for the right side. The profile is always symmetrical about X=0.

## Parameter Summary

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `button_width_at_join` | input | varies | Width at back plate |
| `neck_width_at_top_of_ribs` | input | varies | Width at top of block |
| `fb_width_at_body_join` | derived | calculated | Interpolated FB width |
| `fb_blend_percent` | input | 0 | Curve extension into FB side |
| `overstand` | input | varies | Gap between belly and FB |
| `rib_height` | input | varies | Block height (most families) |
| `top_block_height` | input | varies | Block height (VIOL family) |
| `fingerboard_radius` | input | varies | Radius of FB playing surface |
| `fb_visible_height_at_join` | input | varies | Edge thickness of FB |

## Derived Values for Display

| Value | Description |
|-------|-------------|
| `fb_width_at_body_join` | Full fingerboard width at join |
| `fb_thickness_at_join` | Total FB thickness including sagitta |
| `sagitta_at_join` | Arc height of radiused top |
| `neck_block_max_width` | Profile width at fb_bottom (equals fb_width when blend=0) |
