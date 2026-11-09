# mini-disk-space-diff-reporter

Compares two directory snapshots and reports which files and folders grew, shrank, appeared, or vanished.

```js
import { diffSnapshots } from './src/index.js';

const before = { 'src/a.js': 10, 'src/b.js': 20 };
const after = { 'src/a.js': 15, 'src/b.js': 5, 'src/c.js': 3 };

const report = diffSnapshots(before, after);

console.log(report.grown);
// [ { path: 'src', before: 30, after: 23, delta: -7 },
//   { path: 'src/a.js', before: 10, after: 15, delta: 5 } ]

console.log(report.shrunk);
// [ { path: 'src/b.js', before: 20, after: 5, delta: -15 } ]

console.log(report.appeared);
// [ { path: 'src/c.js', before: 0, after: 3, delta: 3 } ]

console.log(report.vanished);
// []
```

The library exists because comparing disk usage usually means running `du` twice and eyeballing two long outputs. That is fine for one directory but breaks down when you want to track a directory over time or compare two machines. This library takes the two snapshots as plain objects and returns a structured diff. The trade-off is that it does not walk the filesystem itself: you supply the snapshots, so it stays dependency-free and works with any source of size data.

The awkward edge is folder inference. The library computes folder sizes by summing the files underneath them, and it treats a folder that no longer contains any files as vanished. If a folder is empty in both snapshots it does not appear at all, because there is no file path to anchor it. That is a deliberate choice: an empty folder has zero size and therefore no measurable change.

## API

### `diffSnapshots(before, after)`

Returns `{ grown, shrunk, appeared, vanished }`. Each is an array of `{ path, before, after, delta }`, sorted by path. `delta` is `after - before`.

Paths are normalised before comparison: backslashes become forward slashes, `.` segments are dropped, and `..` segments are resolved. Paths that normalise to the root are ignored. A snapshot must be a plain object mapping non-empty path strings to non-negative finite byte counts; anything else throws a `TypeError`.
