export const toasts = $state<{ id: number; text: string }[]>([]);

let next = 0;

export function toast(text: string) {
  const id = ++next;
  toasts.push({ id, text });
  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index > -1) toasts.splice(index, 1);
  }, 2800);
}
