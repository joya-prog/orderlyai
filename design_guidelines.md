# Orderly AI Platform Design Guidelines

## Design Approach

**Selected Approach:** Ultra-Clean Modern Dashboard with Polished Depth

**Justification:** Inspired by contemporary healthcare/SaaS dashboards, this design brings a premium, clinical-meets-luxury aesthetic to the restaurant voice AI platform. The approach prioritizes clarity, generous whitespace, and floating card elements that feel premium and trustworthy.

**Key Principles:**
- Ultra-clean, modern clinical-meets-luxury aesthetic
- Floating cards with soft shadows and generous radii (20-24px)
- Abundant negative space for visual breathing room
- Layered neutrals with strategic accent colors
- Premium but approachable - conveys trust, precision, and calm
- Glass-morphism effects on key interactive elements

**Color Philosophy:**
- Background: Misty white/light gray (#F7F9FC) - clean, professional
- Card surfaces: Pure white (#FFFFFF) with subtle shadows
- Primary: Deep cobalt blue (#2563EB) - trust, precision, modern tech
- Secondary: Teal/sea-glass (#14B8A6) - freshness, success metrics
- Accent: Lime green (#84CC16) - highlights, positive actions
- Text Primary: Charcoal (#1F2937) - strong readability
- Text Secondary: Slate gray (#64748B) - supporting information
- Text Tertiary: Light gray (#94A3B8) - metadata, timestamps

---

## Typography

**Font Stack:**
- Primary: Inter (Google Fonts) - UI elements, buttons, labels, body text
- Secondary: Space Grotesk (Google Fonts) - headings, KPI numbers, emphasis
- Mono: Fira Code (Google Fonts) - code, technical values

**Type Scale:**
- Display (KPI numbers, hero stats): 36px / font-bold / Space Grotesk
- H1 (page titles): 28px / font-semibold
- H2 (section headers): 20px / font-semibold
- H3 (card titles): 16px / font-medium
- Body (default text): 14px / font-normal
- Small (metadata, timestamps): 12px / font-normal
- Micro (labels, badges): 11px / font-medium / uppercase / tracking-wide

**Hierarchy Rules:**
- Bold numerals for KPI cards and statistics
- Medium weight for clickable items and navigation
- Uppercase micro-labels with wide letter spacing for categories
- Muted gray text for supporting/secondary information

---

## Layout System

**Spacing Primitives:** Generous spacing throughout
- Micro spacing (within components): 2, 4
- Standard spacing (between elements): 6, 8
- Section spacing: 12, 16, 24
- Major layout divisions: 32, 48

**Grid Structure:**
- 12-column grid with 24px gaps
- Outer padding: 32-48px on main content areas
- Fixed sidebar (280-320px) with main content area
- Content areas use max-w-7xl containers
- Card clusters in groups of 2-3 with aligned baselines

**Card Layout:**
- Cards float with 20-24px border radius
- Consistent 24px internal padding
- 8-16px spacing between cards
- Vertical rhythm maintained across sections

---

## Shadows & Depth

**Shadow System (Light Mode):**
- Card Shadow: `0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.03)`
- Card Hover Shadow: `0 10px 25px -5px rgba(0,0,0,0.08), 0 4px 10px -4px rgba(0,0,0,0.04)`
- Floating Elements: `0 12px 24px rgba(37,99,235,0.08)`
- Inset Glow (cards): `inset 0 1px 0 rgba(255,255,255,0.5)`

**Depth Layering:**
- Background (base): #F7F9FC
- Cards (elevated): #FFFFFF with shadow
- Popovers/Modals: #FFFFFF with larger shadow
- Overlays: Semi-transparent backdrop blur

---

## Component Library

### Navigation & Structure

**Sidebar Navigation:**
- Width: 280-320px
- Background: Slightly warmer white or subtle gray
- Navigation items: icon + label with generous padding (py-3 px-4)
- Hover state: subtle background elevation
- Active state: primary color indicator (left border or background tint)
- Icons: 20px, stroke width 1.5
- Collapsed state shows icons only

**Header Bar:**
- Height: 64px (h-16)
- Border-bottom for subtle separation
- Contains: Page title (left), actions/profile (right)
- Clean, minimal - no heavy styling

### Dashboard Components

**KPI Cards (Stats):**
- Large rounded corners (rounded-2xl / 20px)
- White background with soft shadow
- Large bold number (text-3xl or text-4xl, Space Grotesk)
- Small label below (text-sm, muted color)
- Optional trend indicator with color coding
- Optional mini-chart/sparkline
- Padding: 24px (p-6)

**Data Cards:**
- Rounded corners (rounded-xl / 16px)
- Clean white background
- Header: title + optional badge/action menu
- Content area with consistent padding
- Footer for actions (optional)
- Hover: subtle lift with enhanced shadow

**Chart Cards:**
- Full card treatment with title in header
- Chart fills content area
- Soft gradient fills (not solid colors)
- Dot markers, no heavy gridlines
- Glass-style tooltips on hover
- Color palette: primary blue, teal, lime variations

**Profile/User Cards:**
- Circular avatar with thin white ring border
- Name prominent, role/status subdued
- Quick stats or actions nearby
- Clean, compact layout

### Tables & Lists

**Table Styling:**
- Row height: 52-56px for comfortable touch targets
- Header: uppercase micro-labels, muted color
- Alternating rows: very subtle (#FAFBFC)
- Row hover: slightly darker background
- No visible borders between cells
- Actions column: right-aligned, icon buttons
- Status chips: pill-shaped badges

**Visit History / Activity Lists:**
- Avatar + name/title cluster (left)
- Metadata columns (center)
- Status badge + actions (right)
- Consistent vertical alignment
- Subtle dividers or alternating backgrounds

### Forms & Inputs

**Input Fields:**
- Height: 44px (h-11)
- Light gray fill (#F8FAFC) with subtle border
- Border-radius: 10-12px (rounded-lg)
- Focus: blue ring, brighter border
- Label above in muted small text
- Placeholder in lighter gray

**Dropdowns & Selects:**
- Same styling as inputs
- Chevron icon on right
- Dropdown panel with shadow-xl
- Selected item highlighted

**Toggle Switches:**
- Pill shape, 48x24px
- Primary color when on
- Smooth transition animation

### Buttons

**Primary Button:**
- Solid primary color background (#2563EB)
- White text, font-medium
- Height: 40-44px
- Padding: px-5 to px-6
- Border-radius: rounded-lg (10-12px)
- Hover: slightly brighter, subtle lift
- Active: slight scale-down

**Secondary Button:**
- Outline style with primary color border
- Primary color text
- Same dimensions as primary
- Hover: light primary background fill

**Ghost Button:**
- No background or border
- Subtle hover background
- Used for less important actions

**Icon Button:**
- Square format (40x40 or 36x36)
- Rounded-lg
- Hover: subtle background fill

### Badges & Status

**Status Badges:**
- Pill shape (rounded-full)
- Padding: px-3 py-1
- Font: text-xs font-medium
- Colors:
  - Active/Success: Teal background (#CCFBF1), dark teal text
  - Warning: Yellow background (#FEF3C7), amber text
  - Error/Cancelled: Red background (#FEE2E2), red text
  - Neutral/Inactive: Gray background (#F1F5F9), gray text
  - Primary/Info: Blue background (#DBEAFE), blue text

**Rating Display:**
- Star icons or numeric with parenthetical count
- Consistent sizing and alignment

### Special Components

**Promo/CTA Card:**
- Gradient background (deep blue to cyan)
- White text with bold headline
- Icon or graphic element
- Action button
- Rounded corners matching other cards

**Circular Progress/Gauge:**
- Used for completion metrics
- Gradient stroke color
- Center value display
- Clean, modern look

**Tooltip/Popover:**
- White background with shadow
- Subtle border
- Arrow indicator
- Smooth fade-in animation

---

## Color Tokens (for index.css)

### Light Mode
```
--background: 220 14% 97%     /* #F7F9FC - misty white */
--foreground: 220 15% 15%     /* #1F2937 - charcoal */
--card: 0 0% 100%             /* #FFFFFF - pure white */
--card-foreground: 220 15% 15%
--primary: 217 91% 60%        /* #2563EB - cobalt blue */
--primary-foreground: 0 0% 100%
--secondary: 220 14% 96%      /* Light gray surface */
--secondary-foreground: 220 15% 35%
--muted: 220 14% 96%
--muted-foreground: 215 16% 47%  /* #64748B - slate */
--accent: 84 85% 43%          /* #84CC16 - lime */
--accent-foreground: 0 0% 100%
--success: 168 76% 42%        /* #14B8A6 - teal */
--destructive: 0 72% 51%
--border: 220 13% 91%
--input: 220 13% 91%
--ring: 217 91% 60%
```

### Dark Mode
```
--background: 224 20% 10%
--foreground: 220 14% 90%
--card: 224 18% 14%
--card-foreground: 220 14% 90%
--primary: 217 91% 65%
--secondary: 224 18% 18%
--muted: 224 18% 20%
--muted-foreground: 220 14% 60%
```

---

## Animations

**Micro-interactions:**
- Hover lift on cards: transform translateY(-2px), 150ms ease
- Button hover: brightness increase, subtle scale
- Active press: scale(0.98), 100ms
- Focus rings: smooth 150ms transition

**Transitions:**
- Panel slide-ins: 250ms ease-out
- Modal fade-in: 200ms ease
- Toast notifications: slide from top-right, 200ms
- Dropdown open: 150ms ease-out

**Avoid:**
- Heavy animations that slow interface
- Jarring movements
- Excessive bounce effects

---

## Responsive Considerations

**Breakpoints:**
- Mobile: < 768px (single column, collapsed sidebar)
- Tablet: 768-1024px (2 columns, collapsible sidebar)
- Desktop: > 1024px (full layout, expanded sidebar)

**Mobile Adaptations:**
- Sidebar becomes bottom nav or hamburger menu
- Cards stack vertically
- Tables become card-based lists
- Maintain generous spacing even on mobile
