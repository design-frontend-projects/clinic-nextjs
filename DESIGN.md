# ClinicPro Dual-Mode Design System (Notion Light + NVIDIA Dark)

ClinicPro uses a **True Dual-System Morph** architecture driven by CSS custom properties and Tailwind CSS v4 (`@theme inline` in `src/app/globals.css`). Switching between Light Mode and Dark Mode transforms colors, surfaces, typography tracking, border radii, shadows, and decorative motifs cohesively.

---

## Mode Architecture

### Light Mode (`:root`) — Notion Inspired
Warm, paper-calm clinical productivity workspace designed for zero visual fatigue during long clinical shifts.
- **Canvas**: `#f6f5f4` (Warm Paper)
- **Surface / Card / Nav / Input**: `#ffffff` (Pure White)
- **Ink**: `#000000` (Primary), `#31302e` (Secondary), `#615d59` (Muted)
- **Hairline**: `#e6e6e6`
- **Primary Structural Accent**: `#0075de` (Notion Blue) / `#005bab` (Active) with `#ffffff` ink
- **Signature Hero Band**: `#213183` (Deep Indigo night band)
- **Decorative Sticker Palette**: Sky `#62aef0`, Purple `#d6b6f6`, Pink `#ff64c8`, Orange `#dd5b00`, Teal `#2a9d99`, Green `#1aae39` (used only for icon tiles, illustrations, and category dots)
- **Geometry**: `12px` cards (`--radius-card`), `8px` utility buttons (`--radius-button`), `4px` inputs (`--radius-input`), `9999px` pill marketing CTAs & badges (`--radius-cta`, `--radius-badge`)
- **Elevation**: Hairline + barely-there layered micro-shadows (`--shadow-soft`, `--shadow-elevated`)

### Dark Mode (`.dark`) — NVIDIA Inspired
High-contrast engineering precision designed for low-light environments and sharp data legibility.
- **Canvas**: `#000000` (Pure Black)
- **Surface / Card / Popover**: `#121212` / `#1a1a1a` (Elevated Carbon)
- **Ink**: `#ffffff` (Primary), `rgba(255, 255, 255, 0.7)` (Muted)
- **Hairline**: `#333333` / `#2c2c2c`
- **Primary Accent**: `#76b900` (NVIDIA Green) / `#5a8d00` (Active) with `#000000` high-contrast ink
- **Semantic**: Error `#e52020`, Warning `#ef9100`, Success `#76b900`, Link Blue `#62aef0`
- **Geometry**: Hyper-angular `2px` across cards, buttons, marketing CTAs, inputs, and badges
- **Elevation**: Zero drop shadows (`none`); separation via `1px` crisp hairlines
- **Signature Motif**: `.nvidia-corner-accent` renders a `10px × 10px` `#76b900` square anchored to the top-end corner of featured/stat cards (automatically hidden in Light Mode)

---

## Typography
- **LTR (`en`, `fr`)**: `Inter` (`--font-inter`, weights `400`, `500`, `600`, `700`) with OpenType `lnum` and `locl` enabled.
- **RTL (`ar`)**: `IBM Plex Sans Arabic` (`--font-arabic`, weights `400`, `500`, `600`, `700`), automatically prioritized under `html[dir="rtl"]`.
- **Scale**: `text-display-xl` (64px/700), `text-display-lg` (54px/700), `text-display-md` (40px/700), `text-headline` (26px/700), `text-card-title` (20px/600), `text-subhead` (18px/400), `text-eyebrow` (12px/600).

## Do's & Don'ts
- **Do** use semantic tokens (`bg-canvas`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-hairline`, `bg-primary`, `text-primary-foreground`) and morphing radius tokens (`rounded-[var(--radius-card)]`, `rounded-[var(--radius-button)]`, `rounded-[var(--radius-input)]`, `rounded-[var(--radius-cta)]`, `rounded-[var(--radius-badge)]`).
- **Do** use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `border-e`, `border-s`) for full RTL Arabic parity.
- **Don't** hardcode `font-inter`, `bg-slate-*`, `text-ink`, `text-mute`, or `bg-fin`.
