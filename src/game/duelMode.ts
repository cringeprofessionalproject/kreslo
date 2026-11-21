import type { DilemmaCard, JobPack, PackId } from '../types';
import { prepareBalancedCard } from './balanceMath';
import { getTelegramBotAppUrl } from './telegramStars';

/**
 * РЕЖИМ «⚔️ БЛИЦ-ДУЭЛЬ ПО ССЫЛКЕ» (v39):
 * - 6 убойных карточек на одинаковом детерминированном раскладе (seed), урон ×1.65 (партия ~40 сек).
 * - Пока игрок думает — ход соперника засекречен («👻 Тень соперника: ход скрыт»).
 * - Сразу после свайпа вспыхивает: совпали, разошлись или «🔥 Именно здесь соперник сгорел!».
 * - Ссылка кодируется в компактный Telegram-совместимый startapp параметр ([A-Za-z0-9_-] без точек и амперсандов!):
 *   `duel_<packIdx>_<seedBase36>_<movesMask>_<diedAt>_<encodedName>`
 */

export const DUEL_BLITZ_LENGTH = 6;
export const DUEL_DAMAGE_MULT = 1.65;

const PACK_CODE_LIST: PackId[] = [
  'office_manager',
  'pvz_december',
  'wb_seller',
  'sales_rop',
  'it_product',
  'renovation_pro',
  'car_flipper',
  'plastic_surgeon',
  'barista_pro',
  'smm_insta',
  'ai_agent',
  'sales_manager',
  'sec_sysadmin',
  'tender_44fz',
  'it_cfo',
  'ux_designer',
  'hr_family',
  'cctv_installer',
  'scs_designer',
  'nvc_master',
];

export interface DuelGhostData {
  packId: PackId;
  seed: number;
  /** Массив ходов соперника ('L' | 'R') до момента вылета или победы */
  moves: Array<'L' | 'R'>;
  /** Индекс хода (0..5), на котором соперник сгорел, либо 6 если прошёл все 6/6 */
  survivedCount: number;
  challengerName: string;
}

function encodeChallengerName(raw: string): string {
  const clean = raw.trim().slice(0, 14);
  if (!clean) return 'Drug';
  try {
    const bytes = new TextEncoder().encode(clean);
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return 'Drug';
  }
}

function decodeChallengerName(b64url: string): string {
  if (!b64url) return 'Соперник';
  try {
    const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes).trim() || 'Соперник';
  } catch {
    return 'Соперник';
  }
}

export function encodeDuelStartParam(data: DuelGhostData): string {
  const pIdx = Math.max(0, PACK_CODE_LIST.indexOf(data.packId)).toString(36);
  const seedStr = (data.seed >>> 0).toString(36);
  const movesChars = data.moves.map((m) => (m === 'R' ? '1' : '0')).join('') || '0';
  const surv = Math.max(0, Math.min(DUEL_BLITZ_LENGTH, data.survivedCount)).toString(36);
  const namePart = encodeChallengerName(data.challengerName);
  return `duel_${pIdx}_${seedStr}_${movesChars}_${surv}_${namePart}`;
}

export function decodeDuelStartParam(param: string | null | undefined): DuelGhostData | null {
  if (!param || !param.startsWith('duel_')) return null;
  const parts = param.split('_');
  if (parts.length < 5) return null;
  const pIdx = parseInt(parts[1], 36);
  const packId = PACK_CODE_LIST[pIdx] ?? 'office_manager';
  const seed = parseInt(parts[2], 36);
  if (!Number.isFinite(seed)) return null;
  const movesRaw = parts[3] || '';
  const moves: Array<'L' | 'R'> = movesRaw
    .slice(0, DUEL_BLITZ_LENGTH)
    .split('')
    .map((ch) => (ch === '1' ? 'R' : 'L'));
  const survivedCount = Math.max(0, Math.min(DUEL_BLITZ_LENGTH, parseInt(parts[4], 36) || 0));
  const challengerName = decodeChallengerName(parts.slice(5).join('_'));
  return { packId, seed, moves, survivedCount, challengerName };
}

export function parseDuelRouteFromWindow(): DuelGhostData | null {
  if (typeof window === 'undefined') return null;
  try {
    const tgStart = (
      window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } };
      }
    ).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (tgStart && tgStart.startsWith('duel_')) {
      return decodeDuelStartParam(tgStart);
    }
    const sp = new URLSearchParams(window.location.search);
    const qStart = sp.get('tgWebAppStartParam') || sp.get('duel');
    if (qStart) {
      return decodeDuelStartParam(qStart.startsWith('duel_') ? qStart : `duel_${qStart}`);
    }
  } catch {
    // ignore
  }
  return null;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Собирает детерминированную колоду из 6 ярких карточек (включая хотя бы 1 с realCase, если есть) */
export function buildDeterministicDuelDeck(pack: JobPack, seed: number): DilemmaCard[] {
  const rng = mulberry32(seed);
  const pool = [...pack.deckCards];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const withProof = pool.filter((c) => c.realCase);
  const others = pool.filter((c) => !c.realCase);
  const selected: DilemmaCard[] = [];

  if (withProof.length > 0) {
    selected.push(withProof[0]);
  }
  for (const c of others) {
    if (selected.length >= DUEL_BLITZ_LENGTH) break;
    selected.push(c);
  }
  for (const c of withProof.slice(1)) {
    if (selected.length >= DUEL_BLITZ_LENGTH) break;
    selected.push(c);
  }

  // Перемешаем выбранные 6 карт тем же seed, чтобы карточка с пруфом не всегда была 1-й
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected.map((c) => prepareBalancedCard(c));
}

export function buildDuelSharePayload(data: DuelGhostData, packTitle: string): {
  url: string;
  text: string;
} {
  const startParam = encodeDuelStartParam(data);
  const url = getTelegramBotAppUrl(startParam);
  const text =
    data.survivedCount >= DUEL_BLITZ_LENGTH
      ? `Прошёл блиц «${packTitle}» 6 из 6 на двойном уроне. Выстоишь на моём же раскладе за 40 сек?`
      : `Срезался на ${data.survivedCount + 1}-м ходу в «${packTitle}» 💀 Пройдёшь дальше на моём же раскладе?`;
  return { url, text };
}
