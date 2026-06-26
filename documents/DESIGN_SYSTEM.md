# Physician System — Design System

**Basis:** Dreams EMR by Dreams Technologies  
**Scope:** `modern-ui-claude/` physician application  
**Status:** Adopted June 2025

---

## 1. Design philosophy

Dreams EMR's visual language is built on four principles that distinguish it from legacy EHR aesthetics:

| Principle | What it means in practice |
|-----------|--------------------------|
| **Clinical precision** | Every pixel serves a task. No decorative chrome, no gratuitous gradients. |
| **Information density with calm** | Data-dense screens feel scannable, not overwhelming, through consistent spacing and clear hierarchy. |
| **Professional trust** | Deep indigo-navy palette reads as institutional confidence — trustworthy and authoritative without being cold. |
| **Efficiency-first interactions** | Inline editing, one-click actions, minimal modal use. Clinicians are always one step from the next task. |

---

## 2. Color palette

### 2.1 Brand colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#2e37a4` | Primary buttons, active nav items, links, focus rings |
| `--primary-dark` | `#1f278a` | Hover state on primary elements |
| `--primary-surface` | `#eef0fb` | Tinted backgrounds, selected rows, inline form backgrounds |
| `--primary-border` | `#c5caef` | Border on primary-tinted containers |

### 2.2 Semantic / status colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#0cbc8b` | Active status, confirmed, signed, reviewed |
| `--success-surface` | `#e8faf4` | Success badge background |
| `--warning` | `#f7bd4a` | Pending, expiring soon, review needed |
| `--warning-surface` | `#fef9ec` | Warning badge background |
| `--danger` | `#dc3545` | Critical, cancelled, overdue, abnormal critical |
| `--danger-surface` | `#fce9eb` | Danger badge background |
| `--info` | `#0ea5e9` | Informational, note, secondary action |
| `--info-surface` | `#e0f5fe` | Info badge background |

### 2.3 Neutral / structural colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-page` | `#f9fbfe` | Page-level background (body) |
| `--bg-card` | `#ffffff` | Card, panel, modal background |
| `--bg-row-hover` | `#f5f7fe` | Table row hover, list item hover |
| `--border-default` | `#e6eaed` | Card borders, input borders, dividers |
| `--border-strong` | `#c8cdd2` | Emphasized separator |
| `--text-primary` | `#1b2559` | Headings, primary body text |
| `--text-secondary` | `#6c757d` | Labels, captions, metadata |
| `--text-muted` | `#9fa6b2` | Placeholder text, disabled labels |
| `--text-on-primary` | `#ffffff` | Text on primary-colored backgrounds |

### 2.4 Sidebar (dark theme)

| Token | Hex | Usage |
|-------|-----|-------|
| `--sidebar-bg` | `#1b2038` | Sidebar background |
| `--sidebar-hover` | `#252c48` | Nav item hover |
| `--sidebar-active` | `#2e37a4` | Active nav item background |
| `--sidebar-text` | `#8898aa` | Inactive nav item text |
| `--sidebar-text-active` | `#ffffff` | Active nav item text |
| `--sidebar-icon` | `#6b7894` | Nav icon (inactive) |
| `--sidebar-divider` | `#293052` | Section dividers within sidebar |

### 2.5 Color-use rules

- Never use `--primary` as a background behind body text — use `--primary-surface` instead.
- Status colors are always paired: `--success` for text/icon, `--success-surface` for badge background.
- `--danger` is reserved for clinical alerts (abnormal critical labs, overdue items). Do not use for routine UI states.
- In dark contexts (sidebar, dark mode header), lighten primary to `#4f5ec7` for legible links.

---

## 3. Typography

### 3.1 Font family

