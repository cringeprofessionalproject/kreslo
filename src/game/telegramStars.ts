import type { PackId } from '../types';

/**
 * Монетизация Telegram Stars (@vkreslegame + обратная совместимость с @heuristic_p1_bot):
 * - Поштучная продажа модулей под пакеты Stars: Блок 2 = 79 ★ (оставляет 21 ★ горячей сдачи с пакета 100 ★!), Блок 3 = 99 ★.
 * - Гача-продолжения при срыве смены («Удержать кресло с этого хода»): лесенка 5 ★ -> 9 ★ -> 15 ★.
 * - Облачная синхронизация покупок через встроенный Telegram.WebApp.CloudStorage (0% ПДн, работает между телефоном и ноутбуком).
 */

export const TELEGRAM_STARS_BLOCK2_PRICE = 79;
export const TELEGRAM_STARS_BLOCK3_PRICE = 99;
export const BARISTA_STARS_PRICE = 1; // Тестовая цена 1 ★ на Кофейне

export const GACHA_SAVE_PRICES = [5, 9, 15] as const;
export const GACHA_FREE_DEATHS_GRACE = 2; // С 3-го срыва (или сразу в Блоках 2–3) предлагаем продолжить за ★

export const TELEGRAM_PRIMARY_BOT = 'vkreslegame';
export const TELEGRAM_STARS_LIVE = true;

type BotKey = 'vkreslegame' | 'heuristic_p1_bot';

interface BotInvoiceSet {
  block_2: string;
  block_3: string;
  barista_2: string;
  barista_3: string;
  save_5: string;
  save_9: string;
  save_15: string;
}

const INVOICES_BY_BOT: Record<BotKey, BotInvoiceSet> = {
  vkreslegame: {
    block_2: 'https://t.me/$dMCccO8OEUiOGAAASqvczTZGnDw',
    block_3: 'https://t.me/$AWxdI-8OEUiPGAAAJCu5essVt0Q',
    barista_2: 'https://t.me/$zcpirO8OEUiQGAAAdn5geAPGO_Q',
    barista_3: 'https://t.me/$WQ14CO8OEUiRGAAAdpuSEKJSD7M',
    save_5: 'https://t.me/$z-xZHe8OEUiSGAAAVXgU21G7Ohs',
    save_9: 'https://t.me/$4hYQOu8OEUiTGAAAVc5o3_cToH4',
    save_15: 'https://t.me/$iEGWP-8OEUiUGAAA2fAgEAia-FI',
  },
  heuristic_p1_bot: {
    block_2: 'https://t.me/$VO-gNdLKEUgOHwAA_l2kMUvpU-w',
    block_3: 'https://t.me/$n_69GtLKEUgPHwAAX17dJWOPw_w',
    barista_2: 'https://t.me/$_3f529LKEUgQHwAAptik0ETrPwc',
    barista_3: 'https://t.me/$62eyAdLKEUgRHwAAKKJFLxfvZKM',
    save_5: 'https://t.me/$Y8s3YtLKEUgSHwAA6RFl9SqckRU',
    save_9: 'https://t.me/$EP2kEtLKEUgTHwAAqxuMcQR85uU',
    save_15: 'https://t.me/$K0H6RNLKEUgUHwAA1nrA5JzHhcQ',
  },
};

interface TgCloudStorageLike {
  getItem: (key: string, cb: (err: unknown, value?: string) => void) => void;
  setItem: (key: string, value: string, cb?: (err: unknown, stored?: boolean) => void) => void;
}

interface TgWebAppLike {
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
    user?: { id?: number; first_name?: string; username?: string };
  };
  openInvoice?: (url: string, cb?: (status: string) => void) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  CloudStorage?: TgCloudStorageLike;
}

function getTgWebApp(): TgWebAppLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebAppLike } }).Telegram?.WebApp;
}

function detectActiveBotKey(): BotKey {
  if (typeof window === 'undefined') return 'vkreslegame';
  try {
    const params = new URLSearchParams(window.location.search);
    const b = params.get('bot');
    if (b === 'vkreslegame') return 'vkreslegame';
    if (b === 'heuristic_p1_bot') return 'heuristic_p1_bot';
    const cached = sessionStorage.getItem('kreslo_active_bot');
    if (cached === 'vkreslegame' || cached === 'heuristic_p1_bot') {
      return cached;
    }
  } catch {
    // ignore
  }
  // По умолчанию новый основной бот @vkreslegame
  return 'vkreslegame';
}

export function rememberActiveBotFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const b = new URLSearchParams(window.location.search).get('bot');
    if (b === 'vkreslegame' || b === 'heuristic_p1_bot') {
      sessionStorage.setItem('kreslo_active_bot', b);
    }
  } catch {
    // ignore
  }
}

export function getTelegramStarsPriceForPack(packId?: PackId, blockNum: 2 | 3 = 2): number {
  if (packId === 'barista_pro') return BARISTA_STARS_PRICE;
  return blockNum === 3 ? TELEGRAM_STARS_BLOCK3_PRICE : TELEGRAM_STARS_BLOCK2_PRICE;
}

