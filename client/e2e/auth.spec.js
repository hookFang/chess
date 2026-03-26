const { test, expect } = require('@playwright/test');

async function register(page, username, password) {
  await page.goto('/');
  await page.click('button:has-text("Register")'); // switch to Register tab
  await page.fill('input[placeholder="Enter username"]', username);
  await page.fill('input[placeholder="Enter password"]', password);
  await page.click('button[type="submit"]'); // "Create Account"
  await page.waitForURL('/lobby', { timeout: 10000 });
}

async function login(page, username, password) {
  await page.goto('/');
  // Login tab is active by default
  await page.fill('input[placeholder="Enter username"]', username);
  await page.fill('input[placeholder="Enter password"]', password);
  await page.click('button[type="submit"]'); // "Sign In"
  await page.waitForURL('/lobby', { timeout: 10000 });
}

test('User can register and lands on lobby', async ({ page }) => {
  const username = `user_${Date.now()}`;
  await register(page, username, 'testpass123');
  expect(page.url()).toContain('/lobby');
});

test('User can log in after registering', async ({ page }) => {
  const username = `loginuser_${Date.now()}`;
  const password = 'testpass123';

  await register(page, username, password);
  await page.click('button:has-text("Sign out")');
  await page.waitForURL('/', { timeout: 5000 });

  await login(page, username, password);
  expect(page.url()).toContain('/lobby');
});

test('Wrong password shows error', async ({ page }) => {
  const username = `wrongpass_${Date.now()}`;
  await register(page, username, 'correctpass123');
  await page.click('button:has-text("Sign out")');
  await page.waitForURL('/', { timeout: 5000 });

  await page.fill('input[placeholder="Enter username"]', username);
  await page.fill('input[placeholder="Enter password"]', 'wrongpass');
  await page.click('button[type="submit"]');

  const error = page.locator('p').filter({ hasText: /invalid|credentials|wrong/i });
  await expect(error).toBeVisible({ timeout: 3000 });
});

test('Unauthenticated redirected from lobby to home', async ({ page }) => {
  await page.goto('/lobby');
  await expect(page).toHaveURL('/', { timeout: 5000 });
});

test('Unauthenticated redirected from game to home', async ({ page }) => {
  await page.goto('/game/fake-room-id');
  await expect(page).toHaveURL('/', { timeout: 5000 });
});
