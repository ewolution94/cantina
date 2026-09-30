// While the page scrolls, rows slide under a resting cursor and each would switch into its hover
// state and back. Pausing pointer events on the content until scrolling settles means none of
// that happens mid-scroll; the root attribute only toggles when scrolling starts and stops.
//
// Measured (scroll benchmark in the README): this keeps input latency at one frame during wheel
// scrolling. A fixed transparent "shield" over the page instead was slower in Chrome.

const root = document.documentElement;
let settle = 0;

addEventListener(
  'scroll',
  () => {
    if (!settle) root.dataset.scrolling = '';
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      delete root.dataset.scrolling;
      settle = 0;
    }, 140);
  },
  { passive: true },
);
