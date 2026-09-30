// The mark: a fork and a spoon, drawn on a 32-unit grid. The same shapes make the favicon and the
// app icons in brand/ and public/icons/.

export type MarkShape =
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { tag: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'path'; d: string };

export const MARK: MarkShape[] = [
  { tag: 'rect', x: 6.62, y: 3.2, width: 1.75, height: 8.60, rx: 0.875 },
  { tag: 'rect', x: 9.53, y: 3.2, width: 1.75, height: 8.60, rx: 0.875 },
  { tag: 'rect', x: 12.43, y: 3.2, width: 1.75, height: 8.60, rx: 0.875 },
  { tag: 'path', d: "M6.62 10.40H14.18V11.60C14.18 13.80 12.30 15.30 11.50 15.60H9.30C8.50 15.30 6.62 13.80 6.62 11.60Z" },
  { tag: 'rect', x: 9.20, y: 13.70, width: 2.4, height: 15.10, rx: 1.2 },
  { tag: 'ellipse', cx: 21.7, cy: 8.7, rx: 4.2, ry: 5.5 },
  { tag: 'path', d: "M20.50 13.2C20.50 13.2 21.20 14.2 20.80 15.5L20.50 27.6A1.2 1.2 0 0 0 22.90 27.6L22.60 15.5C22.20 14.2 22.90 13.2 22.90 13.2Z" },
  { tag: 'rect', x: 20.50, y: 15, width: 2.4, height: 13.8, rx: 1.2 },
];
