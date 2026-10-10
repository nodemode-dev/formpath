const svg = (body: string, x: number, y: number, fallback = 'default'): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`)}") ${x} ${y}, ${fallback}`;

const ARROW = 'M4 2 L4 18 L8.2 14.2 L11 20.5 L13.6 19.3 L10.9 13.2 L16.5 13.2 Z';
const PEN = 'M5 21 L7.5 13.5 L15 6 L18 9 L10.5 16.5 Z M15 6 L17 4 L20 7 L18 9';
const badge = (k: 'plus' | 'minus' | 'x' | 'o' | 'caret' | 'slash'): string => {
  switch (k) {
    case 'plus': return '<path d="M17 16 h5 M19.5 13.5 v5" stroke="#000" stroke-width="3"/><path d="M17 16 h5 M19.5 13.5 v5" stroke="#fff" stroke-width="1.2"/>';
    case 'minus': return '<path d="M17 16 h5" stroke="#000" stroke-width="3"/><path d="M17 16 h5" stroke="#fff" stroke-width="1.2"/>';
    case 'x': return '<path d="M17 13.5 l4.5 4.5 M21.5 13.5 l-4.5 4.5" stroke="#000" stroke-width="3"/><path d="M17 13.5 l4.5 4.5 M21.5 13.5 l-4.5 4.5" stroke="#fff" stroke-width="1.2"/>';
    case 'o': return '<circle cx="19.5" cy="16" r="2.4" fill="none" stroke="#000" stroke-width="3"/><circle cx="19.5" cy="16" r="2.4" fill="none" stroke="#fff" stroke-width="1.2"/>';
    case 'caret': return '<path d="M16.5 18 l3 -4 l3 4" fill="none" stroke="#000" stroke-width="3"/><path d="M16.5 18 l3 -4 l3 4" fill="none" stroke="#fff" stroke-width="1.2"/>';
    case 'slash': return '<path d="M17 18.5 l5 -5" stroke="#000" stroke-width="3"/><path d="M17 18.5 l5 -5" stroke="#fff" stroke-width="1.2"/>';
  }
};

export const CURSORS = {
  select: svg(`<path d="${ARROW}" fill="#000" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`, 4, 2),
  selectCopy: svg(`<path d="${ARROW}" fill="#000" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="${ARROW}" transform="translate(7 5) scale(.55)" fill="#fff" stroke="#000" stroke-width="2"/>`, 4, 2),
  direct: svg(`<path d="${ARROW}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>`, 4, 2),
  directPoint: svg(`<path d="${ARROW}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><rect x="16" y="15" width="4" height="4" fill="#fff" stroke="#000"/>`, 4, 2),
  groupSelect: svg(`<path d="${ARROW}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('plus')}`, 4, 2),
  pen: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('x')}`, 5, 21, 'crosshair'),
  penPlain: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>`, 5, 21, 'crosshair'),
  penAdd: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('plus')}`, 5, 21, 'crosshair'),
  penDelete: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('minus')}`, 5, 21, 'crosshair'),
  penClose: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('o')}`, 5, 21, 'crosshair'),
  penConvert: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('caret')}`, 5, 21, 'crosshair'),
  penContinue: svg(`<path d="${PEN}" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>${badge('slash')}`, 5, 21, 'crosshair'),
  anchor: svg('<path d="M5 20 L11 6 L17 20" fill="none" stroke="#000" stroke-width="3"/><path d="M5 20 L11 6 L17 20" fill="none" stroke="#fff" stroke-width="1.2"/>', 11, 6, 'crosshair'),
  pencil: svg('<path d="M3 21 L4.5 16 L16 4.5 L19.5 8 L8 19.5 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>', 3, 21, 'crosshair'),
  brush: svg('<path d="M3 21 C3 17 5 16 7 16 C9 16 9.5 18 8.5 19.5 C7.5 21 5 21 3 21 Z M8 16 L19 4.5 L20.5 6 L9.5 17.5" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>', 3, 21, 'crosshair'),
  rotate: svg('<path d="M6 12 A6 6 0 1 1 12 18" fill="none" stroke="#000" stroke-width="3.2"/><path d="M6 12 A6 6 0 1 1 12 18" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M3 10 L6 14 L9 10 Z" fill="#fff" stroke="#000"/>', 12, 12, 'crosshair'),
  eyedropper: svg('<path d="M3 21 L4 17 L13 8 L16 11 L7 20 Z M13 8 L15.5 5.5 A2 2 0 0 1 18.5 8.5 L16 11" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>', 3, 21, 'crosshair'),
  bucket: svg('<path d="M5 12 L12 5 L19 12 L12 19 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><path d="M19 12 C21 15 21 17 20 18 C19 19 18 18 18 16 Z" fill="#000"/>', 20, 19, 'crosshair'),
  scissors: svg('<circle cx="6" cy="17" r="3" fill="#fff" stroke="#000" stroke-width="1.2"/><circle cx="18" cy="17" r="3" fill="#fff" stroke="#000" stroke-width="1.2"/><path d="M8 15 L16 3 M16 15 L8 3" stroke="#000" stroke-width="1.6"/>', 12, 9, 'crosshair'),
  knife: svg('<path d="M4 20 L18 4 L20 6 L8 20 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>', 4, 20, 'crosshair'),
  shaper: svg('<path d="M3 21 L4.5 16 L14 6.5 L17.5 10 L8 19.5 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><rect x="15" y="1.5" width="5" height="5" fill="#fff" stroke="#000" stroke-width="1.1"/><circle cx="20" cy="15" r="2.6" fill="#fff" stroke="#000" stroke-width="1.1"/>', 3, 21, 'crosshair'),
  intertwine: svg(`<path d="${ARROW}" fill="#000" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><circle cx="16" cy="17" r="3" fill="none" stroke="#000" stroke-width="2.6"/><circle cx="20" cy="17" r="3" fill="none" stroke="#000" stroke-width="2.6"/><circle cx="16" cy="17" r="3" fill="none" stroke="#fff" stroke-width="1.1"/><path d="M17 14.2 A3 3 0 1 1 17 19.8" fill="none" stroke="#fff" stroke-width="1.1"/>`, 4, 2),
  cross: 'crosshair',
  loadedText: svg('<rect x="4" y="5" width="13" height="15" fill="#fff" stroke="#000" stroke-width="1.2"/><path d="M6.5 9 h8 M6.5 12 h8 M6.5 15 h5" stroke="#000" stroke-width="1.4"/><path d="M1 1 v6 M1 1 h6" stroke="#000" stroke-width="1.6"/>', 1, 1, 'crosshair'),
  type: 'text',
  typeVertical: 'vertical-text',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
  hand: 'grab',
} as const;

export function cursorFor(handle: number): string {
  return ['nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize'][handle] ?? 'default';
}
