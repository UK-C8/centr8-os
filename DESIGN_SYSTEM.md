# DESIGN_SYSTEM.md — Centr8 OS

Design tokens and visual conventions for Claude Code to follow across every screen. Read this before building or editing any UI component. Do not introduce colors, fonts, or spacing values outside what's defined here without flagging it first.

---

## 1. Typography

**Primary typeface: Google Sans (with system fallback)**

Google Sans isn't distributed as an open web font, so load it via a close-matching stack. Use **Google Sans** where licensed/available (e.g. through a Google Fonts-adjacent CDN or self-hosted license), falling back to **Product Sans / Inter** as the nearest visual match if Google Sans itself isn't obtainable for the project's license.

```css
:root {
  --font-primary: 'Google Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Google Sans Mono', 'Roboto Mono', 'SF Mono', Consolas, monospace;
}
```

If Claude Code cannot license/load actual Google Sans, use **Inter** as the working substitute (closest metrics and neutral, professional character) and note this substitution explicitly in the README rather than silently swapping to a different-feeling font like a generic system sans.

### Type Scale

| Token | Size | Weight | Use |
|---|---|---|---|
| `--text-display` | 32px / 2rem | 600 | Page titles, dashboard headers |
| `--text-h1` | 24px / 1.5rem | 600 | Section headers |
| `--text-h2` | 20px / 1.25rem | 600 | Card titles, modal headers |
| `--text-h3` | 16px / 1rem | 600 | Sub-headers, table headers |
| `--text-body` | 14px / 0.875rem | 400 | Default body text |
| `--text-body-medium` | 14px / 0.875rem | 500 | Emphasized body text, labels |
| `--text-small` | 12px / 0.75rem | 400 | Metadata, timestamps, helper text |
| `--text-caption` | 11px / 0.6875rem | 500 | Badge text, tags (uppercase, letter-spaced) |

Line height: 1.5 for body text, 1.3 for headers.

---

## 2. Color System

**No pure black, no pure white.** All neutrals are slightly warmed or cooled off-black/off-white to read as professional software rather than a default template.

### Neutrals (Base UI)

| Token | Hex | Use |
|---|---|---|
| `--neutral-950` | `#14161A` | Primary text (replaces black) |
| `--neutral-800` | `#2B2E34` | Secondary text, icons |
| `--neutral-600` | `#5B5F68` | Muted text, placeholders |
| `--neutral-400` | `#9CA0A8` | Disabled text, borders (dark mode) |
| `--neutral-300` | `#D4D7DC` | Borders, dividers |
| `--neutral-200` | `#E8EAED` | Subtle backgrounds, table stripes |
| `--neutral-100` | `#F4F5F7` | Page background |
| `--neutral-50` | `#FAFBFC` | Card background (replaces pure white) |

### Brand / Primary

| Token | Hex | Use |
|---|---|---|
| `--primary-700` | `#1E4FD6` | Primary hover/active state |
| `--primary-600` | `#2E62F0` | Primary buttons, links, active nav item |
| `--primary-100` | `#E3EAFD` | Primary-tinted backgrounds, selected rows |

A confident, professional blue — not the generic Tailwind default indigo, and not startup-purple.

### Semantic Colors

| Token | Hex | Use |
|---|---|---|
| `--success-600` | `#1C8A5A` | Done status, positive health signals |
| `--success-100` | `#DFF3E9` | Success badge background |
| `--warning-600` | `#B4740E` | At-risk status, medium priority |
| `--warning-100` | `#FBEDD6` | Warning badge background |
| `--danger-600` | `#C13B3B` | Blocked status, overdue, high risk |
| `--danger-100` | `#F9E1E1` | Danger badge background |
| `--info-600` | `#2E7BB0` | In-progress status, informational |
| `--info-100` | `#DCEEF7` | Info badge background |

### AI-Generated Content Accent

A distinct, consistent color for anything AI-authored (draft banners, AI badges, agent-generated summaries) — separate from the primary brand blue so it's instantly recognizable as "AI, not the user or system."

| Token | Hex | Use |
|---|---|---|
| `--ai-600` | `#7A4FD6` | AI badges, "AI-generated" banner border/icon |
| `--ai-100` | `#EEE7FB` | AI banner background |

### Status Badge Mapping (for tasks/projects/health)

| Status | Background | Text |
|---|---|---|
| Not Started / To Do | `--neutral-200` | `--neutral-800` |
| In Progress | `--info-100` | `--info-600` |
| In Review | `--warning-100` | `--warning-600` |
| Blocked | `--danger-100` | `--danger-600` |
| Done | `--success-100` | `--success-600` |
| AI Draft / Provisional | `--ai-100` | `--ai-600` |

---

## 3. Spacing Scale

4px base unit, consistent across all components.

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

Standard card padding: `--space-6`. Standard gap between form fields: `--space-4`. Page margin (desktop): `--space-8`.

---

## 4. Radius & Elevation

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Badges, small buttons |
| `--radius-md` | 10px | Cards, inputs, modals |
| `--radius-lg` | 16px | Large panels, dashboard widgets |
| `--radius-full` | 9999px | Avatars, pill badges |

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(20, 22, 26, 0.06)` | Cards at rest |
| `--shadow-md` | `0 4px 12px rgba(20, 22, 26, 0.08)` | Dropdowns, popovers |
| `--shadow-lg` | `0 12px 32px rgba(20, 22, 26, 0.12)` | Modals |

Shadows are tinted with `--neutral-950` at low opacity, not pure black, to stay consistent with the no-pure-black rule.

---

## 5. Component Conventions

- **Buttons:** Primary = `--primary-600` background, `--neutral-50` text. Secondary = `--neutral-50` background, `--neutral-300` border, `--neutral-950` text. Never a black button.
- **Cards:** `--neutral-50` background, `--neutral-300` border or `--shadow-sm`, `--radius-md`.
- **Badges:** Always paired background/text tokens from the status mapping above — never freehand colors.
- **AI-generated content banner:** `--ai-100` background, `--ai-600` left border (4px) or icon, small "AI-generated — review before accepting" label in `--text-caption`. This pattern is locked and reused everywhere AI output appears (draft review, sprint plan proposals, generated docs, executive recommendations).
- **Focus states:** `--primary-600` 2px outline, never browser default blue.
- **Dark mode (if/when built):** invert neutral scale, keep brand/semantic hues but shift to their darker variants for backgrounds — do not simply drop opacity.

---

## 6. What to Avoid

- No `#000000` or `#FFFFFF` anywhere in the UI — use `--neutral-950` / `--neutral-50` instead.
- No default Tailwind gray/blue/indigo palette used unmodified — always reference the tokens above.
- No emoji in UI copy or component labels (matches Urvil's communication preference — clean, professional, text-only).
- No inconsistent badge coloring — every status must map through Section 2's table, not be picked ad hoc per screen.
