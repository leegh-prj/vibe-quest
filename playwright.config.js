import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173', headless: true },
  webServer: process.env.BASE_URL ? undefined : { command: 'python3 -m http.server 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  retries: 0,
});
