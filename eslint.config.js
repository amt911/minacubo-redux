// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'texturas/**',
      'node_modules/**',
      'coverage/**',
      'graphify-out/**',
      'resources/**',
      // Storybook's own static build output (generated, not source)
      'storybook-static/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...storybook.configs['flat/recommended'],
];
