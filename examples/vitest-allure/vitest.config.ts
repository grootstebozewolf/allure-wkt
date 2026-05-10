import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['allure-vitest/setup'],
    reporters: [
      'default',
      'allure-vitest/reporter',
    ],
  },
});
