import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  initSound,
  sfxCardGrab,
  sfxCardSnapBack,
  sfxCoffeeSave,
  sfxSwipeCommit,
  sfxThresholdLock,
  sfxTiltTick,
  sfxUiTap,
  sfxVictory,
  vibrate,
} from '../audio';
import { sendAnonymousPulse } from '../game/anonymousPulse';
import {
  buildCheckShareUrl,
  buildDirectSnapshotUrl,
  bumpCandidateAttemptOnStart,
  type CheckVisibilityMode,
  type CreatedCheckRecord,
  createNewCheckLinkRecord,
  type DecodedCheckReceipt,
  deleteCreatedCheckRecord,
  fetchRemoteCheckState,
  findCreatedCheckRecord,
  getOrderedCardsForToken,
  getSavedCandidateCompletion,
  loadCreatedChecks,
  packCheckReceipt,
  publishCandidateCompletion,
  publishCandidateProgress,
  type RemoteCheckStatusSnapshot,
  saveCandidateCompletionLocally,
  subscribeLiveCheckStream,
  unpackCheckReceipt,
  updateCreatedCheckMemo,
} from '../game/skillCheckSync';
import {
  getSkillCheckById,
  SKILL_CHECKS,
  type SkillCheckCard,
  type SkillCheckDef,
} from '../game/skillChecksData';
import { EditorialCardPortrait } from './CharacterArt';
import { IconGrid, IconVolume } from './Icons';

// ─────────────────────────────────────────────────────────────────────────────
// ОЦЕНКА И СТРУКТУРА ОТЧЁТА ПО 10 СИТУАЦИЯМ
// ─────────────────────────────────────────────────────────────────────────────

interface EvaluatedCardRow {
  canonicalIndex: number;
  card: SkillCheckCard;
  chosenSide: 'left' | 'right';
  isSmart: boolean;
  isCriticalFail: boolean;
  secSpent: number;
}

interface EvaluatedAttemptReport {
  score: number;
  total: number;
  pct: number;
  criticalFails: number;
  verdictTitle: string;
  verdictSub: string;
  tone: 'good' | 'warn' | 'bad';
  avgSec: number;
  slowCount: number;
  tabLeaves: number;
  attemptNum: number;
  durationSec: number;
  axes: { axis: string; ok: number; total: number }[];
  rows: EvaluatedCardRow[];
}

