// Applies the saved theme before first paint so there's no flash of the wrong one, and pins
// theme-color to it, which colours an installed app's status bar. Mirrors
// src/lib/state/theme.svelte.ts; keep the two in step.
try {
  var theme = JSON.parse(localStorage.getItem('cantina:settings') || '{}').theme;
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].content = theme === 'light' ? '#f6f5f2' : '#0a0a0c';
  }
} catch (e) {}
