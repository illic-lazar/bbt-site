# Big Bad Thai — El Nido

Marketing site for Big Bad Thai, an authentic Thai restaurant in El Nido, Palawan.

- `index.html` — the full responsive homepage (desktop + mobile, swapped by CSS media query at 860px).
- `TKC*.jpg` — web-optimised photos.
- `favicon.png` — site icon.
- Fonts: Brandford (embedded), Google Fonts + Tabler icons (CDN).

## Videos
`hero-video.mp4` and `kitchen-video.mp4` are **not** in this repo (too large for GitHub).
The hero/kitchen `<video>` tags fall back to a poster image until the videos are wired up.
See `../DEPLOY.md` for hosting them on Supabase Storage.

## Deploy
Static site — no build step. Deploys as-is on Vercel (root = this folder). See `../DEPLOY.md`.
