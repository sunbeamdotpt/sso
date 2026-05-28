import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import deno from '@deno/vite-plugin'

export default defineConfig({
  plugins: [deno(), react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3102',
    },
  },
  build: {
    outDir: 'dist',
  },
})