```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Inter is loaded from Google Fonts at weights 300, 400, 500, 600. No other typefaces are used.

### 3.2 Type scale

| Role | Size | Weight | Line height | Color token |
|------|------|--------|-------------|-------------|
| Page title (h1) | 22px | 600 | 1.3 | `--text-primary` |
| Section heading (h2) | 18px | 600 | 1.3 | `--text-primary` |
| Card title (h3) | 16px | 500 | 1.4 | `--text-primary` |
| Sub-heading (h4) | 14px | 500 | 1.4 | `--text-primary` |
| Body text | 14px | 400 | 1.6 | `--text-primary` |
| Small / metadata | 13px | 400 | 1.5 | `--text-secondary` |
| Caption / label | 12px | 500 | 1.4 | `--text-secondary` |
| Table column header | 11px | 600 | 1 | `--text-muted` |
| Micro / timestamp | 11px | 400 | 1.3 | `--text-muted` |

### 3.3 Table header treatment

Table column headers are **uppercase + letter-spacing** to distinguish them from data rows:

```css
.table-col-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
```

### 3.4 Typography rules

- **Never exceed 600 weight** for body elements — it reads heavy in medical UIs.
- **500 (medium) is the work-horse weight** for labels, card titles, navigation items, and button text.
- Monospace font (`font-family: monospace`) is used only for ICD codes, drug codes, and identifiers.
- Do not use italics in clinical data — italics reduce readability at small sizes.

---

## 4. Spacing

All spacing is derived from a base-8 system.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Icon-to-label gap, tight internal padding |
| `--space-2` | `8px` | Small component internal padding |
| `--space-3` | `12px` | List item vertical padding |
| `--space-4` | `16px` | Standard section gap, input padding |
| `--space-5` | `20px` | Card header vertical padding |
| `--space-6` | `24px` | Card body padding, page section gap |
| `--space-8` | `32px` | Large section separation |
| `--space-10` | `40px` | Hero area, page-level vertical breathing room |
| `--space-12` | `48px` | Empty state, large banner padding |

**Card padding**: `24px` (`--space-6`) on all sides.  
**Page padding**: `24px` horizontal, `24px` top, matching the card rhythm.  
**Table cell padding**: `12px 16px` (vertical then horizontal).  

---

## 5. Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | `4px` | Inline code, tight badges |
| `--radius-sm` | `6px` | Inputs, selects, small buttons |
| `--radius-md` | `8px` | Standard buttons, dropdowns, tooltips |
| `--radius-lg` | `12px` | Cards, panels, modals |
| `--radius-xl` | `16px` | Large cards, patient header panels |
| `--radius-full` | `50px` | Pill badges, avatar circles, toggle switches |

---

## 6. Elevation / shadows

Dreams EMR uses shadow (not border) to lift cards off the page background.

| Layer | Value | Usage |
|-------|-------|-------|
| Flat | `none` | Items sitting on `--bg-page`, inline elements |
| Card | `0 1px 4px rgba(27, 37, 89, 0.06)` | Default card, list panel |
| Raised | `0 2px 8px rgba(27, 37, 89, 0.10)` | Hover state, focused card |
| Dropdown | `0 4px 20px rgba(27, 37, 89, 0.14)` | Popovers, select menus, notification panel |
| Modal | `0 8px 40px rgba(27, 37, 89, 0.20)` | Dialogs, slide-in panels |

The shadow tint (`#1b2559`) is the dark text color — this keeps shadow color harmonious with the palette.

---

## 7. Layout grid

### 7.1 Structural dimensions

| Region | Value |
|--------|-------|
| Sidebar width (expanded) | `240px` |
| Sidebar width (collapsed) | `60px` |
| Header height | `60px` |
| Patient context bar height | `52px` |
| Page max-content width | `1440px` (fluid within this) |
| Default page padding | `24px` |

### 7.2 Content grid

```
┌──────────────────────────────────────────────────────┐
│  HEADER  (60px, white, full width, z-index: 100)     │
├────────────┬─────────────────────────────────────────┤
│            │  PATIENT CONTEXT BAR  (52px, sticky)    │
│  SIDEBAR   ├─────────────────────────────────────────┤
│  (240px)   │  TAB BAR  (40px)                        │
│  dark navy ├─────────────────────────────────────────┤
│            │  PAGE CONTENT  (24px padding)            │
│            │   ┌──────────┐  ┌──────────┐            │
│            │   │  CARD    │  │  CARD    │            │
│            │   └──────────┘  └──────────┘            │
└────────────┴─────────────────────────────────────────┘
```

### 7.3 Card grid system

Prefer CSS Grid over Bootstrap columns for card layouts:

```css
/* Two-column layout */
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }

/* Three-column layout */
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

/* Auto-responsive */
.grid-auto { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }

/* Wide card spanning full row */
.col-full { grid-column: 1 / -1; }
```

---

## 8. Component specifications

### 8.1 Cards

```
Background:  --bg-card (#ffffff)
Border:      none (shadow only)
Shadow:      0 1px 4px rgba(27,37,89,0.06)
Radius:      --radius-lg (12px)
Padding:     24px
Hover:       shadow upgrades to 0 2px 8px rgba(27,37,89,0.10)

Card header:
  Border-bottom: 1px solid --border-default
  Padding-bottom: 16px
  Margin-bottom: 16px
  Title: 14px / 500 / --text-primary
  Action link: 13px / 500 / --primary
```

