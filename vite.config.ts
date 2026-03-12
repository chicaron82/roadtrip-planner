import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Custom domain (myexperienceengine.com) serves from root
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'map-vendor'
            if (id.includes('@dnd-kit')) return 'dnd-vendor'
            if (id.includes('framer-motion')) return 'motion-vendor'
            if (id.includes('lucide-react')) return 'icons-vendor'
            return 'vendor'
          }

          if (id.includes('/src/components/Map/')) return 'map-feature'
          if (id.includes('/src/lib/hub-seed-data.ts')) return 'hub-seed'
        },
      },
    },
  },
})
