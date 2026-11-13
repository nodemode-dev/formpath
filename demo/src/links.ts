import './links.css';

const PAGES: ReadonlyArray<{ id: string; label: string; path: string }> = [
  { id: 'poster', label: 'Poster', path: 'demo/index.html' },
  { id: 'icons', label: 'Icons', path: 'demos/icons/index.html' },
  { id: 'pattern', label: 'Pattern', path: 'demos/pattern/index.html' },
];

export function mountLinks(current: string): void {
  const up = current === 'poster' ? '../' : '../../';
  const nav = document.createElement('nav');
  nav.className = 'dz-links';
  nav.setAttribute('aria-label', 'formpath demos');
  const head = document.createElement('span');
  head.textContent = 'Demos';
  nav.append(head);
  for (const p of PAGES) {
    const a = document.createElement('a');
    a.href = `${up}${p.path}`;
    a.textContent = p.label;
    if (p.id === current) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  document.body.append(nav);
}
