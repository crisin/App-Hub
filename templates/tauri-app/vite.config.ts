import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Tauri sets TAURI_DEV_HOST when developing against a device on the network
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [svelte()],
  // keep Rust compiler errors visible in the terminal
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    // Rust sources are watched by tauri dev, not by vite
    watch: { ignored: ['**/src-tauri/**', '**/crates/**', '**/target/**', '**/.worktrees/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // WebView2 (Windows) is Chromium; WKWebView (macOS) is Safari
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
