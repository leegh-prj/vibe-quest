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

test('project list excludes abandoned empty onboarding draft', async ({ page }) => {
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
  await page.evaluate(() => projectsPage());
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('vibequest-v1')));
  expect(state.projects).toHaveLength(0);
  await expect(page.getByText('내 프로젝트', { exact: true })).toBeVisible();
});

test('malformed quest progress is limited to seven boolean slots', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('vibequest-v1', JSON.stringify({
    type: 'web', description: '복구 확인', done: [1, 0, 'yes', null, false, true, 0, true, true]
  })));
  await page.reload();
  const progress = await page.evaluate(() => data.done);
  expect(progress).toEqual([true, false, true, false, false, true, false]);
  await expect(page.getByRole('button', { name: /새 프로젝트 시작하기/ })).toBeVisible();
});

test('corrupted navigation indices are bounded on startup', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('vibequest-v1', JSON.stringify({
    type: 'web', description: '인덱스 복구', done: [],
    step: 900, current: -18
  })));
  await page.reload();
  const state = await page.evaluate(() => ({ step: data.step, current: data.current }));
  expect(state).toEqual({ step: 3, current: 0 });
  await expect(page.getByRole('button', { name: /새 프로젝트 시작하기/ })).toBeVisible();
});

test('malformed archived project can be opened safely after reload', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('vibequest-v1', JSON.stringify({
    type: 'web', description: '현재 프로젝트', done: [],
    activeId: 'active',
    projects: [{ type: 'game', done: [true, 0, 1, 1, 1, 1, 1, true], activeId: 'damaged',
      description: null, notes: null, evidence: [], criteria: 'invalid', qa: null }]
  })));
  await page.reload();
  await page.evaluate(() => projectsPage());
  await page.getByRole('button', { name: /학습 이어가기/ }).first().click();
  await expect(page.getByText('게임 프로젝트')).toBeVisible();
  const state = await page.evaluate(() => ({ description: data.description, done: data.done, notes: data.notes }));
  expect(state.description).toBe('');
  expect(state.done).toHaveLength(7);
  expect(state.notes).toEqual({});
});

test('keyboard navigation exposes visible focus and quiz feedback status', async ({ page }) => {
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, outline: getComputedStyle(el).outlineStyle };
  });
  expect(focus.tag).toBe('BUTTON');
  expect(focus.outline).not.toBe('none');
  await createProject(page, '웹사이트', '접근성 검증');
  await page.locator('.step').first().click();
  await expect(page.locator('#feedback')).toHaveAttribute('role', 'status');
  await expect(page.locator('#quizFeedback')).toHaveAttribute('aria-live', 'polite');
});

test('touch targets and reduced motion preferences are supported', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const metrics = await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).evaluate(el => {
    const c = getComputedStyle(el);
    return { height: el.getBoundingClientRect().height, transition: c.transitionDuration };
  });
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  await createProject(page, '웹사이트', '터치 검증');
  await page.locator('.step').first().click();
  const check = await page.locator('.verify').first().evaluate(el => el.getBoundingClientRect().height);
  expect(check).toBeGreaterThanOrEqual(20);
});

test('onboarding idea persists when going backward and reloading', async ({ page }) => {
  await page.getByRole('button', { name: /새 프로젝트 시작하기/ }).click();
  await expect(page.locator('.choice.active')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /다음/ }).click();
  await page.locator('#idea').fill('나만의 모바일 프로젝트');
  await page.getByRole('button', { name: /이전/ }).click();
  await page.getByRole('button', { name: /다음/ }).click();
  await expect(page.locator('#idea')).toHaveValue('나만의 모바일 프로젝트');
  await page.reload();
  await page.evaluate(() => onboard());
  await expect(page.locator('#idea')).toHaveValue('나만의 모바일 프로젝트');
  await expect(page.locator('#idea')).toHaveAttribute('maxlength', '1200');
  await expect(page.getByLabel('만들고 싶은 프로젝트 설명 (선택)')).toBeVisible();
});

