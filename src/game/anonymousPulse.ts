import type { PackId } from '../types';

export type PulseEventName =
  | 'run_start'
  | 'swipe'
  | 'block_clear'
  | 'unlock_more'
  | 'share_click'
  | 'camera_on'
  | 'sms_open'
  | 'b2b_click';

export interface ServerAggregateStats {
  updatedAtDay: string;
  totals: {
    runsStarted: number;
    swipesTotal: number;
    blocksCleared: number;
    unlockMoreClicks: number;
    sharesClicked: number;
    cameraActivations: number;
    smsEventsOpened: number;
    b2bLeadClicks: number;
  };
  packPlays: Partial<Record<PackId, number>>;
  unlockMoreByPack: Partial<Record<PackId, number>>;
  unlockMoreBySource: Record<string, number>;
  daily: Record<
    string,
    {
      runs: number;
      swipes: number;
      unlocks: number;
      shares: number;
    }
  >;
}

/**
 * Отправляет строго безымянный атомарный инкремент счётчика (+1 к событию).
 * - credentials: 'omit' гарантирует, что браузер НЕ прикрепляет никакие cookies.
 * - В теле передаётся ТОЛЬКО тип события и код курса (без user_id, session_id, экрана и времени).
 * - На сервере IP-адрес и User-Agent полностью игнорируются и нигде не сохраняются (0% ПДн по 152-ФЗ).
 */
export function sendAnonymousPulse(
  event: PulseEventName,
  packId?: PackId,
  source?: string
): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    void fetch('./api/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, packId, source }),
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {
      // В офлайн-режиме или на чистой статике без контейнера тихо игнорируем
    });
  } catch {
    // ignore
  }
}

export async function fetchServerAggregateStats(): Promise<ServerAggregateStats | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('./api/stats', {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ServerAggregateStats;
    if (!data || typeof data.totals?.runsStarted !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}