### 8.2 Buttons

| Variant | Background | Text | Border | Hover bg |
|---------|------------|------|--------|----------|
| Primary | `#2e37a4` | `#fff` | none | `#1f278a` |
| Secondary | `#eef0fb` | `#2e37a4` | `1px solid #c5caef` | `#dce0f6` |
| Danger | `#dc3545` | `#fff` | none | `#b02a37` |
| Ghost | transparent | `#2e37a4` | `1px solid #c5caef` | `#eef0fb` |
| Muted | `#f9fbfe` | `#6c757d` | `1px solid #e6eaed` | `#eef0fb` |

All buttons:
- Height: `36px` (small) / `40px` (default) / `44px` (large)
- Padding: `0 16px`
- Font: 13px / 500 / Inter
- Radius: `--radius-md` (8px)
- Transition: `background 120ms ease, box-shadow 120ms ease`
- Disabled: `opacity: 0.5`, `cursor: not-allowed`

### 8.3 Form inputs

```
Height:           40px
Padding:          0 14px
Font:             14px / 400 / Inter
Background:       #ffffff
Border:           1px solid --border-default (#e6eaed)
Radius:           --radius-sm (6px)
Color:            --text-primary (#1b2559)
Placeholder:      --text-muted (#9fa6b2)

:focus
  Border-color:   --primary (#2e37a4)
  Box-shadow:     0 0 0 3px rgba(46,55,164,0.12)
  Outline:        none

textarea
  Min-height:     80px
  Resize:         vertical
  Padding-top:    10px
  Padding-bottom: 10px

select
  Appearance:     none
  Background-image: chevron-down SVG
```

### 8.4 Status badges

Dreams EMR uses **pill badges** (full border-radius) for all status/category labels.

```
Radius:    50px
Padding:   3px 12px
Font:      12px / 500 / Inter
Display:   inline-flex; align-items: center; gap: 5px

Active / Confirmed:    bg #e8faf4  text #0cbc8b
Pending / In progress: bg #fef9ec  text #d9a012
Cancelled / Inactive:  bg #fce9eb  text #dc3545
Info / Note:           bg #e0f5fe  text #0ea5e9
Primary / Scheduled:   bg #eef0fb  text #2e37a4
Muted / Draft:         bg #f2f4f5  text #6c757d
```

### 8.5 Data tables

```
Table layout:     auto
Width:            100%
Cell padding:     12px 16px
Font (body):      14px / 400
Font (header):    11px / 600 / uppercase / letter-spacing 0.06em / --text-muted

Row dividers:     border-bottom: 1px solid --border-default
Header row:       background: --bg-page (#f9fbfe)
Body rows:        background: --bg-card (#ffffff)
Hover row:        background: --bg-row-hover (#f5f7fe)
Active row:       background: --primary-surface (#eef0fb); left border: 3px solid --primary

Sortable header:  cursor pointer; sort icon visible on hover; active icon: --primary

Action column:
  Buttons hidden until row hover
  Use icon-only ghost buttons (28px square, --radius-sm)
  Primary action appears on direct row click where applicable
```

### 8.6 Navigation sidebar

```
Width:            240px (expanded), 60px (collapsed)
Background:       #1b2038
Padding:          0

Logo section:
  Height:         60px (matches header)
  Padding:        0 20px
  Logo white variant

Section header:
  Font:           10px / 600 / uppercase / letter-spacing 0.08em
  Color:          #4f5a7a
  Padding:        16px 20px 6px
  Margin-top:     8px

Nav item:
  Height:         42px
  Padding:        0 20px
  Display:        flex; align-items: center; gap: 12px
  Font:           13px / 400
  Color:          #8898aa
  Radius:         0 (full-width highlight)
  Icon:           18px, color: #6b7894

Nav item :hover:
  Background:     #252c48
  Color:          #d0d8ea

Nav item (active):
  Background:     #2e37a4
  Color:          #ffffff
  Icon-color:     #ffffff
  Left border:    3px solid #4f5ec7

Nav sub-item:
  Padding-left:   52px
  Height:         36px
  Font-size:      13px
```

### 8.7 Page / section header

