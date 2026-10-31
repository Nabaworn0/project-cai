import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets the same build serve from a sub-folder (e.g. GitHub Pages: /repo-name/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // Our own service worker (src/sw.ts): the page from the web first, the kept one offline.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'WINSTALL · ภารกิจเด็กฝึกงาน ลง Windows 11',
        short_name: 'WINSTALL',
        description: 'เกมฝึกติดตั้ง Windows 11: เด็กฝึกงานที่ร้านซ่อมคอมของพี่ช่าง (โหมดจำลอง)',
        lang: 'th',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1b2a4a',
        theme_color: '#1b2a4a',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Thai + Latin font subsets only; other subsets are never used by the game.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json}', '**/*-{thai,latin}-*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
});
