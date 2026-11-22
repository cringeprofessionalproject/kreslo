import { useEffect, useState } from 'react';
import { sfxCoffeeSave, sfxVictory } from '../audio';
import { CAMPAIGN_BLOCKS, getBlockForWeek, type BlockMetaInfo } from '../game/blockCampaignEngine';
import type { RecordedReelResult } from '../game/reelVideoRecorder';
import { renderEditorialSharePoster } from '../game/shareCardRenderer';
import type { RunSwipeHighlight } from '../game/shortsHighlightBuilder';
import { pickBestRealCaseForHighlight } from '../game/shortsHighlightBuilder';
import {
  getTelegramStarsPriceForPack,
  isRunningInsideTelegramMiniApp,
} from '../game/telegramStars';
import type { EndingDef, JobPack, PersistentMeta, PillarMeta, Stats } from '../types';
import { EditorialCardPortrait } from './CharacterArt';
import { IconShare, PillarSvgIcon } from './Icons';
import { useSheetPullToDismiss } from './useNativeGestures';

// ───────── 1. ИНФО-СПРАВКА ПО МЕТРИКЕ ИЛИ РЕЗЕРВУ (С ЖЕСТОМ СВАЙПА ВНИЗ) ─────────

interface MetricInfoProps {
  pillar?: PillarMeta;
  currentValue?: number;
  pack: JobPack;
  showLifelineInfo?: boolean;
  lifelineCharges?: number;
  onClose: () => void;
}

export function MetricInfoModal({
  pillar,
  currentValue = 50,
  pack,
  showLifelineInfo,
  lifelineCharges = 0,
  onClose,
}: MetricInfoProps) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);
  const zoneStatus =
    currentValue <= 20
      ? { text: 'Опасно низко', cls: 'danger' }
      : currentValue >= 82
        ? { text: 'Опасный перегрев', cls: 'danger' }
        : { text: 'В норме', cls: 'safe' };

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />

        {showLifelineInfo ? (
          <>
            <span className="eyebrow-tag">РЕЗЕРВ СМЕНЫ</span>
            <h3 className="sheet-serif-title">{pack.lifelineName}</h3>
            <p className="info-lead">{pack.lifelineDesc}</p>
            <div className="info-danger-card safe">
              <strong>Зарядов в запасе: {lifelineCharges}</strong>
              <p>Пополняется каждые 8 смен, на рубеже Блоков и во входящих СМС.</p>
            </div>
          </>
        ) : pillar ? (
          <>
            <div className="info-head">
              <div className="pillar-modal-ico">
                <PillarSvgIcon packId={pack.id} statKey={pillar.key} size={22} />
              </div>
              <div>
                <h3>
                  {pillar.label} · {currentValue}%
                </h3>
                <span className={`zone-chip ${zoneStatus.cls}`}>{zoneStatus.text}</span>
              </div>
            </div>

            <p className="info-lead">{pillar.whatIsIt}</p>

            <div className="info-extremes">
              <div className="info-danger-card low">
                <strong>Если упадёт в 0%</strong>
                <p>{pillar.zeroWarning}</p>
              </div>
              <div className="info-danger-card high">
                <strong>Если дойдёт до 100%</strong>
                <p>{pillar.hundredWarning}</p>
              </div>
            </div>
          </>
        ) : null}

        <button type="button" className="cta-btn subtle" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

// ───────── 2. РУБЕЖ БЛОКА (С ЖЕСТОМ СВАЙПА) ─────────

interface BlockIntermissionProps {
  pack: JobPack;
  clearedBlock: BlockMetaInfo;
  nextBlock: BlockMetaInfo;
  stats: Stats;
  iqHits: number;
  iqTotal: number;
  isNextBlockUnlocked: boolean;
  onContinueNextBlock: () => void;
  onUnlockMoreAndContinue: () => void;
  onBackToHub: () => void;
}

