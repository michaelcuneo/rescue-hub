import { test, expect } from '@playwright/test';

test('public sign-in and documentation are reachable and focus indicators work', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const email = page.getByLabel('Email');
  await email.focus();
  await expect(email).toBeFocused();
  await page.goto('/documentation');
  await expect(page.locator('main')).toBeVisible();
});

test('demo workspace and administration dialogs handle Escape and focus', async ({ page }) => {
  test.skip(!process.env.RESCUE_E2E_EMAIL || !process.env.RESCUE_E2E_PASSWORD,
    'Configure read-only smoke credentials RESCUE_E2E_EMAIL / RESCUE_E2E_PASSWORD in GitHub secrets');
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.RESCUE_E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.RESCUE_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.goto('/admin');
  const invite = page.getByRole('button', { name: /Invite person/i });
  test.skip(!(await invite.isVisible().catch(() => false)), 'Account has no invite permission');
  await invite.click();
  const dialog = page.getByRole('dialog', { name: 'Invite a person' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close invitation' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(invite).toBeFocused();
});

test('chat mentions support keyboard dismissal without sending a message', async ({ page }) => {
  test.skip(!process.env.RESCUE_E2E_EMAIL || !process.env.RESCUE_E2E_PASSWORD,
    'Requires fake-data demo account credentials');
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.RESCUE_E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.RESCUE_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/chats');
  const firstChat = page.locator('.chat-list-tabs + button, aside button.animal-channel').first();
  test.skip(!(await firstChat.isVisible().catch(() => false)), 'Demo account has no accessible channel');
  await firstChat.click();
  const compose = page.locator('#chat-message');
  await expect(compose).toBeVisible();
  await compose.fill('@pos');
  await expect(page.locator('#chat-mention-guidance')).toHaveAttribute('aria-live', 'polite');
  await page.keyboard.press('Escape');
  await expect(page.locator('#chat-mention-options')).toHaveCount(0);
  await expect(compose).toHaveValue('@pos');
  // No submissions: this suite never sends messages or changes rescue records.
});
