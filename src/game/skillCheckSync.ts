import { getSkillCheckById, type SkillCheckCard, type SkillCheckDef, type SkillCheckId } from './skillChecksData';

export type CheckVisibilityMode = 'screening' | 'challenge';

export interface DecodedCheckReceipt {
  raw: string;
  choices: ('left' | 'right')[]; // По каноническому индексу карточки 0..9
  perCardSec: number[]; // Секунды раздумий по каноническому индексу 0..9
  durationSec: number;
  attemptNum: number;
  tabLeaves: number;
  completedAtMs: number;
}

export interface CreatedCheckRecord {
  token: string;
  slug: string;
  checkId: SkillCheckId;
  mode: CheckVisibilityMode;
  createdAtMs: number;
  memo: string; // Хранится СТРОГО локально на устройстве автора (0% ПДн в сети)
  ownerKey: string;
  lastStatus: 'waiting' | 'opened' | 'halfway' | 'completed';
  openedAtMs?: number;
  progressDone?: number;
  receipts: string[]; // Верифицированные слепки прохождений в хронологическом порядке
}

export interface RemoteCheckStatusSnapshot {
  status: 'waiting' | 'opened' | 'halfway' | 'completed';
  openedAtMs?: number;
  progressDone?: number;
  receipts: string[];
  decodedReceipts: DecodedCheckReceipt[];
}

const CREATED_CHECKS_STORAGE_KEY = 'heuristics_kreslo_created_checks_v1';
const ATTEMPT_COUNTER_PREFIX = 'heuristics_kreslo_chk_att_';
const CANDIDATE_DONE_PREFIX = 'heuristics_kreslo_chk_done_';
const BROADCAST_CHANNEL_NAME = 'heuristics_kreslo_chk_bc_v1';
const EPOCH_2026_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 3500
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function notifyLocalBroadcast(ch: string): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.postMessage({ ch, ts: Date.now() });
    bc.close();
  } catch {
    // ignore
  }
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const clean = str.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
    const bin = atob(clean + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function computeTokenTag(slug: string, core8: string, modeChar: string): string {
  const gen = xmur3(`kreslo-tok-v1:${slug}:${core8}:${modeChar}`);
  const h1 = gen();
  const h2 = gen();
  return ALPHANUM[h1 % ALPHANUM.length] + ALPHANUM[h2 % ALPHANUM.length];
}

export function deriveOwnerKey(slug: string, token: string): string {
  const gen = xmur3(`kreslo-owner-pin-v1:${slug}:${token}`);
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += ALPHANUM[gen() % ALPHANUM.length];
  }
  return out;
}

export function deriveChannelKey(slug: string, token: string): string {
  const gen = xmur3(`kreslo-sync-ch-v1:${slug}:${token}`);
  const parts = [gen(), gen(), gen(), gen()].map((n) => n.toString(16).padStart(8, '0'));
  return parts.join('').slice(0, 28);
}

export function generateCheckToken(slug: string, mode: CheckVisibilityMode): string {
  const rand = new Uint32Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 8; i += 1) rand[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let core8 = '';
  for (let i = 0; i < 8; i += 1) {
    core8 += ALPHANUM[rand[i] % ALPHANUM.length];
  }
  const modeChar = mode === 'challenge' ? 'C' : 'S';
  const tag2 = computeTokenTag(slug, core8, modeChar);
  return `${core8}${modeChar}${tag2}`;
}

export function resolveModeFromToken(slug: string, token: string): CheckVisibilityMode {
  if (token.length < 11) return 'screening';
  const core8 = token.slice(0, 8);
  const modeChar = token.slice(8, 9);
  const tag2 = token.slice(9, 11);
  if (computeTokenTag(slug, core8, modeChar) !== tag2) {
    return 'screening';
  }
  return modeChar === 'C' ? 'challenge' : 'screening';
}

export interface OrderedCheckCardItem {
  card: SkillCheckCard;
  canonicalIndex: number;
}

/**
 * Перемешивает ТОЛЬКО порядок следования 10 карточек под конкретную ссылку.
 * Лево/Право внутри самой карточки НЕ меняются местами, чтобы сохранялась
 * естественная Tinder-эргономика («← Влево» = Отказ/Стоп, «Вправо →» = Согласие/Шаг).
 */
