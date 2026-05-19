import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'texturas/**',
        'coverage/**',
        'resources/**',
        '**/*.config.js',
        '**/*.test.js',
      ],
    },
  },
});
