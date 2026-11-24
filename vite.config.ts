import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

/**
 * ONE value decides where the site lives: `siteUrl` in site.config.json (or VITE_SITE_URL for a one-off build).
 * It drives: Vite base path, canonical / og:url / og:image / JSON-LD, robots.txt + sitemap.xml (generated here),
 * privacy.html canonical, share links (src/config/site.ts), the service-worker scope (registered at BASE_URL),
 * the manifest (relative start_url/scope) and the CNAME file for a custom domain. See README → "Custom domain".
 * Beta / preview builds add a sub-folder with VITE_SUBPATH=beta (or the older VITE_BASE override).
 */
const slash = (s: string) => (s.endsWith('/') ? s : `${s}/`)
const site = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'site.config.json'), 'utf8')) as { siteUrl: string }
const SITE_URL = slash(process.env.VITE_SITE_URL?.trim() || site.siteUrl)
const SITE = new URL(SITE_URL)
const SUB = (process.env.VITE_SUBPATH || '').replace(/^\/+|\/+$/g, '')
const BASE = slash(process.env.VITE_BASE || `${SITE.pathname}${SUB ? `${SUB}/` : ''}`)
const APP_URL = `${SITE.origin}${BASE}` // absolute URL of THIS build (live, /beta/ or /preview/)
const IS_MAIN = BASE === slash(SITE.pathname) // the public site (not a beta / preview sub-folder)
const CUSTOM_DOMAIN = !SITE.hostname.endsWith('.github.io') && SITE.pathname === '/'

function d31Site(): Plugin {
  let outDir = 'dist'
  const fill = (s: string) => s.replaceAll('{{APP_URL}}', APP_URL).replaceAll('{{SITE_URL}}', SITE_URL)
  return {
    name: 'd31-site',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir) },
    transformIndexHtml: { order: 'pre', handler: (html) => fill(html) },
    generateBundle() {
      const robots = IS_MAIN ? `User-agent: *\nAllow: /\n\nSitemap: ${APP_URL}sitemap.xml\n` : 'User-agent: *\nDisallow: /\n'
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      if (IS_MAIN) {
        const day = new Date().toISOString().slice(0, 10)
        const url = (loc: string, pr: string) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${day}</lastmod>\n    <priority>${pr}</priority>\n  </url>\n`
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${url(APP_URL, '1.0')}${url(`${APP_URL}privacy.html`, '0.3')}</urlset>\n` })
      }
      if (IS_MAIN && CUSTOM_DOMAIN) this.emitFile({ type: 'asset', fileName: 'CNAME', source: `${SITE.hostname}\n` })
    },
    closeBundle() { // public/ files are copied verbatim — fill their placeholders too
      for (const f of ['privacy.html']) {
        const p = path.join(outDir, f)
        if (fs.existsSync(p)) fs.writeFileSync(p, fill(fs.readFileSync(p, 'utf8')))
      }
    },
  }
}

export default defineConfig({
  base: BASE,
  define: { __D31_SITE__: JSON.stringify({ siteUrl: SITE_URL, appUrl: APP_URL, sitePath: slash(SITE.pathname) }) },
  plugins: [d31Site(), react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
})
