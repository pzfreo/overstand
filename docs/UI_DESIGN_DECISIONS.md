# Overstand UI Design Decisions

Comprehensive record of deliberate UI/UX decisions made throughout the project's history. **Must be preserved in any UI redesign.** Each decision traces back to git commits where it was established.

---

## Layout & Panels

- **Top toolbar** with brand, action buttons, theme toggle, menu, and auth — replaces old icon bar — PR `#90`
- **Desktop params panel 400px wide** (CSS grid `400px 1fr`); collapsing expands preview to full width — PR `#90`
- **Mobile params**: slides from left, 85% width / 380px max, with dim overlay — `11e717b`, `08306c2`
- **Viewport-constrained layout**: `overflow: hidden` on `.app-container` prevents page from expanding beyond viewport height — PR `#90`
- **Modals must live outside main container** for z-index to work (currently outside `.app-container`) — `82aa63b`
- **Mobile breakpoint is 1024px** (single canonical value in `constants.js`) — `08306c2`
- Secondary breakpoints at 768px (tabs wrap, compact modals) and 480px (single column)
- Z-index stacking: toolbar 100, params drawer 160, app-menu 200, modals 2000
- **CaneCalc density reference**: CaneCalc (bamboo rod taper tool) uses ~40px toolbar, no accordion overhead, continuous flowing params. Overstand targets similar density. — PR `#90`

## Toolbar & Menu

- **Single unified dropdown menu** (`#app-menu-overlay`) — replaces two separate systems (slide-in panel + mobile dropdown) — PR `#90`
- Menu dropdown anchored top-right below toolbar, 280px wide, `max-height: calc(100vh - 60px)` with scroll — PR `#90`
- **Menu items not duplicated in toolbar**: toolbar has Load, Save, Import, Export, SVG, PDF, Share; menu has additional items (Shortcuts, About, Cache, GitHub, etc.) — PR `#90`
- Both toolbar Menu button and hamburger open the same dropdown
- Close via: click outside, Escape key, or clicking a menu item
- **Auth button in toolbar**: shows "Sign In" when logged out (primary button style), "Sign Out" when logged in — PR `#90`
- User email shown as info row in menu when signed in — PR `#90`
- Hamburger visible on mobile only; toolbar actions visible on desktop only — PR `#90`
- **Toolbar height 44px** (reduced from 52px for CaneCalc-level density), brand SVG 24px, button padding `0.3rem 0.6rem` — PR `#90`

## Auto-Generate (no Generate button)

- **Debounced at 500ms** on any param change; Cmd/Ctrl+Enter for immediate — `ccf1aca`
- **Mobile: panel stays open during generation** (deliberate — users batch-edit params) — `1220543`
- Status shows "Updating preview..." / "Preview updated"
- Errors don't block subsequent auto-generation — `3575002`

## Parameter Organization

- **Horizontal row layout**: label on left, input on right — compact, standard for parameter panels — PR `#90`
- **Sections 1–3 expanded by default** (Identity, Body & Bridge, String Action) — everything needed for a side view — `b5a297a`
- **Sections 4–9 collapsed** (Viol, Fingerboard, Cross-Section, Frets, Advanced, Display)
- **Section headers**: uppercase title with indigo accent bar (`::before` pseudo-element), indigo text — PR `#90`
- **Accordion state persisted in localStorage** across sessions — `b22df07`
- **Accordion is keyboard-accessible**: Enter/Space toggle, ARIA attributes (`role="button"`, `aria-expanded`) — `b22df07`
- `fret_join` lives in Body & Bridge (not buried in Frets) — same conceptual role as `body_stop` — `b5a297a`
- All params created in DOM even when hidden (visibility toggled dynamically) — `d6a7463`
- `"(calculated)"` label dynamically appended to output-only fields
- **Output params** styled with left indigo border and subtle background tint — PR `#90`
- **Input widths**: number/text inputs 100px, selects 140px, right-aligned — PR `#90`
- **Notes textarea inside Instrument Identity accordion** (not standalone) — collapsed with the section, saves ~35px when Identity is collapsed — PR `#90`
- **Compact accordion headers**: `padding: 0.3rem 0.75rem`, no border-top (bottom border of previous section suffices) — PR `#90`
- **Tight param row spacing**: `min-height: 26px`, `padding: 0.15rem 0.5rem` — CaneCalc-inspired density — PR `#90`

