# Wedding Website — Cursor Rules

These rules apply to the entire `caleb-emma-wedding` project. Follow them in every file, every response, every code suggestion.

---

## Identity & Tone

- This is a **personal wedding website** for Caleb Haber and Emma Vanden Berg, marrying October 3, 2026.
- All copy should feel **warm, personal, and elegant** — not generic or template-like.
- Names: **Caleb**, **Emma**. Never "the couple," "the bride and groom," or placeholder filler in final copy.

---

## Architecture Rules

- **No third-party wedding platforms.** No Zola, The Knot, Wix, etc. — everything is custom.
- **Self-hostable stack only.** Vanilla HTML/CSS/JS or Next.js/SvelteKit. Confirm the chosen framework before generating scaffolding.
- **Flat-file data.** Guest list, schedule, FAQ, wedding party, and registry links are all managed via JSON config files — no database, no backend service required.
- **Photos in `/photos`.** All images must be referenced from this folder dynamically. Never hardcode absolute paths or external image URLs.
- **Mobile-first.** Every component must be responsive. Design for ~375px viewport first, then scale up.

---

## Feature Rules

### Wordle Gate
- The gate answer is `HABER`. Do not expose this in client-side code comments or obvious variable names.
- Unlock state persists via `localStorage` key (e.g., `wg_unlocked`). Do not prompt again if key is set.
- Gate UI must match the site's design system — same fonts, colors, spacing.

### RSVP
- **No last-name lookup.** The security model uses either unique per-guest codes or a hybrid code+zip approach.
- Every RSVP submission must be tied to a specific guest record from the flat-file guest list.
- Validate access code on page load before showing the RSVP form.
- Guest list JSON must include fields for: name, party size, access code, zip (if hybrid), and rsvp status.

### Admin
- Admin panel or management scripts must be protected (password or environment variable gate).
- Provide a CLI script or simple UI for: adding guests, generating codes, and exporting the RSVP list.

---

## Code Style

- **Comments everywhere.** Every function, component, and non-obvious block gets a comment explaining its purpose.
- **Named constants** for all magic strings and numbers (colors, breakpoints, localStorage keys, etc.).
- **No inline styles** except where truly one-off. Use CSS variables for the design system.
- File and folder names: `kebab-case`.
- Component names (if using a framework): `PascalCase`.
- Keep components small and single-purpose. Prefer composition over large monolithic files.

---

## Design System

Use these values consistently. Define them as CSS custom properties in a shared `:root` block.

```css
:root {
  /* Colors */
  --color-ivory:      #FAF7F2;
  --color-sage:       #8A9E85;
  --color-dusty-rose: #C9A79A;
  --color-charcoal:   #2C2C2C;
  --color-warm-gray:  #7A7A7A;
  --color-white:      #FFFFFF;

  /* Typography */
  --font-heading: 'Italiana', Georgia, serif;
  --font-body:    'Jost', system-ui, sans-serif;

  /* Spacing scale */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  32px;
  --space-xl:  64px;
  --space-2xl: 96px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}
```

- **Headings:** `var(--font-heading)`, tracked slightly, sentence case
- **Body:** `var(--font-body)`, 1.6 line-height minimum
- **Buttons:** Filled primary = sage; ghost/outline for secondary actions
- **Animations:** Subtle only. Max 300ms transitions. No gratuitous motion.

---

## File Structure (Target)

```
/
├── photos/                  # All couple/wedding photos
├── data/
│   ├── guests.json          # Guest list with codes + RSVP status
│   ├── schedule.json        # Wedding day timeline
│   ├── faq.json             # FAQ entries
│   ├── wedding-party.json   # Names, roles, bios, photo filenames
│   └── registry.json        # Registry links
├── public/ (or pages/)      # Pages depending on framework
│   ├── index                # Home / Landing
│   ├── schedule             # Schedule & Details
│   ├── registry             # Registry
│   ├── wedding-party        # Wedding Party
│   ├── gallery              # Gallery / Meet the Couple
│   ├── faq                  # FAQ
│   └── rsvp                 # RSVP
├── components/ (or includes/)
├── styles/
│   └── globals.css          # CSS variables + base styles
├── scripts/
│   └── manage-guests.js     # CLI: add guest, generate code, export RSVPs
└── README.md
```

---

## Don'ts

- ❌ Don't use `any` type in TypeScript without a comment explaining why
- ❌ Don't hardcode guest names, codes, or personal data in source files — always read from `data/guests.json`
- ❌ Don't add npm packages without checking if the task can be done in ~10 lines of vanilla code first
- ❌ Don't break the Wordle gate by exposing the answer obviously
- ❌ Don't generate lorem ipsum for visible user-facing copy — use realistic wedding-context placeholders (e.g., "Ceremony begins at 3:00 PM" not "Lorem ipsum dolor")
- ❌ Don't use external CDN image URLs — all images from `/photos`

---

## README Checklist

The README must cover:
- [ ] How to update schedule, FAQ, registry, and wedding party content (edit JSON files)
- [ ] How to add a guest and generate their access code
- [ ] How to view/export the RSVP list
- [ ] How to deploy (Vercel/Netlify one-click or CLI)
- [ ] Local dev setup (install + run command)
