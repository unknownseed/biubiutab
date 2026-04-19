# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** BiuBiu Tab
**Category:** Music Education / AI Transcription
**Style:** Editorial, Minimalist, Poetic, Hand-crafted
**Last Updated:** 2026-04-19

---

## Global Rules

### Color Palette

| Role | Color Name | Hex | Usage |
|------|------------|-----|-------|
| **Brand Primary** | Retro Green | `#2F4F4F` | Main CTA buttons, highlighted text, active states. Gives a vintage, calm, and professional vibe. |
| **Brand Accent** | Wood Yellow | `#EAB308` (Tailwind `yellow-500`) | Highlights, active states, hover effects, playhead, glowing elements. Replaces all previous brown/wood colors. |
| **Background Base** | Paper White | `#FFFFFF` | Main page background. Often used with low-opacity textured `.webp` images to create a paper/canvas feel. |
| **Text Dark** | Ink 900 | `#111827` (Tailwind `gray-900`) | Primary headings, strong emphasis. |
| **Text Medium** | Ink 700 | `#374151` (Tailwind `gray-700`) | Body text, secondary information. |
| **Text Light** | Ink 500 | `#6B7280` (Tailwind `gray-500`) | Metadata, disabled text, subtle borders. |
| **Overlay** | White/Black Alpha | `rgba(255,255,255,X)` | Used extensively for glassmorphism (`backdrop-blur-sm`), decorative frames (`border-white/20`), and text on dark backgrounds. |

### Typography

- **Heading Font:** Noto Serif SC, Playfair Display (Serif)
  - **Vibe:** Poetic, crafted, editorial, elegant.
  - **Usage:** Large section titles (`text-4xl` to `text-5xl`), CTA button text (`font-serif tracking-[0.2em]`), emphasis quotes.
- **Body Font:** Inter, Noto Sans SC (Sans-serif)
  - **Vibe:** Clean, modern, legible.
  - **Usage:** Paragraphs, long descriptions, secondary lists.
- **Logo Font:** Caveat, Pacifico (Handwriting)
  - **Vibe:** Personal, acoustic, indie.
  - **Usage:** Brand name ("BiuBiu Tab") in the navbar.
- **Metadata Font:** JetBrains Mono (Monospace)
  - **Usage:** Eyebrow headings (e.g., `AI TRANSCRIPTION`), numbers (e.g., `01`, `02`), BPM displays.

### Layout & Spacing (Editorial Style)

- **Container:** Maximum width usually capped at `max-w-7xl` or `max-w-5xl` for content, but sections often break out to full bleed (`w-[100vw] ml-[50%] -translate-x-1/2`).
- **Whitespace:** Extremely generous. Use `py-32` or `gap-24` between major sections to let the content breathe.
- **Grids:** 
  - 2-column for feature highlights (Text on one side, large Image on the other).
  - 3-column for galleries or learning paths (Aspect ratio `4/5` for images).

### UI Elements & Interactions

#### Buttons (CTA)
- **Shape:** Strict sharp corners (`rounded-none`). Do not use rounded corners on buttons or first-level outer container shapes.
- **Typography:** Small serif text (`text-sm font-serif`), extremely wide tracking (`tracking-[0.2em]`), enclosed in brackets `[ 文字 ]`.
- **Interaction:** 
  - Solid background with matching border.
  - Hover: Invert colors (Background becomes white/transparent, text becomes original background color).
  - Hover Animation: The text inside the brackets shifts slightly to the right (`group-hover:translate-x-1`).

#### Images
- **Format:** Prefer `.webp`.
- **Style:** Often desaturated (`grayscale-[30%]`), low contrast (`contrast-[0.9]`), slightly transparent (`opacity-90`).
- **Interaction:** On hover, images slowly regain full color (`grayscale-0 opacity-100`) and scale up slightly (`scale-[1.03]`). Transition duration should be long (e.g., `duration-1000`).
- **Decorations:** Often overlaid with a delicate, pointer-events-none border frame (e.g., `border-white/20` inset by `4px`).

#### Background Textures
- Use large `.webp` images absolute-centered behind sections.
- Apply extreme transparency (e.g., `opacity-[0.06]`), grayscale (`grayscale-[50%]`), and `object-contain` (usually scaled to `55%` - `85%`) to make them look like watermarks or paper textures.

#### Glassmorphism
- Used in upload areas and editor controls.
- Formula: `bg-white/35 backdrop-blur-sm` (or dark variant `bg-zinc-900/80 backdrop-blur-md`).
- Always keep corners sharp (`rounded-none`).

---

## Component Specs

### CTA Button Example (Retro Green)
```tsx
<button className="inline-flex items-center justify-center px-12 py-5 text-sm tracking-[0.2em] text-paper-50 font-serif bg-retro-green border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green rounded-none group">
  <span className="transition-transform duration-500 group-hover:translate-x-1">
    [ 按钮文字 ]
  </span>
</button>
```

### Eyebrow Heading Example
```tsx
<div className="flex flex-col gap-6">
  <span className="text-xs font-mono tracking-[0.2em] text-yellow-500 uppercase">SECTION NAME</span>
  <h2 className="text-4xl lg:text-5xl font-serif text-ink-900 tracking-wide leading-tight">
    中文大标题
  </h2>
  <div className="h-px w-24 bg-yellow-500/30"></div>
</div>
```

---

## Anti-Patterns (Do NOT Use)

- ❌ **Inappropriate Rounded Corners:** Do not use `rounded-md`, `rounded-lg`, etc., on buttons, cards, or primary outer container shapes. Sharp corners (`rounded-none`) define the macro structure, though subtle rounding is permitted on inner, secondary UI elements (like progress indicators or inner tags).
- ❌ **Bright/Neon Primary Colors:** Except for the specific `#EAB308` yellow accent, avoid default Tailwind blue, purple, red, etc. Stick to the earthy/retro palette.
- ❌ **Cluttered Layouts:** Do not cram information. If it feels empty, it's probably right. Let it breathe.
- ❌ **System Fonts for Headings:** Always use the defined Serif fonts for headings to maintain the poetic vibe.
- ❌ **Fast Animations:** Avoid `duration-100` or `duration-150` for layout transitions. Use `duration-500` to `duration-1000` for a calmer, more deliberate feel.
