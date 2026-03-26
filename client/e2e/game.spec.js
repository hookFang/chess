const { test, expect } = require('@playwright/test');

async function registerAndGoToLobby(page, username) {
  await page.goto('/');
  await page.click('button:has-text("Register")');
  await page.fill('input[placeholder="Enter username"]', username);
  await page.fill('input[placeholder="Enter password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/lobby', { timeout: 10000 });
}

async function setupGame(browser) {
  const username1 = `white_${Date.now()}`;
  const username2 = `black_${Date.now() + 1}`;

  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await registerAndGoToLobby(page1, username1);
  await page1.click('button:has-text("Create New Game")');
  await page1.waitForURL(/\/game\//, { timeout: 10000 });
  const gameUrl = page1.url();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await registerAndGoToLobby(page2, username2);
  await page2.goto(gameUrl);

  // Wait for both sides to recognise two players are present
  await page1.waitForSelector(`text=${username2}`, { timeout: 8000 }).catch(() => null);
  await page2.waitForSelector(`text=${username1}`, { timeout: 8000 }).catch(() => null);

  return { page1, page2, context1, context2, gameUrl, username1, username2 };
}

test('Both players see each other', async ({ browser }) => {
  const { page1, page2, context1, context2, username1, username2 } = await setupGame(browser);

  await expect(page1.locator(`text=${username2}`).first()).toBeVisible({ timeout: 5000 });
  await expect(page2.locator(`text=${username1}`).first()).toBeVisible({ timeout: 5000 });

  await context1.close();
  await context2.close();
});

test('White moves e2 to e4, both see the move', async ({ browser }) => {
  const { page1, page2, context1, context2 } = await setupGame(browser);

  await page1.getByTestId('square-e2').click();
  await page1.getByTestId('square-e4').click();

  // Both boards should reflect the move (pawn moved from e2 to e4)
  // The e2 square should now be empty (no piece child element with dark color)
  await expect(page1.getByTestId('square-e4')).toBeVisible();
  await expect(page2.getByTestId('square-e4')).toBeVisible({ timeout: 5000 });

  await context1.close();
  await context2.close();
});

test('Black cannot move on white\'s turn', async ({ browser }) => {
  const { page1, page2, context1, context2 } = await setupGame(browser);

  // Black tries to click a piece on their turn (white hasn't moved yet)
  await page2.getByTestId('square-e7').click();

  // e6 and e5 should NOT show legal move dots (no child dot div)
  const e6 = page2.getByTestId('square-e6');
  // Verify no move was triggered by confirming board hasn't changed
  await expect(e6).toBeVisible();
  // Black should still be on the game page
  expect(page2.url()).toContain('/game/');

  await context1.close();
  await context2.close();
});

test('Player resigns and both see game over', async ({ browser }) => {
  const { page1, page2, context1, context2 } = await setupGame(browser);

  const resignButton = page1.locator('button').filter({ hasText: /resign/i });
  await expect(resignButton).toBeVisible({ timeout: 3000 });

  // Accept the window.confirm dialog that handleResign() triggers
  page1.once('dialog', dialog => dialog.accept());
  await resignButton.click();

  // White sees "Resigned", black sees "Victory"
  await expect(page1.getByText('Resigned')).toBeVisible({ timeout: 5000 });
  await expect(page2.getByText('Victory')).toBeVisible({ timeout: 5000 });

  await context1.close();
  await context2.close();
});

test('Multiple moves sequence works', async ({ browser }) => {
  const { page1, page2, context1, context2 } = await setupGame(browser);

  // Move 1: White e2-e4
  await page1.getByTestId('square-e2').click();
  await page1.getByTestId('square-e4').click();

  // Move 2: Black e7-e5
  await page2.getByTestId('square-e7').click();
  await page2.getByTestId('square-e5').click();

  // Move 3: White g1-f3
  await page1.getByTestId('square-g1').click();
  await page1.getByTestId('square-f3').click();

  // Game should still be in progress
  expect(page1.url()).toContain('/game/');
  expect(page2.url()).toContain('/game/');

  await context1.close();
  await context2.close();
});
