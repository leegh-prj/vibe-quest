import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('close', () => { if (errors.length) console.error('Browser errors:', errors.join(' | ')); });
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

test('invalid backup does not replace existing project data', async ({ page }) => {
  await createProject(page, '웹사이트', '복원 보호 테스트');
  await page.getByRole('button', { name: /전체 기록 백업/ }).click();
  const before = await page.evaluate(() => localStorage.getItem('vibequest-v1'));
  await page.locator('#backupFile').setInputFiles({
    name: 'bad-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      format: 'vibequest-backup', version: 1,
      data: { type: 'web', description: '손상된 백업', done: [], projects: [{ type: 'wrong', description: 'bad', done: [] }] }
    }))
  });
  await expect(page.locator('#restoreStatus')).toContainText('올바른 VIBE QUEST 백업 파일');
  const after = await page.evaluate(() => localStorage.getItem('vibequest-v1'));
  expect(after).toBe(before);
});

test('malformed saved state does not crash landing page', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('vibequest-v1', JSON.stringify({
    type: 'invalid', done: null, evidence: null, notes: [], criteria: 'broken',
    aiHistory: null, projects: [{ type: 'missing', done: [] }]
  })));
  await page.reload();
  await expect(page.getByRole('button', { name: /새 프로젝트 시작하기/ })).toBeVisible();
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
  await expect(page.locator('.choice').first()).toBeVisible();
});

test('QA checklist persists after project reload', async ({ page }) => {
  await createProject(page, '웹사이트', 'QA 저장 검증');
  await page.locator('.step').first().click();
  await page.locator('.qa-check').first().check();
  await expect(page.locator('#qaCount')).toContainText('1 /');
  await page.reload();
  await page.evaluate(() => dashboard());
  await page.locator('.step').first().click();
  await expect(page.locator('.qa-check').first()).toBeChecked();
});

test('narrow mobile layout has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await createProject(page, '웹사이트', '모바일 점검');
  await page.locator('.step').first().click();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport + 2);
});

test('all five tracks show their own exercise guidance', async ({ page }) => {
  for (const type of ['웹사이트','웹앱·모바일 앱','게임','AI 도구·자동화','범용 학습']) {
    await page.goto('/');
    await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
    await page.locator('.choice').filter({ hasText: type }).first().click();
    await page.getByRole('button', { name: /다음/ }).click();
    await page.locator('#idea').fill(type + ' 테스트');
    await page.getByRole('button', { name: /다음/ }).click();
    await page.getByRole('button', { name: /다음/ }).click();
    await page.getByRole('button', { name: /맞춤 로드맵 만들기/ }).click();
    await page.locator('.step').first().click();
    await expect(page.locator('.track-guide')).toBeVisible();
    await expect(page.locator('.track-guide')).toContainText('맞춤 실습');
  }
});

test('quest completion cannot proceed when storage is blocked', async ({ page }) => {
  await createProject(page, '웹사이트', '저장 공간 테스트');
  await page.locator('.step').first().click();
  const correct = await page.evaluate(() => LESSON_LIBRARY[0].correct);
  await page.locator('.quiz-option').nth(correct).click();
  await page.locator('.verify').evaluateAll(nodes => nodes.forEach(el => {el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true }))}));
  await page.locator('#result').fill('https://example.com/project');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__originalSetItem = original;
    Storage.prototype.setItem = function () { throw new DOMException('quota exceeded', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: /완료하고 다음/ }).click();
  await expect(page.locator('#feedback')).toContainText('저장');
  expect(await page.evaluate(() => data.done[0])).not.toBe(true);
});

test('complete all seven quests with valid evidence and retain progress after reload', async ({ page }) => {
  await createProject(page, '웹사이트', '7단계 완주 시나리오');
  await page.locator('.step').first().click();
  for (let i = 0; i < 7; i++) {
    await expect(page.getByText('QUEST ' + (i + 1) + ' / 7')).toBeVisible();
    const answer = await page.evaluate(i => LESSON_LIBRARY[i].correct, i);
    await page.locator('.quiz-option').nth(answer).click();
    for (const checkbox of await page.locator('.verify').all()) await checkbox.check();
    await page.locator('#result').fill('https://example.com/step-' + (i + 1));
    await page.locator('#memo').fill('브라우저에서 실제 결과를 점검했습니다.');
    await page.getByRole('button', { name: /완료하고 다음/ }).click();
  }
  await expect(page.getByText('실전 7단계 완주!')).toBeVisible();
  await page.reload();
  await page.evaluate(() => dashboard());
  await expect(page.getByText('완료 7 / 7 퀘스트')).toBeVisible();
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(completed.done.filter(Boolean)).toHaveLength(7);
  expect(Object.keys(completed.quizPassed).filter(key => completed.quizPassed[key])).toHaveLength(7);
});

