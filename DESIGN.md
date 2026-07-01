---
version: 1.0.0
name: Raycast-design-system

---

# Raycast-Inspired Design System

Applied to ClinicPro - A productivity-focused clinic management application.

## Key Characteristics

- **Dark-only mode** with a 4-step surface ladder: `#07080a` → `#0d0d0d` → `#101111` → `#121212`
- **White CTA pill** (`#ffffff`) for all primary actions
- **Inter typography** with `font-feature-settings: "calt", "kern", "liga", "ss03"` enabled site-wide
- **Hairline 1px borders** (`#242728`) for cards and structural elements
- **No drop shadows** - elevation built from surface color ladder
- **Saturated category accents** (yellow/red/green/blue) reserved for status indicators only

## Colors

### Surface Colors
| Token | Value | Use |
|---|---|---|
| `--canvas` | `#07080a` | Page background |
| `--surface` | `#0d0d0d` | Card backgrounds |
| `--surface-elevated` | `#101111` | Input/button fills |
| `--surface-card` | `#121212` | Icon tiles, hover states |

### Text Colors
| Token | Value | Use |
|---|---|---|
| `--ink` | `#f4f4f6` | Primary headlines |
| `--body` | `#cdcdcd` | Paragraph text |
| `--mute` | `#9c9c9d` | Secondary text |
| `--ash` | `#6a6b6c` | Disabled text |
| `--stone` | `#434345` | Caption text |

### Accent Colors (Status Indicators)
| Token | Value | Use |
|---|---|---|
| `--accent-blue` | `#57c1ff` | Info/status |
| `--accent-red` | `#ff6161` | Destructive/cancel/error |
| `--accent-green` | `#59d499` | Success/positive trends |
| `--accent-yellow` | `#ffc533` | Warning/pending |

## Typography

Inter with ss03 stylistic set enabled for the signature alternate 'g' glyph.

| Token | Size | Weight | Line Height |
|---|---|---|---|
| Display XL | 64px | 600 | 1.1 |
| Display LG | 56px | 500 | 1.17 |
| Heading XL | 24px | 500 | 1.6 |
| Heading LG | 22px | 500 | 1.15 |
| Heading MD | 20px | 500 | 1.4 |
| Heading SM | 18px | 500 | 1.4 |
| Body LG | 18px | 400 | 1.6 |
| Body MD | 16px | 400 | 1.6 |
| Body SM | 14px | 400 | 1.6 |

## Components

### Buttons
- **Primary/Default**: White background, black text, 8px radius
- **Secondary**: Transparent background, on-dark text, hairline border
- **Tertiary**: Surface-elevated background, on-dark text

### Cards
- Background: `--surface` (`#0d0d0d`)
- Border: 1px solid `--hairline` (`#242728`)
- Radius: 8px

### Inputs
- Background: `--surface-elevated` (`#101111`)
- Border: 1px solid `--hairline` (`#242728`)
- Focus: Border changes to `--accent-blue`

## Implementation

The design system is implemented via:
1. CSS custom properties in `src/app/globals.css`
2. Tailwind config in `tailwind.config.js` with extended colors
3. Updated UI components using Raycast styling tokens