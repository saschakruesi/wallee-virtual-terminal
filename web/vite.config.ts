import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

/**
 * Content-Security-Policy for the production build. It is injected at build time
 * only, because the Vite dev server needs inline scripts for HMR / React Refresh.
 * frame-ancestors is not valid in <meta>; the Go helper sends X-Frame-Options: DENY instead.
 * `connect-src 'self'` covers the helper proxy (`/wallee/*`). If the frontend is
 * ever built for direct API access (VITE_API_BASE), that origin is added here.
 */
function csp(): Plugin {
  const apiBase = process.env.VITE_API_BASE
  const connect = ["'self'"]
  if (apiBase && /^https?:\/\//.test(apiBase)) connect.push(new URL(apiBase).origin)
  const policy = [
    "default-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'wvt-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), csp()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // Dev only: mirrors what the Go helper does in production.
      '/wallee': {
        target: 'https://app-wallee.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/wallee/, '/api/v2.0'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            proxyReq.removeHeader('cookie')
          })
        },
      },
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
