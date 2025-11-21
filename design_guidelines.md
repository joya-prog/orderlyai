# Orderly AI Platform Design Guidelines

## Design Approach

**Selected Approach:** Modern Material Design 3 with Purple/Indigo Color Scheme

**Justification:** This is a utility-focused, enterprise-grade dashboard application requiring clarity, consistency, and efficiency with a contemporary aesthetic. The purple/indigo color palette with coral accents creates a modern, professional look suitable for restaurant business owners.

**Key Principles:**
- Modern, clean aesthetic with gradient-filled charts and subtle shadows
- Clarity over decoration - prioritize information hierarchy and workflow efficiency
- Consistent, predictable interactions for rapid learning
- Professional hospitality industry aesthetic - trustworthy and capable
- Spatial organization using elevation and containment rather than heavy visual effects

**Color Philosophy:**
- Primary: Purple/Indigo (#6366F1) - modern, professional, tech-forward
- Accent: Coral/Orange (#F97316) - warm, inviting, attention-grabbing
- Success: Green (#10B981) - revenue, growth, positive outcomes
- Supporting colors: Purple (#A855F7), Pink (#EC4899) for data visualization

---

## Typography

**Font Stack:**
- Primary: Inter (Google Fonts) - UI elements, buttons, labels, body text
- Secondary: Space Grotesk (Google Fonts) - headings, section titles, emphasis

**Type Scale:**
- Display (agent names, dashboard headers): 32px / font-bold
- H1 (page titles): 24px / font-semibold
- H2 (section headers): 20px / font-semibold
- H3 (subsection titles): 16px / font-medium
- Body (default text): 14px / font-normal
- Small (metadata, timestamps): 12px / font-normal
- Micro (labels, captions): 11px / font-medium / uppercase / letter-spacing-wide

**Hierarchy Rules:**
- All caps + tight letter spacing for input labels and category tags
- Medium weight for clickable items and navigation
- Bold reserved for critical actions and primary headings

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 24**
- Micro spacing (within components): 2, 4
- Standard spacing (between elements): 6, 8
- Section spacing: 12, 16
- Major layout divisions: 24

**Grid Structure:**
- Dashboard uses fixed left sidebar (280px width) with main content area
- Flow builder uses full viewport with floating panels
- Content areas use max-w-7xl containers with px-6 to px-8 padding
- Card-based layouts use gap-6 for consistent spacing

---

## Component Library

### Navigation & Structure

**Sidebar Navigation:**
- Full-height fixed sidebar with logo at top (h-16)
- Navigation items with icon + label, hover state with subtle background
- Active state with accent indicator (left border-l-4)
- Collapsed state shows icons only (w-16)
- Bottom section for user profile/settings

**Top Bar:**
- Height: h-16, backdrop blur for elevation feel
- Contains: breadcrumbs (left), agent status indicators (center), action buttons (right)
- Sticky positioning during scroll

### Dashboard Components

**Agent Cards:**
- Rounded corners (rounded-xl), shadow-md elevation
- Header: agent name + status badge + menu (3-dot)
- Body: key stats (calls handled, success rate, uptime)
- Footer: quick actions (edit, test, deploy)
- Hover state lifts card with shadow-lg

**Flow Builder Canvas:**
- Infinite canvas with subtle dot grid background
- Zoom controls (bottom-right corner)
- Mini-map overview (top-right corner)
- Node palette (collapsible left panel)

**Flow Nodes:**
- Rounded rectangles (rounded-lg) with subtle shadow
- Color-coded borders by node type (greeting, question, action, condition)
- Icon + title at top, content in body
- Connection handles (small circles) on edges
- Selected state: thicker border + elevated shadow
- Node types: greeting, conditional, collect info, book table, transfer call, end call

**Configuration Panels:**
- Slide-in from right (w-96 to w-[480px])
- Sticky header with title + close button
- Scrollable body with organized sections
- Footer with save/cancel actions

### Forms & Inputs

**Input Fields:**
- Outlined style with label floating above
- Height: h-12 for text inputs
- Focus state: accent border + ring
- Helper text below in small gray text
- Error state: red border + error message

**Dropdowns & Selects:**
- Same height as inputs (h-12)
- Custom styling with chevron icon
- Dropdown menu with shadow-xl, max height with scroll

**Toggle Switches:**
- Modern pill-style toggles for boolean settings
- Size: h-6 w-11 with animated transition

**Code Editor (for prompts):**
- Monaco/CodeMirror integration
- Monospace font (Fira Code via Google Fonts)
- Syntax highlighting for AI prompts
- Line numbers, minimap for long content

### Data Display

**Tables:**
- Zebra striping (subtle alternate row backgrounds)
- Sticky header on scroll
- Row hover state
- Action column (right-aligned) for edit/delete/view
- Pagination at bottom (simple prev/next + page numbers)

**Status Badges:**
- Pill shape (rounded-full px-3 py-1)
- Text size: text-xs font-medium
- Semantic states: active (green), testing (blue), inactive (gray), error (red)

**Stats Cards:**
- Compact cards showing single metrics
- Large number (text-3xl font-bold)
- Label below (text-sm text-gray-600)
- Optional trend indicator (↑↓ with percentage)

### Interactive Elements

**Buttons:**
- Primary: solid background, h-10 px-6, rounded-lg, font-medium
- Secondary: outlined with border-2, same dimensions
- Ghost: no background/border, hover shows subtle background
- Icon buttons: square (h-10 w-10), rounded-lg, centered icon
- Disabled state: reduced opacity (opacity-50), cursor-not-allowed

**Modals:**
- Overlay with backdrop blur (backdrop-blur-sm)
- Center-aligned, max-w-lg to max-w-2xl depending on content
- Rounded corners (rounded-xl), shadow-2xl
- Header + body + footer structure

**Tabs:**
- Underline style with active indicator
- Height: h-12, horizontal list
- Active tab: border-b-2 with accent color

### Templates Section

**Template Gallery:**
- 3-column grid on desktop (grid-cols-3 gap-6)
- Template cards with preview image placeholder
- Badge showing industry type (Fine Dining, Casual, Hotel, Catering)
- "Use Template" button on hover overlay

---

## Images

**Dashboard/Builder:**
This is primarily a functional dashboard - minimal decorative imagery. Use icons from Heroicons (via CDN) throughout for:
- Navigation items (phone, settings, chart, users)
- Node types in flow builder (chat bubbles, branches, actions)
- Status indicators (check, warning, info)
- Action buttons (edit, delete, duplicate, play)

**Empty States:**
Use simple illustrations (SVG or placeholder) for:
- "No agents yet" - first dashboard view
- "No knowledge base items" - empty knowledge tab
- "Test your agent" - before first test run

**No Hero Image:** This is not a marketing page - focus on functional UI clarity.

---

## Animations

**Minimal Motion:**
- Sidebar collapse/expand: 200ms ease
- Panel slide-ins: 300ms ease-out
- Card hovers: transform scale slightly (scale-105), 150ms ease
- Button clicks: subtle scale-down (active:scale-95)
- Toast notifications: slide in from top-right, 250ms ease
- Loading states: simple spinner or skeleton screens (no elaborate animations)

**No Animations:**
- Flow canvas interactions (use instant feedback)
- Table sorting/filtering
- Tab switches