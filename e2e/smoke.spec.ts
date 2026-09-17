import { test, expect } from '@playwright/test';

// One smoke spec per AGENTS.md's own bar for E2E on this stack: the game has no
// backend and no isolatable flows beyond "it boots" — assert the page loads, the
// WebGL canvas Three.js renders into is present, and nothing logged a console error.
test('the game boots: canvas renders, no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');

  // index.html's #c is the canvas MyScene.js renders the Three.js scene into.
  const canvas = page.locator('#c');
  await expect(canvas).toBeAttached();

  // Give MyScene.js a moment to construct the scene and render at least one frame.
  await page.waitForTimeout(2000);

  expect(consoleErrors).toEqual([]);
});
