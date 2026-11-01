import { defineConfig, devices } from '@playwright/test';

// Runs against the production build (vite preview) so the service worker and offline mode are real.
/** The teacher's page's PIN in the tests' build (tests/helpers.ts openTeacher). */
export const TEACHER_PIN = 'test-pin-2468';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // Always a fresh build: reusing a server left running could test a stale bundle.
    reuseExistingServer: false,
    timeout: 180_000,
    // The teacher's page asks this PIN in the tests' build (src/teacher/PinGate.tsx); the real build uses pin.json.
    env: { VITE_TEACHER_PIN_TEST: TEACHER_PIN },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'small-phone', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 640 } } },
    { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
