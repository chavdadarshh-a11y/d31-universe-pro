# D31.UNIVERSE

**Real biomechanics. No guesswork.**

**D31.UNIVERSE** is a human performance and biomechanics OS created by **Darshan Chavda**. It is completely distinct from astronomy or M31 galaxies:

- **D** = Darshan
- **31** = Birth Date
- **UNIVERSE** = The Human Body (*Brahmand*) — built to accept any physical challenge with unique, science-backed training.

### Training Layers
- **Range:** Mobility & Flexibility
- **Control:** Calisthenics, Balance & Movement
- **Force:** Strength, Powerlifting & Bodybuilding
- **Expression:** Boxing & Conditioning

Live Web App: https://chavdadarshh-a11y.github.io/d31-universe-pro/

### Site address & custom domain

The site address lives in **one place**: `site.config.json` → `siteUrl` (now `https://chavdadarshh-a11y.github.io/d31-universe-pro/`).
At build time it sets the Vite base path, `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`, the JSON-LD `url`,
`robots.txt` and `sitemap.xml` (both generated, not in `public/`), the privacy-page canonical, referral/share links, the
service-worker scope and the Knowledge feed path. The web manifest uses relative paths, so it follows automatically.
Beta and preview builds keep their sub-folders (`VITE_SUBPATH=beta`, or the older `VITE_BASE` override).

To move to a custom domain (for example `https://d31universe.com/`):

1. Change `siteUrl` in `site.config.json` to `https://d31universe.com/` and push to `main`. The build then also writes a
   `CNAME` file (`d31universe.com`) so GitHub Pages keeps the domain on every deploy.
2. At your domain registrar add DNS records for GitHub Pages: `A` records for the apex
   (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153) and/or a `CNAME` record `www → chavdadarshh-a11y.github.io`.
3. GitHub → repo **Settings → Pages → Custom domain**: enter the domain, wait for the DNS check, then tick **Enforce HTTPS**.
4. Search Console: add the new domain as a property (the existing `google-site-verification` tag keeps working) and submit
   `https://d31universe.com/sitemap.xml`.
5. Android app (TWA) only: update the host / URLs in `android-twa/twa-manifest.json` and `assetlinks.json`, then rebuild the app.

One-off builds elsewhere (Netlify / Vercel) can override it without editing the file: `VITE_SITE_URL=https://example.com/ npm run build`.
