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

test('iPhone testing guide opens with actionable checklist and backup link', async ({ page }) => {
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).tap();
  await expect(page.getByRole('heading', { name: /아이폰 테스트 안내/ })).toBeVisible();
  await expect(page.getByText('홈 화면에 추가')).toBeVisible();
  await expect(page.getByText(/로컬 저장소에 보관됩니다/)).toBeVisible();
  const checks = page.locator('input[type="checkbox"]');
  await expect(checks).toHaveCount(5);
  await checks.first().check();
  await expect(checks.first()).toBeChecked();
  await page.getByRole('button', { name: '학습 기록 백업·복원', exact: true }).tap();
  await expect(page.getByRole('heading', { name: '학습 기록 백업·복원' })).toBeVisible();
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).tap();
  await expect(page.getByRole('heading', { name: /아이폰 테스트 안내/ })).toBeVisible();
  await expect(page.locator('input[type="checkbox"]').first()).not.toBeChecked();
});

test('iPhone Safari testing guide fits narrow and landscape viewports', async ({ page }) => {
  for (const viewport of [{width:375,height:667},{width:430,height:932},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
    const result = await page.evaluate(() => ({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));
    expect(result.documentWidth).toBeLessThanOrEqual(result.width);
    await expect(page.getByText('홈 화면에 추가')).toBeVisible();
    await page.getByRole('button', { name: /홈으로/ }).tap();
  }
});
