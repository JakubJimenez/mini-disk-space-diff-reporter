import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSnapshots } from '../src/index.js';

test('reports files that grew and shrank', () => {
  const before = { 'a.txt': 10, 'b.txt': 20 };
  const after = { 'a.txt': 15, 'b.txt': 5 };
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.grown, [{ path: 'a.txt', before: 10, after: 15, delta: 5 }]);
  assert.deepEqual(result.shrunk, [{ path: 'b.txt', before: 20, after: 5, delta: -15 }]);
  assert.deepEqual(result.appeared, []);
  assert.deepEqual(result.vanished, []);
});

test('reports files that appeared and vanished', () => {
  const before = { 'old.txt': 7 };
  const after = { 'new.txt': 3 };
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.appeared, [{ path: 'new.txt', before: 0, after: 3, delta: 3 }]);
  assert.deepEqual(result.vanished, [{ path: 'old.txt', before: 7, after: 0, delta: -7 }]);
  assert.deepEqual(result.grown, []);
  assert.deepEqual(result.shrunk, []);
});

test('rolls file sizes up into folder totals', () => {
  const before = { 'src/a.js': 10, 'src/b.js': 10 };
  const after = { 'src/a.js': 20, 'src/b.js': 10 };
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.grown, [
    { path: 'src', before: 20, after: 30, delta: 10 },
    { path: 'src/a.js', before: 10, after: 20, delta: 10 },
  ]);
});

test('treats a folder that disappears as vanished', () => {
  const before = { 'tmp/a': 4, 'tmp/b': 6 };
  const after = {};
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.vanished, [
    { path: 'tmp', before: 10, after: 0, delta: -10 },
    { path: 'tmp/a', before: 4, after: 0, delta: -4 },
    { path: 'tmp/b', before: 6, after: 0, delta: -6 },
  ]);
});

test('normalises backslashes and redundant separators', () => {
  const before = { 'src\\nested//file.txt': 1 };
  const after = { 'src/nested/file.txt': 5 };
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.grown, [
    { path: 'src', before: 1, after: 5, delta: 4 },
    { path: 'src/nested', before: 1, after: 5, delta: 4 },
    { path: 'src/nested/file.txt', before: 1, after: 5, delta: 4 },
  ]);
});

test('ignores paths that normalise to the root', () => {
  const before = { '.': 100, './': 100 };
  const after = { '.': 50 };
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.grown, []);
  assert.deepEqual(result.shrunk, []);
  assert.deepEqual(result.appeared, []);
  assert.deepEqual(result.vanished, []);
});

test('rejects duplicate paths after normalisation', () => {
  const before = { 'a/b': 1, 'a//b': 2 };
  assert.throws(() => diffSnapshots(before, {}), /duplicate path after normalisation/);
});

test('rejects negative or non-numeric sizes', () => {
  assert.throws(() => diffSnapshots({ a: -1 }, {}), /non-negative finite number/);
  assert.throws(() => diffSnapshots({ a: '10' }, {}), /non-negative finite number/);
  assert.throws(() => diffSnapshots({ a: Infinity }, {}), /non-negative finite number/);
});

test('rejects non-object snapshots', () => {
  assert.throws(() => diffSnapshots(null, {}), /plain object/);
  assert.throws(() => diffSnapshots([], {}), /plain object/);
});

test('returns empty arrays for identical snapshots', () => {
  const snapshot = { 'a.txt': 1, 'dir/b.txt': 2 };
  const result = diffSnapshots(snapshot, snapshot);

  assert.deepEqual(result.grown, []);
  assert.deepEqual(result.shrunk, []);
  assert.deepEqual(result.appeared, []);
  assert.deepEqual(result.vanished, []);
});

test('handles zero-byte files without inventing changes', () => {
  const before = { 'empty.txt': 0 };
  const after = { 'empty.txt': 0 };
  const result = diffSnapshots(before, after);

  assert.deepEqual(result.grown, []);
  assert.deepEqual(result.shrunk, []);
  assert.deepEqual(result.appeared, []);
  assert.deepEqual(result.vanished, []);
});
