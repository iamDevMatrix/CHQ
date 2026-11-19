import { defineConfig, devices } from '@playwright/test';

// Production build (dist/) against a real local Supabase stack. Run via scripts/test-supabase.sh, which
// starts the stack, resets the database and builds with the stack's URL and key.
export default defineConfig({
  testDir: 'tests/supabase',
  workers: 1,
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4174/', launchOptions: { executablePath: process.env.CHROME_PATH } },
  webServer: { command: 'npx vite preview --outDir dist --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: false },
});
