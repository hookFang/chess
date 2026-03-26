const { test, expect } = require('@playwright/test');

async function registerAndGoToLobby(page, username) {
  await page.goto('/');
  await page.click('button:has-text("Register")');
  await page.fill('input[placeholder="Enter username"]', username);
  await page.fill('input[placeholder="Enter password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/lobby', { timeout: 10000 });
}

test('Create game redirects to game page', async ({ page }) => {
  await registerAndGoToLobby(page, `lobbyuser_${Date.now()}`);

  await page.click('button:has-text("Create New Game")');
  await page.waitForURL(/\/game\//, { timeout: 10000 });
  expect(page.url()).toContain('/game/');
});

test('Invite link button visible after game creation', async ({ page }) => {
  await registerAndGoToLobby(page, `inviteuser_${Date.now()}`);

  await page.click('button:has-text("Create New Game")');
  await page.waitForURL(/\/game\//, { timeout: 10000 });

  // GamePage should show a copy/share link button
  const inviteButton = page.locator('button').filter({ hasText: /copy|invite|share|link/i });
  await expect(inviteButton).toBeVisible({ timeout: 5000 });
});

test('Second player can join via URL', async ({ browser }) => {
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await registerAndGoToLobby(page1, `player1_${Date.now()}`);
  await page1.click('button:has-text("Create New Game")');
  await page1.waitForURL(/\/game\//, { timeout: 10000 });
  const gameUrl = page1.url();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await registerAndGoToLobby(page2, `player2_${Date.now()}`);
  await page2.goto(gameUrl);

  // Both should be on the same game URL
  expect(page2.url()).toBe(gameUrl);

  // Wait for game to become active on each page independently
  await expect(page1.locator('text=black').first()).toBeVisible({ timeout: 8000 });
  await expect(page2.locator('text=white').first()).toBeVisible({ timeout: 8000 });

  await context1.close();
  await context2.close();
});
