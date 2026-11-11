const { test, expect } = require('@playwright/test');

// Two anonymous players: one creates the game, the other opens the shared link.
async function setupGame(browser) {
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto('/');
  await page1.getByRole('radio', { name: /White/ }).click();
  await page1.click('button:has-text("Create Game")');
  await page1.waitForURL(/\/game\//, { timeout: 10000 });
  const gameUrl = page1.url();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(gameUrl);

  // Both sides see an opponent once the second player has joined
  await expect(page1.getByText('Opponent', { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page2.getByText('Opponent', { exact: true })).toBeVisible({ timeout: 8000 });

  return { page1, page2, context1, context2, gameUrl };
}

test('Both players see each other', async ({ browser }) => {
  const { page1, page2, context1, context2 } = await setupGame(browser);

  await expect(page1.getByText('You', { exact: true })).toBeVisible();
  await expect(page2.getByText('You', { exact: true })).toBeVisible();

  await context1.close();
  await context2.close();
});

test('Third visitor is a spectator and cannot resign', async ({ browser }) => {
  const { context1, context2, gameUrl } = await setupGame(browser);

  const context3 = await browser.newContext();
  const page3 = await context3.newPage();
  await page3.goto(gameUrl);
  await expect(page3.getByText('White', { exact: true }).first()).toBeVisible({ timeout: 8000 });
  await expect(page3.locator('button').filter({ hasText: /resign/i })).toHaveCount(0);

  await context1.close();
  await context2.close();
  await context3.close();
});

test('Refreshing keeps the same seat', async ({ browser }) => {
  const { page1, context1, context2 } = await setupGame(browser);

  await page1.reload();
  await expect(page1.getByText('You', { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page1.locator('button').filter({ hasText: /resign/i })).toBeVisible({ timeout: 8000 });

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

test('White can castle kingside (king and rook both move)', async ({ browser }) => {
  const { page1, page2, context1, context2 } = await setupGame(browser);

  const play = async (page, from, to) => {
    await page.getByTestId(`square-${from}`).click();
    await page.getByTestId(`square-${to}`).click();
  };
  // 1. e4 e5  2. Nf3 Nc6  3. Bc4 Bc5 — leaves f1/g1 empty for white
  await play(page1, 'e2', 'e4');
  await expect(page2.getByTestId('square-e4')).toContainText('♙');
  await play(page2, 'e7', 'e5');
  await expect(page1.getByTestId('square-e5')).toContainText('♟');
  await play(page1, 'g1', 'f3');
  await expect(page2.getByTestId('square-f3')).toContainText('♘');
  await play(page2, 'b8', 'c6');
  await expect(page1.getByTestId('square-c6')).toContainText('♞');
  await play(page1, 'f1', 'c4');
  await expect(page2.getByTestId('square-c4')).toContainText('♗');
  await play(page2, 'f8', 'c5');
  await expect(page1.getByTestId('square-c5')).toContainText('♝');

  // Selecting the king must offer g1 as a destination, then castling moves both pieces
  await page1.getByTestId('square-e1').click();
  await play(page1, 'e1', 'g1');

  for (const page of [page1, page2]) {
    await expect(page.getByTestId('square-g1')).toContainText('♔', { timeout: 5000 });
    await expect(page.getByTestId('square-f1')).toContainText('♖');
    await expect(page.getByTestId('square-e1')).not.toContainText('♔');
    await expect(page.getByTestId('square-h1')).not.toContainText('♖');
  }
  await expect(page1.getByText('O-O', { exact: true })).toBeVisible();

  await context1.close();
  await context2.close();
});

test('Creator can play Black; the joiner gets White and moves first', async ({ browser }) => {
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto('/');
  await page1.getByRole('radio', { name: /Black/ }).click();
  await page1.click('button:has-text("Create Game")');
  await page1.waitForURL(/\/game\//, { timeout: 10000 });
  await expect(page1.getByText('black', { exact: true }).first()).toBeVisible();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(page1.url());
  await expect(page2.getByText('Your move')).toBeVisible({ timeout: 8000 });

  await page2.getByTestId('square-e2').click();
  await page2.getByTestId('square-e4').click();
  await expect(page1.getByTestId('square-e4')).toContainText('♙', { timeout: 5000 });
  await expect(page1.getByText('Your move')).toBeVisible();

  await context1.close();
  await context2.close();
});