export function getOrderedCardsForToken(
  check: SkillCheckDef,
  token: string
): OrderedCheckCardItem[] {
  const items: OrderedCheckCardItem[] = check.cards.map((card, idx) => ({
    card,
    canonicalIndex: idx,
  }));
  const seedFn = xmur3(`kreslo-order-v1:${check.slug}:${token}`);
  const rng = mulberry32(seedFn());
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

function computeMac32(slug: string, token: string, plainBytes: Uint8Array): number {
  let str = `kreslo-mac-v1:${slug}:${token}:`;
  for (let i = 0; i < plainBytes.length; i += 1) {
    str += String.fromCharCode(plainBytes[i]);
  }
  const gen = xmur3(str);
  return (gen() ^ gen()) >>> 0;
}

export function packCheckReceipt(
  slug: string,
  token: string,
  input: {
    choices: ('left' | 'right')[];
    perCardSec: number[];
    durationSec: number;
    attemptNum: number;
    tabLeaves: number;
    completedAtMs?: number;
  }
): string {
  const count = Math.min(10, input.choices.length);
  const plain = new Uint8Array(21);
  plain[0] = 1;

  const completedMin = Math.max(
    0,
    Math.floor(((input.completedAtMs ?? Date.now()) - EPOCH_2026_MS) / 60000)
  );
  plain[1] = (completedMin >>> 24) & 0xff;
  plain[2] = (completedMin >>> 16) & 0xff;
  plain[3] = (completedMin >>> 8) & 0xff;
  plain[4] = completedMin & 0xff;

  const dur = Math.max(1, Math.min(65535, Math.round(input.durationSec)));
  plain[5] = (dur >>> 8) & 0xff;
  plain[6] = dur & 0xff;

  plain[7] = Math.max(1, Math.min(255, Math.round(input.attemptNum)));
  plain[8] = Math.max(0, Math.min(255, Math.round(input.tabLeaves)));

  let bitmask = 0;
  for (let i = 0; i < count; i += 1) {
    if (input.choices[i] === 'right') {
      bitmask |= 1 << i;
    }
  }
  plain[9] = (bitmask >>> 8) & 0xff;
  plain[10] = bitmask & 0xff;

  for (let i = 0; i < 10; i += 1) {
    const sec = Math.max(0, Math.min(255, Math.round(input.perCardSec[i] ?? 0)));
    plain[11 + i] = sec;
  }

  const mac = computeMac32(slug, token, plain);
  const cipher = new Uint8Array(25);
  const streamSeed = xmur3(`kreslo-stream-v1:${slug}:${token}`);
  const rng = mulberry32(streamSeed());

  for (let i = 0; i < 21; i += 1) {
    const maskByte = Math.floor(rng() * 256) & 0xff;
    cipher[i] = plain[i] ^ maskByte;
  }
  cipher[21] = (mac >>> 24) & 0xff;
  cipher[22] = (mac >>> 16) & 0xff;
  cipher[23] = (mac >>> 8) & 0xff;
  cipher[24] = mac & 0xff;

  return toBase64Url(cipher);
}

export function unpackCheckReceipt(
  slug: string,
  token: string,
  receiptStr: string
): DecodedCheckReceipt | null {
  if (!receiptStr || receiptStr.length < 28 || receiptStr.length > 64) return null;
  const cipher = fromBase64Url(receiptStr);
  if (!cipher || cipher.length !== 25) return null;

  const plain = new Uint8Array(21);
  const streamSeed = xmur3(`kreslo-stream-v1:${slug}:${token}`);
  const rng = mulberry32(streamSeed());
  for (let i = 0; i < 21; i += 1) {
    const maskByte = Math.floor(rng() * 256) & 0xff;
    plain[i] = cipher[i] ^ maskByte;
  }

  if (plain[0] !== 1) return null;

  const expectedMac = computeMac32(slug, token, plain);
  const actualMac =
    (((cipher[21] << 24) | (cipher[22] << 16) | (cipher[23] << 8) | cipher[24]) >>> 0);
  if (expectedMac !== actualMac) return null;

  const completedMin =
    (((plain[1] << 24) | (plain[2] << 16) | (plain[3] << 8) | plain[4]) >>> 0);
  const completedAtMs = EPOCH_2026_MS + completedMin * 60000;
  const durationSec = (plain[5] << 8) | plain[6];
  const attemptNum = Math.max(1, plain[7]);
  const tabLeaves = plain[8];
  const bitmask = (plain[9] << 8) | plain[10];

  const choices: ('left' | 'right')[] = [];
  const perCardSec: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    choices.push((bitmask & (1 << i)) !== 0 ? 'right' : 'left');
    perCardSec.push(plain[11 + i]);
  }

  return {
    raw: receiptStr,
    choices,
    perCardSec,
    durationSec,
    attemptNum,
    tabLeaves,
    completedAtMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ЛОКАЛЬНЫЙ РЕЕСТР ССЫЛОК АВТОРА + СЧЁТЧИК ПОПЫТОК УЧАСТНИКА
// ─────────────────────────────────────────────────────────────────────────────

export function loadCreatedChecks(): CreatedCheckRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CREATED_CHECKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CreatedCheckRecord =>
        Boolean(item && typeof item.token === 'string' && typeof item.slug === 'string')
    );
  } catch {
    return [];
  }
}

