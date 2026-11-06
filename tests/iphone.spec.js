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
  await expect(page.locator('input[type="checkbox"]').first()).toBeChecked();
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

test('iPhone QA device details and checklist persist independently of learning progress', async ({ page }) => {
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await page.locator('#iphoneModel').fill('iPhone 15 Pro');
  await page.locator('#iphoneIos').fill('iOS 18');
  await page.locator('#iphoneNote').fill('가로 모드에서 확인 필요');
  await page.locator('.iphone-qa-check').first().check();
  await page.reload();
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await expect(page.locator('#iphoneModel')).toHaveValue('iPhone 15 Pro');
  await expect(page.locator('#iphoneIos')).toHaveValue('iOS 18');
  await expect(page.locator('#iphoneNote')).toHaveValue('가로 모드에서 확인 필요');
  await expect(page.locator('.iphone-qa-check').first()).toBeChecked();
  const stored = await page.evaluate(() => ({
    qa: localStorage.getItem('vibequest-iphone-qa-v1'),
    lessons: localStorage.getItem('vibequest-v1')
  }));
  expect(JSON.parse(stored.qa).checks[0]).toBe(true);
  expect(stored.lessons).toBeNull();
});

test('iPhone QA report downloads without resetting the saved learning data', async ({ page }) => {
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await page.locator('#iphoneModel').fill('iPhone SE');
  await page.locator('.iphone-qa-check').nth(2).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '테스트 결과 JSON 다운로드' }).tap()
  ]);
  expect(download.suggestedFilename()).toBe('vibe-quest-iphone-qa.json');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '점검 기록 초기화' }).tap();
  await expect(page.locator('.iphone-qa-check').nth(2)).not.toBeChecked();
  await expect(page.locator('#iphoneModel')).toHaveValue('');
});

test('iPhone QA produces concise share text without treating unchecked items as failures', async ({ page }) => {
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await page.locator('#iphoneModel').fill('iPhone 16');
  await page.locator('#iphoneNote').fill('공유 테스트용 메모');
  await page.locator('.iphone-qa-check').nth(1).check();
  const summary = await page.evaluate(() => iphoneQaSummary());
  expect(summary).toContain('점검: 1/5개 확인');
  expect(summary).toContain('[확인] 퀘스트 버튼');
  expect(summary).toContain('[미확인] 온보딩');
  expect(summary).not.toContain('[실패]');
  expect(summary).toContain('공유 테스트용 메모');
});

test('iPhone QA clipboard fallback shows selectable share text', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, value: undefined });
  });
  await page.reload();
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await page.getByRole('button', { name: '공유용 요약 복사' }).tap();
  await expect(page.locator('#iphoneQaStatus')).toContainText('직접 선택해 복사');
  await expect(page.locator('#iphoneQaShareText')).toBeVisible();
  await expect(page.locator('#iphoneQaShareText')).toHaveValue(/VIBE QUEST 아이폰 수동 QA 결과/);
});

test('iPhone QA issues can be added, updated and restored after reload', async ({ page }) => {
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await page.locator('#issueTitle').fill('아이폰 가로 모드에서 버튼 잘림');
  await page.locator('#issueDetail').fill('가로 회전 후 하단 버튼 확인');
  await page.getByRole('button', { name: 'QA 이슈 등록' }).tap();
  await expect(page.locator('#issueCount')).toContainText('등록 1개 · 미완료 1개');
  const select = page.getByRole('combobox', { name: '아이폰 가로 모드에서 버튼 잘림 처리 상태' });
  await select.selectOption('working');
  await page.reload();
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await expect(page.locator('#issueList')).toContainText('가로 회전 후 하단 버튼 확인');
  await expect(page.getByRole('combobox', { name: '아이폰 가로 모드에서 버튼 잘림 처리 상태' })).toHaveValue('working');
  await page.getByRole('combobox', { name: '아이폰 가로 모드에서 버튼 잘림 처리 상태' }).selectOption('verified');
  await expect(page.locator('#issueCount')).toContainText('등록 1개 · 미완료 0개');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '이슈 목록 JSON 다운로드' }).tap()]);
  expect(download.suggestedFilename()).toBe('vibe-quest-iphone-issues.json');
});

test('iPhone QA issue input is escaped and isolated from learning data', async ({ page }) => {
  await page.getByRole('button', { name: /아이폰 테스트 안내/ }).first().tap();
  await page.locator('#issueTitle').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'QA 이슈 등록' }).tap();
  await expect(page.locator('#issueList img')).toHaveCount(0);
  await expect(page.locator('#issueList')).toContainText('<img src=x onerror=alert(1)>');
  const saved = await page.evaluate(() => ({issue:localStorage.getItem('vibequest-iphone-issues-v1'),learning:localStorage.getItem('vibequest-v1')}));
  expect(JSON.parse(saved.issue)).toHaveLength(1);
  expect(saved.learning).toBeNull();
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: '이슈 삭제' }).tap();
  await expect(page.locator('#issueCount')).toContainText('등록 0개');
});