export function BlockIntermissionModal({
  pack,
  clearedBlock,
  nextBlock,
  stats,
  iqHits,
  iqTotal,
  isNextBlockUnlocked,
  onContinueNextBlock,
  onUnlockMoreAndContinue,
  onBackToHub,
}: BlockIntermissionProps) {
  const masteryPct = iqTotal > 0 ? Math.round((iqHits / iqTotal) * 100) : 80;
  // Свайп вниз закрывает в каталог (а не вызывает оплату!)
  const dismissAction = isNextBlockUnlocked ? onContinueNextBlock : onBackToHub;
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(dismissAction);
  const targetBlk = nextBlock.blockNum === 3 ? 3 : 2;
  const blockStars = getTelegramStarsPriceForPack(pack.id, targetBlk);

  return (
    <div
      className="overlay-backdrop"
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismissAction();
      }}
    >
      <div
        className="ending-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <span className="eyebrow-tag">РУБЕЖ ПРОЙДЕН · ЧЕКПОИНТ СОХРАНЁН</span>

        <div className="blocks-stepper">
          {CAMPAIGN_BLOCKS.map((b) => {
            const state =
              b.blockNum <= clearedBlock.blockNum
                ? 'done'
                : b.blockNum === nextBlock.blockNum
                  ? 'current'
                  : 'upcoming';
            return (
              <div key={b.blockNum} className={`bs-item ${state}`}>
                <span className="bs-num">Блок {b.roman}</span>
                <small>
                  {b.startWeek}–{b.endWeek}
                </small>
              </div>
            );
          })}
        </div>

        <h2 className="sheet-serif-title">{clearedBlock.title} позади</h2>
        <p className="ending-desc">
          Дальше — <b>{nextBlock.title}</b>. {nextBlock.subtitle}
        </p>

        <div className="elegant-stats-strip">
          {pack.pillars.map((p) => (
            <div key={p.key} className="ess-cell">
              <strong>{stats[p.key]}%</strong>
              <span>{p.label}</span>
            </div>
          ))}
          <div className="ess-cell accent">
            <strong>{masteryPct}%</strong>
            <span>Опыт</span>
          </div>
        </div>

        {isNextBlockUnlocked ? (
          <button type="button" className="cta-btn primary big" onClick={onContinueNextBlock}>
            Продолжить · Смена {nextBlock.startWeek} →
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <button
              type="button"
              className={`cta-btn primary big ${
                nextBlock.blockNum === 3 ? 'tier-unlock-polychrome' : 'tier-unlock-foil'
              }`}
              onClick={onUnlockMoreAndContinue}
            >
              {isRunningInsideTelegramMiniApp()
                ? `Открыть Блок ${targetBlk} · ${blockStars} ★ →`
                : `Открыть Блок ${targetBlk} в Telegram · ${blockStars} ★ →`}
            </button>
            <button type="button" className="cta-btn subtle" onClick={onBackToHub}>
              К выбору колоды
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── 2.5. ГАЧА-СПАСЕНИЕ «УДЕРЖАТЬ КРЕСЛО С ЭТОЙ СМЕНЫ» (ПОСЛЕ 3-ГО СРЫВА ИЛИ В БЛОКАХ 2–3) ─────────

export function GachaContinueModal({
  pack,
  week,
  crashedStatLabel,
  starsPrice,
  onAcceptSave,
  onDeclineAndFinish,
}: {
  pack: JobPack;
  week: number;
  crashedStatLabel: string;
  starsPrice: number;
  onAcceptSave: () => void;
  onDeclineAndFinish: () => void;
}) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onDeclineAndFinish);
  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onDeclineAndFinish}>
      <div
        className="ending-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 410 }}
      >
        <div className="sheet-grabber-bar" />
        <span className="eyebrow-tag" style={{ color: 'var(--brass)' }}>
          СРЫВ НА {week}-й СМЕНЕ ИЗ 36 · «{crashedStatLabel.toUpperCase()}»
        </span>
        <h2 className="sheet-serif-title" style={{ marginTop: 6 }}>
          Удержать кресло с этого хода?
        </h2>
        <p className="ending-desc">
          Сработает экстренный резерв (<b>{pack.lifelineName}</b>): критический показатель вернётся
          в рабочую зону, и вы продолжите партию прямо с <b>{week}-й смены</b> без потери прогресса.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', marginTop: 10 }}>
          <button
            type="button"
            className="cta-btn primary big tier-unlock-foil"
            onClick={onAcceptSave}
          >
            Продолжить с {week}-й смены · {starsPrice} ★
          </button>
          <button type="button" className="cta-btn subtle" onClick={onDeclineAndFinish}>
            Завершить смену и посмотреть итог
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── 3. ЭЛЕГАНТНЫЙ ЛАКОНИЧНЫЙ ФИНАЛЬНЫЙ ЭКРАН (СМАХИВАЕТСЯ ВНИЗ КАК В iOS) ─────────

