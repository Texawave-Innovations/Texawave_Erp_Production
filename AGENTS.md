# TexaOne ERP — Agent Guidelines & Inviolable Rules

This file sets explicit behavioral constraints and design rules for all AI coding agents working on the TexaOne codebase.

## 1. Strictly Prohibited Elements (Zero Tolerance)

1. **NO AI-Related Logos, Icons, Badges, or Micro-Decorations:**
   - Icons such as `Sparkles`, `Wand`, `Bot`, `Brain`, `Robot`, or stars indicating artificial intelligence are **strictly forbidden anywhere in the application**.
   - NEVER add badges, pill tags, tooltips, or indicators referring to "AI Generated", "AI Assistant", "AI Powered", or similar phrasing.
   - For all actions and controls, use standard deterministic business icons (e.g. `KeyRound` for credentials, `RefreshCw` for regeneration, `Check` for verification, `UserPlus` for creation).

2. **NO Violet, Purple, or Indigo Shades:**
   - The brand aesthetic is strictly TexaOne Prime Blue (`#1769F5`, `#0284c7`, `#0a3271`), Cyan (`#12CFE3`), Sky (`#38bdf8`), and neutral slate/gray.
   - Violet, purple, and indigo accents, gradient stops, drop shadows, and glow filters are strictly prohibited.

3. **NO Monospace Fonts (`font-mono`):**
   - The application exclusively uses **Nunito Sans** (`--font-sans`).
   - Do NOT use `font-mono` for employee codes, IDs, dates, numbers, or temporary passwords.

## 2. Layout & Container Rules

1. **Never use `overflow-hidden` on Form Cards or Section Containers:**
   - Containers housing dropdowns, popovers, or `DatePicker` controls must never use `overflow-hidden`, as this clips dropdown menus and calendar popovers.
   - Use `relative focus-within:z-30` on form sections to ensure proper stacking order above subsequent sections.