export function saveCreatedChecks(records: CreatedCheckRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CREATED_CHECKS_STORAGE_KEY, JSON.stringify(records.slice(0, 80)));
  } catch {
    // ignore storage quota errors
  }
}

export function createNewCheckLinkRecord(
  check: SkillCheckDef,
  mode: CheckVisibilityMode,
  memo = ''
): CreatedCheckRecord {
  const token = generateCheckToken(check.slug, mode);
  const record: CreatedCheckRecord = {
    token,
    slug: check.slug,
    checkId: check.id,
    mode,
    createdAtMs: Date.now(),
    memo: memo.trim().slice(0, 80),
    ownerKey: deriveOwnerKey(check.slug, token),
    lastStatus: 'waiting',
    receipts: [],
  };
  const existing = loadCreatedChecks();
  saveCreatedChecks([record, ...existing]);
  return record;
}

export function updateCreatedCheckMemo(token: string, memo: string): CreatedCheckRecord[] {
  const list = loadCreatedChecks().map((r) =>
    r.token === token ? { ...r, memo: memo.slice(0, 80) } : r
  );
  saveCreatedChecks(list);
  return list;
}

export function deleteCreatedCheckRecord(token: string): CreatedCheckRecord[] {
  const list = loadCreatedChecks().filter((r) => r.token !== token);
  saveCreatedChecks(list);
  return list;
}

export function findCreatedCheckRecord(slug: string, token: string): CreatedCheckRecord | undefined {
  return loadCreatedChecks().find((r) => r.token === token && r.slug === slug);
}

export function claimOwnershipByPin(
  check: SkillCheckDef,
  token: string,
  ownerPin: string
): CreatedCheckRecord | null {
  if (deriveOwnerKey(check.slug, token) !== ownerPin) return null;
  const existing = findCreatedCheckRecord(check.slug, token);
  if (existing) return existing;
  const restored: CreatedCheckRecord = {
    token,
    slug: check.slug,
    checkId: check.id,
    mode: resolveModeFromToken(check.slug, token),
    createdAtMs: Date.now(),
    memo: '',
    ownerKey: ownerPin,
    lastStatus: 'waiting',
    receipts: [],
  };
  saveCreatedChecks([restored, ...loadCreatedChecks()]);
  return restored;
}

export function bumpCandidateAttemptOnStart(token: string): number {
  if (typeof window === 'undefined') return 1;
  try {
    const key = `${ATTEMPT_COUNTER_PREFIX}${token}`;
    const prev = Number(localStorage.getItem(key) || '0');
    const next = Math.min(255, Math.max(1, prev + 1));
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function getSavedCandidateCompletion(token: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`${CANDIDATE_DONE_PREFIX}${token}`);
  } catch {
    return null;
  }
}