interface EndingModalProps {
  pack: JobPack;
  ending: EndingDef;
  finalStats: Stats;
  weeksSurvived: number;
  checkpointBlock: 1 | 2 | 3;
  attemptNumber: number;
  isNewEnding: boolean;
  iqHits: number;
  iqTotal: number;
  isPackFullyUnlocked: boolean;
  decisionLog?: { id: string; title: string; fact: string; wasSmart: boolean }[];
  runSwipeHighlights?: RunSwipeHighlight[];
  faceSnapshotUrl?: string | null;
  recordedReel?: RecordedReelResult | null;
  isFinalizingReel?: boolean;
  onOpenRecordedReel?: () => void;
  onOpenShortsCombain?: () => void;
  onOpenDuelChallenge?: () => void;
  onStartReactionRun?: () => void;
  onTrackShare: () => void;
  onUnlockMoreFromEnding: () => void;
  onRestartFromCheckpoint: () => void;
  onRestartFromZero: () => void;
  onSwitchPack: () => void;
  onContinueEndless?: () => void;
}

export function EndingModal({
  pack,
  ending,
  finalStats,
  weeksSurvived,
  checkpointBlock,
  attemptNumber,
  isNewEnding,
  iqHits,
  iqTotal,
  isPackFullyUnlocked,
  decisionLog,
  runSwipeHighlights,
  faceSnapshotUrl,
  recordedReel: _recordedReel,
  isFinalizingReel,
  onOpenRecordedReel: _onOpenRecordedReel,
  onOpenShortsCombain,
  onOpenDuelChallenge,
  onTrackShare,
  onUnlockMoreFromEnding,
  onRestartFromCheckpoint,
  onRestartFromZero,
  onSwitchPack,
  onContinueEndless,
}: EndingModalProps) {
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [unlockedJustNow, setUnlockedJustNow] = useState(false);

  const primaryRestart =
    checkpointBlock > 1 && !ending.isVictory ? onRestartFromCheckpoint : onRestartFromZero;

  // Свайп вниз по финальному экрану элегантно сворачивает его и начинает новую попытку!
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(primaryRestart);

  const masteryPct = iqTotal > 0 ? Math.round((iqHits / iqTotal) * 100) : 78;
  const blockReached = getBlockForWeek(weeksSurvived);

  useEffect(() => {
    let cancelled = false;
    renderEditorialSharePoster({
      pack,
      ending,
      finalStats,
      weeksSurvived,
      attemptNumber,
      iqHits,
      iqTotal,
      faceSnapshotUrl,
    }).then((res) => {
      if (!cancelled) {
        setPosterPreviewUrl(res.previewDataUrl);
        setPosterBlob(res.blob);
        if (res.blob) {
          const fname = `kreslo-screen-${weeksSurvived}smen.png`;
          setPosterFile(new File([res.blob], fname, { type: 'image/png', lastModified: Date.now() }));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attemptNumber, ending, faceSnapshotUrl, finalStats, iqHits, iqTotal, pack, weeksSurvived]);

  const handlePosterShareClick = async () => {
    if (
      posterFile &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [posterFile] }))
    ) {
      try {
        await navigator.share({ files: [posterFile] });
        sfxVictory();
        onTrackShare();
        setShareToast('Скрин сохранён / отправлен');
        window.setTimeout(() => setShareToast(null), 2600);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('abort') || msg.includes('cancel')) return;
      }
    }

    onTrackShare();
    sfxVictory();

    let blob = posterBlob;
    let url = posterPreviewUrl;
    if (!blob || !url) {
      const generated = await renderEditorialSharePoster({
        pack,
        ending,
        finalStats,
        weeksSurvived,
        attemptNumber,
        iqHits,
        iqTotal,
        faceSnapshotUrl,
      });
      blob = generated.blob;
      url = generated.previewDataUrl;
      setPosterPreviewUrl(url);
      setPosterBlob(blob);
    }
    if (!blob || !url) return;

    const cleanFileName = `kreslo-screen-${weeksSurvived}smen.png`;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
    } catch {
      // ignore
    }
    const a = document.createElement('a');
    a.download = cleanFileName;
    a.href = url;
    a.click();
    setShareToast('Скрин сохранён и скопирован в буфер');
    window.setTimeout(() => setShareToast(null), 3000);
  };

  return (
    <div className="overlay-backdrop" style={backdropStyle}>
      <div
        className={`ending-sheet elegant-ending native-ios-sheet ${
          ending.isVictory ? 'victory' : 'crash'
        }`}
        {...sheetProps}
      >
        <div className="sheet-grabber-bar" title="Смахните вниз, чтобы закрыть" />

        <div className="elegant-ending-hero">
          <div className="ee-medallion">
            {ending.videoClip ? (
              <video
                src={ending.videoClip}
                autoPlay
                loop
                muted
                playsInline
                className="ending-video"
              />
            ) : ending.image ? (
              <img src={ending.image} alt={ending.title} draggable={false} />
            ) : (
              <EditorialCardPortrait
                packId={pack.id}
                cardId={ending.id}
                speaker={ending.title}
                blockNum={blockReached.blockNum}
                hideFaceForCutout={Boolean(faceSnapshotUrl)}
              />
            )}

            {faceSnapshotUrl && (
              <img
                src={faceSnapshotUrl}
                alt="Ваше лицо"
                className="ending-tracked-head"
              />
            )}
          </div>

          <div className="ee-status-line">
            <span className={`ee-pill ${ending.isVictory ? 'ok' : 'fail'}`}>
              {ending.isVictory ? 'Аттестован' : 'Срыв смены'}
            </span>
            <span className="ee-meta">
              Смена {weeksSurvived}/36 · Блок {blockReached.roman}
              {isNewEnding ? ' · Новый исход' : ''}
            </span>
          </div>

          <h2 className="ee-title">{ending.title}</h2>
          <p className="ee-desc">{ending.description}</p>
        </div>

        {/* Единая лаконичная полоса итогов без лишних коробок */}
        <div className="elegant-stats-strip">
          {pack.pillars.map((p) => {
            const val = finalStats[p.key];
            const crashed = val <= 0 || val >= 100;
            return (
              <div key={p.key} className={`ess-cell ${crashed ? 'crashed' : ''}`}>
                <strong>{val}%</strong>
                <span>{p.label}</span>
              </div>
            );
          })}
          <div className="ess-cell accent">
            <strong>{masteryPct}%</strong>
            <span>Опыт</span>
          </div>
        </div>

        {decisionLog && decisionLog.length > 0 && (() => {
          const traps = decisionLog.filter((d) => !d.wasSmart);
          const shown = (traps.length > 0 ? traps : decisionLog).slice(-8);
          return (
            <details className="ee-review">
              <summary>
                <span>Разбор решений</span>
                <b className={traps.length === 0 ? 'clean' : ''}>
                  {traps.length === 0
                    ? 'Ни одной ловушки'
                    : `Ловушек: ${traps.length} из ${decisionLog.length}`}
                </b>
              </summary>
              <ul>
                {shown.map((d) => (
                  <li key={d.id} className={d.wasSmart ? 'ok' : 'trap'}>
                    <strong>{d.title}</strong>
                    <span>{d.fact}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })()}

        {(() => {
          const rcBundle = pickBestRealCaseForHighlight(pack, runSwipeHighlights ?? []);
          if (!rcBundle) return null;
          const rc = rcBundle.realCase;
          const isBlunder = rc.kind === 'blunder';
          return (
            <div
              style={{
                padding: '11px 13px',
                borderRadius: 12,
                marginBottom: 10,
                background: 'var(--paper)',
                color: 'var(--ink)',
                border: '1px solid var(--paper-Rule)',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isBlunder ? 'var(--vermilion)' : 'var(--forest)',
                  marginBottom: 3,
                }}
              >
                {isBlunder
                  ? `Известный просчёт · ${rc.person} (${rc.year})`
                  : `Исторический прецедент · ${rc.person} (${rc.year})`}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>{rc.headline}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.38 }}>
                {rc.story}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  color: 'var(--ink-muted)',
                  opacity: 0.78,
                  marginTop: 4,
                }}
              >
                Источник: {rc.source}
              </div>
            </div>
          );
        })()}

        {!isPackFullyUnlocked && !unlockedJustNow && (
          <button
            type="button"
            className="ee-unlock-inline"
            onClick={() => {
              onUnlockMoreFromEnding();
            }}
          >
            <span>Открыть следующий модуль (до 36-й смены)</span>
            <b>Продолжить →</b>
          </button>
        )}

        <div className="ee-actions">
          {onOpenShortsCombain && (
            <button
              type="button"
              className="cta-btn primary big icon-inline-btn"
              disabled={Boolean(isFinalizingReel)}
              onClick={onOpenShortsCombain}
            >
              <IconShare size={18} />
              <span>{isFinalizingReel ? 'Готовим видео…' : 'Поделиться видео'}</span>
            </button>
          )}

          {ending.isVictory && onContinueEndless ? (
            <button
              type="button"
              className="cta-btn subtle"
              onClick={onContinueEndless}
            >
              Бесконечный режим →
            </button>
          ) : checkpointBlock > 1 && !ending.isVictory ? (
            <button
              type="button"
              className="cta-btn subtle"
              onClick={onRestartFromCheckpoint}
            >
              С чекпоинта (Блок {checkpointBlock === 2 ? 'II' : 'III'})
            </button>
          ) : (
            <button
              type="button"
              className="cta-btn subtle"
              onClick={onRestartFromZero}
            >
              Попробовать ещё раз
            </button>
          )}

          <div className="two-col-btns">
            {onOpenDuelChallenge ? (
              <button type="button" className="cta-btn subtle" onClick={onOpenDuelChallenge}>
                Дуэль по раскладу
              </button>
            ) : (
              <button
                type="button"
                className="cta-btn subtle icon-inline-btn"
                onClick={handlePosterShareClick}
              >
                <IconShare size={16} />
                <span>Скрин</span>
              </button>
            )}
            <button type="button" className="cta-btn subtle" onClick={onSwitchPack}>
              К колодам
            </button>
          </div>
        </div>

        {shareToast && <div className="saved-toast">{shareToast}</div>}

        <div className="ee-quiet-footer">
          <span>Смахните вниз, чтобы начать новую смену</span>
        </div>
      </div>
    </div>
  );
}

