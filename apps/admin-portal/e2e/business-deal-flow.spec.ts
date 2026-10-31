import { expect, test } from '@playwright/test';
import { login, signOut } from './helpers';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_BUSINESS_OWNER_EMAIL, E2E_PASSWORD } from './global-setup';

// A single, ordered walk through Phase 4's full moderation loop: register → admin approves →
// submit a deal → admin approves that too. Each run uses a uniquely-named business/deal so it
// never collides with a previous run's leftovers (there's no delete endpoint for either — status
// transitions only — so old E2E rows just accumulate harmlessly in local dev data).
test.describe.configure({ mode: 'serial' });

const runId = Date.now();
const businessName = `E2E Test Business ${runId}`;
const dealTitle = `E2E Test Deal ${runId}`;

test('business owner registers a new business', async ({ page }) => {
  await login(page, E2E_BUSINESS_OWNER_EMAIL, E2E_PASSWORD);

  const existingRegisterButton = page.getByRole('button', { name: /Register (your|another) business/ });
  await existingRegisterButton.click();

  await page.getByLabel('Business name').fill(businessName);
  await page.getByLabel('Category').selectOption('DUTY_FREE');
  await page.getByLabel('Airport (IATA)').fill('DXB');
  await page.getByLabel('Contact email').fill(`${runId}@e2e-test.example`);
  await page.getByRole('button', { name: 'Submit for approval' }).click();

  const card = page.getByTestId('business-card').filter({ hasText: businessName });
  await expect(card).toContainText('PENDING');

  await signOut(page);
});

test('admin approves the pending business', async ({ page }) => {
  await login(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  await page.goto('/dashboard/businesses');

  const row = page.locator('li', { hasText: businessName });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(row).toHaveCount(0); // leaves the PENDING-filtered list once approved

  await page.getByRole('button', { name: 'APPROVED' }).click();
  await expect(page.locator('li', { hasText: businessName })).toContainText('APPROVED');

  await signOut(page);
});

test('business owner submits a deal for the now-approved business', async ({ page }) => {
  await login(page, E2E_BUSINESS_OWNER_EMAIL, E2E_PASSWORD);

  const card = page.getByTestId('business-card').filter({ hasText: businessName });
  await expect(card).toContainText('APPROVED');
  await card.getByRole('button', { name: 'New deal' }).click();

  await page.getByLabel('Title').fill(dealTitle);
  await page.getByLabel('Description').fill('Created by the Playwright E2E suite.');
  await page.getByLabel('Valid from').fill('2026-01-01');
  await page.getByLabel('Valid until').fill('2027-01-01');
  await page.getByRole('button', { name: 'Submit for review' }).click();

  await expect(page.getByText(dealTitle)).toBeVisible();

  await signOut(page);
});

test('admin approves the pending deal', async ({ page }) => {
  await login(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  await page.goto('/dashboard/deals');

  const row = page.locator('li', { hasText: dealTitle });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(row).toHaveCount(0); // leaves the PENDING-filtered list once approved

  await page.getByRole('button', { name: 'APPROVED' }).click();
  await expect(page.locator('li', { hasText: dealTitle })).toContainText('APPROVED');
});
