/**
 * Прямой чекаут Telegram Stars (189 ★ за модуль) через многоразовые invoice-ссылки.
 * - Телефон пользователя общается ТОЛЬКО с серверами Telegram (0 запросов на российский VPS!).
 * - Для подтверждения `pre_checkout_query` достаточно 28-строчного Cloudflare Worker
 *   (`scripts/telegram-stars-worker.js`), который общается напрямую с серверами Telegram.
 */

import type { PackId } from '../types';

export const TELEGRAM_STARS_PRICE = 189;
export const BARISTA_STARS_PRICE = 1;

// Включено: Cloudflare Worker (kreslo-stars.koshernoe-detya.workers.dev) и Telegram setWebhook активны!
export const TELEGRAM_STARS_LIVE = true;

export const TELEGRAM_STARS_INVOICES: Record<2 | 3, string> = {
  2: 'https://t.me/$Pc1WIZoSAEidGgAASURU7RXloks',
  3: 'https://t.me/$NeGzlpoSAEieGgAAvHYw3DGYJB0',
};

export const BARISTA_STARS_INVOICES: Record<2 | 3, string> = {
  2: 'https://t.me/$DVoZi5LDAUhKGwAA_dpSeHuxHiE',
  3: 'https://t.me/$6X7cHZLDAUhLGwAAbP_iYpcsEAM',
};

export function getTelegramStarsPriceForPack(packId?: PackId): number {
  return packId === 'barista_pro' ? BARISTA_STARS_PRICE : TELEGRAM_STARS_PRICE;
}

interface TgWebAppLike {
  initData?: string;
  openInvoice?: (url: string, cb?: (status: string) => void) => void;
}

export function isRunningInsideTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebAppLike } }).Telegram?.WebApp;
  return Boolean(tg && typeof tg.openInvoice === 'function' && tg.initData);
}

export function openTelegramStarsCheckout(
  blockNum: 2 | 3,
  packId?: PackId
): Promise<'paid' | 'cancelled' | 'failed' | 'unavailable'> {
  if (!TELEGRAM_STARS_LIVE || !isRunningInsideTelegramMiniApp()) {
    return Promise.resolve('unavailable');
  }
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebAppLike } }).Telegram?.WebApp;
  const url =
    packId === 'barista_pro'
      ? BARISTA_STARS_INVOICES[blockNum]
      : TELEGRAM_STARS_INVOICES[blockNum];
  if (!tg?.openInvoice || !url) {
    return Promise.resolve('unavailable');
  }

  return new Promise((resolve) => {
    try {
      tg.openInvoice!(url, (status) => {
        if (status === 'paid') resolve('paid');
        else if (status === 'cancelled') resolve('cancelled');
        else resolve('failed');
      });
    } catch {
      resolve('failed');
    }
  });
}