test('quest previous and next navigation preserves unsaved draft', async ({ page }) => {
  await createProject(page, '웹사이트', '퀘스트 이동 점검');
  await expect(page.getByRole('progressbar', { name: '퀘스트 완료율' })).toHaveAttribute('aria-valuenow', '0');
  await page.locator('.step').first().click();
  await expect(page.getByRole('button', { name: /이전 퀘스트/ })).toBeDisabled();
  await page.locator('#memo').fill('완료 처리 전에도 이동할 수 있는 메모');
  await page.locator('#result').fill('https://example.com/first');
  await page.getByRole('button', { name: /다음 퀘스트/ }).click();
  await expect(page.getByText('QUEST 2 / 7')).toBeVisible();
  await page.getByRole('button', { name: /이전 퀘스트/ }).click();
  await expect(page.locator('#memo')).toHaveValue('완료 처리 전에도 이동할 수 있는 메모');
  await expect(page.locator('#result')).toHaveValue('https://example.com/first');
  await page.reload();
  await page.evaluate(() => dashboard());
  await page.locator('.step').first().click();
  await expect(page.locator('#memo')).toHaveValue('완료 처리 전에도 이동할 수 있는 메모');
});

test('quest navigation is blocked if draft cannot be saved', async ({ page }) => {
  await createProject(page, '웹사이트', '저장 실패 이동 차단');
  await page.locator('.step').first().click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: /다음 퀘스트/ }).click();
  await expect(page.getByText('QUEST 1 / 7')).toBeVisible();
  await expect(page.locator('#feedback')).toContainText('저장하지 못했습니다');
});

test('project overview shows distinct accessible completion progress', async ({ page }) => {
  await createProject(page, '웹사이트', '진행 중 웹 프로젝트');
  await page.evaluate(() => { data.done = [true,true,false,false,false,false,false]; archiveCurrent(); save(); });
  await createProject(page, '게임', '완료한 게임 프로젝트', true);
  await page.evaluate(() => { data.done = Array(7).fill(true); archiveCurrent(); save(); });
  await page.getByRole('button', { name: /프로젝트 관리/ }).click();
  await expect(page.getByText('2개 프로젝트')).toBeVisible();
  await expect(page.getByText('1개 7단계 완주')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '진행 중 웹 프로젝트 학습 완료 단계' })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('progressbar', { name: '완료한 게임 프로젝트 학습 완료 단계' })).toHaveAttribute('aria-valuenow', '7');
  await page.reload();
  await page.evaluate(() => projectsPage());
  await expect(page.getByRole('progressbar', { name: '진행 중 웹 프로젝트 학습 완료 단계' })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('progressbar', { name: '완료한 게임 프로젝트 학습 완료 단계' })).toHaveAttribute('aria-valuenow', '7');
});

test('empty project library has a useful first-project prompt', async ({ page }) => {
  await page.evaluate(() => projectsPage());
  await expect(page.getByText('아직 저장된 프로젝트가 없습니다.')).toBeVisible();
  await expect(page.getByText('0개 프로젝트')).toBeVisible();
});

test('quest completion checklist updates immediately without unlocking early', async ({ page }) => {
  await createProject(page, '웹사이트', '완료 기준 상태 점검');
  await page.locator('.step').first().click();
  await expect(page.locator('#readyQuiz')).toContainText('○');
  await expect(page.locator('#readyChecks')).toContainText('0/3개');
  await expect(page.locator('#readyProof')).toContainText('○');
  await page.getByRole('button', { name: /완료하고 다음/ }).click();
  await expect(page.locator('#feedback')).toContainText('이해도 확인 문제');
  const answer = await page.evaluate(() => LESSON_LIBRARY[0].correct);
  await page.locator('.quiz-option').nth(answer).click();
  await expect(page.locator('#readyQuiz')).toContainText('✓');
  await page.locator('.verify').first().check();
  await expect(page.locator('#readyChecks')).toContainText('1/3개');
  await page.locator('#result').fill('https://example.com/valid-evidence');
  await expect(page.locator('#readyProof')).toContainText('✓');
  for (const box of await page.locator('.verify').all()) await box.check();
  await expect(page.locator('#readySummary')).toContainText('모든 완료 조건을 충족했습니다');
  await page.reload();
  await page.evaluate(() => dashboard());
  await page.locator('.step').first().click();
  await expect(page.locator('#readySummary')).toContainText('모든 완료 조건을 충족했습니다');
});

