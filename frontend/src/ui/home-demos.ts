import type { DemoId } from '../demos';

export interface DemoCard { id: DemoId; title: string; blurb: string; art: string }

const svg = (body: string): string => `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">${body}</svg>`;

const petals = Array.from({ length: 9 }, (_, i) => `<path class="cv-demo-a" opacity="0.8" transform="rotate(${i * 40} 252 84)" d="M252 80c7-6 7-20 0-30c-7 10-7 24 0 30z"/>`).join('');
const glyphs = Array.from({ length: 12 }, (_, i) => `<rect class="cv-demo-b" x="${28 + (i % 4) * 44}" y="${30 + Math.floor(i / 4) * 44}" width="36" height="36" rx="6"/><circle class="cv-demo-c" cx="${46 + (i % 4) * 44}" cy="${48 + Math.floor(i / 4) * 44}" r="${7 + (i % 3)}"/>`).join('');
const tiles = Array.from({ length: 20 }, (_, i) => { const x = 30 + (i % 4) * 30 + (Math.floor(i / 4) % 2) * 15, y = 26 + Math.floor(i / 4) * 28; return `<circle class="cv-demo-a" cx="${x}" cy="${y}" r="7"/><path class="cv-demo-line" d="M${x - 10} ${y + 13}q5-5 10 0t10 0"/>`; }).join('');
const blend = Array.from({ length: 8 }, (_, i) => `<circle class="cv-demo-a" opacity="${(0.3 + i * 0.1).toFixed(1)}" cx="${180 + i * 16}" cy="${40 - i}" r="${11 - i * 0.6}"/>`).join('');

export const DEMO_CARDS: readonly DemoCard[] = [
  {
    id: 'poster', title: 'Poster and type', blurb: 'A festival poster and its programme: gradients, a gradient mesh, a blend, type on a path, columns and graphic styles.',
    art: svg(`<rect class="cv-demo-b" x="40" y="14" width="104" height="152" rx="4"/><circle class="cv-demo-a" cx="102" cy="78" r="20"/><path class="cv-demo-c" d="M40 104c20-14 40-14 60 0v62H40z"/><path class="cv-demo-a" opacity="0.4" d="M62 66l82-16v26z"/><rect class="cv-demo-c" x="56" y="126" width="72" height="9" rx="2"/><rect class="cv-demo-c" x="62" y="140" width="60" height="9" rx="2"/><rect class="cv-demo-b" x="176" y="14" width="104" height="152" rx="4"/><rect class="cv-demo-c" x="188" y="28" width="56" height="10" rx="2"/><path class="cv-demo-line" d="M188 48c24-4 56 4 80-2"/>${[60, 72, 84, 96, 108, 120].map((y) => `<rect class="cv-demo-c" opacity="0.6" x="188" y="${y}" width="36" height="4" rx="2"/><rect class="cv-demo-c" opacity="0.6" x="232" y="${y}" width="36" height="4" rx="2"/>`).join('')}`),
  },
  {
    id: 'icons', title: 'Icons and a logo', blurb: 'Twelve icons on their own artboards, made with Pathfinder, Shape Crafter and compound paths, and a radial repeat logo.',
    art: svg(`${glyphs}${petals}<circle class="cv-demo-c" cx="252" cy="84" r="7"/><rect class="cv-demo-c" x="216" y="122" width="72" height="8" rx="2"/>`),
  },
  {
    id: 'pattern', title: 'Patterns and colour', blurb: 'A seamless pattern swatch, a blend, an envelope, an extruded 3D badge and three colourways from Recolor Art.',
    art: svg(`<rect class="cv-demo-b" x="18" y="12" width="128" height="156" rx="10"/>${tiles}${blend}<path class="cv-demo-c" d="M178 84q24-14 48 0t48 0v18q-24-14-48 0t-48 0z"/><path class="cv-demo-a" d="M206 118l18 10v20l-18 10-18-10v-20z"/>${[0, 1, 2, 3, 4].map((i) => `<rect class="cv-demo-c" opacity="${(0.4 + i * 0.12).toFixed(2)}" x="${244 + i * 14}" y="126" width="11" height="11" rx="3"/>`).join('')}`),
  },
];
