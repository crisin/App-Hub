#!/usr/bin/env node
/**
 * First-run setup — App Hub runs this as postCreate; run it again any time.
 * Cross-platform on purpose: no bash, no PowerShell, same steps on Windows and macOS.
 *
 *   1. check the Rust toolchain (warn, don't fail — the UI half still works)
 *   2. npm install
 *   3. generate platform icons from app-icon.png (tauri-build needs icons/icon.ico)
 *   4. cargo fetch, so the first build doesn't start with a download
 */
import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  // shell on Windows: npm/npx are .cmd shims there
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: isWindows })
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${result.status})`)
}

function has(cmd) {
  return spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: isWindows }).status === 0
}

const rustMissing = ['rustc', 'cargo'].filter((c) => !has(c))
if (rustMissing.length) {
  console.warn(
    `\n⚠ Rust toolchain not found (${rustMissing.join(', ')}). Install it from https://rustup.rs` +
      (isWindows
        ? ' — plus "Desktop development with C++" (MSVC build tools). WebView2 ships with Windows 11.'
        : ' — plus Xcode Command Line Tools: xcode-select --install') +
      '\nThen run: node setup.mjs',
  )
}

run('npm', ['install'])
run('npx', ['tauri', 'icon', 'app-icon.png'])
if (!rustMissing.length) run('cargo', ['fetch'])

console.log('\n✓ Setup done. Start the app with: npm run dev')
