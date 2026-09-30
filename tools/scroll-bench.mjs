// Scroll benchmark: drives a headless Chrome over the DevTools protocol, scrolls the page the
// way a person does, and reports frame times and how long the renderer takes to handle each input.
// No dependencies (Node 22+, for the global WebSocket).
//
//   npm run build && npm start                       # the app on :8080
//   node tools/scroll-bench.mjs http://127.0.0.1:8080/elbe desktop            # mouse wheel
//   TOUCH=1 node tools/scroll-bench.mjs http://127.0.0.1:8080/elbe mobile     # finger drags, 4× slower CPU
//   node tools/scroll-bench.mjs <url> desktop nohover nobackdrop              # switch suspects off
//
// Healthy: frame p95 ≈ 16.7 ms and input ack p50 ≈ 16 ms, the same as a plain page. Before the
// fixes described in the README, wheel scrolling sat at 33 ms (30 fps) with the cursor over the list.
//
// Env: CHROME (binary), TOUCH=1 or WHEEL=1 (default for desktop), CPU (mobile throttle, default 4),
// UNCAPPED=1 (no vsync), SHOWACKS=1 (print every input's latency).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [url, mode = 'mobile', ...variants] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(path.join(process.env.BENCH_TMP ?? tmpdir(), 'chrome-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
  '--window-size=1440,900', ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(200);
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else listeners.forEach((l) => l(msg));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, (msg) => (msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});

const mobile = mode === 'mobile';
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', mobile
  ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
  : { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url });
await sleep(6000);

const CSS = {
  nobackdrop: '*,*::before,*::after,dialog::backdrop{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  nobg: 'body::before{display:none!important}',
  nomask: '*{mask-image:none!important;-webkit-mask-image:none!important}',
  noimg: '.media img{display:none!important}',
  nocanvas: '.art canvas{display:none!important}',
  noplates: '.plate{display:none!important}',
  nosticky: '.days,header,.side{position:static!important}',
  noshadow: '*{box-shadow:none!important}',
  nohover: '.menu-wrap{pointer-events:none!important}',
  nodishtr: '.dish{transition:none!important}',
  noimgtr: '.media img{transition:none!important}',
  nodottr: '.plate .dot{transition:none!important}',
  norise: '.dish{animation:none!important}',
  nohas: '.media::after{display:none!important}',
  noheadertr: 'header{transition:none!important}',
  nopause: ':root[data-scrolling] main{pointer-events:auto!important}',
  nobeforetr: '.dish::before,.dish,.media img,.media .plate{transition:none!important}',
  noanim: '*,*::before,*::after{transition:none!important;animation:none!important}',
  nofilter: '*{filter:none!important}',
};
const css = variants.map((v) => CSS[v]).filter(Boolean).join('\n');
if (css) {
  await send('Runtime.evaluate', { expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.append(s); })()` });
}
await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
await sleep(800);
if (mobile && process.env.CPU !== '1') await send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU ?? 4) });

// Frame timing on the main thread + trace for presented/dropped frames.
await send('Runtime.evaluate', { expression: `window.__frames=[];(function f(t){window.__frames.push(t);requestAnimationFrame(f)})(performance.now());` });
const events = [];
listeners.push((msg) => { if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value); });
await send('Tracing.start', {
  categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,benchmark,cc,viz',
  options: 'record-as-much-as-possible',
  transferMode: 'ReportEvents',
});
const t0 = Date.now();
if (process.env.TOUCH) {
  // Finger drags: down the page in 6 flicks, then back up, each move acknowledged by the renderer.
  globalThis.acks = [];
  for (const dir of [-1, -1, -1, 1, 1, 1]) {
    let y = dir < 0 ? 700 : 150;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y }] });
    for (let i = 0; i < 20; i++) {
      y += dir * 26;
      const a = performance.now();
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
      globalThis.acks.push(performance.now() - a);
      await sleep(16);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  }
} else if (process.env.WHEEL || !mobile) {
  // A mouse wheel with the pointer resting over the list: rows slide under the cursor, as they do for a real user.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 500 });
  globalThis.acks = [];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 90; i++) {
      const a = performance.now();
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 500, deltaX: 0, deltaY: pass ? -40 : 40 });
      globalThis.acks.push(performance.now() - a);
      await sleep(16);
    }
  }
} else {
  await send('Input.synthesizeScrollGesture', { x: mobile ? 200 : 900, y: mobile ? 600 : 600, yDistance: -2600, speed: 1600, gestureSourceType: mobile ? 'touch' : 'mouse', repeatCount: 1 });
  await send('Input.synthesizeScrollGesture', { x: mobile ? 200 : 900, y: 400, yDistance: 2600, speed: 1600, gestureSourceType: mobile ? 'touch' : 'mouse', repeatCount: 1 });
}
const elapsed = Date.now() - t0;
const done = new Promise((r) => listeners.push((msg) => msg.method === 'Tracing.tracingComplete' && r()));
await send('Tracing.end');
await done;
const frames = (await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__frames)', returnByValue: true })).result.value;

// --- Analysis: busy time per thread (merged top-level intervals) over the scroll.
const names = new Map();
for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
const spans = new Map();
let minTs = Infinity, maxTs = 0;
for (const e of events) {
  if (e.ph !== 'X' || !e.dur) continue;
  const key = `${e.pid}:${e.tid}`;
  (spans.get(key) ?? spans.set(key, []).get(key)).push([e.ts, e.ts + e.dur]);
  minTs = Math.min(minTs, e.ts); maxTs = Math.max(maxTs, e.ts + e.dur);
}
const busy = {};
for (const [key, list] of spans) {
  list.sort((a, b) => a[0] - b[0]);
  let total = 0, cur = null;
  for (const [a, b] of list) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b]; }
    else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  const name = (names.get(key) ?? key).replace(/\d+$/, '');
  busy[name] = (busy[name] ?? 0) + total / 1000;
}
const byName = {};
for (const e of events) if (e.ph === 'X' && e.dur) byName[e.name] = (byName[e.name] ?? 0) + e.dur / 1000;
const pick = ['Paint', 'RasterTask', 'ImageDecodeTask', 'Decode Image', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Layerize', 'Commit', 'DrawFrame', 'SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass', 'SkiaOutputSurfaceImplOnGpu::SwapBuffers', 'FireAnimationFrame', 'FunctionCall'];
const f = JSON.parse(frames);
const deltas = f.slice(1).map((t, i) => t - f[i]).slice(-Math.round(elapsed / 16));
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * p)] ?? 0;
const acks = globalThis.acks ?? [];
if (process.env.SHOWACKS) console.log('   acks: ' + acks.map((a) => Math.round(a)).join(','));
const ackInfo = acks.length ? ` ack p50=${pct(acks, 0.5).toFixed(1)} p95=${pct(acks, 0.95).toFixed(1)} max=${Math.max(...acks).toFixed(0)}` : '';
console.log(`${mode.padEnd(7)} ${(variants.join('+') || 'baseline').padEnd(28)} elapsed=${elapsed} frames=${deltas.length} p95=${pct(deltas, 0.95).toFixed(1)}ms${ackInfo}`);
console.log('   busy ms: ' + Object.entries(busy).filter(([, v]) => v > 20).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n}=${v.toFixed(0)}`).join('  '));
console.log('   events:  ' + pick.filter((n) => byName[n]).map((n) => `${n.replace('SkiaOutputSurfaceImplOnGpu::', 'Gpu:')}=${byName[n].toFixed(0)}`).join('  '));
ws.close();
chrome.kill();
process.exit(0);