test('returning learner resumes the last unfinished quest after reload', async ({ page }) => {
  await createProject(page, '웹사이트', '학습 복귀 프로젝트');
  await page.locator('.step').nth(3).click();
  await expect(page.getByText('QUEST 4 / 7')).toBeVisible();
  await page.locator('#memo').fill('마지막으로 작업하던 기록');
  await page.reload();
  await page.evaluate(() => dashboard());
  await expect(page.locator('.focus-banner')).toContainText('QUEST 4');
  await page.locator('#resumeQuestBtn').click();
  await expect(page.getByText('QUEST 4 / 7')).toBeVisible();
  await expect(page.locator('#memo')).toHaveValue('마지막으로 작업하던 기록');
});

test('resume restores each project independently after switching', async ({ page }) => {
  await createProject(page, '웹사이트', '웹 복귀 프로젝트');
  await page.locator('.step').nth(4).click();
  await createProject(page, '게임', '게임 복귀 프로젝트', true);
  await page.locator('.step').nth(1).click();
  await page.evaluate(() => projectsPage());
  await page.getByRole('button', { name: '학습 이어가기' }).first().click();
  await expect(page.locator('.focus-banner')).toContainText('QUEST 5');
  await page.evaluate(() => projectsPage());
  await page.getByRole('button', { name: '학습 이어가기' }).nth(1).click();
  await expect(page.locator('.focus-banner')).toContainText('QUEST 2');
});

test('resume falls back to first unfinished quest when last visited is completed', async ({ page }) => {
  await createProject(page, '웹사이트', '완료된 단계 복귀');
  await page.evaluate(() => {
    data.done = [true, true, false, false, false, false, false];
    data.current = 1;
    save();
  });
  await page.reload();
  await page.evaluate(() => dashboard());
  await expect(page.locator('.focus-banner')).toContainText('QUEST 3');
  await page.locator('#resumeQuestBtn').click();
  await expect(page.getByText('QUEST 3 / 7')).toBeVisible();
});

test('learning records summarize completed and draft work without mixing projects', async ({ page }) => {
  await createProject(page, '웹사이트', '학습기록 웹 프로젝트');
  await page.evaluate(() => {
    data.done = [true, false, false, false, false, false, false];
    data.evidence[0] = 'https://example.com/proof';
    data.notes[0] = '첫 퀘스트 학습 메모';
    data.notes[1] = '두 번째 퀘스트 진행 중';
    save();
    dashboard();
  });
  await expect(page.getByText('1개 퀘스트 완료 · 2개 퀘스트에 기록 있음')).toBeVisible();
  await expect(page.locator('.learning-records')).toContainText('첫 퀘스트 학습 메모');
  await expect(page.locator('.learning-records')).toContainText('두 번째 퀘스트 진행 중');
  await page.getByRole('button', { name: 'QUEST 2 학습 기록 보기' }).click();
  await expect(page.locator('#memo')).toHaveValue('두 번째 퀘스트 진행 중');
  await createProject(page, '게임', '별도 게임 프로젝트', true);
  await expect(page.getByText('0개 퀘스트 완료 · 0개 퀘스트에 기록 있음')).toBeVisible();
  await expect(page.locator('.learning-records')).not.toContainText('첫 퀘스트 학습 메모');
});

test('learning record text is escaped instead of interpreted as HTML', async ({ page }) => {
  await createProject(page, '웹사이트', '학습 메모 표시 확인');
  await page.evaluate(() => {
    data.notes[0] = '<img src=x onerror=alert(1)>';
    save();
    dashboard();
  });
  await expect(page.locator('.learning-records')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.learning-records img')).toHaveCount(0);
  await page.reload();
  await page.evaluate(() => dashboard());
  await expect(page.locator('.learning-records img')).toHaveCount(0);
});

test('mobile learning record details expand without losing navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await createProject(page, '웹사이트', '모바일 기록 확인');
  await page.evaluate(() => {
    data.notes[0] = '모바일에서 접어 둘 긴 학습 메모';
    data.evidence[0] = 'https://example.com/mobile-proof';
    save();
    dashboard();
  });
  const details = page.locator('.learning-records details').first();
  await expect(details).not.toHaveAttribute('open');
  await expect(page.getByText('모바일에서 접어 둘 긴 학습 메모')).not.toBeVisible();
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open');
  await expect(page.getByText('모바일에서 접어 둘 긴 학습 메모')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'QUEST 1 학습 기록 보기' }).click();
  await expect(page.locator('#memo')).toHaveValue('모바일에서 접어 둘 긴 학습 메모');
});

