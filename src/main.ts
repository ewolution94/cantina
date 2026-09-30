import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import './app.css';
import './lib/scrolling';

import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });

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
