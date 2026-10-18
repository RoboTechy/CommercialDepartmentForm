import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/vazirmatn/arabic-500.css';
import '@fontsource/vazirmatn/arabic-600.css';
import '@fontsource/vazirmatn/arabic-700.css';
import '@fontsource/vazirmatn/latin-400.css';
import '@fontsource/vazirmatn/latin-600.css';
import './index.css';
import { applyTheme, loadTheme } from './utils/theme.ts';

applyTheme(loadTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
