import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Мягкая инициализация Telegram Mini App (если открыто внутри @heuristic_p1_bot)
function initTelegramMiniApp() {
  const tg = (
    window as unknown as {
      Telegram?: {
        WebApp?: {
          ready?: () => void;
          expand?: () => void;
          disableVerticalSwipes?: () => void;
          setHeaderColor?: (color: string) => void;
          setBackgroundColor?: (color: string) => void;
        };
      };
    }
  ).Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready?.();
    tg.expand?.();
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.('#0d1512');
    tg.setBackgroundColor?.('#0d1512');
  } catch {
    // ignore outside Telegram
  }
}

initTelegramMiniApp();
window.addEventListener('load', initTelegramMiniApp);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {});
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