## Core Metrics Panel

- **Always visible** at top of params: Neck Angle (primary), Neck Stop, Nut Relative to Ribs, String Break Angle — `0ccad9c`
- Neck Stop swaps to Body Stop for Guitar/Mandolin family — `08306c2`
- Real-time updates on param change
- Config defined in `KEY_MEASUREMENTS` in `src/ui_metadata.py`

## Keyboard Shortcuts

- **Cmd/Ctrl+S** — cloud save if logged in, file export if not — `c6234d5`, `c788ce4`
- **Cmd/Ctrl+O** — load profile modal if signed in, file import if not — `c6234d5`
- **+/-/0** — zoom in/out/reset (blocked when typing in input fields) — `08306c2`
- **Cmd/Ctrl+Enter** — immediate generation (bypass debounce)
- **Escape** — close any open menu/panel/modal

## Naming (user-facing terminology)

| Old name | Correct name | Commit |
|---|---|---|
| "cloud presets" | **"profiles"** | `ee6c5de` |
| "Export to JSON" | **"Export to File"** | `c3a414f` |
| "Import from JSON" | **"Import from File"** | `c3a414f` |
| "Sign in / Sign up" | **"Sign In"** (toolbar button) | PR `#90` |
| built-in presets | **"Standard Instruments"** | `08306c2` |
| "Generating..." | **"Updating preview..."** | `ccf1aca` |

Rationale: instrument makers don't know what JSON is. "Profiles" better describes personal saved configurations.

## Auth Flow

- **Google OAuth only** (no GitHub) — `de3dd3a`
- **Popup window** for OAuth (falls back to redirect if blocked) — `3ed4e1b`
- Lightweight `oauth-callback.html` extracts tokens, passes via localStorage — `51cbd0e`
- Main page polls localStorage (storage events unreliable when popup closes fast) — `7e736df`
- Supabase uses **implicit flow** (tokens in URL hash `#access_token=...`), not PKCE — `ad1d06a`
- OAuth tokens stripped from URL hash before analytics can see them — `93d557b`
- Auth button in toolbar (Sign In / Sign Out); email shown in menu dropdown when signed in — PR `#90`

## Save / Load / Export Flow

- **Unsaved changes guard** (`confirmDiscardChanges()`) on all load paths: preset, cloud profile, community profile, file import — plus `beforeunload` handler — `1841775`
- Active profile name in status bar with "(unsaved)" indicator when modified — `1841775`
- **Standard presets always accessible without sign-in** — `9cc7c58`
- Optional description field on profiles ("e.g., Based on Stradivari 1716 Messiah measurements") — `64ec69e`
- Cmd+S = cloud save when logged in, JSON export when not — `c788ce4`

## View Tabs

- **Side View is default**, tabs ordered: Side, Top, Cross-Section, Dimensions, Fret Positions, Radius Template — `76bf4c9`
- Fret Positions tab disabled for Violin family; auto-switches to Side View — `96a8258`
- Radius Template is SVG-only download (for 3D printing import) — `71b99d0`
- SVG download button grayed out for table views (Dimensions, Fret Positions); both SVG and PDF buttons always visible to avoid layout shift — `0da47b7`

## Status Bar

- **Left side**: transient status messages (Ready, Updating preview...)
- Version info + small "reset" link for cache clearing — `efd2bb1`, `8cb50e5`
- Auth moved from status bar to toolbar button — PR `#90`

## Error Handling

