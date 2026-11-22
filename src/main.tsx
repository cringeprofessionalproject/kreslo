import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { rememberActiveBotFromUrl } from './game/telegramStars';
import './styles.css';

rememberActiveBotFromUrl();

// Скрипт Telegram грузим только внутри Telegram и не блокируем запуск (telegram.org может быть недоступен)
function isTelegramContext(): boolean {
  const w = window as unknown as { TelegramWebviewProxy?: unknown };
  return (
    Boolean(w.TelegramWebviewProxy) ||
    /tgWebApp/i.test(window.location.hash) ||
    /tgWebApp/i.test(window.location.search) ||
    /Telegram/i.test(navigator.userAgent)
  );
}

function loadTelegramScript(): Promise<void> {
  return new Promise((resolve) => {
    if (!isTelegramContext()) {
      resolve();
      return;
    }
    const sc = document.createElement('script');
    sc.src = 'https://telegram.org/js/telegram-web-app.js';
    sc.async = true;
    const finish = () => resolve();
    sc.onload = finish;
    sc.onerror = finish;
    document.head.appendChild(sc);
    window.setTimeout(finish, 2500);
  });
}

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
    const curBg =
      getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() ||
      '#0c1219';
    tg.setHeaderColor?.(curBg);
    tg.setBackgroundColor?.(curBg);
  } catch {
    // ignore outside Telegram
  }
}

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

void loadTelegramScript().then(() => {
  initTelegramMiniApp();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
