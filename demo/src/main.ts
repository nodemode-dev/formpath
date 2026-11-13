import './shim/api';
import '../../frontend/src/main';
import { mountLinks } from './links';
import { openSession } from './session';

const id = document.documentElement.dataset.demoId ?? 'poster';
mountLinks(id);
void openSession(id);
