# Caleb & Emma Wedding Website

A custom multi-page wedding website for **Caleb Haber** and **Emma Vanden Berg** — October 3, 2026 at Good Hope Presbyterian Church.

Built with [Astro](https://astro.build), hosted on [Netlify](https://netlify.com), with flat-file JSON content and serverless RSVP handling.

## Features

- **Home, Schedule, Registry, Wedding Party, Gallery, FAQ, RSVP** pages
- **Wordle gate** — guests solve a 5-letter puzzle before entering the site
- **Per-party RSVP codes** — unique access codes printed on invitations, validated server-side
- **Admin dashboard** at `/admin` — view RSVPs and export CSV
- **CLI guest manager** — add parties, generate codes, export responses

---

## Local Setup

```bash
npm install
cp .env.example .env   # set ADMIN_PASSWORD
```

### Static pages only (no API)

```bash
npm run dev
```

Opens at [http://localhost:4321](http://localhost:4321). RSVP and admin API routes will not work in this mode.

### Full stack (pages + Netlify Functions + Blobs)

```bash
npm run dev:netlify
```

Opens at [http://localhost:8888](http://localhost:8888) with working `/api/*` routes.

---

## Updating Content

All site copy lives in JSON files under `data/`. Edit these directly — no CMS required. Changes appear after save (dev) or redeploy (production).

| File | What it controls |
|------|------------------|
| `data/site.json` | Couple names, wedding date, venue address |
| `data/schedule.json` | Timeline events and schedule notes |
| `data/registry.json` | Registry links and message |
| `data/wedding-party.json` | Wedding party members (name, role, bio, photo filename) |
| `data/story.json` | "Our Story" sections on the gallery page |
| `data/faq.json` | FAQ questions and answers |

**Example** — update ceremony time in `data/schedule.json`:

```json
{
  "time": "2:30 PM",
  "title": "Ceremony",
  "description": "We will exchange vows surrounded by our favorite people.",
  "location": "Sanctuary"
}
```

---

## Adding Photos

1. Drop images into the `photos/` folder (`.jpg`, `.png`, `.webp`, or `.svg`)
2. Optionally tag them in `photos/manifest.json`:

```json
{
  "photos": [
    {
      "filename": "engagement.jpg",
      "tags": ["landing", "gallery"],
      "alt": "Caleb and Emma at the park"
    }
  ]
}
```

- **`landing`** — used on the home page hero (first tagged photo wins)
- **`gallery`** — included in the gallery grid (all photos are included by default)

Photos are synced to `public/photos/` automatically before dev and build via `npm run sync-photos`.

---

## Guest List Management

Guest data lives in `data/guests.json`. **Never import this file in client-side code** — it contains access codes and is only read by Netlify Functions.

### Add a party

```bash
npm run guests -- add --name "The Smith Family" --size 2 --zip 12345
```

Prints the generated access code — add it to the physical invitation.

### List all parties

```bash
npm run guests -- list
```

### Regenerate a code

```bash
npm run guests -- regenerate-code --id the-smith-family
```

### Export RSVPs from the live site

```bash
ADMIN_PASSWORD=your-password npm run guests -- export-rsvps --url https://yoursite.netlify.app
```

Saves merged data to `data/rsvp-export.json`.

---

## Viewing RSVPs

### Admin dashboard

1. Visit `/admin` on your deployed site
2. Sign in with the `ADMIN_PASSWORD` from your Netlify env vars
3. View the RSVP table or click **Export CSV**

### Test codes (local testing)

Each party in `data/guests.json` has a unique access code. Run `npm run guests -- list` to print all codes. RSVP requires `npm run dev:netlify` (not `npm run dev`).

---

## Deploying to Netlify

1. Push this repo to GitHub
2. In [Netlify](https://app.netlify.com), click **Add new site → Import an existing project**
3. Connect your GitHub repo
4. Build settings (auto-detected from `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Add environment variable:
   - `ADMIN_PASSWORD` — strong password for the admin dashboard
6. Deploy

Netlify Blobs are enabled automatically on Netlify-hosted sites — no extra setup needed for RSVP storage.

### Custom domain

Add your domain under **Site settings → Domain management** in the Netlify dashboard.

---

## Project Structure

```
├── data/               # Flat-file content and guest list
├── photos/             # Source photos (synced to public/photos/)
├── netlify/functions/  # RSVP validation, submission, admin API
├── scripts/            # Photo sync + guest list CLI
├── src/
│   ├── components/     # Nav, Footer, Wordle gate, RSVP form
│   ├── layouts/        # BaseLayout.astro
│   ├── pages/          # All site routes
│   └── styles/         # Design system (globals.css)
├── astro.config.mjs
└── netlify.toml
```

---

## Tech Stack

- **Astro 6** — static site generation
- **Netlify Functions** — server-side RSVP validation
- **Netlify Blobs** — runtime RSVP storage
- **Vanilla JS** — Wordle gate and RSVP form interactivity
- **Flat JSON** — all content and guest list data

---

## Wordle Gate

First-time visitors must solve a Wordle-style puzzle to enter the site. The answer is a 5-letter word related to the couple. Unlock state persists in `localStorage` — guests won't see the gate again on the same device.

To reset locally: open DevTools → Application → Local Storage → delete `wg_unlocked`.