```
Margin-bottom: 20px
Display:       flex; justify-content: space-between; align-items: flex-start

Title:
  Font:    22px / 600 / --text-primary
  Margin:  0

Subtitle / breadcrumb:
  Font:    13px / 400 / --text-secondary
  Margin:  4px 0 0

Action area:
  Display: flex; gap: 10px; align-items: center
```

### 8.8 Avatar / initials circle

```
Sizes:     24px (micro), 32px (table), 40px (list), 48px (profile)
Shape:     50% (circle)
Font:      bold, ~40% of diameter
Colors:    rotate through: --primary-surface/--primary, success-surface/success,
           warning-surface/warning, info-surface/info
           (deterministic based on name hash, not random)
```

### 8.9 Empty states

```
Container:  flex column; align-items: center; padding: 48px 24px; text-align: center
Icon:       40px, color: --text-muted, margin-bottom: 12px
Heading:    16px / 500 / --text-primary
Body:       13px / 400 / --text-secondary; max-width: 280px; margin-top: 4px
CTA button: primary or ghost; margin-top: 16px
```

---

## 9. Icon system

Dreams EMR uses **Tabler Icons** (outline style only). This is consistent with our existing implementation.

```
Default size:  18px inline (nav, buttons, labels)
Medium size:   20px (card headers, section icons)
Large size:    24px (empty state icons, feature icons)
Stroke width:  1.5px (default Tabler stroke)

Icon-only buttons:  28–32px container, icon 16–18px
Icon color:         inherits from parent text color
No filled variants: always use outline icons
```

Common icon → concept mapping for this system:

| Concept | Tabler icon |
|---------|-------------|
| Patient | `ti-user-circle` |
| Encounter | `ti-stethoscope` |
| Lab result | `ti-flask` |
| Prescription / Rx | `ti-pill` |
| Appointment | `ti-calendar-event` |
| Message | `ti-message-circle` |
| Notification | `ti-bell` |
| Alert / urgent | `ti-alert-triangle` |
| Chart / vitals | `ti-activity` |
| Document | `ti-file-text` |
| Timeline | `ti-git-commit` |
| Search | `ti-search` |
| Settings | `ti-settings` |
| Sign / approve | `ti-circle-check` |
| New / add | `ti-plus` |
| Remove / deactivate | `ti-x` |
| Edit | `ti-pencil` |
| Print | `ti-printer` |
| Download | `ti-download` |
| More options | `ti-dots` |

---

## 10. Motion & transitions

Dreams EMR uses **subtle, fast** transitions. Nothing decorative.

```
Default transition:    all 120ms ease
Color transitions:     background-color 120ms, color 120ms, border-color 120ms
Shadow transitions:    box-shadow 150ms ease
Expand/collapse:       max-height with 200ms ease, opacity 150ms
Sidebar collapse:      width 200ms ease
Modal entrance:        opacity + translateY(8px) → 0; 180ms ease-out
Toast entrance:        translateX(100%) → 0; 220ms ease-out

No bounce, spring, or elastic easing — these feel out of place in clinical software.
Respect prefers-reduced-motion: substitute with instant state change.
```

---

## 11. Notification & feedback patterns

### Toast messages

```
Position:      top-right, 16px from edge
Width:         320px max
Padding:       14px 16px
Radius:        --radius-md (8px)
Shadow:        --shadow-dropdown
Duration:      4 seconds (success), 6 seconds (error), manual dismiss (warning)

Success:       left border 4px solid --success; bg #e8faf4; icon: ti-circle-check green
Error:         left border 4px solid --danger; bg #fce9eb; icon: ti-alert-triangle red
Warning:       left border 4px solid --warning; bg #fef9ec; icon: ti-info-circle amber
Info:          left border 4px solid --info; bg #e0f5fe; icon: ti-info-circle blue
```

### Inline validation

- Error text appears below the field, `12px / 400 / --danger`, with icon `ti-circle-x` 12px
- No red outline on inputs — the left-border-on-card convention is not used in forms
- Success state is not shown inline (avoid over-celebrating routine data entry)

---

## 12. Dark mode

Dreams EMR supports full dark mode via `data-theme="dark"` on `<html>`. Key overrides:

```css
[data-theme="dark"] {
  --bg-page:      #0d1117;
  --bg-card:      #161b22;
  --bg-row-hover: #1c2230;
  --border-default: #30363d;
  --border-strong:  #484f58;
  --text-primary:   #e6edf3;
  --text-secondary: #8b949e;
  --text-muted:     #6e7681;
  --sidebar-bg:     #0d1117;
  --sidebar-hover:  #161b22;
}
```

