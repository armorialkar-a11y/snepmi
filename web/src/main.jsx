import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';
import { ready } from './lib/telegram.js';
import './styles/site.css';
import './styles/miniapp.css';

ready();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);
