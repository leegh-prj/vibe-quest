import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function createProject(page, type, description) {
  await page.getByRole('button', { name: /시작하기/ }).first().click();
  await page.getByRole('button', { name: new RegExp(type) }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.locator('#idea').fill(description);
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /로드맵 만들기/ }).click();
  await expect(page.getByText(description).first()).toBeVisible();
}

test('new project does not overwrite earlier project', async ({ page }) => {
  await createProject(page, '웹사이트', '웹 포트폴리오');
  await page.getByRole('button', { name: /새 프로젝트 시작/ }).click();
  await page.getByRole('button', { name: /게임/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.locator('#idea').fill('퍼즐 게임');
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /로드맵 만들기/ }).click();
  await page.getByRole('button', { name: /프로젝트 관리/ }).click();
  await expect(page.getByText('웹 포트폴리오')).toBeVisible();
  await expect(page.getByText('퍼즐 게임')).toBeVisible();
});

test('quest completion requires knowledge check and evidence', async ({ page }) => {
  await createProject(page, '웹사이트', '웹 포트폴리오');
  await page.getByRole('button', { name: /첫 퀘스트|프로젝트 목표/ }).first().click();
  await page.getByRole('button', { name: /완료하고 다음/ }).click();
  await expect(page.getByText(/먼저 이해도 확인 문제/)).toBeVisible();
});

test('backup is valid JSON with projects', async ({ page }) => {
  await createProject(page, '웹사이트', '나의 사이트');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /전체 기록 백업/ }).click();
  await page.getByRole('button', { name: /백업 파일 다운로드/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vibe-quest-backup.json');
});
