/**
 * Census, the self-hosted visit counter: no cookies, nothing stored on the device. The beacon
 * comes from our own origin (server/census.mjs forwards /_e.js and /_e), so the CSP stays 'self'.
 *
 * The beacon counts every path change as a page view, so it's loaded only once the first route
 * is settled: a bare / turns into /<start outlet> through replaceState, and loading it earlier
 * would count that one visit twice. Production only, like the service worker.
 */
let loaded = false;

export function loadCensus() {
  if (loaded || !import.meta.env.PROD) return;
  loaded = true;
  const script = document.createElement('script');
  script.src = '/_e.js';
  document.head.append(script);
}