export function saveCandidateCompletionLocally(token: string, receipt: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!localStorage.getItem(`${CANDIDATE_DONE_PREFIX}${token}`)) {
      localStorage.setItem(`${CANDIDATE_DONE_PREFIX}${token}`, receipt);
    }
  } catch {
    // ignore
  }
}

export function buildCheckShareUrl(slug: string, token: string): string {
  if (typeof window === 'undefined') {
    return `https://kreslo.heuristics.ru/?check=${encodeURIComponent(`${slug}.${token}`)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('check', `${slug}.${token}`);
  return url.toString();
}

export function buildDirectSnapshotUrl(slug: string, token: string, receipt: string): string {
  if (typeof window === 'undefined') {
    return `https://kreslo.heuristics.ru/?check=${encodeURIComponent(`${slug}.${token}`)}&r=${encodeURIComponent(receipt)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('check', `${slug}.${token}`);
  url.searchParams.set('r', receipt);
  return url.toString();
}

export interface ParsedUrlCheckRoute {
  check: SkillCheckDef;
  slug: string;
  token: string;
  mode: CheckVisibilityMode;
  directReceipt?: DecodedCheckReceipt;
  isOwner: boolean;
}

export function parseUrlCheckRoute(): ParsedUrlCheckRoute | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const rawCheck = params.get('check');
  if (!rawCheck || !rawCheck.includes('.')) return null;
  const dotIdx = rawCheck.indexOf('.');
  const slug = rawCheck.slice(0, dotIdx).trim();
  const token = rawCheck.slice(dotIdx + 1).trim();
  if (!slug || token.length < 8) return null;

  const check = getSkillCheckById(slug);
  if (!check) return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const ownerPin = hashParams.get('owner') || params.get('owner');
  if (ownerPin) {
    claimOwnershipByPin(check, token, ownerPin);
  }

  const rawReceipt = params.get('r') || '';
  const directReceipt = rawReceipt
    ? (unpackCheckReceipt(check.slug, token, rawReceipt) ?? undefined)
    : undefined;
  const isOwner = Boolean(findCreatedCheckRecord(check.slug, token));

  return {
    check,
    slug: check.slug,
    token,
    mode: resolveModeFromToken(check.slug, token),
    directReceipt,
    isOwner,
  };
}

export function clearUrlCheckParams(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('check');
  url.searchParams.delete('r');
  url.searchParams.delete('owner');
  if (url.hash.includes('owner=')) url.hash = '';
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// БЫСТРАЯ АВТО-СИНХРОНИЗАЦИЯ ПО ТОЙ ЖЕ ССЫЛКЕ (~0.5 СЕК В РФ БЕЗ VPN, С ТАЙМАУТАМИ)
// Формат ячейки textdb.dev: V1|<openedSec>|<progressDone>|<receipt1>.<receipt2>
// (обратно совместим и с чистой строкой <receipt1>.<receipt2>)
// ─────────────────────────────────────────────────────────────────────────────

function parseCloudCellText(rawText: string): {
  openedAtMs?: number;
  progressDone: number;
  receipts: string[];
} {
  const text = rawText.trim();
  if (!text) return { progressDone: 0, receipts: [] };
  if (text.startsWith('V1|')) {
    const parts = text.split('|');
    const openedSec = Number(parts[1] || '0');
    const prog = Number(parts[2] || '0');
    const recPart = parts[3] || '';
    const receipts = recPart ? recPart.split('.').filter(Boolean) : [];
    return {
      openedAtMs: openedSec > 0 ? openedSec * 1000 : undefined,
      progressDone: Number.isFinite(prog) ? prog : 0,
      receipts,
    };
  }
  const legacyReceipts = text.split('.').filter(Boolean);
  return {
    progressDone: legacyReceipts.length > 0 ? 10 : 0,
    receipts: legacyReceipts,
  };
}

function serializeCloudCellText(
  openedAtMs: number | undefined,
  progressDone: number,
  receipts: string[]
): string {
  const openedSec = Math.floor((openedAtMs ?? Date.now()) / 1000);
  const prog = receipts.length > 0 ? 10 : Math.max(0, Math.min(10, Math.round(progressDone)));
  return `V1|${openedSec}|${prog}|${receipts.slice(0, 5).join('.')}`;
}

function mergeVerifiedReceipts(
  slug: string,
  token: string,
  candidates: string[]
): { receipts: string[]; decoded: DecodedCheckReceipt[] } {
  const seen = new Set<string>();
  const decoded: DecodedCheckReceipt[] = [];
  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    const dec = unpackCheckReceipt(slug, token, trimmed);
    if (dec) {
      seen.add(trimmed);
      decoded.push(dec);
    }
  }
  decoded.sort((a, b) => a.attemptNum - b.attemptNum || a.completedAtMs - b.completedAtMs);
  return {
    receipts: decoded.map((d) => d.raw),
    decoded,
  };
}

