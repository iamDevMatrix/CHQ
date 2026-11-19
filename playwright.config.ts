import { defineConfig, devices } from '@playwright/test';

// demo projects: the single-file demo build (dist-demo, file://), no backend.
// live projects: the production code (dist-live) served over http, with Supabase REST answered by tests/e2e/live.spec.ts.
const demoURL = 'file://' + process.cwd() + '/dist-demo/index.html';
const liveURL = 'http://localhost:4173/';
const chrome = { ...devices['Pixel 7'], launchOptions: { executablePath: process.env.CHROME_PATH } };
const iphone = devices['iPhone 14'];

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: { command: 'npx vite preview --outDir dist-live --port 4173 --strictPort', url: liveURL, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'android-chrome', testIgnore: /live\.spec/, use: { ...chrome, baseURL: demoURL } },
    { name: 'iphone-webkit', testIgnore: /live\.spec/, use: { ...iphone, baseURL: demoURL } },
    { name: 'live-android-chrome', testMatch: /live\.spec/, use: { ...chrome, baseURL: liveURL } },
    { name: 'live-iphone-webkit', testMatch: /live\.spec/, use: { ...iphone, baseURL: liveURL } },
  ],
});