test('offline troubleshooting guide switches between four useful problem categories', async ({ page }) => {
  await createProject(page, '웹사이트', '문제 해결 가이드 검증');
  await page.locator('.step').nth(3).click();
  await page.locator('#troubleshooting summary').click();
  await expect(page.locator('#troubleSteps')).toContainText('320px과 375px');
  for (const [value, expected] of [
    ['action', '버튼을 눌러도 반응이 없어요'],
    ['storage', '기존 기록을 먼저 백업합니다'],
    ['deploy', '최신 커밋의 빌드 완료 여부']
  ]) {
    await page.locator('#troubleType').selectOption(value);
    await expect(page.locator('#troubleSteps')).toContainText(expected);
  }
  await expect(page.locator('#troubleSteps')).toContainText('이번 퀘스트:');
  await expect(page.locator('#troubleSteps')).toContainText('모바일');
});

test('troubleshooting remains usable without AI endpoint and on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route('**/api/coach', route => route.abort());
  await createProject(page, '게임', '오프라인 가이드');
  await page.locator('.step').first().click();
  await page.locator('#troubleshooting summary').click();
  await expect(page.locator('#troubleSteps')).toContainText('모바일에서 화면이 겹치거나 잘려요');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('button', { name: /AI 코치에게 질문/ })).toBeVisible();
});

test('iPhone Safari page preparation includes safe areas and non-zooming form fields', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await createProject(page, '웹사이트', '아이폰 화면 검증');
  await page.locator('.step').first().click();
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    formFont: parseFloat(getComputedStyle(document.querySelector('#memo')).fontSize)
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.width);
  expect(metrics.formFont).toBeGreaterThanOrEqual(16);
});

test('MVP goals track built and manually tested features independently of quests', async ({ page }) => {
  await createProject(page, '웹사이트', '목표 검증 포트폴리오');
  await expect(page.locator('#goalReviewSummary')).toContainText('구현 0/3개 · 직접 테스트 0/3개');
  await page.locator('#goalStatus0').selectOption('built');
  await page.locator('#goalStatus1').selectOption('tested');
  await expect(page.locator('#goalStatus1')).toHaveValue('built');
  await expect(page.locator('#goalSaveMessage')).toContainText('8자 이상');
  await page.locator('#goalEvidence1').fill('모바일에서 목록과 링크 클릭을 직접 확인했습니다.');
  await page.locator('#goalStatus1').selectOption('tested');
  await expect(page.locator('#goalReviewSummary')).toContainText('구현 2/3개 · 직접 테스트 1/3개');
  await expect(page.locator('.pill').filter({hasText:'완료 0 / 7'})).toBeVisible();
  await page.reload();
  await page.evaluate(() => dashboard());
  await expect(page.locator('#goalStatus1')).toHaveValue('tested');
  await expect(page.locator('#goalEvidence1')).toHaveValue('모바일에서 목록과 링크 클릭을 직접 확인했습니다.');
});

