// The menu refresh lets go, whatever webspeiseplan does.
//
// On 2026-10-09 one of Clinch's polls never settled: no answer, no error, no timeout, although its
// request had been aborted. Here that would hold `inflight` for good: no refresh ever again, and
// from the next morning every /api/menu waiting on it. Most tests stub a `fetch` that never
// answers and ignores its abort signal, which is that afternoon in its simplest form.

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berlinDate, createApi, createMenuSource } from '../server/kochwerk.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** A `fetch` that never answers, and counts how often it was asked. */
function hangingFetch() {
  let calls = 0;
  globalThis.fetch = () => {
    calls += 1;
    return new Promise(() => {});
  };
  return { calls: () => calls };
}

/** Every model answers, empty: enough for normalize() to build a (menu-less) document. */
function emptyFetch() {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, content: [] }) });
}

/** Waits for `promise` to settle, either way, and fails the test past `ms`. */
async function within(ms, promise) {
  let timer;
  try {
    return await Promise.race([
      promise.then((value) => ({ value }), (error) => ({ error })),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`still pending after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe('a request upstream never answers', () => {
  it('fails the refresh at its deadline even when fetch ignores the abort', async () => {
    hangingFetch();
    const source = createMenuSource({ cacheFile: null, timeout: 50 });
    const { error } = await within(1_000, source.get());
    assert.match(error.message, /no answer within 50ms/);
  });

  it('fails it when the headers arrive and the body never does', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, text: () => new Promise(() => {}) });
    const source = createMenuSource({ cacheFile: null, timeout: 50 });
    const { error } = await within(1_000, source.get());
    assert.match(error.message, /no answer within 50ms/);
  });

  it('lets go of the refresh, so the next reader asks again', async () => {
    const upstream = hangingFetch();
    const source = createMenuSource({ cacheFile: null, timeout: 50 });
    await within(1_000, source.get());
    const first = upstream.calls();
    assert.ok(first > 0);
    // Before the fix this joined the stuck refresh and asked nobody.
    await within(1_000, source.get());
    assert.equal(upstream.calls(), 2 * first);
    assert.equal(source.stuck, false);
  });
});

describe('the refresh as a whole', () => {
  it('gives up at its own deadline, whatever is holding it', async () => {
    hangingFetch();
    // The request deadline is out of reach here, so only the refresh's can end it.
    const source = createMenuSource({ cacheFile: null, timeout: 1_000, refreshDeadline: 50 });
    const { error } = await within(500, source.get());
    assert.match(error.message, /no answer within 50ms/);
  });

  it("on a new day waits for it, then falls back to yesterday's menu", async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T10:00:00Z') });
    emptyFetch();
    const source = createMenuSource({ cacheFile: null, timeout: 50, refreshDeadline: 100 });
    const yesterday = await source.get();
    assert.equal(yesterday.doc.today, '2026-10-12');

    t.mock.timers.tick(24 * 60 * 60_000);
    assert.equal(berlinDate(), '2026-10-13');
    hangingFetch();
    const { value } = await within(1_000, source.get());
    assert.equal(value, yesterday);
  });

  it('counts as stuck only once it has outlived its deadline', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    hangingFetch();
    // Both deadlines out of reach: the refresh stays in flight while the clock moves.
    const source = createMenuSource({ cacheFile: null, timeout: 300, refreshDeadline: 300 });
    const api = createApi({ source });
    void source.get().catch(() => {});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.stuck(), false);

    t.mock.timers.tick(300 + 60_001);
    assert.equal(source.stuck, true);
    assert.equal(api.stuck(), true);
  });
});
