# __APP_NAME__

Desktop app for Windows and macOS: Tauri 2 shell, Svelte 5 UI, Rust core crates.
Windows is the reference platform; macOS builds from the same code.

## Layout and layering

```
src/              Svelte 5 UI (runes) — talks to Rust only through Tauri commands
src-tauri/        Tauri shell: windows, commands, plugins, capabilities — keep it thin
crates/core/      app logic — no Tauri types, no window handles, unit-tested
app-icon.png      icon source → `npm run icons` regenerates src-tauri/icons/
setup.mjs         first-run setup (npm install, icons, cargo fetch) — cross-platform
```

Rules:
- Nothing under `crates/` depends on `tauri`. When logic grows inside a command in
  `src-tauri/src/lib.rs`, move it into a crate (new crates go to `crates/<name>`, the
  workspace picks them up automatically).
- The UI never assumes Tauri is present (`npm run dev:web` runs it in a browser).
- New capabilities/plugins: add the permission explicitly in
  `src-tauri/capabilities/default.json` — nothing is allowed implicitly.
- Platform-specific code goes behind `#[cfg(target_os = "...")]` in its own module; a
  missing implementation degrades the feature, it never breaks the build.

## Commands

```bash
node setup.mjs        # first run / after pulling new deps
npm run dev           # tauri dev: Vite + cargo, hot reload for UI, rebuild for Rust
npm run build         # installers: MSI/NSIS on Windows, DMG/.app on macOS
npm run check         # svelte-check + cargo clippy -D warnings + cargo test
npm run test          # cargo test --workspace
npm run dev:web       # UI only, in the browser (no Rust)
```

Prerequisites: Node 20+, Rust via rustup. Windows: MSVC build tools ("Desktop development
with C++"); WebView2 ships with Windows 11. macOS: `xcode-select --install`.

## Notes

- Cargo workspace root is this directory; build output goes to `target/`. Coding-agent
  worktrees share `.worktrees/.cargo-target` (App Hub sets `CARGO_TARGET_DIR`) — don't
  override it inside a task.
- Svelte 5 runes only (`$state`, `$derived`, `$props`), no stores.
- Styling: design tokens as CSS custom properties in `src/app.css`; a theme is a set of
  token values, not code.
