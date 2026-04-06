import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import globals from 'globals'

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  // Warn on hardcoded hex colors in Svelte files
  {
    files: ['**/*.svelte'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3}){1,2}$/]',
          message: 'Avoid hardcoded hex colors — use CSS custom properties instead.',
        },
      ],
    },
  },
  {
    rules: {
      // Relax rules that conflict with common patterns in the codebase
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    rules: {
      // Static routes in SvelteKit don't need resolve()
      'svelte/no-navigation-without-resolve': 'off',
      // Allow keyless each blocks for simple static arrays
      'svelte/require-each-key': 'warn',
      // Allow standard built-ins — Svelte reactive wrappers are optional
      'svelte/prefer-svelte-reactivity': 'off',
      // Allow @html for trusted content (e.g. nav icons)
      'svelte/no-at-html-tags': 'warn',
      // Allow $state + $effect pattern alongside $derived
      'svelte/prefer-writable-derived': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      '**/node_modules/',
      'dist/',
      '**/dist/',
      'build/',
      '**/build/',
      'data/',
      '.svelte-kit/',
      '**/.svelte-kit/',
      'projects/',
      'templates/',
    ],
  },
)