Primary colors (`--primary`, `--success`, `--warning`, `--danger`, `--info`) remain identical in dark mode. Their surface variants lighten to 15% opacity overlays:

```css
[data-theme="dark"] {
  --primary-surface: rgba(46, 55, 164, 0.15);
  --success-surface: rgba(12, 188, 139, 0.12);
  --warning-surface: rgba(247, 189, 74, 0.12);
  --danger-surface:  rgba(220, 53, 69, 0.12);
  --info-surface:    rgba(14, 165, 233, 0.12);
}
```

---

## 13. Responsive breakpoints

```
Mobile:   < 576px  — single-column, sidebar hidden (drawer)
Tablet:   576–992px — sidebar collapsed (60px icon-only)
Desktop:  992–1280px — sidebar expanded (240px), two-column content
Wide:     > 1280px — same as desktop, wider content grids
```

At mobile/tablet, the patient context bar collapses to show only name + DOB on a single line.

---

## 14. Clinical-specific patterns

### 14.1 Abnormal lab flags

Labs follow a severity hierarchy with both color and label:

| Abnormal type | Badge | Color |
|--------------|-------|-------|
| Critical high/low | `CRITICAL` | `#dc3545` on `#fce9eb`, bold |
| High | `H ↑` | `#d9a012` on `#fef9ec` |
| Low | `L ↓` | `#0ea5e9` on `#e0f5fe` |
| Abnormal (non-directional) | `ABN` | `#7c3aed` on `#ede9fe` |
| Normal | — | No badge shown |

### 14.2 Urgency / expiry indicators

Used in prescription renewals, overdue tasks, and action inboxes:

| State | Label | Color |
|-------|-------|-------|
| Expired (past end date) | `Expired` | `#dc3545` |
| Critical (≤ 7 days) | `≤7 days` | `#dc3545` |
| Soon (8–30 days) | `≤30 days` | `#d9a012` |
| OK (31–60 days) | `≤60 days` | `#0cbc8b` |

### 14.3 Patient status / encounter status

| Status | Label | Color |
|--------|-------|-------|
| Checked in | Active | `--success` |
| Awaiting | Pending | `--warning` |
| No-show | No-show | `--danger` |
| Completed | Done | muted gray |
| Signed encounter | Signed | `--primary` |

### 14.4 Inline action buttons on lists

When rows contain deactivate/remove actions:
- Actions are **hidden by default**, visible on row hover
- Use `28×28px` ghost icon buttons
- Destructive actions (remove, deactivate) use `--danger` color on hover only
- Confirmation is inline (brief text prompt below the row), not a modal

---

## 15. What is different from the current Calm Clinical system

| Aspect | Calm Clinical (current) | Dreams EMR (target) |
|--------|------------------------|---------------------|
| Primary color | Teal `#0f6e56` | Indigo `#2e37a4` |
| Sidebar color | Forest `#1c3a30` | Navy `#1b2038` |
| Page background | Warm off-white `#f7f9f8` | Cool blue-white `#f9fbfe` |
| Accent / alert | Coral `#993c1d` | Standard semantic (green/amber/red) |
| Border radius | Variable (4–12px) | Consistent scale (6/8/12px) |
| Card elevation | Border only | Shadow only (no border) |
| Font | System default | Inter (explicit) |
| Typography | Implicit scale | Documented 9-stop scale |
| Table headers | Title case | UPPERCASE + letter-spacing |
| Badge style | Variable | Always pill (50px radius) |
| Status colors | Teal/coral derived | Semantic green/amber/red |
| Shadow tint | Black | Dark text color (`#1b2559`) |

---

## 16. Implementation notes

The CSS variables should be declared in `:root` in `modern-ui-claude/src/index.css`, replacing the current custom properties. Specific migration steps:

1. Replace `--teal` / `--coral` / `--bg` / `--surface` / `--border` / `--text` / `--text-muted` with the full token set above.
2. Update `--radius-md` and `--radius-lg` to match the Dreams EMR scale.
3. Remove `--shadow-card` / `--shadow-pop` and replace with the 5-layer shadow system.
4. Add Inter font import to `index.html`.
5. Update button classes to use the 5-variant button system.
6. Update badge classes to always use `border-radius: 50px`.
7. Switch table column headers to uppercase + letter-spacing.
8. Replace sidebar background with `#1b2038`.

See `MODERNIZATION_PLAN.md` for phased implementation sequencing.
