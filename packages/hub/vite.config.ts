import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5174,
  },
  // Exclude native Node modules from Vite bundling — they must be loaded at runtime
  ssr: {
    external: ['better-sqlite3'],
  },
})
