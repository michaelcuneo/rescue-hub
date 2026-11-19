import { defineConfig, devices } from '@playwright/test';

const target = process.env.RESCUE_E2E_BASE_URL ?? 'https://rescue.michaelcuneo.com.au';
if (new URL(target).origin !== 'https://rescue.michaelcuneo.com.au') {
  throw new Error('Rescue Hub browser smoke is restricted to the fake-data demo domain.');
}
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 1,
  use: {
    baseURL: target, trace: 'retain-on-failure',
    screenshot: 'only-on-failure', video: 'off'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: '200-percent-zoom', use: { ...devices['Desktop Chrome'], viewport: { width: 720, height: 450 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }
  ],
  reporter: [['list']],
  outputDir: 'test-results/browser'
});
