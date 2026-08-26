import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

export default defineConfig({
  // Vite only exposes VITE_-prefixed env vars to import.meta.env by default; this repo's
  // Firebase config is deliberately named without that prefix (FIREBASE_*, matching what's
  // set in Vercel), so FIREBASE_ has to be added explicitly. VITE_ is kept alongside it so
  // the default convention still works too, in case anything else ever needs it.
  envPrefix: ['FIREBASE_', 'VITE_'],
  resolve: {
    alias: {
      '@shared': resolve(import.meta.dirname, 'src/shared')
    }
  },
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [react()]
})