test('MVP review is preserved independently across project switching and backup restoration', async ({ page }) => {
  await createProject(page, '웹사이트', '첫 번째 목표 검증');
  await page.locator('#goalEvidence0').fill('테스트를 수행한 화면과 결과 기록입니다.');
  await page.locator('#goalStatus0').selectOption('tested');
  await createProject(page, '게임', '두 번째 게임 목표', true);
  await expect(page.locator('#goalReviewSummary')).toContainText('구현 0/3개 · 직접 테스트 0/3개');
  await page.evaluate(() => projectsPage());
  await page.getByRole('button', { name: '학습 이어가기' }).first().click();
  await expect(page.locator('#goalReviewSummary')).toContainText('구현 1/3개 · 직접 테스트 1/3개');
  const backup = await page.evaluate(() => {
    archiveCurrent();
    return JSON.stringify({format:'vibequest-backup',version:1,data});
  });
  await page.evaluate(() => start());
  await page.evaluate(() => showBackup());
  page.on('dialog', d=>d.accept());
  await page.locator('#backupFile').setInputFiles({name:'learning.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await expect(page.locator('#goalStatus0')).toHaveValue('tested');
  await expect(page.locator('#goalEvidence0')).toHaveValue('테스트를 수행한 화면과 결과 기록입니다.');
});

test('MVP goal evidence is escaped rather than executed as HTML', async ({ page }) => {
  await createProject(page, '웹사이트', '결과 안전성 검증');
  await page.locator('#goalEvidence0').fill('<img src=x onerror=alert(1)>');
  await page.reload();
  await page.evaluate(() => dashboard());
  await expect(page.locator('#goalEvidence0')).toHaveValue('<img src=x onerror=alert(1)>');
  await expect(page.locator('.goal-review img')).toHaveCount(0);
});

test('retry helper builds a scoped correction prompt and saves verified outcome', async ({ page }) => {
  await createProject(page, '웹사이트', '재시도 도움 포트폴리오');
  await page.locator('.step').first().click();
  await page.getByRole('button', { name: '수정 요청문 생성' }).click();
  await expect(page.locator('#retryMessage')).toContainText('각각 5자');
  await page.locator('#retryProblem').fill('아이폰에서 하단 버튼이 눌리지 않습니다');
  await page.locator('#retryExpected').fill('하단 버튼이 정상적으로 눌려야 합니다');
  await page.getByRole('button', { name: '수정 요청문 생성' }).click();
  await expect(page.locator('#retryPrompt')).toHaveValue(/사용자 데이터는 유지하면서/);
  await expect(page.locator('#retryPrompt')).toHaveValue(/아이폰에서 하단 버튼/);
  await page.locator('#retryStatus').selectOption('resolved');
  await page.getByRole('button', { name: '재시도 기록 저장' }).click();
  await expect(page.locator('#retryMessage')).toContainText('8자 이상');
  await page.locator('#retryAfter').fill('Safari 화면에서 버튼 동작을 직접 다시 확인했습니다');
  await page.getByRole('button', { name: '재시도 기록 저장' }).click();
  await expect(page.locator('.retry-entry')).toContainText('직접 확인 후 해결');
  await page.reload();
  await page.evaluate(() => quest(0));
  await expect(page.locator('.retry-entry')).toContainText('Safari 화면에서 버튼 동작');
});

test('retry history remains project-specific and survives backup restore', async ({ page }) => {
  await createProject(page, '웹사이트', '첫번째 재시도');
  await page.locator('.step').first().click();
  await page.locator('#retryProblem').fill('첫 프로젝트 버튼이 동작하지 않아요');
  await page.locator('#retryExpected').fill('버튼을 누르면 화면이 열려야 해요');
  await page.getByRole('button', { name: '재시도 기록 저장' }).click();
  await createProject(page, '게임', '두번째 재시도 프로젝트', true);
  await page.locator('.step').first().click();
  await expect(page.locator('.retry-entry')).toHaveCount(0);
  await page.evaluate(() => projectsPage());
  await page.getByRole('button', { name: '학습 이어가기' }).first().click();
  await page.locator('.step').first().click();
  await expect(page.locator('.retry-entry')).toContainText('첫 프로젝트 버튼');
  const backup=await page.evaluate(() => { archiveCurrent(); return JSON.stringify({format:'vibequest-backup',version:1,data}); });
  await page.evaluate(() => showBackup());
  page.on('dialog',d=>d.accept());
  await page.locator('#backupFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await page.locator('.step').first().click();
  await expect(page.locator('.retry-entry')).toContainText('첫 프로젝트 버튼');
});

test('retry inputs remain inert when displaying HTML-looking text', async ({ page }) => {
  await createProject(page, '웹사이트', '안전한 재시도 기록');
  await page.locator('.step').first().click();
  await page.locator('#retryProblem').fill('<img src=x onerror=alert(1)>');
  await page.locator('#retryExpected').fill('문자열을 안전하게 보여줘야 합니다');
  await page.getByRole('button', { name: '재시도 기록 저장' }).click();
  await expect(page.locator('.retry-entry')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.retry-panel img')).toHaveCount(0);
});
