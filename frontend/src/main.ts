import { startApp } from './app';
import { initLanguage } from './i18n';

void initLanguage().finally(startApp);
