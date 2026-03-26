const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    cwd: require('path').resolve(__dirname, '..'),
    env: {
      NODE_ENV: 'production',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'chessdb_test',
      DB_USER: 'chess',
      DB_PASSWORD: 'chesspass',
      JWT_SECRET: 'test-secret-key',
      PORT: '3001',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
