import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // face-api (with TensorFlow.js) is one ~1.3 MB chunk, lazy-loaded on /gallery and /indexer only.
  build: { chunkSizeWarningLimit: 1400 },
  server: { port: 5173 },
})
