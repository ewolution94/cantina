// The mark: a plate seen from above, drawn in halftone. The same dots make the favicon and the
// app icons in brand/ and public/.

const ring = (count: number, radius: number, r: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = (Math.PI * 2 * i) / count + offset;
    return { x: 16 + radius * Math.cos(a), y: 16 + radius * Math.sin(a), r };
  });

export const MARK_DOTS = [{ x: 16, y: 16, r: 2.7 }, ...ring(6, 6.1, 1.75, Math.PI / 6), ...ring(12, 10.4, 0.95)];
