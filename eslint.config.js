import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['libs/**', 'texturas/**', 'node_modules/**', 'coverage/**', 'graphify-out/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        THREE: 'readonly',
        TWEEN: 'readonly',
        $: 'readonly',
        jQuery: 'readonly',
        noise: 'readonly',
        Stats: 'readonly',
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
];
