#!/usr/bin/env node
// Headless perf benchmark for the chunk pipeline.
//
// Launches the dev page in Chromium via puppeteer-core, lets the in-page bench
// harness (see MyScene._setupBench, triggered by ?bench=1) settle, drive the
// player forward for a fixed duration, sample renderer.info + chunk metrics,
// and write a summary to window.__benchReport. We poll document.title for the
// `BENCH_DONE` sentinel, then read the report back via page.evaluate.
//
// CAUTION: headless Chromium uses software GL (swiftshader by default) — the
// absolute FPS numbers are NOT representative of the user's GPU. Use this to
// compare commits relatively, not to forecast real-world frame rates.
//
// Usage:
//   node scripts/bench.mjs                 # default 3s settle + 30s record
//   node scripts/bench.mjs --duration 60000 --settle 5000
//   node scripts/bench.mjs --base http://localhost:8080 --out /tmp/bench.json
//   node scripts/bench.mjs --compare /tmp/before.json   # diff vs baseline
//
// Requires the dev server to already be running (CLAUDE.md notes it lives at
// http://localhost:8080 during sessions).

import puppeteer from 'puppeteer-core';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const argv = parseArgs(process.argv.slice(2));
const BASE      = argv.base       ?? 'http://localhost:8080';
const DURATION  = +(argv.duration ?? 30000);
const SETTLE    = +(argv.settle   ?? 3000);
const DR        = +(argv.DR       ?? 12);
const RUNS      = +(argv.runs     ?? 1);
const OUT       = argv.out        ?? null;
const COMPARE   = argv.compare    ?? null;
const TIMEOUT   = (DURATION + SETTLE + 30000);
const EXEC_PATH = argv.chromium   ?? process.env.CHROME_BIN ?? '/usr/bin/chromium';
const HEADLESS  = argv.show !== 'true';
// --gpu drops the swiftshader override so the browser uses whatever GL the
// display provides (xvfb + mesa in CI, the real GPU on a workstation). Keep
// it OFF by default — headless software GL is the most reproducible setup
// and any local run without --show wants it.
const GPU       = argv.gpu === 'true';

function parseArgs(arr) {
  const out = {};
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[++i] : 'true';
    out[k] = v;
  }
  return out;
}

const url = `${BASE}/?bench=1&duration=${DURATION}&settle=${SETTLE}&DR=${DR}`;

console.error(`[bench] launching chromium → ${url}`);
console.error(`[bench] settle ${SETTLE}ms + record ${DURATION}ms (timeout ${TIMEOUT}ms)`);

const browser = await puppeteer.launch({
  executablePath: EXEC_PATH,
  headless: HEADLESS,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
    '--window-size=1600,1000',
    // Newer headless mode requires angle/swiftshader pairing — bare
    // --use-gl=swiftshader fails to create a WebGL context on Chromium ≥130.
    // Omitted in --gpu mode so xvfb's GL is used instead.
    ...(GPU ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  ],
  defaultViewport: { width: 1600, height: 1000 },
});

try {
  const runs = [];
  for (let r = 0; r < RUNS; r++) {
    if (RUNS > 1) console.error(`\n[bench] === run ${r + 1}/${RUNS} ===`);
    const page = await browser.newPage();

    page.on('console', (msg) => {
      const t = msg.text();
      if (t.startsWith('BENCH') || t.includes('error')) console.error(`[page] ${t}`);
    });
    page.on('pageerror', (e) => console.error('[page error]', e.message));

    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    const deadline = Date.now() + TIMEOUT;
    let report = null;
    while (Date.now() < deadline) {
      const title = await page.title();
      if (title === 'BENCH_DONE') {
        report = await page.evaluate(() => /** @type {any} */ (window).__benchReport);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await page.close();

    if (!report) {
      console.error('[bench] TIMEOUT — no BENCH_DONE within deadline');
      process.exit(1);
    }
    runs.push(report);
  }

  const finalReport = runs.length === 1 ? runs[0] : aggregate(runs);
  console.log(JSON.stringify(finalReport, null, 2));

  if (OUT) {
    writeFileSync(OUT, JSON.stringify(finalReport, null, 2));
    console.error(`[bench] wrote ${OUT}`);
  }

  if (COMPARE) {
    if (!existsSync(COMPARE)) {
      console.error(`[bench] --compare file not found: ${COMPARE}`);
      process.exit(1);
    }
    const base = JSON.parse(readFileSync(COMPARE, 'utf8'));
    console.error('\n[bench] diff vs baseline (' + COMPARE + '):');
    diffReports(base, finalReport);
  }
} finally {
  await browser.close();
}

/** Median across multiple runs for every numeric field of the first run. */
function aggregate(runs) {
  const out = { ...runs[0] };
  const numKeys = Object.keys(runs[0]).filter((k) => typeof runs[0][k] === 'number');
  for (const k of numKeys) {
    const vals = runs.map((r) => r[k]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    if (!vals.length) continue;
    out[k] = +vals[Math.floor(vals.length / 2)].toFixed(3);
  }
  out.runs = runs.length;
  out._raw = runs.map((r) => ({ fps_avg: r.fps_avg, frame_avg_ms: r.frame_avg_ms }));
  return out;
}

function diffReports(a, b) {
  const keys = [
    'fps_avg', 'frame_avg_ms', 'frame_p50_ms', 'frame_p95_ms', 'frame_p99_ms',
    'frame_max_ms', 'max_calls', 'max_tris', 'max_meshes', 'max_instances',
    'max_queue', 'build_avg_ms',
  ];
  const rows = keys.map((k) => {
    const av = a[k], bv = b[k];
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
  console.table(rows);
}
