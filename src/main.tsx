import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { rememberActiveBotFromUrl } from './game/telegramStars';
import './styles.css';

rememberActiveBotFromUrl();

// Инициализация Telegram Mini App (@vkreslegame)
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
    tg.setHeaderColor?.('#120e1e');
    tg.setBackgroundColor?.('#120e1e');
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
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
