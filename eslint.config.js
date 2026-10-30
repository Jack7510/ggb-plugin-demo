/** Code style is inherited from gts; local rules only strengthen the guide. */
import gts from 'gts';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.runtime*/**',
      '.pnpm-store/**',
      'output/**',
    ],
  },
  ...gts,
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    rules: {
      curly: ['error', 'all'],
    },
  },
  {files: ['**/*.ts'], rules: {'@typescript-eslint/ban-ts-comment': 'error'}},
  {
    files: ['eslint.config.js', 'scripts/*.mjs', 'viewer/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly',
        GGBApplet: 'readonly',
        DOMParser: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
];
