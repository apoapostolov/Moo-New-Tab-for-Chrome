import './lib/extensionApi';
import { createRoot } from 'react-dom/client';
import Modal from 'react-modal';

import App from './App';
import ErrorBoundary from './ErrorBoundary';
import variables from './config/variables';

import './scss/index.scss';
// the toast css is based on default so we need to import it
import 'react-toastify/dist/ReactToastify.css';

import { selectLanguage } from 'lib/translations';

import { migrateScratchAssets } from './utils/customBackgroundDB';
import { recoverProfileChange, withProfileLock } from './utils/settings/profile';
import runMigrations from './utils/settings/migrations';
import { moveSettings } from './utils/settings/move';

async function start() {
  await withProfileLock(async () => {
    await recoverProfileChange();
    moveSettings();
    await migrateScratchAssets();
  });
  // Before anything reads a setting, so no component mounts with a stale value.
  runMigrations();

  const languagecode = localStorage.getItem('language') || 'en_GB';
  const translation = await selectLanguage(languagecode);
  variables.language = translation.instance;
  variables.languagecode = translation.language;
  document.documentElement.lang = languagecode.replace('_', '-');

  variables.getMessage = (text, optional) =>
    variables.language.getMessage(variables.languagecode, text, optional || {});

  const container = document.getElementById('root');
  Modal.setAppElement(container);
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
start().catch((error) => {
  const root = document.getElementById('root');
  root.textContent = `Moo could not open its saved data. Reload to try again. ${error.message}`;
});