export function getGachaSaveStarsPrice(savesUsedInRun: number): 5 | 9 | 15 {
  if (savesUsedInRun <= 0) return 5;
  if (savesUsedInRun === 1) return 9;
  return 15;
}

export function isRunningInsideTelegramMiniApp(): boolean {
  const tg = getTgWebApp();
  return Boolean(tg && typeof tg.openInvoice === 'function' && tg.initData);
}

/**
 * Чистая публичная ссылка на бота/приложение БЕЗ утечки #tgWebAppData.
 * Используем ?start=..., чтобы Cloudflare Worker всегда выдавал кнопку с пробросом параметра
 * даже без отдельной настройки Main Mini App в BotFather.
 */
export function getTelegramBotAppUrl(startParam?: string): string {
  if (startParam) {
    const clean = startParam.replace(/[^A-Za-z0-9_-]/g, '');
    return `https://t.me/${TELEGRAM_PRIMARY_BOT}?start=${clean}`;
  }
  return `https://t.me/${TELEGRAM_PRIMARY_BOT}`;
}

export const PUBLIC_WEB_GAME_BASE_URL = 'https://cringeprofessionalproject.github.io/kreslo/';

export function getDirectWebPlayUrl(slugOrPackId: string): string {
  const clean = slugOrPackId.replace(/[^A-Za-z0-9_-]/g, '');
  return `${PUBLIC_WEB_GAME_BASE_URL}?play=${clean}`;
}

export function shareLinkViaTelegramOrNative(url: string, text: string): boolean {
  const tg = getTgWebApp();
  if (tg?.openTelegramLink && tg.initData) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(shareUrl);
    return true;
  }
  return false;
}

export function openTelegramDeepLinkOutsideTma(startParam?: string): void {
  const target = getTelegramBotAppUrl(startParam);
  window.open(target, '_blank', 'noopener,noreferrer');
}

function openRawInvoiceUrl(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'unavailable'> {
  if (!TELEGRAM_STARS_LIVE || !isRunningInsideTelegramMiniApp()) {
    return Promise.resolve('unavailable');
  }
  const tg = getTgWebApp();
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

export function openTelegramStarsCheckout(
  blockNum: 2 | 3,
  packId?: PackId
): Promise<'paid' | 'cancelled' | 'failed' | 'unavailable'> {
  const botSet = INVOICES_BY_BOT[detectActiveBotKey()];
  const url =
    packId === 'barista_pro'
      ? blockNum === 3
        ? botSet.barista_3
        : botSet.barista_2
      : blockNum === 3
        ? botSet.block_3
        : botSet.block_2;
  return openRawInvoiceUrl(url);
}

export function openTelegramStarsSaveCheckout(
  savesUsedInRun: number
): Promise<'paid' | 'cancelled' | 'failed' | 'unavailable'> {
  const botSet = INVOICES_BY_BOT[detectActiveBotKey()];
  const tier = getGachaSaveStarsPrice(savesUsedInRun);
  const url = tier === 5 ? botSet.save_5 : tier === 9 ? botSet.save_9 : botSet.save_15;
  return openRawInvoiceUrl(url);
}

// ── ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ ПОКУПОК В TELEGRAM CLOUDSTORAGE (0% ПДн) ──

const CLOUD_PURCHASES_KEY = 'kreslo_purchases_v1';

export interface CloudPurchasesPayload {
  u: Record<string, 1 | 2 | 3>; // unlockedBlockByPack
  c?: Record<string, 1 | 2 | 3>; // checkpointBlockByPack
}

export function hydratePurchasesFromTelegramCloud(): Promise<CloudPurchasesPayload | null> {
  const tg = getTgWebApp();
  if (!tg?.CloudStorage || !tg.initData) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      tg.CloudStorage!.getItem(CLOUD_PURCHASES_KEY, (err, raw) => {
        if (err || !raw) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as CloudPurchasesPayload;
          if (parsed && typeof parsed === 'object' && parsed.u) {
            resolve(parsed);
            return;
          }
        } catch {
          // ignore
        }
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function syncPurchasesToTelegramCloud(
  unlockedBlockByPack: Record<string, 1 | 2 | 3>,
  checkpointBlockByPack: Record<string, 1 | 2 | 3>
): void {
  const tg = getTgWebApp();
  if (!tg?.CloudStorage || !tg.initData) return;
  try {
    const compactUnlocked: Record<string, 1 | 2 | 3> = {};
    for (const [k, v] of Object.entries(unlockedBlockByPack)) {
      if (v > 1) compactUnlocked[k] = v;
    }
    const compactCkpt: Record<string, 1 | 2 | 3> = {};
    for (const [k, v] of Object.entries(checkpointBlockByPack)) {
      if (v > 1) compactCkpt[k] = v;
    }
    const payload: CloudPurchasesPayload = { u: compactUnlocked, c: compactCkpt };
    tg.CloudStorage.setItem(CLOUD_PURCHASES_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}
