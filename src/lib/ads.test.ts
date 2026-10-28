import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clickRate, isAdLive, pickWeighted, validateAdInput } from './ads.ts';

test('掲載中で期間内の広告だけ表示する', () => {
  const ad = { status: 'active' as const, startDate: '2026-11-01', endDate: '2026-11-30' };
  assert.equal(isAdLive(ad, '2026-10-31'), false);
  assert.equal(isAdLive(ad, '2026-11-01'), true);
  assert.equal(isAdLive(ad, '2026-11-30'), true);
  assert.equal(isAdLive(ad, '2026-12-01'), false);
  assert.equal(isAdLive({ ...ad, status: 'paused' }, '2026-11-15'), false);
  assert.equal(isAdLive({ status: 'active', startDate: '', endDate: '' }, '2030-01-01'), true);
});

test('表示の割合に応じて選ぶ', () => {
  const items = [{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }];
  assert.equal(pickWeighted(items, 0)?.id, 'a');
  assert.equal(pickWeighted(items, 0.74)?.id, 'a');
  assert.equal(pickWeighted(items, 0.76)?.id, 'b');
  assert.equal(pickWeighted([], 0.5), null);
  // 多数回選ぶと、だいたい 3:1 になる
  let a = 0;
  for (let i = 0; i < 4000; i++) if (pickWeighted(items, i / 4000)?.id === 'a') a++;
  assert.equal(a, 3000);
});

test('入力の確認：https 以外のリンクや範囲外の割合は断る', () => {
  const ok = { title: ' 求人サイト ', description: '', imageUrl: '', linkUrl: 'https://example.com/?a=1', weight: '10', startDate: '', endDate: '' };
  const r = validateAdInput(ok);
  assert.ok('ad' in r && r.ad.title === '求人サイト' && r.ad.weight === 10);
  assert.ok('error' in validateAdInput({ ...ok, linkUrl: 'javascript:alert(1)' }));
  assert.ok('error' in validateAdInput({ ...ok, linkUrl: 'http://example.com' }));
  assert.ok('error' in validateAdInput({ ...ok, imageUrl: 'data:image/png;base64,xx' }));
  assert.ok('error' in validateAdInput({ ...ok, weight: 0 }));
  assert.ok('error' in validateAdInput({ ...ok, title: '' }));
  assert.ok('error' in validateAdInput({ ...ok, startDate: '2026-12-01', endDate: '2026-11-01' }));
});

test('クリック率', () => {
  assert.equal(clickRate(0, 0), 0);
  assert.equal(clickRate(200, 3), 1.5);
});