test('backup then restore preserves progress and current project', async ({ page }) => {
  await createProject(page, '웹사이트', '백업 왕복 시나리오');
  await page.locator('.step').first().click();
  await page.locator('#memo').fill('왕복 테스트 메모');
  await page.getByRole('button', { name: /내 로드맵/ }).click();
  await page.getByRole('button', { name: /전체 기록 백업/ }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: /백업 파일 다운로드/ }).click();
  const download = await downloadEvent;
  const temp = await download.path();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  await page.evaluate(() => localStorage.clear());
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#backupFile').setInputFiles(temp);
  await expect(page.getByText('백업 왕복 시나리오').first()).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(restored.notes['0']).toEqual(saved.notes['0']);
  expect(restored.activeId).toEqual(saved.activeId);
});

test('abandoned empty onboarding drafts are not saved as projects', async ({ page }) => {
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
  await page.evaluate(() => start());
  await page.evaluate(() => start());
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(state.projects).toHaveLength(0);
  await page.locator('.choice').first().click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.locator('#idea').fill('완료된 프로젝트');
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /맞춤 로드맵 만들기/ }).click();
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(result.projects).toHaveLength(1);
});

test('home loads without JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('button', { name: /새 프로젝트 시작하기/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('wrong quiz answer cannot unlock quest completion', async ({ page }) => {
  await createProject(page, '웹사이트', '퀴즈 오답 검증');
  await page.locator('.step').first().click();
  const correct = await page.evaluate(() => LESSON_LIBRARY[0].correct);
  const wrong = correct === 0 ? 1 : 0;
  await page.locator('.quiz-option').nth(wrong).click();
  await expect(page.locator('#quizFeedback')).toContainText('다시 생각해 보세요');
  for (const check of await page.locator('.verify').all()) await check.check();
  await page.locator('#result').fill('https://example.com/proof');
  await page.getByRole('button', { name: /완료하고 다음/ }).click();
  await expect(page.locator('#feedback')).toContainText('이해도 확인 문제');
});

test('completed project with empty description is preserved when starting another', async ({ page }) => {
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /맞춤 로드맵 만들기/ }).click();
  const first = await page.evaluate(() => data.activeId);
  await page.getByRole('button', { name: /새 프로젝트 시작/ }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(state.projects.some(p => p.activeId === first)).toBeTruthy();
});

test('failed manual save never displays success confirmation', async ({ page }) => {
  await createProject(page, '웹사이트', '저장 실패 메시지 확인');
  await page.locator('.step').first().click();
  await page.locator('#memo').fill('저장 장애 재현');
  await page.evaluate(() => {
    Storage.prototype.setItem = function () { throw new DOMException('quota exceeded', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: '진행 저장', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('저장하지 못했습니다');
  await expect(page.locator('#feedback')).not.toContainText('학습 기록을 저장했습니다');
});

test('quest completion stops on failed evidence save before changing progress', async ({ page }) => {
  await createProject(page, '웹사이트', '저장 실패 완료 방지');
  await page.locator('.step').first().click();
  const answer = await page.evaluate(() => LESSON_LIBRARY[0].correct);
  await page.locator('.quiz-option').nth(answer).click();
  for (const checkbox of await page.locator('.verify').all()) await checkbox.check();
  await page.locator('#result').fill('https://example.com/proof');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: /완료하고 다음/ }).click();
  await expect(page.locator('#feedback')).toContainText('저장하지 못했습니다');
  expect(await page.evaluate(() => Boolean(data.done[0]))).toBe(false);
});

test('backup export still downloads if localStorage write fails', async ({ page }) => {
  await createProject(page, '웹사이트', '저장 실패 백업 테스트');
  await page.getByRole('button', { name: /전체 기록 백업/ }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); };
  });
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /백업 파일 다운로드/ }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('vibe-quest-backup.json');
});
