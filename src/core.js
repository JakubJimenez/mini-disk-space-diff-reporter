const toBytes = (value) => {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError('size must be a non-negative finite number');
  }
  return value;
};

const normalisePath = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new TypeError('snapshot paths must be non-empty strings');
  }
  const replaced = raw.replace(/\\/g, '/');
  const parts = [];
  for (const segment of replaced.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join('/');
};

const normaliseSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('a snapshot must be a plain object mapping paths to byte sizes');
  }
  const result = new Map();
  for (const [rawPath, rawSize] of Object.entries(snapshot)) {
    const path = normalisePath(rawPath);
    if (path === '') continue;
    if (result.has(path)) {
      throw new Error(`duplicate path after normalisation: ${path}`);
    }
    result.set(path, toBytes(rawSize));
  }
  return result;
};

const parentOf = (path) => {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
};

const addSize = (map, path, size) => {
  map.set(path, (map.get(path) || 0) + size);
};

const rollUp = (files) => {
  const totals = new Map();
  for (const [path, size] of files) {
    let current = path;
    while (current !== '') {
      addSize(totals, current, size);
      current = parentOf(current);
    }
  }
  return totals;
};

/**
 * Compare two directory snapshots and report how each file and folder changed.
 *
 * A snapshot is a plain object whose keys are paths and whose values are byte
 * sizes for individual files. Folders are inferred from the paths: the size of
 * a folder is the sum of every file underneath it. This mirrors `du`-style
 * reporting without requiring a real filesystem walk.
 *
 * The result contains four arrays. Each entry is `{ path, before, after, delta }`
 * where `delta` is `after - before` (positive means growth). Entries are sorted
 * by path so the output is stable across runs and easy to diff.
 *
 * @param {Record<string, number>} before snapshot taken earlier
 * @param {Record<string, number>} after snapshot taken later
 * @returns {{grown: Array, shrunk: Array, appeared: Array, vanished: Array}}
 */
export function diffSnapshots(before, after) {
  const beforeFiles = normaliseSnapshot(before);
  const afterFiles = normaliseSnapshot(after);

  const beforeTotals = rollUp(beforeFiles);
  const afterTotals = rollUp(afterFiles);

  const allPaths = new Set([...beforeTotals.keys(), ...afterTotals.keys()]);

  const grown = [];
  const shrunk = [];
  const appeared = [];
  const vanished = [];

  for (const path of allPaths) {
    const had = beforeTotals.has(path);
    const has = afterTotals.has(path);
    const beforeSize = had ? beforeTotals.get(path) : 0;
    const afterSize = has ? afterTotals.get(path) : 0;
    const delta = afterSize - beforeSize;

    if (!had && has) {
      appeared.push({ path, before: 0, after: afterSize, delta });
    } else if (had && !has) {
      vanished.push({ path, before: beforeSize, after: 0, delta });
    } else if (delta > 0) {
      grown.push({ path, before: beforeSize, after: afterSize, delta });
    } else if (delta < 0) {
      shrunk.push({ path, before: beforeSize, after: afterSize, delta });
    }
  }

  const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  grown.sort(byPath);
  shrunk.sort(byPath);
  appeared.sort(byPath);
  vanished.sort(byPath);

  return { grown, shrunk, appeared, vanished };
}
