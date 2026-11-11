const { test, expect } = require('@playwright/test');

test('Home creates a game', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Create Game")');
  await page.waitForURL(/\/game\//, { timeout: 10000 });
});

test('Creator sees an invite link while waiting', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Create Game")');
  await page.waitForURL(/\/game\//, { timeout: 10000 });

  const link = page.locator('input[readonly]');
  await expect(link).toHaveValue(page.url());
  await expect(page.locator('button').filter({ hasText: /copy invite/i })).toBeVisible();
});

test('Unknown game link shows not found', async ({ page }) => {
  await page.goto('/game/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('Game not found')).toBeVisible({ timeout: 5000 });
});

test('Unknown routes go home', async ({ page }) => {
  await page.goto('/some/unknown/path');
  await expect(page.locator('button:has-text("Create Game")')).toBeVisible();
});