export async function publishCandidateProgress(
  slug: string,
  token: string,
  stage: 'open' | 'half',
  doneCount = 1
): Promise<void> {
  if (typeof fetch === 'undefined') return;
  const ch = deriveChannelKey(slug, token);
  const stepCount = stage === 'open' ? 1 : Math.max(5, doneCount);

  void fetchWithTimeout(
    './api/check-sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ch, event: 'half', doneCount: stepCount }),
      credentials: 'omit',
      keepalive: true,
    },
    2500
  ).catch(() => {});

  void (async () => {
    try {
      let existing: ReturnType<typeof parseCloudCellText> = { progressDone: 0, receipts: [] };
      try {
        const g = await fetchWithTimeout(
          `https://textdb.dev/api/data/kreslo_c1_${ch}`,
          { method: 'GET', credentials: 'omit', cache: 'no-store' },
          3000
        );
        if (g.ok) existing = parseCloudCellText(await g.text());
      } catch {
        // ignore
      }
      // Никогда не затираем уже завершённые попытки прогрессом!
      const verified = mergeVerifiedReceipts(slug, token, existing.receipts);
      if (verified.receipts.length > 0) return;

      const bodyStr = serializeCloudCellText(
        existing.openedAtMs ?? Date.now(),
        Math.max(existing.progressDone, stepCount),
        []
      );
      await fetchWithTimeout(
        `https://textdb.dev/api/data/kreslo_c1_${ch}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: bodyStr,
          credentials: 'omit',
          keepalive: true,
        },
        3500
      );
      notifyLocalBroadcast(ch);
    } catch {
      // ignore
    }
  })();

  notifyLocalBroadcast(ch);
}

export async function publishCandidateCompletion(
  slug: string,
  token: string,
  receipt: string
): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  const ch = deriveChannelKey(slug, token);

  const localTask = fetchWithTimeout(
    './api/check-sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ch, event: 'done', receipt }),
      credentials: 'omit',
      keepalive: true,
    },
    2500
  )
    .then((r) => r.ok)
    .catch(() => false);

  const kvTask = (async () => {
    try {
      let existing: ReturnType<typeof parseCloudCellText> = { progressDone: 0, receipts: [] };
      try {
        const getRes = await fetchWithTimeout(
          `https://textdb.dev/api/data/kreslo_c1_${ch}`,
          { method: 'GET', credentials: 'omit', cache: 'no-store' },
          3200
        );
        if (getRes.ok) {
          existing = parseCloudCellText(await getRes.text());
        }
      } catch {
        // ignore pre-read failure
      }
      const merged = mergeVerifiedReceipts(slug, token, [...existing.receipts, receipt]);
      const bodyStr = serializeCloudCellText(
        existing.openedAtMs ?? Date.now(),
        10,
        merged.receipts
      );
      const postRes = await fetchWithTimeout(
        `https://textdb.dev/api/data/kreslo_c1_${ch}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: bodyStr,
          credentials: 'omit',
          keepalive: true,
        },
        4000
      );
      return postRes.ok;
    } catch {
      return false;
    }
  })();

  const results = await Promise.all([localTask, kvTask]);
  notifyLocalBroadcast(ch);
  return results.some(Boolean);
}

function persistSnapshotToOwnerCache(
  slug: string,
  token: string,
  snap: RemoteCheckStatusSnapshot
): void {
  const list = loadCreatedChecks();
  const idx = list.findIndex((r) => r.token === token && r.slug === slug);
  if (idx === -1) return;
  const cur = list[idx];
  const merged = mergeVerifiedReceipts(slug, token, [...cur.receipts, ...snap.receipts]);
  const nextStatus =
    merged.receipts.length > 0
      ? 'completed'
      : snap.status === 'halfway' || cur.lastStatus === 'halfway'
        ? 'halfway'
        : snap.status === 'opened' || cur.lastStatus === 'opened'
          ? 'opened'
          : 'waiting';

  list[idx] = {
    ...cur,
    lastStatus: nextStatus,
    openedAtMs: cur.openedAtMs ?? snap.openedAtMs,
    progressDone: Math.max(cur.progressDone ?? 0, snap.progressDone ?? 0),
    receipts: merged.receipts,
  };
  saveCreatedChecks(list);
}

export async function fetchRemoteCheckState(
  slug: string,
  token: string,
  extraReceipt?: string
): Promise<RemoteCheckStatusSnapshot> {
  const ch = deriveChannelKey(slug, token);
  const ownerRec = findCreatedCheckRecord(slug, token);
  const collectedReceipts: string[] = [...(ownerRec?.receipts ?? [])];
  if (extraReceipt) collectedReceipts.push(extraReceipt);

  let openedAtMs = ownerRec?.openedAtMs;
  let progressDone = ownerRec?.progressDone ?? 0;

  if (typeof fetch !== 'undefined') {
    const localPromise = fetchWithTimeout(
      `./api/check-sync?ch=${encodeURIComponent(ch)}&_t=${Date.now()}`,
      { method: 'GET', credentials: 'omit', cache: 'no-store' },
      2200
    )
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          openedAtMs?: number;
          progressDone?: number;
          receipts?: string[];
        };
        if (data.openedAtMs && (!openedAtMs || data.openedAtMs < openedAtMs)) {
          openedAtMs = data.openedAtMs;
        }
        if (typeof data.progressDone === 'number') {
          progressDone = Math.max(progressDone, data.progressDone);
        }
        if (Array.isArray(data.receipts)) {
          collectedReceipts.push(...data.receipts);
        }
      })
      .catch(() => {});

    const kvPromise = fetchWithTimeout(
      `https://textdb.dev/api/data/kreslo_c1_${ch}`,
      { method: 'GET', credentials: 'omit', cache: 'no-store' },
      3500
    )
      .then(async (res) => {
        if (!res.ok) return;
        const parsed = parseCloudCellText(await res.text());
        if (parsed.openedAtMs && (!openedAtMs || parsed.openedAtMs < openedAtMs)) {
          openedAtMs = parsed.openedAtMs;
        }
        progressDone = Math.max(progressDone, parsed.progressDone);
        collectedReceipts.push(...parsed.receipts);
      })
      .catch(() => {});

    await Promise.all([localPromise, kvPromise]);
  }

  const merged = mergeVerifiedReceipts(slug, token, collectedReceipts);
  const status: RemoteCheckStatusSnapshot['status'] =
    merged.receipts.length > 0
      ? 'completed'
      : progressDone >= 5
        ? 'halfway'
        : openedAtMs || progressDone > 0
          ? 'opened'
          : 'waiting';

  const snap: RemoteCheckStatusSnapshot = {
    status,
    openedAtMs,
    progressDone,
    receipts: merged.receipts,
    decodedReceipts: merged.decoded,
  };

  persistSnapshotToOwnerCache(slug, token, snap);
  return snap;
}

export function subscribeLiveCheckStream(
  slug: string,
  token: string,
  onEvent: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const ch = deriveChannelKey(slug, token);
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (e) => {
        if (e.data?.ch === ch) onEvent();
      };
    } catch {
      // ignore
    }
  }

  const onFocusOrVis = () => {
    if (document.visibilityState === 'visible') {
      onEvent();
    }
  };
  window.addEventListener('focus', onFocusOrVis);
  document.addEventListener('visibilitychange', onFocusOrVis);

  const pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      onEvent();
    }
  }, 3500);

  return () => {
    window.clearInterval(pollTimer);
    window.removeEventListener('focus', onFocusOrVis);
    document.removeEventListener('visibilitychange', onFocusOrVis);
    if (bc) {
      try {
        bc.close();
      } catch {
        // ignore
      }
    }
  };
}
