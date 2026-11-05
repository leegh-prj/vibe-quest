import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 13'], browserName: 'webkit' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('iPhone Safari onboarding, navigation and saved record', async ({ page }) => {
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).tap();
  await page.locator('.choice').first().tap();
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.locator('#idea').fill('아이폰 사파리 테스트');
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('button', { name: /맞춤 로드맵 만들기/ }).tap();
  await page.locator('.step').first().tap();
  await page.locator('#memo').fill('아이폰에서 남긴 학습 기록');
  await page.getByRole('button', { name: /다음 퀘스트/ }).tap();
  await page.getByRole('button', { name: /이전 퀘스트/ }).tap();
  await expect(page.locator('#memo')).toHaveValue('아이폰에서 남긴 학습 기록');
  await page.reload();
  await page.evaluate(() => dashboard());
  await page.locator('.step').first().tap();
  await expect(page.locator('#memo')).toHaveValue('아이폰에서 남긴 학습 기록');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('iPhone Safari offline help and records are tap-friendly', async ({ page }) => {
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).tap();
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.locator('#idea').fill('사파리 탭 테스트');
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('button', { name: /맞춤 로드맵 만들기/ }).tap();
  await page.locator('.step').first().tap();
  await page.locator('#troubleshooting summary').tap();
  await expect(page.locator('#troubleSteps')).toContainText('320px과 375px');
  await page.locator('#troubleType').selectOption('storage');
  await expect(page.locator('#troubleSteps')).toContainText('기존 기록을 먼저 백업');
  const size = await page.locator('#memo').evaluate(x => parseFloat(getComputedStyle(x).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
});