function evaluateCheckAttempt(
  check: SkillCheckDef,
  receipt: DecodedCheckReceipt
): EvaluatedAttemptReport {
  const rows: EvaluatedCardRow[] = check.cards.map((card, idx) => {
    const chosenSide = receipt.choices[idx] ?? 'left';
    const isSmart = chosenSide === card.smartSide;
    const isCriticalFail = !isSmart && Boolean(card.criticalRedFlag);
    const secSpent = receipt.perCardSec[idx] ?? 0;
    return {
      canonicalIndex: idx,
      card,
      chosenSide,
      isSmart,
      isCriticalFail,
      secSpent,
    };
  });

  const score = rows.filter((r) => r.isSmart).length;
  const total = rows.length;
  const pct = Math.round((score / total) * 100);
  const criticalFails = rows.filter((r) => r.isCriticalFail).length;

  const axisMap = new Map<string, { ok: number; total: number }>();
  for (const r of rows) {
    const prev = axisMap.get(r.card.axis) ?? { ok: 0, total: 0 };
    prev.total += 1;
    if (r.isSmart) prev.ok += 1;
    axisMap.set(r.card.axis, prev);
  }
  const axes = Array.from(axisMap.entries()).map(([axis, v]) => ({
    axis,
    ok: v.ok,
    total: v.total,
  }));

  const sumSec = rows.reduce((acc, r) => acc + r.secSpent, 0);
  const avgSec = total > 0 ? Math.round((sumSec / total) * 10) / 10 : 0;
  const slowCount = rows.filter((r) => r.secSpent >= 25).length;

  let verdictTitle = 'Сильная база · Рекомендован';
  let verdictSub = 'Уверенно ориентируется в рабочих развилках без критических проколов.';
  let tone: 'good' | 'warn' | 'bad' = 'good';

  if (score >= check.passScore && criticalFails === 0) {
    verdictTitle = 'Сильная база · Без красных флагов';
    verdictSub = 'Решения совпадают с отраслевым стандартом и здравым смыслом.';
    tone = 'good';
  } else if (score >= 7 && criticalFails > 0) {
    verdictTitle = `Есть стоп-риск (${criticalFails} кр. флаг)`;
    verdictSub =
      'Общий балл неплохой, но допущена опасная ошибка в зоне критического риска — стоит разобрать на встрече.';
    tone = 'warn';
  } else if (score >= 6) {
    verdictTitle = 'Пограничный результат';
    verdictSub = 'Плавает в спорных ситуациях — потребуется чёткий инструктаж на старте.';
    tone = 'warn';
  } else {
    verdictTitle = 'Высокий риск · База не подтверждена';
    verdictSub = 'Системные ошибки в базовых стандартах и оценке последствий.';
    tone = 'bad';
  }

  return {
    score,
    total,
    pct,
    criticalFails,
    verdictTitle,
    verdictSub,
    tone,
    avgSec,
    slowCount,
    tabLeaves: receipt.tabLeaves,
    attemptNum: receipt.attemptNum,
    durationSec: receipt.durationSec,
    axes,
    rows,
  };
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function formatDurationShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s} сек`;
  return `${m} мин ${String(s).padStart(2, '0')} с`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ВИДЖЕТ ДЕТАЛЬНОГО ОТЧЁТА (SCORECARD)
// ─────────────────────────────────────────────────────────────────────────────

export const SkillCheckScorecardView: React.FC<{
  check: SkillCheckDef;
  decodedReceipts: DecodedCheckReceipt[];
  audience?: 'owner' | 'self';
}> = ({ check, decodedReceipts, audience = 'owner' }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterMode, setFilterMode] = useState<'mistakes' | 'all'>('mistakes');

  const safeIdx = Math.min(selectedIdx, Math.max(0, decodedReceipts.length - 1));
  const activeReceipt = decodedReceipts[safeIdx];
  const report = useMemo(
    () => (activeReceipt ? evaluateCheckAttempt(check, activeReceipt) : null),
    [activeReceipt, check]
  );

  useEffect(() => {
    if (report && report.score === report.total) {
      setFilterMode('all');
    } else {
      setFilterMode('mistakes');
    }
  }, [report?.score, report?.total, safeIdx]);

  if (!report || !activeReceipt) return null;

  const mistakeRows = report.rows
    .filter((r) => !r.isSmart)
    .sort((a, b) => Number(b.isCriticalFail) - Number(a.isCriticalFail));
  const visibleRows = filterMode === 'mistakes' && mistakeRows.length > 0 ? mistakeRows : report.rows;

  return (
    <div className="sc-report-root">
      {decodedReceipts.length > 1 && (
        <div className="sc-attempts-bar">
          {decodedReceipts.map((rec, i) => (
            <button
              key={rec.raw}
              type="button"
              className={`sc-att-chip ${i === safeIdx ? 'on' : ''}`}
              onClick={() => {
                sfxUiTap();
                setSelectedIdx(i);
              }}
            >
              {i === 0 ? `Попытка #${rec.attemptNum} (первая)` : `Повтор #${rec.attemptNum}`}
            </button>
          ))}
        </div>
      )}

      {/* Главная карточка вердикта */}
      <div className={`sc-hero-verdict tone-${report.tone}`}>
        <div className="sc-score-ring">
          <strong>
            {report.score}
            <span>/{report.total}</span>
          </strong>
          <small>{report.pct}%</small>
        </div>
        <div className="sc-verdict-copy">
          <span className={`sc-verdict-pill tone-${report.tone}`}>
            {audience === 'self'
              ? report.score >= check.passScore && report.criticalFails === 0
                ? 'Отличный результат'
                : report.score >= 6
                  ? 'Неплохо, но есть ловушки'
                  : 'Стоит разобрать ситуации'
              : report.verdictTitle}
          </span>
          <p>
            {audience === 'self'
              ? `Точных решений: ${report.score} из ${report.total} за ${formatDurationShort(report.durationSec)}.`
              : report.verdictSub}
          </p>
        </div>
      </div>

      {/* Панель достоверности (показывается только заказчику проверки / HR) */}
      {audience === 'owner' && (
        <div className="sc-trust-grid">
          <div className="sc-trust-cell">
            <small>Темп ответа</small>
            <strong>~{report.avgSec} с/кейс</strong>
            <span>Всего {formatDurationShort(report.durationSec)}</span>
          </div>
          <div className={`sc-trust-cell ${report.tabLeaves > 1 ? 'warn' : ''}`}>
            <small>Фокус вкладки</small>
            <strong>{report.tabLeaves === 0 ? 'Без выходов' : `${report.tabLeaves} вых.`}</strong>
            <span>{report.tabLeaves === 0 ? 'Не переключался' : 'Сворачивал экран'}</span>
          </div>
          <div className={`sc-trust-cell ${report.attemptNum > 1 ? 'warn' : ''}`}>
            <small>Попытка</small>
            <strong>#{report.attemptNum}</strong>
            <span>{report.attemptNum === 1 ? 'С первого раза' : 'Перезапускал тест'}</span>
          </div>
        </div>
      )}

      {/* Срез по осям компетенций */}
      <div className="sc-axes-card">
        <h4>Срез по блокам проверки</h4>
        <div className="sc-axes-list">
          {report.axes.map((ax) => {
            const axPct = Math.round((ax.ok / ax.total) * 100);
            return (
              <div key={ax.axis} className="sc-axis-row">
                <div className="sc-axis-top">
                  <span>{ax.axis}</span>
                  <strong>
                    {ax.ok}/{ax.total}
                  </strong>
                </div>
                <div className="sc-axis-track">
                  <div
                    className={`sc-axis-fill ${ax.ok === ax.total ? 'full' : ax.ok === 0 ? 'low' : 'mid'}`}
                    style={{ width: `${Math.max(8, axPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Переключатель разбора ответов */}
      {mistakeRows.length > 0 && (
        <div className="ios-segmented-control sc-seg-compact" role="tablist">
          <button
            type="button"
            className={filterMode === 'mistakes' ? 'active' : ''}
            onClick={() => {
              sfxUiTap();
              setFilterMode('mistakes');
            }}
          >
            Ошибки и риски ({mistakeRows.length})
          </button>
          <button
            type="button"
            className={filterMode === 'all' ? 'active' : ''}
            onClick={() => {
              sfxUiTap();
              setFilterMode('all');
            }}
          >
            Все 10 ситуаций
          </button>
        </div>
      )}

      {/* Карточки детального разбора */}
      <div className="sc-breakdown-list">
        {visibleRows.map((row) => {
          const chosenText =
            row.chosenSide === 'left' ? row.card.leftLabel : row.card.rightLabel;
          const smartText =
            row.card.smartSide === 'left' ? row.card.leftLabel : row.card.rightLabel;

          return (
            <div
              key={row.card.id}
              className={`sc-case-item ${row.isSmart ? 'ok' : row.isCriticalFail ? 'crit' : 'miss'}`}
            >
              <div className="sc-case-head">
                <span className="sc-case-axis">{row.card.axis}</span>
                <div className="sc-case-badges">
                  <span className="sc-sec-pill">{row.secSpent} сек</span>
                  {row.isSmart ? (
                    <span className="sc-state-pill ok">Верно</span>
                  ) : row.isCriticalFail ? (
                    <span className="sc-state-pill crit">Красный флаг</span>
                  ) : (
                    <span className="sc-state-pill miss">Ошибка</span>
                  )}
                </div>
              </div>

              <p className="sc-case-q">{row.card.text}</p>

              <div className="sc-choice-box chosen">
                <small>
                  Выбрано ({row.chosenSide === 'left' ? '← Отказ / Стоп' : 'Согласие / Шаг →'}):
                </small>
                <strong>{chosenText}</strong>
              </div>

              {!row.isSmart && (
                <div className="sc-choice-box expected">
                  <small>
                    Верное решение (
                    {row.card.smartSide === 'left' ? '← Отказ / Стоп' : 'Согласие / Шаг →'}):
                  </small>
                  <strong>{smartText}</strong>
                </div>
              )}

              <div className="sc-norm-note">
                <span>{row.card.normTitle}</span>
                <p>{row.card.why}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. ЖИВОЕ ТАБЛО СОЗДАТЕЛЯ ССЫЛКИ («ОДНА ССЫЛКА-ХАМЕЛЕОН»)
// ─────────────────────────────────────────────────────────────────────────────

export const OwnerCheckTrackerModal: React.FC<{
  check: SkillCheckDef;
  token: string;
  directReceipt?: DecodedCheckReceipt;
  onClose: () => void;
  onTestPlaySelf: () => void;
  onRecordsChanged?: () => void;
}> = ({ check, token, directReceipt, onClose, onTestPlaySelf, onRecordsChanged }) => {
  const [record, setRecord] = useState<CreatedCheckRecord | undefined>(() =>
    findCreatedCheckRecord(check.slug, token)
  );
  const [snapshot, setSnapshot] = useState<RemoteCheckStatusSnapshot>(() => {
    const initialReceipts = record?.receipts ?? [];
    const dec = initialReceipts
      .map((r) => unpackCheckReceipt(check.slug, token, r))
      .filter((x): x is DecodedCheckReceipt => Boolean(x));
    if (directReceipt && !dec.some((d) => d.raw === directReceipt.raw)) {
      dec.unshift(directReceipt);
    }
    return {
      status: dec.length > 0 ? 'completed' : record?.lastStatus ?? 'waiting',
      openedAtMs: record?.openedAtMs,
      progressDone: record?.progressDone,
      receipts: dec.map((d) => d.raw),
      decodedReceipts: dec,
    };
  });
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'main' | 'owner' | 'snap' | null>(null);
  const [memoDraft, setMemoDraft] = useState(record?.memo ?? '');
  const prevDoneCountRef = useRef(snapshot.decodedReceipts.length);
  const refreshInFlightRef = useRef(false);

  const shareUrl = useMemo(() => buildCheckShareUrl(check.slug, token), [check.slug, token]);

  const refreshState = useCallback(async (manual = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (manual) setRefreshing(true);
    try {
      const next = await fetchRemoteCheckState(check.slug, token, directReceipt?.raw);
      setSnapshot(next);
      setRecord(findCreatedCheckRecord(check.slug, token));
      onRecordsChanged?.();
      if (next.decodedReceipts.length > prevDoneCountRef.current) {
        prevDoneCountRef.current = next.decodedReceipts.length;
        sfxVictory();
        vibrate([18, 40, 26]);
      }
    } finally {
      refreshInFlightRef.current = false;
      if (manual) setRefreshing(false);
    }
  }, [check.slug, directReceipt?.raw, onRecordsChanged, token]);

  useEffect(() => {
    void refreshState(true);
    const unsub = subscribeLiveCheckStream(check.slug, token, () => {
      void refreshState(false);
    });
    return unsub;
  }, [check.slug, refreshState, token]);

  const handleCopyMainLink = async () => {
    sfxUiTap(true);
    await copyTextSafe(shareUrl);
    setCopiedKind('main');
    setTimeout(() => setCopiedKind(null), 2200);
  };

  const handleNativeShareMainLink = async () => {
    sfxUiTap(true);
    sendAnonymousPulse('share_click');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Блиц-проверка: ${check.title}`,
          text: `Пройди короткую проверку на 10 рабочих ситуаций (2–3 минуты): ${check.title}`,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled share sheet
      }
    }
    await handleCopyMainLink();
  };

  const handleCopySnapshotLink = async () => {
    const first = snapshot.decodedReceipts[0];
    if (!first) return;
    sfxUiTap(true);
    const snapUrl = buildDirectSnapshotUrl(check.slug, token, first.raw);
    await copyTextSafe(snapUrl);
    setCopiedKind('snap');
    setTimeout(() => setCopiedKind(null), 2200);
  };

  const handleCopyCrossDeviceOwnerUrl = async () => {
    if (!record) return;
    sfxUiTap();
    const ownerUrl = `${shareUrl}#owner=${record.ownerKey}`;
    await copyTextSafe(ownerUrl);
    setCopiedKind('owner');
    setTimeout(() => setCopiedKind(null), 2400);
  };

  const handleMemoBlur = () => {
    if (!record) return;
    updateCreatedCheckMemo(token, memoDraft);
    setRecord(findCreatedCheckRecord(check.slug, token));
    onRecordsChanged?.();
  };

  return (
    <div className="overlay-backdrop sc-sheet-backdrop" onClick={onClose}>
      <div className="hub-sheet apple-hub-sheet sc-tracker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sc-sheet-topbar">
          <div>
            <span className="ahh-eyebrow">Умная ссылка-проверка</span>
            <h2 className="sc-sheet-title">{check.title}</h2>
          </div>
          <button type="button" className="hb-circle-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="apple-cards-scroll sc-tracker-scroll">
          {/* Карточка самой ссылки-хамелеона */}
          <div className="sc-link-box">
            <div className="sc-link-explain">
              <strong>Одна ссылка для всего:</strong> у получателя она запустит 10 кейсов, а у вас по
              ней же открывается живой результат.
            </div>

            {record && (
              <div className="sc-memo-row">
                <input
                  type="text"
                  value={memoDraft}
                  onChange={(e) => setMemoDraft(e.target.value)}
                  onBlur={handleMemoBlur}
                  placeholder="Личная заметка (кому кинули ссылку — видно только вам)"
                  maxLength={70}
                />
              </div>
            )}

            <div className="sc-url-preview">{shareUrl}</div>

            <div className="sc-link-actions">
              <button type="button" className="sc-btn-primary" onClick={handleCopyMainLink}>
                {copiedKind === 'main' ? '✓ Ссылка скопирована' : 'Скопировать ссылку'}
              </button>
              <button type="button" className="sc-btn-secondary" onClick={handleNativeShareMainLink}>
                Отправить…
              </button>
            </div>

            <div className="sc-mode-subline">
              <span>
                Формат:{' '}
                {record?.mode === 'challenge'
                  ? 'Открытый (итог сразу виден обоим)'
                  : 'Рабочая оценка (ответы скрыты от участника)'}
              </span>
              {record && (
                <button type="button" className="sc-text-link" onClick={handleCopyCrossDeviceOwnerUrl}>
                  {copiedKind === 'owner' ? '✓ Ключ скопирован' : 'Открыть трекер на ПК'}
                </button>
              )}
            </div>
          </div>

          {/* Живой статус или готовый отчёт */}
          {snapshot.decodedReceipts.length === 0 ? (
            <div className="sc-live-waiting-card">
              <div className={`sc-pulse-orb ${snapshot.status}`} />
              {snapshot.status === 'waiting' && (
                <>
                  <h3>Ожидает прохождения</h3>
                  <p>
                    Отправьте ссылку человеку. Как только он откроет тест и свайпнет 10 ситуаций,
                    разбор автоматически появится прямо здесь.
                  </p>
                </>
              )}
              {snapshot.status === 'opened' && (
                <>
                  <h3>Ссылку открыли · Идёт чтение 1-х карточек…</h3>
                  <p>Тестируемый уже внутри проверки. Экран обновится автоматически по завершении.</p>
                </>
              )}
              {snapshot.status === 'halfway' && (
                <>
                  <h3>Проходит прямо сейчас ({snapshot.progressDone || 5} из 10)…</h3>
                  <p>Половина кейсов позади — через минуту отчёт соберётся на этом экране.</p>
                </>
              )}

              <div className="sc-wait-btns">
                <button
                  type="button"
                  className="sc-btn-secondary"
                  disabled={refreshing}
                  onClick={() => {
                    sfxUiTap();
                    void refreshState(true);
                  }}
                >
                  {refreshing ? 'Проверяем…' : 'Обновить статус'}
                </button>
                <button
                  type="button"
                  className="sc-btn-ghost"
                  onClick={() => {
                    sfxUiTap(true);
                    onTestPlaySelf();
                  }}
                >
                  Пройти самому (тест)
                </button>
              </div>
            </div>
          ) : (
            <>
              <SkillCheckScorecardView check={check} decodedReceipts={snapshot.decodedReceipts} />

              <div className="sc-bottom-share-bar">
                <button type="button" className="sc-btn-secondary full" onClick={handleCopySnapshotLink}>
                  {copiedKind === 'snap'
                    ? '✓ Ссылка на этот отчёт скопирована'
                    : 'Поделиться готовым отчётом с коллегой'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. МОДАЛКА СОЗДАНИЯ ССЫЛКИ ИЗ КАТАЛОГА ПРОВЕРОК В ХАБЕ
// ─────────────────────────────────────────────────────────────────────────────

export const CreateSkillCheckModal: React.FC<{
  check: SkillCheckDef;
  onClose: () => void;
  onCreatedLink: (record: CreatedCheckRecord) => void;
  onPlaySelfNow: (check: SkillCheckDef) => void;
}> = ({ check, onClose, onCreatedLink, onPlaySelfNow }) => {
  // По умолчанию ВСЕГДА «Рабочая оценка» — ответы скрыты от участника, а полный отчёт виден только создателю ссылки
  const [mode, setMode] = useState<CheckVisibilityMode>('screening');
  const [memo, setMemo] = useState('');

  const handleGenerate = async () => {
    sfxCoffeeSave();
    vibrate(18);
    sendAnonymousPulse('b2b_click');
    const rec = createNewCheckLinkRecord(check, mode, memo);
    const url = buildCheckShareUrl(rec.slug, rec.token);
    await copyTextSafe(url);
    onCreatedLink(rec);
  };

  return (
    <div className="overlay-backdrop sc-sheet-backdrop" onClick={onClose}>
      <div className="hub-sheet apple-hub-sheet sc-create-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sc-sheet-topbar">
          <div>
            <span className="ahh-eyebrow">{check.badge}</span>
            <h2 className="sc-sheet-title">{check.title}</h2>
          </div>
          <button type="button" className="hb-circle-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="apple-cards-scroll sc-tracker-scroll">
          <p className="sc-create-lead">{check.subtitle}</p>

          <div className="sc-tinder-hint-card">
            <div className="sc-th-col left">
              <small>← Свайп влево</small>
              <strong>Отказ · Стоп · Промолчать</strong>
            </div>
            <div className="sc-th-divider" />
            <div className="sc-th-col right">
              <small>Свайп вправо →</small>
              <strong>Согласие · Принять · Шаг</strong>
            </div>
          </div>

          <div className="sc-mode-picker">
            <button
              type="button"
              className={`sc-mode-option ${mode === 'screening' ? 'on' : ''}`}
              onClick={() => {
                sfxUiTap();
                setMode('screening');
              }}
            >
              <div className="sc-mo-head">
                <strong>Рабочая оценка</strong>
                <span className="sc-mo-radio" />
              </div>
              <p>
                Правильные ответы в конце скрыты от участника, а подробный отчёт с таймингами
                откроется только вам по этой же ссылке.
              </p>
            </button>

            <button
              type="button"
              className={`sc-mode-option ${mode === 'challenge' ? 'on' : ''}`}
              onClick={() => {
                sfxUiTap();
                setMode('challenge');
              }}
            >
              <div className="sc-mo-head">
                <strong>Открытый формат</strong>
                <span className="sc-mo-radio" />
              </div>
              <p>
                Участник сразу увидит свой балл и разбор после 10 карточек, а у вас по ссылке также
                сохранится его результат.
              </p>
            </button>
          </div>

          <div className="sc-memo-field">
            <label htmlFor="sc-memo-input">Кому отправляете? (необязательно, хранится только у вас)</label>
            <input
              id="sc-memo-input"
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Напр.: Артём с hh / Катя стажёр / Чат отдела"
              maxLength={70}
            />
          </div>

          <div className="sc-create-actions">
            <button type="button" className="sc-btn-primary full" onClick={handleGenerate}>
              Создать ссылку и скопировать
            </button>
            <button
              type="button"
              className="sc-btn-secondary full"
              onClick={() => {
                sfxUiTap(true);
                onPlaySelfNow(check);
              }}
            >
              Пройти самому (2 минуты)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ВКЛАДКА «ПРОВЕРКИ» ВНУТРИ ГЛАВНОГО APPLE HUB
// ─────────────────────────────────────────────────────────────────────────────

export const HubSkillChecksTab: React.FC<{
  onPlaySelfCheck: (check: SkillCheckDef) => void;
  onOpenOwnerTracker: (check: SkillCheckDef, token: string) => void;
  refreshTrigger?: number;
}> = ({ onPlaySelfCheck, onOpenOwnerTracker, refreshTrigger = 0 }) => {
  const [selectedForCreate, setSelectedForCreate] = useState<SkillCheckDef | null>(null);
  const [createdList, setCreatedList] = useState<CreatedCheckRecord[]>(() => loadCreatedChecks());
  const [checkFilter, setCheckFilter] = useState<'all' | 'standards' | 'roles'>('all');

  useEffect(() => {
    setCreatedList(loadCreatedChecks());
  }, [refreshTrigger]);

  // Тихое фоновое обновление статусов последних 6 активных ссылок при открытии вкладки
  useEffect(() => {
    const list = loadCreatedChecks().slice(0, 6);
    if (list.length === 0) return;
    let cancelled = false;
    void Promise.all(list.map((r) => fetchRemoteCheckState(r.slug, r.token))).then(() => {
      if (!cancelled) setCreatedList(loadCreatedChecks());
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleDeleteRecord = (e: React.MouseEvent, token: string) => {
    e.stopPropagation();
    sfxUiTap();
    setCreatedList(deleteCreatedCheckRecord(token));
  };

  return (
    <div className="apple-cards-scroll">
      <div className="sc-hub-intro">
        <p>
          Короткие проверки на 10 рабочих развилок: сгенерируйте ссылку и отслеживайте результат
          прямо по ней же — без регистрации и сбора персональных данных.
        </p>
      </div>

      {/* Секция выданных пользователем ссылок */}
      {createdList.length > 0 && (
        <div className="sc-my-links-section">
          <div className="sc-sec-header">
            <span>Мои проверочные ссылки ({createdList.length})</span>
          </div>
          {createdList.slice(0, 12).map((rec) => {
            const chk = getSkillCheckById(rec.checkId) ?? getSkillCheckById(rec.slug);
            if (!chk) return null;
            const firstDecoded = rec.receipts[0]
              ? unpackCheckReceipt(rec.slug, rec.token, rec.receipts[0])
              : null;
            const quickEval = firstDecoded ? evaluateCheckAttempt(chk, firstDecoded) : null;

            return (
              <div key={rec.token} className="sc-my-link-row">
                <button
                  type="button"
                  className="sc-mlr-main"
                  onClick={() => {
                    sfxUiTap(true);
                    onOpenOwnerTracker(chk, rec.token);
                  }}
                >
                  <div className="sc-mlr-copy">
                    <div className="sc-mlr-top">
                      <strong>{rec.memo || chk.shortTitle}</strong>
                      {quickEval ? (
                        <span className={`sc-mini-badge tone-${quickEval.tone}`}>
                          {quickEval.score}/10 · Готов отчёт
                        </span>
                      ) : rec.lastStatus === 'halfway' || rec.lastStatus === 'opened' ? (
                        <span className="sc-mini-badge active">Проходит сейчас…</span>
                      ) : (
                        <span className="sc-mini-badge idle">Ждёт прохождения</span>
                      )}
                    </div>
                    <small>
                      {rec.memo ? `${chk.title} · ` : ''}#{rec.token.slice(0, 6)}
                    </small>
                  </div>
                  <span className="apr-chevron">›</span>
                </button>
                <button
                  type="button"
                  className="sc-mlr-del"
                  onClick={(e) => handleDeleteRecord(e, rec.token)}
                  aria-label="Удалить ссылку из списка"
                  title="Убрать из списка"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Фильтр каталога проверок */}
      <div className="ios-context-chips">
        {(
          [
            ['all', 'Все'],
            ['standards', 'Общая база'],
            ['roles', 'По специальностям'],
          ] as ['all' | 'standards' | 'roles', string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={checkFilter === key ? 'on' : ''}
            onClick={() => {
              sfxUiTap();
              setCheckFilter(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {SKILL_CHECKS.filter((chk) => checkFilter === 'all' || chk.group === checkFilter).map((chk) => (
        <div key={chk.id} className="apple-pack-row">
          <button
            type="button"
            className="apr-main-tap"
            onClick={() => {
              sfxUiTap(true);
              setSelectedForCreate(chk);
            }}
          >
            <div className="apr-thumb-squircle">
              <EditorialCardPortrait
                packId={chk.coverPackId}
                cardId={`chk_cover_${chk.id}`}
                speaker={chk.shortTitle}
                blockNum={2}
              />
            </div>

            <div className="apr-copy">
              <div className="apr-title-line">
                <h3>{chk.title}</h3>
              </div>
              <p>{chk.subtitle}</p>
              <div className="apr-meta">
                <span>{chk.badge}</span>
                <span>· По ссылке</span>
              </div>
            </div>

            <span className="apr-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      ))}

      {selectedForCreate && (
        <CreateSkillCheckModal
          check={selectedForCreate}
          onClose={() => setSelectedForCreate(null)}
          onCreatedLink={(rec) => {
            const targetCheck = selectedForCreate;
            setSelectedForCreate(null);
            setCreatedList(loadCreatedChecks());
            onOpenOwnerTracker(targetCheck, rec.token);
          }}
          onPlaySelfNow={(chk) => {
            setSelectedForCreate(null);
            onPlaySelfCheck(chk);
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. АНИМАЦИЯ УЛЕТАЮЩЕЙ КАРТОЧКИ В РЕЖИМЕ ПРОВЕРКИ (1:1 С ГЛАВНОЙ СЦЕНОЙ)
// ─────────────────────────────────────────────────────────────────────────────

interface ExitingCheckCardSnap {
  seq: number;
  card: SkillCheckCard;
  side: 'left' | 'right';
  fromX: number;
  fromY: number;
  fromRot: number;
}

const OutgoingCheckCardGhost: React.FC<{
  snapshot: ExitingCheckCardSnap;
  onDone: (seq: number) => void;
}> = ({ snapshot, onDone }) => {
  const ghostRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ghostRef.current;
    if (!el) return;
    const dirSign = snapshot.side === 'right' ? 1 : -1;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 430;
    const targetX = dirSign * Math.max(vw * 1.28, 560);
    const targetRot = dirSign * 26;
    const targetTiltY = dirSign * 18;
    const wasTap = Math.abs(snapshot.fromX) < 26;

    const keyframes: Keyframe[] = wasTap
      ? [
          {
            offset: 0,
            transform: `perspective(1100px) translate3d(${snapshot.fromX.toFixed(1)}px, ${snapshot.fromY.toFixed(1)}px, 0) rotate(${snapshot.fromRot.toFixed(2)}deg) scale(1)`,
            opacity: 1,
          },
          {
            offset: 0.18,
            transform: `perspective(1100px) translate3d(${(dirSign * 34).toFixed(1)}px, -10px, 0) rotate(${(dirSign * 4.2).toFixed(2)}deg) rotateY(${(dirSign * 4).toFixed(1)}deg) scale(1.024)`,
            opacity: 1,
          },
          {
            offset: 0.74,
            transform: `perspective(1100px) translate3d(${(targetX * 0.72).toFixed(1)}px, 38px, 0) rotate(${(targetRot * 0.78).toFixed(2)}deg) rotateY(${(targetTiltY * 0.8).toFixed(1)}deg) scale(0.985)`,
            opacity: 0.96,
          },
          {
            offset: 1,
            transform: `perspective(1100px) translate3d(${targetX}px, 92px, 0) rotate(${targetRot}deg) rotateY(${targetTiltY}deg) scale(0.92)`,
            opacity: 0,
          },
        ]
      : [
          {
            offset: 0,
            transform: `perspective(1100px) translate3d(${snapshot.fromX.toFixed(1)}px, ${snapshot.fromY.toFixed(1)}px, 0) rotate(${snapshot.fromRot.toFixed(2)}deg) rotateY(${(dirSign * 3).toFixed(1)}deg) scale(1)`,
            opacity: 1,
          },
          {
            offset: 0.42,
            transform: `perspective(1100px) translate3d(${(snapshot.fromX + (targetX - snapshot.fromX) * 0.46).toFixed(1)}px, ${(snapshot.fromY + 24).toFixed(1)}px, 0) rotate(${(snapshot.fromRot + (targetRot - snapshot.fromRot) * 0.48).toFixed(2)}deg) rotateY(${(targetTiltY * 0.55).toFixed(1)}deg) scale(0.995)`,
            opacity: 1,
          },
          {
            offset: 0.78,
            transform: `perspective(1100px) translate3d(${(snapshot.fromX + (targetX - snapshot.fromX) * 0.82).toFixed(1)}px, ${(snapshot.fromY + 56).toFixed(1)}px, 0) rotate(${(targetRot * 0.88).toFixed(2)}deg) rotateY(${(targetTiltY * 0.88).toFixed(1)}deg) scale(0.965)`,
            opacity: 0.94,
          },
          {
            offset: 1,
            transform: `perspective(1100px) translate3d(${targetX}px, ${(snapshot.fromY + 96).toFixed(1)}px, 0) rotate(${targetRot}deg) rotateY(${targetTiltY}deg) scale(0.92)`,
            opacity: 0,
          },
        ];

    const anim = el.animate(keyframes, {
      duration: wasTap ? 540 : 480,
      easing: 'cubic-bezier(0.3, 0.05, 0.22, 1)',
      fill: 'forwards',
    });
    anim.onfinish = () => onDone(snapshot.seq);
    return () => anim.cancel();
  }, [onDone, snapshot]);

  const chosenFull =
    snapshot.side === 'left' ? snapshot.card.leftLabel : snapshot.card.rightLabel;

  return (
    <div
      ref={ghostRef}
      className={`dilemma-card apple-spring-card outgoing-ghost-card exit-${snapshot.side}`}
    >
      <div className="dc-portrait-area">
        <EditorialCardPortrait
          packId={snapshot.card.portraitPackId}
          cardId={snapshot.card.id}
          speaker={snapshot.card.speaker}
          blockNum={2}
        />
        <div className={`reigns-choice-curtain top-ergonomic-curtain ${snapshot.side}`} style={{ opacity: 1 }}>
          <div className={`rcc-volumetric-bar ${snapshot.side}`} style={{ width: '100%' }} />
          <div className="rcc-copy">
            <small>{snapshot.side === 'left' ? '← Решение принято' : 'Решение принято →'}</small>
            <strong>{chosenFull}</strong>
          </div>
        </div>
      </div>
      <div className="dc-speaker-bar">
        <strong>{snapshot.card.speaker}</strong>
        <span>{snapshot.card.role}</span>
      </div>
      <div className="dc-question-body">
        <p>{snapshot.card.text}</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. ПОЛНОЭКРАННОЕ ПРОХОЖДЕНИЕ БЛИЦ-ПРОВЕРКИ (10 КАРТОЧЕК)
// ─────────────────────────────────────────────────────────────────────────────

export const ActiveSkillCheckRunner: React.FC<{
  check: SkillCheckDef;
  token: string;
  mode: CheckVisibilityMode;
  isSelfPractice?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onExitToHub: () => void;
  onCreateOwnChallengeLink: (check: SkillCheckDef) => void;
}> = ({
  check,
  token,
  mode,
  isSelfPractice = false,
  muted,
  onToggleMute,
  onExitToHub,
  onCreateOwnChallengeLink,
}) => {
  const orderedItems = useMemo(() => getOrderedCardsForToken(check, token), [check, token]);

  const savedExistingReceipt = useMemo(
    () => (isSelfPractice ? null : getSavedCandidateCompletion(token)),
    [isSelfPractice, token]
  );

  const [alreadyDoneReceipt, setAlreadyDoneReceipt] = useState<DecodedCheckReceipt | null>(() =>
    savedExistingReceipt ? unpackCheckReceipt(check.slug, token, savedExistingReceipt) : null
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [cardSeq, setCardSeq] = useState(1);
  const [exitingCards, setExitingCards] = useState<ExitingCheckCardSnap[]>([]);
  const [finishedReceipt, setFinishedReceipt] = useState<DecodedCheckReceipt | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'offline'>('idle');
  const [copiedBackup, setCopiedBackup] = useState(false);

  const attemptNumRef = useRef<number>(1);
  const runStartedAtMsRef = useRef<number>(Date.now());
  const cardShownAtMsRef = useRef<number>(Date.now());
  const tabLeavesRef = useRef<number>(0);
  const choicesByCanonicalRef = useRef<('left' | 'right')[]>(new Array(10).fill('left'));
  const secByCanonicalRef = useRef<number[]>(new Array(10).fill(0));
  const startedSyncSentRef = useRef(false);

  const activeCardElRef = useRef<HTMLDivElement | null>(null);
  const backElRef = useRef<HTMLDivElement | null>(null);
  const lastInlineCommitMsRef = useRef(0);
  const ghostSeqRef = useRef(1);

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    captured: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    lockedThreshold: false,
    lastTickBucket: 0,
  });

  const [previewSide, setPreviewSide] = useState<'left' | 'right' | null>(null);
  const [pullRatio, setPullRatio] = useState(0);

  // Регистрируем старт попытки и слушаем уходы из вкладки
  useEffect(() => {
    if (alreadyDoneReceipt || finishedReceipt) return;
    runStartedAtMsRef.current = Date.now();
    cardShownAtMsRef.current = Date.now();
    if (!isSelfPractice) {
      attemptNumRef.current = bumpCandidateAttemptOnStart(token);
      if (!startedSyncSentRef.current) {
        startedSyncSentRef.current = true;
        void publishCandidateProgress(check.slug, token, 'open', 0);
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        tabLeavesRef.current += 1;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [alreadyDoneReceipt, check.slug, finishedReceipt, isSelfPractice, token]);

  const currentItem = orderedItems[stepIdx];
  const nextItem = orderedItems[stepIdx + 1];

  const removeGhost = useCallback((seq: number) => {
    setExitingCards((prev) => prev.filter((g) => g.seq !== seq));
  }, []);

  const commitCardChoice = useCallback(
    (side: 'left' | 'right', release: { fromX: number; fromY: number; fromRot: number }) => {
      if (!currentItem || finishedReceipt) return;
      initSound();
      sfxSwipeCommit(side);
      vibrate(side === 'right' ? [14] : [11]);

      const now = Date.now();
      const spentSec = Math.max(1, Math.min(255, Math.round((now - cardShownAtMsRef.current) / 1000)));
      choicesByCanonicalRef.current[currentItem.canonicalIndex] = side;
      secByCanonicalRef.current[currentItem.canonicalIndex] = spentSec;

      const snapSeq = ghostSeqRef.current++;
      setExitingCards((prev) => [
        ...prev.slice(-2),
        {
          seq: snapSeq,
          card: currentItem.card,
          side,
          fromX: release.fromX,
          fromY: release.fromY,
          fromRot: release.fromRot,
        },
      ]);

      setPreviewSide(null);
      setPullRatio(0);

      if (stepIdx + 1 < orderedItems.length) {
        const nextStep = stepIdx + 1;
        if (!isSelfPractice && nextStep === 5) {
          void publishCandidateProgress(check.slug, token, 'half', 5);
        }
        cardShownAtMsRef.current = now;
        setStepIdx(nextStep);
        setCardSeq((s) => s + 1);
      } else {
        // Финал 10-й карточки!
        const totalDurationSec = Math.max(
          5,
          Math.round((now - runStartedAtMsRef.current) / 1000)
        );
        const packed = packCheckReceipt(check.slug, token, {
          choices: choicesByCanonicalRef.current,
          perCardSec: secByCanonicalRef.current,
          durationSec: totalDurationSec,
          attemptNum: attemptNumRef.current,
          tabLeaves: tabLeavesRef.current,
          completedAtMs: now,
        });
        const decoded = unpackCheckReceipt(check.slug, token, packed);
        sfxVictory();
        vibrate([18, 45, 24]);

        if (decoded) {
          setFinishedReceipt(decoded);
        }

        if (!isSelfPractice) {
          saveCandidateCompletionLocally(token, packed);
          setSyncState('syncing');
          void publishCandidateCompletion(check.slug, token, packed).then((ok) => {
            setSyncState(ok ? 'synced' : 'offline');
          });
        } else {
          setSyncState('synced');
        }
      }
    },
    [check.slug, currentItem, finishedReceipt, isSelfPractice, orderedItems.length, stepIdx, token]
  );

  const SWIPE_THRESHOLD = 78;

  const applyDragDom = (dx: number, dy: number) => {
    const cardEl = activeCardElRef.current;
    if (!cardEl) return;
    const rot = Math.max(-18, Math.min(18, dx * 0.062));
    const liftY = dy * 0.24 - Math.min(10, Math.abs(dx) * 0.035);
    cardEl.style.transition = 'none';
    cardEl.style.transform = `perspective(1100px) translate3d(${dx.toFixed(1)}px, ${liftY.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;

    const ratio = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
    const backEl = backElRef.current;
    if (backEl) {
      const plane = backEl.querySelector('.dc-focus-plane') as HTMLElement | null;
      if (plane) {
        const blurPx = (1 - ratio * 0.72) * 11;
        plane.style.filter = `blur(${blurPx.toFixed(1)}px) brightness(${(0.84 + ratio * 0.14).toFixed(2)})`;
      }
    }
  };

  const resetDragDom = () => {
    const cardEl = activeCardElRef.current;
    if (cardEl) {
      cardEl.style.transition = 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)';
      cardEl.style.transform = '';
    }
    const backEl = backElRef.current;
    if (backEl) {
      const plane = backEl.querySelector('.dc-focus-plane') as HTMLElement | null;
      if (plane) plane.style.filter = '';
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (finishedReceipt || alreadyDoneReceipt) return;
    if ((e.target as HTMLElement | null)?.closest('button[data-no-drag]')) return;
    initSound();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      captured: false,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      lockedThreshold: false,
      lastTickBucket: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const dist = Math.hypot(dx, dy);

    if (!d.captured && dist > 6) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        d.captured = true;
        sfxCardGrab();
      } catch {
        // ignore
      }
    }
    if (!d.captured) return;

    d.dx = dx;
    d.dy = dy;
    applyDragDom(dx, dy);

    const absX = Math.abs(dx);
    const ratio = Math.min(1, absX / SWIPE_THRESHOLD);
    setPullRatio(ratio);
    setPreviewSide(absX > 14 ? (dx < 0 ? 'left' : 'right') : null);

    const dir: 'left' | 'right' = dx < 0 ? 'left' : 'right';
    const bucket = Math.floor(absX / 28);
    if (bucket !== d.lastTickBucket && bucket > 0 && bucket <= 3) {
      d.lastTickBucket = bucket;
      sfxTiltTick(dir);
    }

    if (absX >= SWIPE_THRESHOLD && !d.lockedThreshold) {
      d.lockedThreshold = true;
      sfxThresholdLock(dir, true);
      vibrate(10);
    } else if (absX < SWIPE_THRESHOLD - 10 && d.lockedThreshold) {
      d.lockedThreshold = false;
      sfxThresholdLock(dir, false);
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    d.active = false;
    if (d.captured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (Math.abs(d.dx) >= SWIPE_THRESHOLD) {
      const side: 'left' | 'right' = d.dx < 0 ? 'left' : 'right';
      const rot = Math.max(-18, Math.min(18, d.dx * 0.062));
      const liftY = d.dy * 0.24 - Math.min(10, Math.abs(d.dx) * 0.035);
      if (activeCardElRef.current) {
        activeCardElRef.current.style.transition = 'none';
        activeCardElRef.current.style.transform = '';
      }
      commitCardChoice(side, { fromX: d.dx, fromY: liftY, fromRot: rot });
    } else {
      if (Math.abs(d.dx) > 14) sfxCardSnapBack();
      setPreviewSide(null);
      setPullRatio(0);
      resetDragDom();
    }
  };

  // Экран завершения (или повторного открытия уже пройденной ссылки)
  const completedData = finishedReceipt ?? alreadyDoneReceipt;
  if (completedData) {
    const showBreakdownToUser = isSelfPractice || mode === 'challenge';
    const backupSnapshotUrl = buildDirectSnapshotUrl(check.slug, token, completedData.raw);

    return (
      <div className="reigns-shell sc-completed-shell">
        <header className="top-bar unified-bar">
          <button
            type="button"
            className="hb-pill hb-pack-pill"
            onClick={() => {
              sfxUiTap(true);
              onExitToHub();
            }}
          >
            <IconGrid size={15} />
            <span className="hb-pack-name">Все режимы</span>
          </button>
          <span className="sc-top-badge">{check.shortTitle} · 10/10</span>
        </header>

        <div className="apple-cards-scroll sc-finish-scroll">
          {!showBreakdownToUser ? (
            <div className="sc-screening-done-card">
              <div className="sc-done-check-icon">✓</div>
              <h2>Проверка завершена</h2>
              <p>
                Все 10 ситуаций пройдены за {formatDurationShort(completedData.durationSec)}. Ваши
                решения зафиксированы и уже доступны отправителю по выданной ссылке.
              </p>

              <div className="sc-sync-pill-wrap">
                {syncState === 'syncing' ? (
                  <span className="sc-sync-pill">Сохраняем отчёт по ссылке…</span>
                ) : syncState === 'offline' ? (
                  <span className="sc-sync-pill warn">
                    Сеть ограничена — скопируйте резервную ссылку ниже
                  </span>
                ) : (
                  <span className="sc-sync-pill ok">✓ Результат синхронизирован по ссылке</span>
                )}
              </div>

              <div className="sc-done-actions">
                {syncState === 'offline' && (
                  <button
                    type="button"
                    className="sc-btn-secondary full"
                    onClick={async () => {
                      sfxUiTap(true);
                      await copyTextSafe(backupSnapshotUrl);
                      setCopiedBackup(true);
                      setTimeout(() => setCopiedBackup(false), 2400);
                    }}
                  >
                    {copiedBackup
                      ? '✓ Резервный код скопирован'
                      : 'Скопировать резервную ссылку для отправителя'}
                  </button>
                )}

                <button
                  type="button"
                  className="sc-btn-primary full"
                  onClick={() => {
                    sfxUiTap(true);
                    onExitToHub();
                  }}
                >
                  Открыть симулятор профессий «Кресло»
                </button>

                {alreadyDoneReceipt && !finishedReceipt && (
                  <button
                    type="button"
                    className="sc-btn-ghost full"
                    onClick={() => {
                      sfxUiTap();
                      setAlreadyDoneReceipt(null);
                    }}
                  >
                    Пройти повторно (зафиксируется как Попытка #{completedData.attemptNum + 1})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="sc-challenge-done-wrap">
              <div className="sc-challenge-head">
                <span className="ahh-eyebrow">Итог блиц-проверки</span>
                <h2>{check.title}</h2>
                {!isSelfPractice && (
                  <small className="sc-challenge-sub">
                    Отправитель ссылки также получил ваш результат автоматически
                  </small>
                )}
              </div>

              <SkillCheckScorecardView
                check={check}
                decodedReceipts={[completedData]}
                audience="self"
              />

              <div className="sc-done-actions">
                <button
                  type="button"
                  className="sc-btn-primary full"
                  onClick={() => {
                    sfxCoffeeSave();
                    onCreateOwnChallengeLink(check);
                  }}
                >
                  Создать свою ссылку — проверить коллегу или друга
                </button>
                <button
                  type="button"
                  className="sc-btn-secondary full"
                  onClick={() => {
                    sfxUiTap(true);
                    onExitToHub();
                  }}
                >
                  К списку всех специальностей и проверок
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!currentItem) return null;
  const currentCard = currentItem.card;

  return (
    <div className="reigns-shell sc-active-runner">
      <header className="top-bar unified-bar">
        <button
          type="button"
          data-no-drag="1"
          className="hb-pill hb-pack-pill"
          onClick={() => {
            sfxUiTap(true);
            onExitToHub();
          }}
        >
          <IconGrid size={15} />
          <span className="hb-pack-name">{check.shortTitle}</span>
          <span className="hb-shift-num">
            {String(stepIdx + 1).padStart(2, '0')}/{orderedItems.length}
          </span>
        </button>

        <div className="hb-right-group">
          <button
            type="button"
            data-no-drag="1"
            className="hb-circle-btn"
            onClick={() => {
              sfxUiTap();
              onToggleMute();
            }}
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          >
            <IconVolume size={17} muted={muted} />
          </button>
        </div>
      </header>

      {/* 10 чётких сегментов прогресса проверки */}
      <div className="sc-ten-segments">
        {orderedItems.map((it, idx) => (
          <div
            key={it.card.id}
            className={`sc-seg-dot ${idx < stepIdx ? 'done' : idx === stepIdx ? 'cur' : ''}`}
          />
        ))}
      </div>

      {/* Стабильная памятка единой Tinder-семантики */}
      <div className="context-ticker-slot">
        <div className="sc-semantics-ribbon">
          <span className="left-sem">← Влево: Отказ / Стоп</span>
          <span className="sem-dot">·</span>
          <span className="right-sem">Вправо: Согласие / Шаг →</span>
        </div>
      </div>

      <main
        className="card-stage spacious-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div className="deck-stack-wrapper">
          <div className="deck-back back-2" />

          {nextItem && (
            <div
              key={`chk_under_${cardSeq}`}
              ref={backElRef}
              className="dilemma-card apple-spring-card blurred-next-underlay"
              aria-hidden="true"
            >
              <div className="dc-focus-plane">
                <div className="dc-portrait-area">
                  <EditorialCardPortrait
                    packId={nextItem.card.portraitPackId}
                    cardId={nextItem.card.id}
                    speaker={nextItem.card.speaker}
                    blockNum={2}
                  />
                </div>
                <div className="dc-speaker-bar">
                  <strong>{nextItem.card.speaker}</strong>
                  <span>{nextItem.card.role}</span>
                </div>
                <div className="dc-question-body">
                  <p>{nextItem.card.text}</p>
                </div>
                <div className="dc-inline-choices">
                  <div className="dc-inline-side left">
                    <div className="dc-inline-copy">
                      <small className="dc-dir-kicker">← Отказ / Стоп</small>
                      <strong>{nextItem.card.leftShort}</strong>
                    </div>
                  </div>
                  <div className="dc-inline-side right">
                    <div className="dc-inline-copy">
                      <small className="dc-dir-kicker">Согласие / Шаг →</small>
                      <strong>{nextItem.card.rightShort}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bnu-depth-veil" />
            </div>
          )}

          <div
            key={`chk_cur_${cardSeq}`}
            ref={activeCardElRef}
            className={`dilemma-card apple-spring-card ${cardSeq > 1 ? 'rack-focus-appear' : ''} ${
              previewSide === 'left' ? 'tilted-left' : previewSide === 'right' ? 'tilted-right' : ''
            }`}
          >
            <div className="dc-focus-plane">
              <div className="dc-portrait-area">
                <EditorialCardPortrait
                  packId={currentCard.portraitPackId}
                  cardId={currentCard.id}
                  speaker={currentCard.speaker}
                  blockNum={2}
                />

                {previewSide && (
                  <div
                    className={`reigns-choice-curtain top-ergonomic-curtain ${previewSide}`}
                    style={{ opacity: Math.min(1, 0.9 + pullRatio * 0.1) }}
                  >
                    <div
                      className={`rcc-volumetric-bar ${previewSide}`}
                      style={{ width: `${Math.round(Math.max(22, pullRatio * 100))}%` }}
                    />
                    <div className="rcc-copy">
                      <small>
                        {previewSide === 'left'
                          ? '← Отказ / Стоп · Полное решение'
                          : 'Согласие / Шаг · Полное решение →'}
                      </small>
                      <strong>
                        {previewSide === 'left' ? currentCard.leftLabel : currentCard.rightLabel}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="dc-speaker-bar">
                <strong>{currentCard.speaker}</strong>
                <span>{currentCard.role}</span>
              </div>

              <div className="dc-question-body">
                <p>{currentCard.text}</p>
              </div>

              <div className="dc-inline-choices">
                <button
                  type="button"
                  data-inline-choice="left"
                  className={`dc-inline-side left ${previewSide === 'left' ? 'active' : ''}`}
                  onClick={() => {
                    if (performance.now() - lastInlineCommitMsRef.current > 180) {
                      lastInlineCommitMsRef.current = performance.now();
                      commitCardChoice('left', { fromX: 0, fromY: 0, fromRot: 0 });
                    }
                  }}
                >
                  <div
                    className="dc-inline-fill left-dir"
                    style={{
                      width: previewSide === 'left' ? `${Math.round(pullRatio * 100)}%` : '0%',
                    }}
                  />
                  <div className="dc-inline-copy">
                    <small className="dc-dir-kicker">← Отказ / Стоп</small>
                    <strong>{currentCard.leftShort}</strong>
                  </div>
                </button>

                <button
                  type="button"
                  data-inline-choice="right"
                  className={`dc-inline-side right ${previewSide === 'right' ? 'active' : ''}`}
                  onClick={() => {
                    if (performance.now() - lastInlineCommitMsRef.current > 180) {
                      lastInlineCommitMsRef.current = performance.now();
                      commitCardChoice('right', { fromX: 0, fromY: 0, fromRot: 0 });
                    }
                  }}
                >
                  <div
                    className="dc-inline-fill right-dir"
                    style={{
                      width: previewSide === 'right' ? `${Math.round(pullRatio * 100)}%` : '0%',
                    }}
                  />
                  <div className="dc-inline-copy">
                    <small className="dc-dir-kicker">Согласие / Шаг →</small>
                    <strong>{currentCard.rightShort}</strong>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {exitingCards.map((snap) => (
            <OutgoingCheckCardGhost key={snap.seq} snapshot={snap} onDone={removeGhost} />
          ))}
        </div>
      </main>

      <footer className="minimal-bottom-dock sc-runner-footer">
        <span className="sc-axis-caption">Блок: {currentCard.axis}</span>
      </footer>
    </div>
  );
};
