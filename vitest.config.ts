import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Testes de componentes (Vitest + Testing Library em jsdom). O E2E fica no
// Playwright (`e2e/`), fora deste runner.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      env: {
        VITE_API_URL: 'http://api.test/api/v1',
        VITE_APP_NAME: 'Nutri Vision',
        VITE_ENVIRONMENT: 'test',
      },
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
        reporter: ['text', 'lcov'],
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      },
    },
  }),
);
