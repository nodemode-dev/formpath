import { startApp } from './app';
import { initLanguage } from './i18n';
import { loadWindowKey } from './io/window-key';

void Promise.all([loadWindowKey(), initLanguage().catch(() => undefined)]).finally(startApp);
