const wait = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));
const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()));

async function card(id: string): Promise<HTMLElement> {
  for (let i = 0; i < 400; i++) {
    const b = document.querySelector<HTMLElement>(`[data-demo-open="${id}"]`);
    if (b && document.body.classList.contains('app-ready')) return b;
    await wait(50);
  }
  throw new Error('The demo window did not start.');
}

export async function openSession(id: string): Promise<void> {
  try {
    (await card(id)).click();
    for (let i = 0; i < 600 && document.querySelector('.cv-home-demo[aria-busy="true"]'); i++) await wait(50);
  } finally {
    await frame();
    await frame();
    document.documentElement.removeAttribute('data-demo');
  }
}
