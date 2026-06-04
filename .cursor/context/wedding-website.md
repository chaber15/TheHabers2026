# Caleb & Emma Wedding Website — Project Context

**Couple:** Caleb Haber & Emma Vanden Berg  
**Wedding Date:** October 3, 2026  
**Venue:** Good Hope Presbyterian Church  
**Developer:** Caleb Haber (recent CS graduate)  
**Aesthetic Reference:** Zola — clean, modern, romantic. Entirely custom-built; no third-party wedding platform dependencies.

---

## Site Pages

| Page | Purpose |
|------|---------|
| **Home / Landing** | Hero with names, date, venue. Quick-access RSVP button + registry link. At least one couple photo — choose from landing-designated photos in `photos/`. |
| **Schedule / Details** | Full wedding-day timeline with venue info. Use placeholder items until finalized. |
| **Registry** | Links/embeds to registries. URL: `https://www.amazon.com/wedding/share/calebandemma2026` |
| **Wedding Party** | Photos, names, and placeholder bios for each wedding party member. |
| **Gallery / Meet the Couple** | Our story + photos pulled dynamically from `photos/` folder. |
| **FAQ** | Placeholder Q&A covering common wedding questions. |
| **RSVP** | See RSVP Security section below. |

All photos live in `/photos` and must be referenced dynamically.

---

## Wordle Gate (Required — Must Ship)

A Wordle-style word game guards access to the entire site. Styled to match the site — playful easter egg, not an obstacle.

- **Answer:** `HABER` (5 letters)
- Standard Wordle rules: 🟩 correct letter + position, 🟨 correct letter + wrong position, ⬜ absent
- 6 attempts
- On solve: guest is admitted to the site
- Gate does not reappear on same session/device — persist unlock state via `localStorage` or cookie

---

## RSVP Security System (Critical)

**Not** a last-name lookup. Evaluate and recommend one of the following, then implement it:

- **Option A — Unique per-guest codes:** Printed on physical invitations. Single-use or tied to a specific guest record. Granular, accurate.
- **Option B — Zip code verification:** Match zip on the mailed invitation. Simpler, less granular.
- **Option C — Hybrid:** Combine elements of A and B.

The chosen approach must support:
1. Generating/storing guest codes or verification data
2. Validating on the RSVP page
3. Tying each submission back to a specific guest record

---

## Admin & Content Management

Simple flat-file-based approach. Must support:

- Updating content: schedule, FAQ, wedding party bios, registry links
- Guest list management: add guests, generate access codes, view who has RSVPed
- Suggest the simplest viable implementation (editable JSON configs, protected admin page, Netlify CMS, etc.)

---

## Technical Preferences

- **Stack:** Self-hostable. Vanilla HTML/CSS/JS or lightweight framework (Next.js or SvelteKit). Make a recommendation with rationale.
- **Hosting:** Free tier. Recommend from Vercel, Netlify, GitHub Pages, etc. Rationale required. Prioritize easy maintenance for a CS grad.
- **Photos:** All in `/photos`, referenced dynamically.
- **Responsive:** Mobile-first.
- **Code quality:** Clean, commented, easy to extend.

---

## Design Direction

- **Aesthetic:** Elegant, minimal, romantic — Zola's visual language
- **Color palette:** Soft neutrals, ivory, sage, or dusty rose (suggestions welcome)
- **Typography:** Serif for headings, clean sans-serif for body
- **Mobile-first responsive**

---

## README Requirements

The repo README must explain:
1. How to update placeholder content
2. How to manage the guest list via the flat file
3. How to deploy the site

---

## Starting Instruction

> Start by proposing the full tech stack, site architecture, hosting recommendation, and flat-file RSVP/storage approach with a brief rationale — then begin building the complete codebase.
