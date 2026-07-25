# PersonaTrace

An OSINT intelligence platform prototype built with Next.js 14, TypeScript, and Zustand.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Real Functionality

The app performs actual API checks:

| Source | What it checks |
|---|---|
| **GitHub API** | Real username existence, followers, repos, bio, location |
| **Reddit API** | Real username existence, karma, account age |
| **npm Registry** | Package author username lookup |
| **Nominatim (OpenStreetMap)** | Reverse geocoding of EXIF GPS coordinates |
| **exifr** | Client-side EXIF extraction (GPS, device, camera, timestamps) |

Other platforms (Instagram, LinkedIn, TikTok, X, etc.) are simulated with deterministic, seed-based data since they require authentication or block scraping.

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project
3. Select your repo — Vercel auto-detects Next.js
4. *(Optional)* Add `GITHUB_TOKEN` in Vercel's Environment Variables to increase GitHub API rate limit to 5,000 req/hr

## Environment Variables

See `.env.example` for all available variables.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand (with localStorage persistence)
- **EXIF**: exifr (client-side image metadata extraction)
- **Deployment**: Vercel
