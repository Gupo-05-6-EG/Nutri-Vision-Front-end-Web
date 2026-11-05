import { defineConfig, devices } from '@playwright/test';

// E2E do fluxo principal do painel (Task 7.4, parte 4/4).
//
// Roda contra o build de producao (`vite build` + `vite preview`). A API e
// interceptada no navegador (`page.route`) em `http://api.test`, entao o teste
// nao depende do back-end no ar e e deterministico no CI.
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_API_URL: 'http://api.test/api/v1',
      VITE_APP_NAME: 'Nutri Vision',
      VITE_ENVIRONMENT: 'e2e',
    },
  },
});