// ───────── 4. АРХИВ ОТКРЫТЫХ КОНЦОВОК (С ЖЕСТОМ СВАЙПА ВНИЗ) ─────────

interface MuseumModalProps {
  pack: JobPack;
  meta: PersistentMeta;
  onClose: () => void;
}

export function MuseumModal({ pack, meta, onClose }: MuseumModalProps) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);
  const packUnlockedCount = pack.endings.filter((e) => meta.unlockedEndings.includes(e.id)).length;
  const bestIq = meta.bestIqByPack?.[pack.id] ?? 0;

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="museum-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <div className="museum-header">
          <div>
            <span className="eyebrow-tag">АРХИВ ИСХОДОВ · {pack.shortTitle.toUpperCase()}</span>
            <h3>
              Открыто {packUnlockedCount}/{pack.endings.length} · Рекорд{' '}
              {meta.bestWeeksByPack[pack.id] ?? 1}/36
              {bestIq > 0 ? ` · Опыт ${bestIq}%` : ''}
            </h3>
          </div>
          <button
            type="button"
            className="close-round-btn"
            onClick={() => {
              sfxCoffeeSave();
              onClose();
            }}
          >
            ×
          </button>
        </div>

        <div className="museum-scroll">
          <div className="endings-grid">
            {pack.endings.map((e) => {
              const open = meta.unlockedEndings.includes(e.id);
              return (
                <div key={e.id} className={`museum-item ${open ? 'open' : 'locked'}`}>
                  <div className="mi-badge">{open ? e.badge : 'НЕ ОТКРЫТО'}</div>
                  <h4>{open ? e.title : 'Неоткрытый исход смены'}</h4>
                  <p>
                    {open
                      ? e.description
                      : e.isVictory
                        ? 'Пройдите все 36 смен для аттестации.'
                        : 'Доведите один из показателей до 0% или 100%.'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
