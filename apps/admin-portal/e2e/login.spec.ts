import { expect, test } from '@playwright/test';
import { login } from './helpers';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_BUSINESS_OWNER_EMAIL, E2E_PASSWORD } from './global-setup';

test('rejects invalid credentials and stays on the login page', async ({ page }) => {
  await login(page, 'nobody@layo.test', 'wrong-password');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/invalid|credentials/i)).toBeVisible();
});

test('an admin sees the admin nav and a real Overview', async ({ page }) => {
  await login(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Deals' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Businesses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Pending deals')).toBeVisible();
});

test('a non-admin sees the business portal, not the admin nav', async ({ page }) => {
  await login(page, E2E_BUSINESS_OWNER_EMAIL, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Business portal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Deals' })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Businesses' })).not.toBeVisible();
});
