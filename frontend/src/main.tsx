import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('No #root element: index.html and main.tsx have drifted apart.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
