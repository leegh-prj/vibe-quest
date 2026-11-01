import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function createProject(page, type, description, fresh = false) {
  if (fresh) await page.getByRole('button', { name: /새 프로젝트 시작/ }).click();
  else await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
  await page.locator('.choice').filter({ hasText: type }).first().click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.locator('#idea').fill(description);
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /맞춤 로드맵 만들기/ }).click();
  await expect(page.getByText(description).first()).toBeVisible();
}

test('projects remain independent across switching and reload', async ({ page }) => {
  await createProject(page, '웹사이트', '웹 포트폴리오');
  await createProject(page, '게임', '퍼즐 게임', true);
  await page.getByRole('button', { name: /프로젝트 관리/ }).click();
  await expect(page.getByText('웹 포트폴리오')).toBeVisible();
  await expect(page.getByText('퍼즐 게임')).toBeVisible();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(original.projects.length).toBeGreaterThanOrEqual(2);
  await page.reload();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(after.projects.length).toBe(original.projects.length);
});

test('quest requires knowledge confirmation before completion', async ({ page }) => {
  await createProject(page, '웹사이트', '웹 포트폴리오');
  await page.locator('.step').first().click();
  await page.getByRole('button', { name: /완료.*다음/ }).click();
  await expect(page.locator('#feedback')).toContainText('먼저 이해도 확인 문제');
});

test('autosaves quest evidence and notes across reload', async ({ page }) => {
  await createProject(page, '웹사이트', '학습 기록 테스트');
  await page.locator('.step').first().click();
  await page.locator('#memo').fill('메뉴를 수정해서 겹침 현상을 해결했습니다.');
  await page.locator('#result').fill('https://example.com');
  await page.reload();
  await page.evaluate(() => dashboard());
  await page.locator('.step').first().click();
  await expect(page.locator('#memo')).toHaveValue('메뉴를 수정해서 겹침 현상을 해결했습니다.');
  await expect(page.locator('#result')).toHaveValue('https://example.com');
});

test('downloaded backup is a JSON file', async ({ page }) => {
  await createProject(page, '웹사이트', '나의 사이트');
  await page.getByRole('button', { name: /전체 기록 백업/ }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /백업 파일 다운로드/ }).click();
  expect((await downloaded).suggestedFilename()).toBe('vibe-quest-backup.json');
});
