import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import './app.css';
import './lib/scrolling';
// Every tap answers on a phone (Folio's pressFeedback, plans/mobile-touch.md); Cantina is the pilot.
import { pressFeedback } from '../vendor/ewo/elements/press.js';

import { mount } from 'svelte';
import App from './App.svelte';

pressFeedback();

function start() {
  mount(App, { target: document.getElementById('app')! });
  requestAnimationFrame(() => dispatchEvent(new Event('splash:ready')));
}

// Installed, the app opens on the splash screen (index.html, switched on by public/boot.js; written by
// development/plans/splash-rollout). iOS fades its launch image into the page as soon as the page has
// laid out, so the splash has to be on screen before the app's first render takes the main thread, or
// the fade goes through a blank white web view. It lifts a frame after the app has mounted.
if (document.documentElement.classList.contains('splash')) {
  let started = false;
  const once = () => {
    if (started) return;
    started = true;
    start();
  };
  requestAnimationFrame(() => setTimeout(once));
  setTimeout(once, 100);
} else {
  start();
}

if (import.meta.env.DEV) {
  void import('./lib/state/app.svelte').then(({ app }) => Object.assign(window, { __cantina: app }));
}

/**
 * The offline shell and last menu (see public/sw.js). Production only: a worker in front of
 * the dev server would cache the modules Vite is trying to hot-replace.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
