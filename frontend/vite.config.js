import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Frontend nikahyuk: React 19 + Tailwind CSS 4.
//
// Saat dev, request ke /api di-proxy ke backend Laravel (php artisan serve di
// port 8010) supaya bebas CORS. Untuk deploy, set VITE_API_BASE_URL ke origin
// API yang sebenarnya.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev server diakses dari luar localhost (tunnel Cloudflare / Tailscale serve).
    // Vite blokir Host header yang tak dikenal; daftar sufiks ini membukanya
    // tanpa mematikan proteksi DNS-rebinding sepenuhnya.
    allowedHosts: ['.trycloudflare.com', '.ts.net', '.pujin.my.id'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
      // Foto undangan: public/storage (symlink ke storage/app/public).
      '/storage': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
})