- **Three types**: transient (auto-dismiss 4s, yellow/warning), persistent (red, stays until resolved), critical — `3575002`
- Error panel: `position: sticky; bottom: 0` in preview panel — `3575002`
- Math domain errors produce actionable messages ("Try adjusting bridge_height, arching_height...") — `3575002`
- Custom modal popups replaced all `alert()` dialogs — `1221bbd`, `3309d57`

## Mobile Specifics

- **No `backdrop-filter: blur()` on overlays** (breaks on Firefox/Android) — `addaa8a`, `240de00`
- **Web Share API only on `pointer: coarse` devices** (Mac desktop `navigator.share` triggers annoying native dialog, so desktop always gets share modal) — `3ed4e1b`
- Email share opens `_blank` (don't navigate away from app) — `1f6341c`
- Overlay opacity very low / transparent — `08306c2`
- Reduced mobile preview padding (1rem not 2rem), compact tabs, smaller zoom buttons — ~30% more SVG space — `09409f0`

## Download & Filenames

- Filenames use `instrument_name` parameter value — `8ff643e`
- Table views: no SVG download, PDF only — `0da47b7`

## PWA / Cache Strategy

- `?reset` URL param for emergency cache clear (inline script before any JS loads) — `643795e`
- "Clear Cache & Reload" in menu under Troubleshooting — `6746522`
- Menu/cache-reset init runs **before Pyodide** so it works even if Python fails to load — `2788fe4`
- App files: **network-first**; Pyodide runtime: **cache-first** (permanent, 20-30MB); Python modules: cache-first — `efd2bb1`
- Production: cache-first + user confirmation to update + hourly checks — `6e4397b`
- Preview: network-first + auto-reload + 5-minute checks — `6e4397b`
- Aggressive mobile cache reset: clears storage, SKIP_WAITING, 500ms wait, `window.stop()` — `00fb589`

## Branding & Theming

- **Indigo `#4F46E5`** throughout (replaced original brown `#8B4513`) — `8ff643e`
- "OS" bold text logo on purple rounded square (Arial Black, white on `#4F46E5`) — `76285ad`
- **No icons in preset dropdown** (removed as unhelpful/confusing, text only) — `18592ca`
- All colors extracted to CSS custom properties in `:root` for theming — `1722e79`

## Share & Community

- **Share is a top-level menu item** (not buried inside Load Profile modal) — `40e2cf9`
- Community profiles: browse, search by name, filter by instrument family — `c496543`
- **Bookmark/star feature**: bookmarked profiles float to top for user, high-bookmark profiles rank higher for everyone — `b13ed34`
- **Publish is a separate top-level menu action** (not per-row in My Profiles) — `b13ed34`

## Preset / Standard Instruments System

- JSON-based preset management with CSV workflow (edit CSV → run script → JSON files) — `9cbfc3c`
- App **auto-loads first preset's parameters on initialization** — `18592ca`
- 11 presets: Violin, Viola, Cello, Treble/Tenor/Bass Viol, Archtop Guitar, Mandolin, Mandola, Octave Mandolin, Custom — `43f1208`

## Accessibility

- Accordion: `role="button"`, `aria-expanded`, `tabindex="0"`, keyboard Enter/Space — `b22df07`
- Content regions: `role="region"` — `b22df07`
- Zoom shortcuts blocked when focus is in input fields — `08306c2`
- Modals: click-outside-to-close, Escape key closes, smooth animations — `1221bbd`

## Analytics

- **Umami Cloud** (cookie-free, GDPR-compliant; migrated from Plausible) — `e9dd66e`
- Tracked events: preset selected, template generated, PDF exported, save/load, errors, view changes, SVG downloads, family changes, engagement milestones — `b9ecb38`, `148e477`, `2381272`
- Parameter edits: debounced, batched, sent after 3s inactivity — `2381272`

## Init / Loading Sequence

- Status messages: "Loading Python engine..." → "Installing package manager..." → "Installing Python libraries..." → "Loading instrument neck modules..." → "Loading fonts..." → "Building interface..."
- Menu and Clear Cache setup runs **first** (before Pyodide), inside try-catch, so users can always access cache reset even on failed load — `2788fe4`
