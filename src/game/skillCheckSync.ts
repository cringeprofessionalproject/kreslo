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
const EPOCH_2026_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

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
  return (
    ALPHANUM[h1 % ALPHANUM.length] +
    ALPHANUM[h2 % ALPHANUM.length]
  );
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
  // 21 байт полезных данных + 4 байта крипто-подписи целостности = 25 байт (~34 символа Base64URL)
  const plain = new Uint8Array(21);
  plain[0] = 1; // Версия протокола слепка

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
// ЛОКАЛЬНЫЙ РЕЕСТР ССЫЛОК АВТОРА + СЧЁТЧИК ПОПЫТОК ТЕСТИРУЕМОГО
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
  const directReceipt = rawReceipt ? unpackCheckReceipt(check.slug, token, rawReceipt) ?? undefined : undefined;
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
// БЕССЕРВЕРНАЯ АВТО-СИНХРОНИЗАЦИЯ ПО ТОЙ ЖЕ ССЫЛКЕ (0 МИКРОСЕРВИСОВ, 0 ПДн)
// Тройное резервирование:
// 1. Локальный ./api/check-sync (для dev / контейнера)
// 2. Live-шина ntfy.sh (мгновенный SSE-пуш за 0.1 сек + неизменяемый лог событий)
// 3. Долгосрочная ячейка textdb.dev (хранит подписанный 34-символьный слепок неделями)
// ─────────────────────────────────────────────────────────────────────────────

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
  doneCount = 0
): Promise<void> {
  if (typeof fetch === 'undefined') return;
  const ch = deriveChannelKey(slug, token);
  const nowSec = Math.floor(Date.now() / 1000);
  const msg = stage === 'open' ? `O|${nowSec}` : `P|${doneCount}|${nowSec}`;

  void fetch('./api/check-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ch, event: stage, doneCount }),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});

  void fetch(`https://ntfy.sh/kreslo_c1_${ch}`, {
    method: 'POST',
    body: msg,
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}

export async function publishCandidateCompletion(
  slug: string,
  token: string,
  receipt: string
): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  const ch = deriveChannelKey(slug, token);
  const nowSec = Math.floor(Date.now() / 1000);

  const localTask = fetch('./api/check-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ch, event: 'done', receipt }),
    credentials: 'omit',
    keepalive: true,
  })
    .then((r) => r.ok)
    .catch(() => false);

  const liveTask = fetch(`https://ntfy.sh/kreslo_c1_${ch}`, {
    method: 'POST',
    body: `D|${receipt}|${nowSec}`,
    credentials: 'omit',
    keepalive: true,
  })
    .then((r) => r.ok)
    .catch(() => false);

  const kvTask = (async () => {
    try {
      let existingRaw = '';
      try {
        const getRes = await fetch(`https://textdb.dev/api/data/kreslo_c1_${ch}`, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
        });
        if (getRes.ok) {
          existingRaw = (await getRes.text()).trim();
        }
      } catch {
        // ignore pre-read failure
      }
      const prevParts = existingRaw ? existingRaw.split('.').filter(Boolean) : [];
      const merged = mergeVerifiedReceipts(slug, token, [...prevParts, receipt]);
      const bodyStr = merged.receipts.slice(0, 5).join('.');
      const postRes = await fetch(`https://textdb.dev/api/data/kreslo_c1_${ch}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: bodyStr,
        credentials: 'omit',
        keepalive: true,
      });
      return postRes.ok;
    } catch {
      return false;
    }
  })();

  const results = await Promise.all([localTask, liveTask, kvTask]);
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

  const tasks: Promise<void>[] = [];

  if (typeof fetch !== 'undefined') {
    tasks.push(
      fetch(`./api/check-sync?ch=${encodeURIComponent(ch)}`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      })
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
        .catch(() => {})
    );

    tasks.push(
      fetch(`https://textdb.dev/api/data/kreslo_c1_${ch}`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      })
        .then(async (res) => {
          if (!res.ok) return;
          const text = (await res.text()).trim();
          if (text) {
            collectedReceipts.push(...text.split('.').filter(Boolean));
          }
        })
        .catch(() => {})
    );

    tasks.push(
      fetch(`https://ntfy.sh/kreslo_c1_${ch}/json?poll=1&since=12h`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      })
        .then(async (res) => {
          if (!res.ok) return;
          const rawLines = (await res.text()).split('\n').filter(Boolean);
          for (const line of rawLines) {
            try {
              const ev = JSON.parse(line) as { event?: string; message?: string; time?: number };
              if (ev.event !== 'message' || typeof ev.message !== 'string') continue;
              const parts = ev.message.split('|');
              const evTimeMs = typeof ev.time === 'number' ? ev.time * 1000 : Date.now();
              if (parts[0] === 'O') {
                if (!openedAtMs || evTimeMs < openedAtMs) openedAtMs = evTimeMs;
              } else if (parts[0] === 'P') {
                const cnt = Number(parts[1] || '5');
                if (!openedAtMs) openedAtMs = evTimeMs;
                if (Number.isFinite(cnt)) progressDone = Math.max(progressDone, cnt);
              } else if (parts[0] === 'D' && parts[1]) {
                if (!openedAtMs) openedAtMs = evTimeMs;
                progressDone = 10;
                collectedReceipts.push(parts[1]);
              }
            } catch {
              // ignore line parse error
            }
          }
        })
        .catch(() => {})
    );
  }

  await Promise.all(tasks);

  const merged = mergeVerifiedReceipts(slug, token, collectedReceipts);
  const status: RemoteCheckStatusSnapshot['status'] =
    merged.receipts.length > 0
      ? 'completed'
      : progressDone > 0
        ? 'halfway'
        : openedAtMs
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
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }
  const ch = deriveChannelKey(slug, token);
  let es: EventSource | null = null;
  try {
    es = new EventSource(`https://ntfy.sh/kreslo_c1_${ch}/sse`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as { event?: string };
        if (parsed.event === 'message') {
          onEvent();
        }
      } catch {
        onEvent();
      }
    };
  } catch {
    // ignore SSE block
  }

  const pollTimer = window.setInterval(() => {
    onEvent();
  }, 9000);

  return () => {
    window.clearInterval(pollTimer);
    if (es) {
      try {
        es.close();
      } catch {
        // ignore
      }
    }
  };
}
