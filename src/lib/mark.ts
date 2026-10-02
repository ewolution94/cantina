// The mark: fork, plate and knife, the app icon's drawing on its 1024 grid
// (development/plans/app-icons, the Field set). The dot on the plate is today's dish.
// brand/ and public/ hold the icons drawn from the same shapes.

export const FORK =
  'M178 278 a20 20 0 0 1 40 0 V400 h18 V278 a20 20 0 0 1 40 0 V400 h18 V278 a20 20 0 0 1 40 0 V430 c0 46 -26 76 -60 88 V732 a38 38 0 0 1 -76 0 V518 c-34 -12 -60 -42 -60 -88 Z';

export const KNIFE =
  'M808 264 c-64 30 -92 120 -92 214 c0 30 12 48 38 56 V732 a38 38 0 0 0 76 0 V300 c0 -26 -10 -42 -22 -36 Z';

/** The plate's rim: a ring from r 109.2 to 166.8, filled with the even-odd rule. */
export const PLATE =
  'M345.2 512 a166.8 166.8 0 1 0 333.6 0 a166.8 166.8 0 1 0 -333.6 0 Z M402.8 512 a109.2 109.2 0 1 0 218.4 0 a109.2 109.2 0 1 0 -218.4 0 Z';

export const DISH = { cx: 512, cy: 512, r: 63 };

/** A square around the three shapes (they span x 138–830, y 258–770). */
export const VIEWBOX = '130 160 708 708';
