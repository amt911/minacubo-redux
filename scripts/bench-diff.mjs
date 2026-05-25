#!/usr/bin/env node
// Standalone diff for two bench reports produced by scripts/bench.mjs.
// Usage:
//   node scripts/bench-diff.mjs baseline.json current.json
//
// Exits 0 always — diff is informational. Wrap in a check if you want CI to
// fail on regressions.

import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('usage: node scripts/bench-diff.mjs <baseline.json> <current.json>');
  process.exit(1);
}

const base = JSON.parse(readFileSync(a, 'utf8'));
const cur  = JSON.parse(readFileSync(b, 'utf8'));

const keys = [
  'fps_avg', 'frame_avg_ms', 'frame_p50_ms', 'frame_p95_ms', 'frame_p99_ms',
  'frame_max_ms', 'max_calls', 'max_tris', 'max_meshes', 'max_instances',
  'max_queue', 'build_avg_ms',
];

const rows = keys.map((k) => {
  const av = base[k] ?? 0;
  const bv = cur[k] ?? 0;
  const delta = bv - av;
  const pct = av ? ((delta / av) * 100) : 0;
  return {
    metric: k,
    baseline: av,
    current: bv,
    delta: +delta.toFixed(3),
    pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
  };
});

console.log(`baseline: ${a}`);
console.log(`current:  ${b}`);
console.table(rows);
