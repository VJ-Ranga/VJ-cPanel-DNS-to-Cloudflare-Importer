# VJ Tools UI Style Guide (Reusable)

This guide captures the final visual and UX system used in the cPanel DNS to Cloudflare Importer.
Use this as the default standard for future VJ Tools projects.

## 1) Brand Foundation

- Brand label: `VJ Tools`
- Design direction: dark, warm, minimal, technical
- Primary accent use: actions and active states only
- Visual mood: premium, low-noise, readable, not flashy

## 2) Typography

- Heading font: `Fraunces` (600, 700)
- Body/UI font: `Space Grotesk` (400, 500, 600, 700)
- Mono (code/output): `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`

Import:

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap");
```

Type scale used:

- H1: `38px`, line-height `1.1`
- Body: `15px`, line-height `1.45`
- Labels: `14px`
- Helper/muted/footer: `12-13px`

## 3) Color Tokens

```css
:root {
  --bg: #0b0b0b;
  --panel: #151310;
  --surface: #1b1714;
  --surface-alt: #221c18;
  --border: #2d2621;

  --text: #f6f2ee;
  --muted: #c8bdb3;

  --accent: #e27d39;
  --accent-hover: #f3b079;
}
```

Usage rules:

- Main background: `--bg`
- Main card/panel: `--panel`
- Inputs/inner cards: `--surface`
- Secondary chips/buttons: `--surface-alt`
- Primary text: `--text`
- Secondary text: `--muted`
- CTA and active chip: `--accent`

## 4) Background Treatment

- Layer 1: radial warm glow at top corners
- Layer 2: subtle dot grid (`18px` spacing)
- Keep effect low opacity so content stays readable

## 5) Layout System

- Max content width: `1120px`
- Desktop page spacing: top `56px`, bottom `36px`, side `16px`
- Mobile top spacing: `34px`
- Header sits outside main card
- Footer sits outside main card

Structure pattern:

1. `header.page-header`
2. main `.card`
3. `footer.page-footer`

## 6) Surfaces, Radius, and Borders

- Main card radius: `18px`
- Section card radius: `14px`
- Inputs radius: `10px`
- Buttons/chips radius: `999px` (pill)
- Border color: `--border`
- Card shadow: `0 14px 40px rgba(0, 0, 0, 0.35)`

## 7) Controls and States

### Buttons

- Default button: `--surface-alt`, bordered
- Primary button: `--accent`, dark text, bold
- Hover: light border shift, very subtle lift
- Active: tiny press scale (`0.99`)
- Focus-visible: soft ring `rgba(226, 125, 57, 0.24)`

### Inputs/Select/Textareas

- Background: `--surface`
- Text: `--text`
- Placeholder: muted warm gray (`#857769`)
- Focus ring: `0 0 0 3px rgba(226, 125, 57, 0.2)`
- Height baseline: `42px` for text/select controls

### Checkbox

- Size: `18px`
- `accent-color: var(--accent)`
- Do not apply generic text-input focus ring to checkbox/radio

### Filter chips

- Inactive: `--surface-alt`, muted light text
- Active: `--accent`, dark text
- Keep interaction stable (no large motion jump)

## 8) Spacing Rhythm

- Major block spacing: `20-30px`
- Mid spacing between form groups: `14-16px`
- Compact inline spacing: `8-10px`
- Action row margin: `16px 0 22px`

Keep vertical rhythm generous and consistent.

## 9) Content and Copy Rules

- Voice: direct, technical, concise
- Avoid marketing fluff
- Action labels should be verbs (`Load`, `Generate`, `Download`)
- Show status text only when meaningful (hide empty/default status)

## 10) Component Behavior Rules

- New records are inserted at top
- Add-record form adapts by record type
- Proxy toggle shown only for `A`, `AAAA`, `CNAME`
- Output filename should default to detected/entered domain
- Filters should support quick type slicing (`All`, `A`, `CNAME`, `MX`, `SRV`, `TXT`)

## 11) File Structure Standard (for future projects)

- `index.html` (or feature page HTML)
- `styles.css` (all styles, no inline blocks unless truly necessary)
- `app.js` (all logic)
- `README.md` (usage + publish notes)
- `STYLE_GUIDE.md` (this guide, reusable)

## 12) Accessibility Baseline

- Keep labels linked with `for` + `id`
- Preserve visible focus for keyboard users (`:focus-visible`)
- Use clear contrast between text and surface
- Keep clickable targets comfortable (`>= 34-40px` height)

## 13) Do / Do Not

Do:

- Keep headings in Fraunces and body in Space Grotesk
- Keep warm accent-only highlights
- Keep header/footer outside primary working card
- Keep CSS and JS separated from HTML

Do not:

- Introduce purple or unrelated accent palettes
- Use bright focus effects on checkbox/radio controls
- Overuse animations or heavy hover movement
- Mix random fonts or lightweight low-contrast text

## 14) Quick Starter Snippet

```html
<link rel="stylesheet" href="styles.css" />
...
<script src="app.js"></script>
```

Use this guide as the default system for all new VJ Tools utilities unless a project has a dedicated brand variation.
