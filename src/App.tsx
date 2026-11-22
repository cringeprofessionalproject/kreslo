import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildMixedRecordingStream,
  initSound,
  playVoice,
  setGameMusicContext,
  setMicRecordingDuck,
  setSoundProfile,
  sfxCardFlip,
  sfxCardGrab,
  sfxCardSnapBack,
  sfxCoffeeSave,
  sfxGameOver,
  sfxSwipeCommit,
  hapticSwipeCommit,
  sfxThresholdLock,
  sfxTiltTick,
  sfxUiTap,
  sfxVictory,
  vibrate,
  type SoundProfile,
} from './audio';
import { sendAnonymousPulse } from './game/anonymousPulse';
import {
  alignInsightWithCard,
  computeBalancedEffects,
  getProgressivePreview,
  prepareBalancedCard,
} from './game/balanceMath';
import { getChoiceShortGist } from './game/choiceErgonomics';
import { buildOutcomeQuip, type OutcomeQuip } from './game/outcomeQuips';
import {
  buildBlock2BossCard,
  buildEscalationDeckForPack,
  CAMPAIGN_BLOCKS,
  CAMPAIGN_TOTAL_SHIFTS,
  getBlockForWeek,
  type BlockMetaInfo,
} from './game/blockCampaignEngine';
import {
  DIRECT_PLAY_SLUGS,
  getJobPack,
  parseDirectPlayPackFromWindow,
  SHOWCASE_PACKS,
} from './game/packs';
import { getProInsightForCard, isPackFullyUnlocked } from './game/proInsights';
import { applyAtmosphereToDocument, getPackAtmosphere } from './game/sceneAtmospheres';
import { parseDuelRouteFromWindow, type DuelGhostData } from './game/duelMode';
import type { RunSwipeHighlight } from './game/shortsHighlightBuilder';
import {
  getDirectWebPlayUrl,
  getGachaSaveStarsPrice,
  getTelegramBotAppUrl,
  getTelegramStarsPriceForPack,
  hydratePurchasesFromTelegramCloud,
  isRunningInsideTelegramMiniApp,
  openTelegramDeepLinkOutsideTma,
  openTelegramStarsCheckout,
  openTelegramStarsSaveCheckout,
  syncPurchasesToTelegramCloud,
} from './game/telegramStars';
import {
  captureFaceSnapshotDataUrl,
  captureLiveGameScreenBlob,
  type LiveReelFrameState,
  type OutgoingReelCardAnim,
  type RecordedReelResult,
  ReelVideoRecorder,
} from './game/reelVideoRecorder';
import type {
  DilemmaCard,
  EndingDef,
  JobPack,
  MiniGameKind,
  PackId,
  PersistentMeta,
  PillarMeta,
  ProKnowledgeEntry,
  StatDelta,
  StatKey,
  Stats,
  TelemetryStats,
} from './types';
import { EditorialCardPortrait } from './ui/CharacterArt';
import { DecisionMiniGameModal } from './ui/DecisionMiniGames';
import {
  type CardLiveMotionState,
  InteractiveFaceStageLayer,
  ReelReadyShareModal,
  useLiveFaceTracker,
} from './ui/FaceReactionStudio';
import {
  IconArchive,
  IconDots,
  IconFrame,
  IconGrid,
  IconInfo,
  IconShare,
  IconVolume,
  PillarSvgIcon,
} from './ui/Icons';
import {
  type BeforeInstallPromptEvent,
  InstallHomeScreenModal,
  VaultAndB2bModal,
} from './ui/InstallAndB2bModals';
import {
  BlockIntermissionModal,
  EndingModal,
  GachaContinueModal,
  MetricInfoModal,
  MuseumModal,
} from './ui/Modals';
import { DuelExperienceModal } from './ui/DuelExperienceModal';
import { SceneBackdrop } from './ui/SceneBackdrop';
import { ShortsCombainModal } from './ui/ShortsCombainModal';
import { ProInsightModal } from './ui/PaywallAndSponsorModal';
import { CameraLocalNoticeModal, PrivacyZeroPiiModal } from './ui/PrivacyAndCameraNoticeModal';
import {
  ActiveSkillCheckRunner,
  HubSkillChecksTab,
  OwnerCheckTrackerModal,
} from './ui/SkillCheckExperience';
import {
  type CheckVisibilityMode,
  clearUrlCheckParams,
  createNewCheckLinkRecord,
  type DecodedCheckReceipt,
  generateCheckToken,
  parseUrlCheckRoute,
  buildCheckShareUrl,
} from './game/skillCheckSync';
import type { SkillCheckDef } from './game/skillChecksData';
import { useSheetPullToDismiss } from './ui/useNativeGestures';

const STORAGE_KEY = 'heuristics_kreslo_sim_v7';
const CAM_NOTICE_ACK_KEY = 'heuristics_kreslo_cam_ack_v1';

const DEFAULT_TELEMETRY: TelemetryStats = {
  runsStarted: 0,
  swipesTotal: 0,
  blocksCleared: 0,
  sharesClicked: 0,
  paywallShown: 0,
  sponsorStarted: 0,
  sponsorCompleted: 0,
  b2bLeadClicks: 0,
  unlockMoreClicks: 0,
  unlockMoreByPack: {},
  unlockMoreBySource: {},
  smsEventsShown: 0,
  smsEventsOpened: 0,
  packPlays: {},
};

const DEFAULT_META: PersistentMeta = {
  selectedPackId: 'office_manager',
  bestWeeksByPack: {},
  bestIqByPack: {},
  checkpointBlockByPack: {},
  unlockedBlockByPack: {},
  deathsTotal: 0,
  attemptsByPack: {},
  unlockedEndings: [],
  proUnlocked: false,
  adUnlockedPacks: [],
  sponsorViewsCount: 0,
  muted: false,
  soundProfile: 'groove',
  tiktokMode: false,
  tiktokBannerIndex: 0,
  telemetry: DEFAULT_TELEMETRY,
};

function loadMeta(): PersistentMeta {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('heuristics_kreslo_sim_v6');
    if (!raw) return DEFAULT_META;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_META,
      ...parsed,
      selectedPackId: parsed.selectedPackId ?? 'office_manager',
      soundProfile: parsed.soundProfile ?? (parsed.muted ? 'off' : 'groove'),
      adUnlockedPacks: Array.isArray(parsed.adUnlockedPacks) ? parsed.adUnlockedPacks : [],
      bestIqByPack: parsed.telemetry ? (parsed.bestIqByPack ?? {}) : {},
      checkpointBlockByPack: parsed.checkpointBlockByPack ?? {},
      unlockedBlockByPack: parsed.unlockedBlockByPack ?? {},
      telemetry: {
        ...DEFAULT_TELEMETRY,
        ...(parsed.telemetry ?? {}),
        unlockMoreByPack: parsed.telemetry?.unlockMoreByPack ?? {},
        unlockMoreBySource: parsed.telemetry?.unlockMoreBySource ?? {},
        packPlays: parsed.telemetry?.packPlays ?? {},
      },
    };
  } catch {
    return DEFAULT_META;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildFullDeck(pack: JobPack): DilemmaCard[] {
  return [...pack.deckCards, ...buildEscalationDeckForPack(pack)];
}

interface QueuedEvent {
  cardId: string;
  triggerWeek: number;
}

interface IncomingSmsBanner {
  kind: MiniGameKind;
  sender: string;
  preview: string;
  swipesLeft: number;
}

function buildIncomingSmsForKind(kind: MiniGameKind, pack: JobPack): IncomingSmsBanner {
  if (kind === 'night_chat') {
    return {
      kind,
      sender: 'Рабочий чат · 23:47',
      preview: `«Не спишь? По „${pack.shortTitle}“ вопрос до утра…»`,
      swipesLeft: 3,
    };
  }
  if (kind === 'xray_scanner') {
    return {
      kind,
      sender: 'Приёмка · Срочно',
      preview: 'Просят подписать акт не глядя. Проверим?',
      swipesLeft: 3,
    };
  }
  return {
    kind,
    sender: 'Вопрос из отдела',
    preview: 'Спорная формулировка в документе — глянешь?',
    swipesLeft: 3,
  };
}

interface ExitingCardSnapshot {
  seq: number;
  card: DilemmaCard;
  packId: PackId;
  blockNum: number;
  hideFace: boolean;
  side: 'left' | 'right';
  fromX: number;
  fromY: number;
  fromRot: number;
}

/**
 * Улетающая верхняя карточка: совершает законченный физический полёт по дуге ЗА пределы экрана
 * при полной непрозрачности (без «пропадания на полпути»), со световой печатью выбора и 3D-разворотом!
 */
function OutgoingCardGhost({
  snapshot,
  onDone,
}: {
  snapshot: ExitingCardSnapshot;
  onDone: (seq: number) => void;
}) {
  const ghostRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ghostRef.current;
    if (!el) return;

    const dirSign = snapshot.side === 'left' ? -1 : 1;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 430;
    // Гарантированный вылет целиком за границу экрана устройства (+ запас на поворот карточки)
    const exitDist = Math.max(580, Math.round(vw * 1.24));
    const targetX = dirSign * exitDist;
    const targetRot = dirSign * 25;
    const targetTiltY = dirSign * 14;
    const wasTapOrMicroFlick = Math.abs(snapshot.fromX) < 24;

    const fx0 = snapshot.fromX.toFixed(1);
    const fy0 = snapshot.fromY.toFixed(1);
    const fr0 = snapshot.fromRot.toFixed(2);
    // Карточка уменьшается и уходит за край экрана в сторону свайпа
    const offX = dirSign * Math.max(vw * 1.15, 520);
    const keyframes: Keyframe[] = [
      {
        offset: 0,
        transform: `translate3d(${fx0}px, ${fy0}px, 0) rotate(${fr0}deg) scale(1)`,
        opacity: 1,
      },
      {
        offset: 0.4,
        transform: `translate3d(${(snapshot.fromX + (offX - snapshot.fromX) * 0.38).toFixed(1)}px, 18px, 0) rotate(${(dirSign * 12).toFixed(2)}deg) scale(0.78)`,
        opacity: 1,
      },
      {
        offset: 1,
        transform: `translate3d(${offX.toFixed(1)}px, 70px, 0) rotate(${(dirSign * 24).toFixed(2)}deg) scale(0.5)`,
        opacity: 1,
      },
    ];
    void wasTapOrMicroFlick;
    void exitDist;
    void targetX;
    void targetRot;
    void targetTiltY;

    const anim = el.animate(keyframes, {
      duration: 460,
      easing: 'cubic-bezier(0.45, 0, 0.75, 0.5)',
      fill: 'forwards',
    });

    anim.onfinish = () => onDone(snapshot.seq);
    return () => {
      anim.cancel();
    };
  }, [onDone, snapshot]);

  const chosenText =
    snapshot.side === 'left' ? snapshot.card.left.label : snapshot.card.right.label;

  const ghostTierCls =
    snapshot.blockNum === 3
      ? 'card-tier-polychrome'
      : snapshot.blockNum === 2
        ? 'card-tier-foil'
        : '';

  return (
    <div
      ref={ghostRef}
      className={`dilemma-card apple-spring-card outgoing-ghost-card ${ghostTierCls} ${snapshot.card.realCase ? 'card-real-case' : ''} exit-${snapshot.side}`}
    >
      <div className="dc-portrait-area">
        {snapshot.card.videoClip ? (
          <video
            src={snapshot.card.videoClip}
            muted
            playsInline
            className="dc-video-loop"
          />
        ) : snapshot.card.photoBanner || snapshot.card.portrait ? (
          <img
            src={snapshot.card.photoBanner ?? snapshot.card.portrait}
            alt={snapshot.card.speaker}
            className="dc-main-img"
            draggable={false}
          />
        ) : (
          <EditorialCardPortrait
            packId={snapshot.packId}
            cardId={snapshot.card.id}
            speaker={snapshot.card.speaker}
            blockNum={snapshot.blockNum}
            hideFaceForCutout={snapshot.hideFace}
          />
        )}
      </div>

      <div className="dc-speaker-bar">
        <strong>{snapshot.card.speaker}</strong>
        <span>{snapshot.card.role}</span>
      </div>

      <div className="dc-question-body">
        <p>{snapshot.card.text}</p>
      </div>

      <div className="dc-inline-choices">
        <div className={`dc-inline-side left ${snapshot.side === 'left' ? 'active' : ''}`}>
          <div className="dc-inline-copy">
            <small className="dc-dir-kicker">← Влево</small>
            <strong>{getChoiceShortGist(snapshot.card.left.label)}</strong>
          </div>
        </div>
        <div className={`dc-inline-side right ${snapshot.side === 'right' ? 'active' : ''}`}>
          <div className="dc-inline-copy">
            <small className="dc-dir-kicker">Вправо →</small>
            <strong>{getChoiceShortGist(snapshot.card.right.label)}</strong>
          </div>
        </div>
      </div>

      {/* Раскрытое решение улетает вместе с карточкой — визуальная непрерывность жеста */}
      <div className={`choice-reveal ${snapshot.side} open armed`} aria-hidden="true">
        <div className="cr-inner">
          <small className="cr-kicker">
            {snapshot.side === 'left' ? '← Выбрано' : 'Выбрано →'}
          </small>
          <strong className="cr-text">{chosenText}</strong>
          <div className="cr-progress">
            <i style={{ transform: 'scaleX(1)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerSheet({
  pack,
  packEndingsOpen,
  activeSoundProfile,
  recordVoice,
  onToggleRecordVoice,
  shareRunActive,
  unlockClicks,
  masteryPct,
  inHubMode,
  onSelectSound,
  onToggleShareRun,
  onOpenTuneFace,
  onTakeScreenshot,
  onOpenStoriesStudio,
  onCopyDirectLinks,
  onOpenMuseum,
  onOpenInstall,
  onOpenVault,
  onOpenTelemetry,
  onOpenPrivacy,
  onClose,
}: {
  pack: JobPack;
  packEndingsOpen: number;
  activeSoundProfile: SoundProfile;
  recordVoice: boolean;
  onToggleRecordVoice: () => void;
  shareRunActive: boolean;
  unlockClicks: number;
  masteryPct: number | null;
  inHubMode?: boolean;
  onSelectSound: (p: SoundProfile) => void;
  onToggleShareRun: () => void;
  onOpenTuneFace?: () => void;
  onTakeScreenshot: () => void;
  onOpenStoriesStudio: () => void;
  onCopyDirectLinks: (mode: 'web' | 'tg') => void;
  onOpenMuseum: () => void;
  onOpenInstall: () => void;
  onOpenVault: () => void;
  onOpenTelemetry: () => void;
  onOpenPrivacy: () => void;
  onClose: () => void;
}) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet compact-drawer native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <div className="pw-top-row">
          <span className="eyebrow-tag">
            ПАРАМЕТРЫ{masteryPct !== null ? ` · ОПЫТ ${masteryPct}%` : ''}
          </span>
        </div>

        <div className="sound-profile-picker">
          <small>Звуковое сопровождение</small>
          <div className="spp-grid">
            {(
              [
                ['groove', 'Грув + Штампы'],
                ['asmr', 'Только ASMR'],
                ['classic', 'Мягкий эмбиент'],
                ['off', 'Без звука'],
              ] as [SoundProfile, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={activeSoundProfile === key ? 'on' : ''}
                onClick={() => onSelectSound(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="ios-grouped-row clickable drawer-voice-row"
          role="switch"
          aria-checked={recordVoice}
          tabIndex={0}
          onClick={onToggleRecordVoice}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onToggleRecordVoice();
            }
          }}
        >
          <div className="igr-labels">
            <strong>Записывать голос в видео</strong>
            <span>Ваши комментарии попадут в ролик прохождения</span>
          </div>
          <span className={`ios-toggle-pill ${recordVoice ? 'on' : ''}`} aria-hidden="true">
            <span className="ios-toggle-knob" />
          </span>
        </div>

        <div className="drawer-actions-list">
          {!inHubMode && (
            <>
              <button
                type="button"
                className="drawer-row-btn"
                onClick={() => {
                  onClose();
                  onToggleShareRun();
                }}
              >
                <IconFrame size={18} />
                <div>
                  <strong>
                    {shareRunActive
                      ? 'Выключить камеру и запись'
                      : 'Включить живое лицо и запись видео'}
                  </strong>
                  <small>
                    Запись стартует автоматически, как только нейросеть захватит лицо
                  </small>
                </div>
              </button>

              {shareRunActive && onOpenTuneFace && (
                <button
                  type="button"
                  className="drawer-row-btn"
                  onClick={() => {
                    onClose();
                    onOpenTuneFace();
                  }}
                >
                  <IconFrame size={18} />
                  <div>
                    <strong>Настроить размер и положение лица</strong>
                    <small>Примагнитить к герою или оставить свободно внизу экрана</small>
                  </div>
                </button>
              )}

              <button
                type="button"
                className="drawer-row-btn"
                onClick={() => {
                  onClose();
                  onTakeScreenshot();
                }}
              >
                <IconFrame size={18} />
                <div>
                  <strong>Сделать скрин смены</strong>
                  <small>Сохранить чистый кадр в Фото или буфер обмена</small>
                </div>
              </button>

              <button
                type="button"
                className="drawer-row-btn"
                onClick={() => {
                  onClose();
                  onOpenMuseum();
                }}
              >
                <IconArchive size={18} />
                <div>
                  <strong>
                    Открытые исходы ({packEndingsOpen}/{pack.endings.length})
                  </strong>
                  <small>Коллекция концовок по курсу «{pack.shortTitle}»</small>
                </div>
              </button>
            </>
          )}

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onOpenVault();
            }}
          >
            <IconArchive size={18} />
            <div>
              <strong>Рабочие чек-листы и памятки</strong>
              <small>4 прикладных конспекта по профессиям</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onOpenInstall();
            }}
          >
            <IconVolume muted={false} size={18} />
            <div>
              <strong>Добавить на экран «Домой»</strong>
              <small>Полноэкранный режим iOS / Android без рамок браузера</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onOpenTelemetry();
            }}
          >
            <IconInfo size={18} />
            <div>
              <strong>Статистика и интерес ({unlockClicks})</strong>
              <small>Обезличенная сводка сервера и локальные показатели</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onOpenStoriesStudio();
            }}
          >
            <IconShare size={18} />
            <div>
              <strong>Поделиться видео</strong>
              <small>Прохождение с лицом, вставка из истории, обрезка и гифки</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onCopyDirectLinks('web');
            }}
          >
            <IconShare size={18} />
            <div>
              <strong>Прямая Web-ссылка на «{pack.shortTitle}»</strong>
              <small>Открывает сразу 1-ю карточку этой колоды без главного меню</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onCopyDirectLinks('tg');
            }}
          >
            <IconShare size={18} />
            <div>
              <strong>Прямая Telegram-ссылка на «{pack.shortTitle}»</strong>
              <small>Запуск этой колоды напрямую через @vkreslegame</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              window.open('./wiki.html', '_blank', 'noopener,noreferrer');
            }}
          >
            <IconArchive size={18} />
            <div>
              <strong>Кодекс весов, ссылок и прецедентов</strong>
              <small>Все прямые ссылки на 9 игр, веса карточек и 36 реальных кейсов</small>
            </div>
          </button>

          <button
            type="button"
            className="drawer-row-btn"
            onClick={() => {
              onClose();
              onOpenPrivacy();
            }}
          >
            <IconInfo size={18} />
            <div>
              <strong>Конфиденциальность · 0% ПДн</strong>
              <small>Локальная камера на устройстве, без cookies и сбора биометрии</small>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const initialDirectPackId = useMemo(() => parseDirectPlayPackFromWindow(), []);
  const initialUrlRoute = useMemo(() => parseUrlCheckRoute(), []);

  const [meta, setMeta] = useState<PersistentMeta>(() => {
    const loaded = loadMeta();
    if (initialDirectPackId) {
      return {
        ...loaded,
        selectedPackId: initialDirectPackId,
        telemetry: {
          ...loaded.telemetry,
          runsStarted: (loaded.telemetry.runsStarted ?? 0) + 1,
          packPlays: {
            ...(loaded.telemetry.packPlays ?? {}),
            [initialDirectPackId]: ((loaded.telemetry.packPlays ?? {})[initialDirectPackId] ?? 0) + 1,
          },
        },
      };
    }
    return loaded;
  });
  const pack: JobPack = useMemo(() => getJobPack(meta.selectedPackId), [meta.selectedPackId]);

  const [inHub, setInHub] = useState(() => !initialDirectPackId);
  const [hasActiveRun, setHasActiveRun] = useState(() => Boolean(initialDirectPackId));
  const [hubTab, setHubTab] = useState<'jobs' | 'checks' | 'minigames'>(() =>
    initialUrlRoute && (initialUrlRoute.isOwner || initialUrlRoute.directReceipt) ? 'checks' : 'jobs'
  );
  const [jobFilter, setJobFilter] = useState<
    'all' | 'practice' | 'story' | 'tech' | 'commerce'
  >('all');
  const [hoveredHubPackId, setHoveredHubPackId] = useState<PackId | null>(null);
  const [checksRefreshSeq, setChecksRefreshSeq] = useState(0);
  const [activeCheckRun, setActiveCheckRun] = useState<{
    check: SkillCheckDef;
    token: string;
    mode: CheckVisibilityMode;
    isSelfPractice: boolean;
  } | null>(() => {
    if (initialUrlRoute && !initialUrlRoute.isOwner && !initialUrlRoute.directReceipt) {
      return {
        check: initialUrlRoute.check,
        token: initialUrlRoute.token,
        mode: initialUrlRoute.mode,
        isSelfPractice: false,
      };
    }
    return null;
  });
  const [ownerTrackerModal, setOwnerTrackerModal] = useState<{
    check: SkillCheckDef;
    token: string;
    directReceipt?: DecodedCheckReceipt;
  } | null>(() => {
    if (initialUrlRoute && (initialUrlRoute.isOwner || initialUrlRoute.directReceipt)) {
      return {
        check: initialUrlRoute.check,
        token: initialUrlRoute.token,
        directReceipt: initialUrlRoute.directReceipt,
      };
    }
    return null;
  });
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

  const [week, setWeek] = useState(1);
  const [stats, setStats] = useState<Stats>({ s1: 50, s2: 50, s3: 50, s4: 50 });
  const [poppingDeltas, setPoppingDeltas] = useState<{ seq: number; deltas: StatDelta }>({
    seq: 0,
    deltas: {},
  });

  const [lifelineCharges, setLifelineCharges] = useState(1);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [incomingSms, setIncomingSms] = useState<IncomingSmsBanner | null>(null);

  // ───────── МАГНИТНОЕ ЛИЦО, ПЛАШКА НАСТРОЙКИ И ЗАПИСЬ С МОМЕНТА ЗАХВАТА ЛИЦА ─────────
  const [shareRunActive, setShareRunActive] = useState(false);
  const [pendingRecordOnFaceLock, setPendingRecordOnFaceLock] = useState(false);
  const [isFaceMagnetized, setIsFaceMagnetized] = useState(true);
  const [freeFacePos, setFreeFacePos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.82 });
  const [faceScale, setFaceScale] = useState(1.0);
  const [faceTuneHudOpen, setFaceTuneHudOpen] = useState(false);
  const [camNoticeOpen, setCamNoticeOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);

  const [reactionMood, setReactionMood] = useState<{
    tone: 'idle' | 'good' | 'warn';
    label: string;
  }>({ tone: 'idle', label: 'НА СМЕНЕ' });

  const [isRecordingReel, setIsRecordingReel] = useState(false);
  const [isFinalizingReel, setIsFinalizingReel] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recordedReel, setRecordedReel] = useState<RecordedReelResult | null>(null);
  const [reelShareModalOpen, setReelShareModalOpen] = useState(false);
  const [faceSnapshotUrl, setFaceSnapshotUrl] = useState<string | null>(null);

  const quickSelfieInputRef = useRef<HTMLInputElement | null>(null);
  const stageElRef = useRef<HTMLElement | null>(null);
  const portraitAreaRef = useRef<HTMLDivElement | null>(null);
  const activeCardElRef = useRef<HTMLDivElement | null>(null);
  const back1ElRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<ReelVideoRecorder | null>(null);

  // Флаг занятости пальца настройкой лица — гарантирует 0% дёргания карточки!
  const faceBusyRef = useRef(false);
  const cardMotionRef = useRef<CardLiveMotionState>({ dx: 0, dy: 0, rotDeg: 0 });

  const {
    cutoutCanvas: trackedCutoutCanvas,
    rawVideoEl,
    pose: trackedPose,
    faceLocked,
  } = useLiveFaceTracker(shareRunActive, webcamStream, customPhotoUrl);

  const [iqHits, setIqHits] = useState(0);
  const [iqTotal, setIqTotal] = useState(0);
  const [lastInsight, setLastInsight] = useState<{
    entry: ProKnowledgeEntry;
    wasSmart: boolean;
  } | null>(null);
  const [insightModalOpen, setInsightModalOpen] = useState(false);

  const [intermission, setIntermission] = useState<{
    clearedBlock: BlockMetaInfo;
    nextBlock: BlockMetaInfo;
  } | null>(null);

  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [vaultModalTab, setVaultModalTab] = useState<'vault' | 'b2b' | 'telemetry' | null>(null);

  const [cardSeq, setCardSeq] = useState(1);
  const [currentCard, setCurrentCard] = useState<DilemmaCard>(() =>
    prepareBalancedCard(pack.onboardingCards[0])
  );
  const [nextCard, setNextCard] = useState<DilemmaCard>(() =>
    prepareBalancedCard(pack.onboardingCards[1] ?? pack.deckCards[0])
  );
  const [exitingCards, setExitingCards] = useState<ExitingCardSnapshot[]>([]);

  const [flags, setFlags] = useState<Set<string>>(() => new Set());
  const [usedOnce, setUsedOnce] = useState<Set<string>>(() =>
    pack.onboardingCards[0] ? new Set([pack.onboardingCards[0].id]) : new Set()
  );
  const [scheduled, setScheduled] = useState<QueuedEvent[]>([]);
  const bagRef = useRef<DilemmaCard[]>(
    shuffle(buildFullDeck(pack)).filter(
      (c) => c.id !== pack.onboardingCards[0]?.id && c.id !== pack.onboardingCards[1]?.id
    )
  );

  const [inspectedPillar, setInspectedPillar] = useState<PillarMeta | null>(null);
  const [lifelineInfoOpen, setLifelineInfoOpen] = useState(false);
  const [activeMiniGame, setActiveMiniGame] = useState<{
    kind: MiniGameKind;
    standalone: boolean;
  } | null>(null);
  const [activeEnding, setActiveEnding] = useState<{ def: EndingDef; isNew: boolean } | null>(null);
  const [endlessMode, setEndlessMode] = useState(false);
  const [museumOpen, setMuseumOpen] = useState(false);

  // v39: Шортс-комбайн, Блиц-дуэль и Гача-спасение за Stars
  const [runSwipeHighlights, setRunSwipeHighlights] = useState<RunSwipeHighlight[]>([]);
  const [shortsCombainOpen, setShortsCombainOpen] = useState(false);
  const [duelModalState, setDuelModalState] = useState<{
    open: boolean;
    ghost: DuelGhostData | null;
  }>(() => {
    const g = parseDuelRouteFromWindow();
    return g ? { open: true, ghost: g } : { open: false, ghost: null };
  });
  const [savesUsedInRun, setSavesUsedInRun] = useState(0);
  const [pendingGachaCrash, setPendingGachaCrash] = useState<{
    endDef: EndingDef;
    isNew: boolean;
    crashedStatLabel: string;
    nextWeek: number;
    nextFlags: Set<string>;
    nextUsed: Set<string>;
    nextQ: QueuedEvent[];
  } | null>(null);

  // Квантованный стейт предпросмотра для шкал и шторки (обновляется только при смене шага, без 120fps нагрузки на React!)
  const [swipePreview, setSwipePreview] = useState<{
    side: 'left' | 'right' | null;
    pullRatio: number;
  }>({ side: null, pullRatio: 0 });
  const lastPreviewStepRef = useRef<string>('none:0');

  // Раскрытие полного текста решения: зажатием (peek) или тапом (pin → второй тап выбирает)
  const [heldSide, setHeldSide] = useState<'left' | 'right' | null>(null);
  const [pinnedSide, setPinnedSide] = useState<'left' | 'right' | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const lastRevealSideRef = useRef<'left' | 'right'>('left');

  // Компактная полоска показателей: раскрывается только по тапу
  const [statsExpanded, setStatsExpanded] = useState(false);

  // Фраза-итог между карточками
  const [quip, setQuip] = useState<(OutcomeQuip & { seq: number }) | null>(null);
  const [quipLeaving, setQuipLeaving] = useState(false);
  const quipTimersRef = useRef<number[]>([]);
  const recentQuipIdsRef = useRef<string[]>([]);
  const quipShownLastTurnRef = useRef(false);

  // Журнал решений для разбора на экране итогов (вместо «НОРМА / ЛОВУШКА» посреди игры)
  const [decisionLog, setDecisionLog] = useState<
    { id: string; title: string; fact: string; wasSmart: boolean }[]
  >([]);

  const stageDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastT: number;
    vx: number;
    dx: number;
    dy: number;
    rot: number;
    inlineBtnSide: 'left' | 'right' | null;
    onReveal: boolean;
    movedMax: number;
    captured: boolean;
    grabPlayed: boolean;
    lockedSide: 'left' | 'right' | null;
  } | null>(null);
  const lastInlineCommitMsRef = useRef(0);
  const tiltZoneRef = useRef<'left' | 'none' | 'right'>('none');
  const outgoingReelAnimRef = useRef<OutgoingReelCardAnim | null>(null);

  // Экранный жест «Свайп от края экрана» (Назад в каталог / Вперёд к смене)
  const edgeSwipeRef = useRef<{
    side: 'left_edge' | 'right_edge';
    startX: number;
    startY: number;
  } | null>(null);

  const curBlock = getBlockForWeek(week);
  const computedMasteryPct = iqTotal > 0 ? Math.round((iqHits / iqTotal) * 100) : 80;

  const anyStatDanger =
    stats.s1 <= 20 ||
    stats.s1 >= 84 ||
    stats.s2 <= 20 ||
    stats.s2 >= 84 ||
    stats.s3 <= 20 ||
    stats.s3 >= 84 ||
    stats.s4 <= 20 ||
    stats.s4 >= 84;

  useEffect(() => {
    setGameMusicContext(pack.category, curBlock.blockNum, anyStatDanger);
  }, [anyStatDanger, curBlock.blockNum, pack.category]);

  const effectiveAtmospherePackId = useMemo<PackId>(() => {
    if (duelModalState.open) {
      return duelModalState.ghost?.packId ?? pack.id;
    }
    if (!inHub) {
      return pack.id;
    }
    if (hoveredHubPackId) {
      return hoveredHubPackId;
    }
    if (hubTab === 'jobs') {
      if (jobFilter === 'story') return 'pvz_december';
      if (jobFilter === 'tech') return 'it_product';
      if (jobFilter === 'commerce') return 'barista_pro';
      if (jobFilter === 'practice') return 'office_manager';
    }
    return pack.id;
  }, [
    duelModalState.ghost?.packId,
    duelModalState.open,
    hoveredHubPackId,
    hubTab,
    inHub,
    jobFilter,
    pack.id,
  ]);

  useLayoutEffect(() => {
    applyAtmosphereToDocument(
      effectiveAtmospherePackId,
      inHub ? 1 : curBlock.blockNum,
      !inHub && anyStatDanger
    );
  }, [anyStatDanger, curBlock.blockNum, effectiveAtmospherePackId, inHub]);

  useEffect(() => {
    if (poppingDeltas.seq === 0) return;
    const t = window.setTimeout(() => {
      setPoppingDeltas((prev) => ({ ...prev, deltas: {} }));
    }, 850);
    return () => window.clearTimeout(t);
  }, [poppingDeltas.seq]);

  const liveReelStateRef = useRef<LiveReelFrameState>({
    pack,
    week,
    blockRoman: curBlock.roman,
    stats,
    speaker: currentCard.speaker,
    role: currentCard.role,
    cardText: currentCard.text,
    leftLabel: currentCard.left.label,
    rightLabel: currentCard.right.label,
    dragX: 0,
    flyDir: null,
    masteryPct: computedMasteryPct,
    reactionStatus: { text: reactionMood.label, tone: reactionMood.tone },
    placement: isFaceMagnetized ? 'card_head' : 'circle_bottom',
    magnetized: isFaceMagnetized,
    freeXNorm: freeFacePos.x,
    freeYNorm: freeFacePos.y,
    faceScale,
    ending: activeEnding?.def ?? null,
    faceSource: null,
    isMirroredVideo: false,
  });

  liveReelStateRef.current = {
    pack,
    week,
    blockRoman: curBlock.roman,
    stats,
    speaker: currentCard.speaker,
    role: currentCard.role,
    cardText: currentCard.text,
    leftLabel: currentCard.left.label,
    rightLabel: currentCard.right.label,
    dragX: cardMotionRef.current.dx,
    flyDir: exitingCards.length > 0 ? exitingCards[exitingCards.length - 1].side : null,
    outgoingCard: outgoingReelAnimRef.current,
    masteryPct: computedMasteryPct,
    reactionStatus: { text: reactionMood.label, tone: reactionMood.tone },
    placement: isFaceMagnetized ? 'card_head' : 'circle_bottom',
    magnetized: isFaceMagnetized,
    freeXNorm: freeFacePos.x,
    freeYNorm: freeFacePos.y,
    faceScale,
    ending: activeEnding?.def ?? null,
    faceSource: trackedCutoutCanvas ?? rawVideoEl,
    trackedCutoutCanvas,
    isMirroredVideo: false,
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch {
      // ignore
    }
  }, [meta]);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    return () => {
      webcamStream?.getTracks().forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
    };
  }, [micStream, webcamStream]);

  useEffect(() => {
    if (!isRecordingReel) return;
    const t = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [isRecordingReel]);

  useEffect(() => {
    return initSound(meta.soundProfile ?? 'groove');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSoundProfile(meta.soundProfile ?? 'groove');
  }, [meta.soundProfile]);

  // Гидратация покупок из облака Telegram (работает между телефоном, планшетом и ноутбуком)
  useEffect(() => {
    void hydratePurchasesFromTelegramCloud().then((cloud) => {
      if (!cloud) return;
      setMeta((m) => {
        const mergedUnlocked: Record<string, 1 | 2 | 3> = { ...(m.unlockedBlockByPack ?? {}) };
        const mergedCkpt: Record<string, 1 | 2 | 3> = { ...m.checkpointBlockByPack };
        for (const [k, v] of Object.entries(cloud.u ?? {})) {
          mergedUnlocked[k] = Math.max(mergedUnlocked[k] ?? 1, v) as 1 | 2 | 3;
        }
        for (const [k, v] of Object.entries(cloud.c ?? {})) {
          mergedCkpt[k] = Math.max(mergedCkpt[k] ?? 1, v) as 1 | 2 | 3;
        }
        return {
          ...m,
          unlockedBlockByPack: mergedUnlocked,
          checkpointBlockByPack: mergedCkpt,
        };
      });
    });
  }, []);

  const getUnlockedBlockForPack = useCallback(
    (m: PersistentMeta, targetPackId: PackId): 1 | 2 | 3 => {
      if (m.proUnlocked || m.adUnlockedPacks.includes(targetPackId)) return 3;
      return m.unlockedBlockByPack?.[targetPackId] ?? 1;
    },
    []
  );

  const unlockNextBlockForPack = useCallback(
    (
      targetPackId: PackId,
      targetBlock: 2 | 3,
      source: 'intermission' | 'ending' | 'hub' | 'vault'
    ) => {
      sendAnonymousPulse('unlock_more', targetPackId, source);
      setMeta((m) => {
        const prevUnlocked = m.unlockedBlockByPack?.[targetPackId] ?? 1;
        const nextUnlocked = Math.max(prevUnlocked, targetBlock) as 1 | 2 | 3;
        const prevCkpt = m.checkpointBlockByPack[targetPackId] ?? 1;
        const nextUnlockedMap: Record<string, 1 | 2 | 3> = {
          ...(m.unlockedBlockByPack ?? {}),
          [targetPackId]: nextUnlocked,
        };
        const nextCkptMap: Record<string, 1 | 2 | 3> = {
          ...m.checkpointBlockByPack,
          [targetPackId]: Math.max(prevCkpt, nextUnlocked) as 1 | 2 | 3,
        };
        syncPurchasesToTelegramCloud(nextUnlockedMap, nextCkptMap);
        return {
          ...m,
          unlockedBlockByPack: nextUnlockedMap,
          checkpointBlockByPack: nextCkptMap,
          telemetry: {
            ...m.telemetry,
            unlockMoreClicks: (m.telemetry.unlockMoreClicks ?? 0) + 1,
            unlockMoreByPack: {
              ...(m.telemetry.unlockMoreByPack ?? {}),
              [targetPackId]: ((m.telemetry.unlockMoreByPack ?? {})[targetPackId] ?? 0) + 1,
            },
            unlockMoreBySource: {
              ...(m.telemetry.unlockMoreBySource ?? {}),
              [source]: ((m.telemetry.unlockMoreBySource ?? {})[source] ?? 0) + 1,
            },
          },
        };
      });
      setToastMsg(targetBlock === 3 ? 'Блок 3 открыт' : 'Блок 2 открыт');
      window.setTimeout(() => setToastMsg(null), 2600);
    },
    []
  );

  const handlePurchaseOrUnlockBlock = useCallback(
    async (
      targetPackId: PackId,
      targetBlock: 2 | 3,
      source: 'intermission' | 'ending' | 'hub' | 'vault',
      onAfterUnlock?: () => void
    ) => {
      const res = await openTelegramStarsCheckout(targetBlock, targetPackId);
      if (res === 'cancelled') return;
      if (res === 'unavailable') {
        setToastMsg('Оплата Stars открывается в Telegram (@vkreslegame)');
        window.setTimeout(() => setToastMsg(null), 2800);
        openTelegramDeepLinkOutsideTma(`pack_${targetPackId}`);
        return;
      }
      if (res === 'failed') {
        setToastMsg('Оплата не завершена — попробуйте ещё раз');
        window.setTimeout(() => setToastMsg(null), 2600);
        return;
      }
      sfxVictory();
      vibrate([14, 30, 20]);
      unlockNextBlockForPack(targetPackId, targetBlock, source);
      if (source === 'intermission') {
        setIntermission(null);
      }
      onAfterUnlock?.();
    },
    [unlockNextBlockForPack]
  );

  const recordUnlockMoreAndOpen = useCallback(
    (
      targetPackId: PackId,
      source: 'intermission' | 'ending' | 'hub' | 'vault',
      unlockVaultToo = false
    ) => {
      sendAnonymousPulse('unlock_more', targetPackId, source);
      setMeta((m) => ({
        ...m,
        proUnlocked: unlockVaultToo ? true : m.proUnlocked,
        adUnlockedPacks: m.adUnlockedPacks.includes(targetPackId)
          ? m.adUnlockedPacks
          : [...m.adUnlockedPacks, targetPackId],
        telemetry: {
          ...m.telemetry,
          unlockMoreClicks: (m.telemetry.unlockMoreClicks ?? 0) + 1,
          unlockMoreByPack: {
            ...(m.telemetry.unlockMoreByPack ?? {}),
            [targetPackId]: ((m.telemetry.unlockMoreByPack ?? {})[targetPackId] ?? 0) + 1,
          },
          unlockMoreBySource: {
            ...(m.telemetry.unlockMoreBySource ?? {}),
            [source]: ((m.telemetry.unlockMoreBySource ?? {})[source] ?? 0) + 1,
          },
        },
      }));
    },
    []
  );

  const requestLiveCamera = useCallback(async (withMic = false): Promise<{
    vStream: MediaStream | null;
    aStream: MediaStream | null;
  }> => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setToastMsg('По HTTP камера скрыта iOS — выберите селфи или откройте HTTPS');
      window.setTimeout(() => setToastMsg(null), 3200);
      return { vStream: null, aStream: null };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return { vStream: null, aStream: null };
    }

    let vStream: MediaStream | null = null;
    try {
      vStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
    } catch {
      try {
        vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        setToastMsg('Разрешите доступ к камере или нажмите на лицо для выбора селфи');
        window.setTimeout(() => setToastMsg(null), 3200);
        return { vStream: null, aStream: null };
      }
    }

    let aStream: MediaStream | null = null;
    if (withMic) {
      try {
        aStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        aStream = null;
      }
    }

    setWebcamStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return vStream;
    });
    setMicStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return aStream;
    });
    return { vStream, aStream };
  }, []);

  const takeLiveScreenshot = useCallback(async () => {
    const blob = await captureLiveGameScreenBlob(liveReelStateRef.current);
    if (!blob) return;
    const fileName = `kreslo-${pack.id}-smena${week}.png`;
    const file = new File([blob], fileName, { type: 'image/png', lastModified: Date.now() });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({ files: [file] });
        sfxVictory();
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('abort') || msg.includes('cancel')) return;
      }
    }

    sfxVictory();
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
    } catch {
      // ignore
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setToastMsg('Скрин сохранён и скопирован в буфер');
    window.setTimeout(() => setToastMsg(null), 2600);
  }, [pack.id, week]);

  const startReelRecordingNow = useCallback(
    (activeMic: MediaStream | null) => {
      if (isRecordingReel) return;
      if (recordedReel?.url) {
        URL.revokeObjectURL(recordedReel.url);
      }

      const hasMic = Boolean(activeMic && activeMic.getAudioTracks().length > 0);
      setMicRecordingDuck(hasMic);
      const mixedAudio = buildMixedRecordingStream(activeMic);

      const rec = new ReelVideoRecorder(() => liveReelStateRef.current);
      const ok = rec.start(mixedAudio);
      if (ok) {
        recorderRef.current = rec;
        setRecSeconds(0);
        setIsRecordingReel(true);
        sfxCoffeeSave();
      }
    },
    [isRecordingReel, recordedReel?.url]
  );

  // Запись видео стартует ТОЛЬКО с кадра, когда нейросеть устойчиво подхватила лицо!
  useEffect(() => {
    if (pendingRecordOnFaceLock && faceLocked && !isRecordingReel) {
      setPendingRecordOnFaceLock(false);
      startReelRecordingNow(micStream);
    }
  }, [faceLocked, isRecordingReel, micStream, pendingRecordOnFaceLock, startReelRecordingNow]);

  const stopReelRecording = useCallback(async (openPreview = true) => {
    setPendingRecordOnFaceLock(false);
    setMicRecordingDuck(false);
    const rec = recorderRef.current;
    if (!rec) {
      setIsFinalizingReel(false);
      return null;
    }
    recorderRef.current = null;
    setIsRecordingReel(false);
    setIsFinalizingReel(true);
    try {
      const result = await rec.stop();
      if (result) {
        setRecordedReel(result);
        if (openPreview) {
          setShortsCombainOpen(true);
        }
      }
      return result;
    } finally {
      setIsFinalizingReel(false);
    }
  }, []);

  const launchCameraSessionAfterConsent = useCallback(
    async (withMic: boolean) => {
      setIsFaceMagnetized(true);
      setFaceScale(1.0);
      setShareRunActive(true);
      setFaceTuneHudOpen(true);
      setPendingRecordOnFaceLock(true);
      sendAnonymousPulse('camera_on', pack.id);

      if (!webcamStream) {
        const { vStream } = await requestLiveCamera(withMic);
        if (!vStream && !customPhotoUrl) {
          quickSelfieInputRef.current?.click();
        }
      }
    },
    [customPhotoUrl, pack.id, requestLiveCamera, webcamStream]
  );

  const activateSharePlaythroughMode = useCallback(async () => {
    let acked = false;
    try {
      acked = localStorage.getItem(CAM_NOTICE_ACK_KEY) === '1';
    } catch {
      acked = false;
    }
    if (!acked && !webcamStream) {
      setCamNoticeOpen(true);
      return;
    }
    await launchCameraSessionAfterConsent(meta.recordVoice ?? true);
  }, [launchCameraSessionAfterConsent, meta.recordVoice, webcamStream]);

  const exitSharePlaythroughMode = useCallback(() => {
    setPendingRecordOnFaceLock(false);
    setFaceTuneHudOpen(false);
    if (recorderRef.current) {
      void stopReelRecording(false);
    }
    webcamStream?.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    setWebcamStream(null);
    setMicStream(null);
    setShareRunActive(false);
  }, [micStream, stopReelRecording, webcamStream]);

  const drawNextForPack = useCallback(
    (
      activePack: JobPack,
      nextWeek: number,
      nextUsed: Set<string>,
      nextQueue: QueuedEvent[],
      isEndless: boolean
    ): { card: DilemmaCard; remQueue: QueuedEvent[] } => {
      const targetBlock = getBlockForWeek(nextWeek).blockNum;
      const midKeys = Object.keys(activePack.specialCards).filter((k) => k.includes('_10'));
      const b2Keys = Object.keys(activePack.specialCards).filter((k) => k.includes('_24'));
      const finKeys = Object.keys(activePack.specialCards).filter((k) => k.includes('_20'));

      if (nextWeek === 12 && midKeys[0]) {
        return {
          card: prepareBalancedCard(activePack.specialCards[midKeys[0]]),
          remQueue: nextQueue,
        };
      }
      if (nextWeek === 24 && !isEndless) {
        const boss24 = b2Keys[0] ? activePack.specialCards[b2Keys[0]] : buildBlock2BossCard(activePack);
        return { card: prepareBalancedCard(boss24), remQueue: nextQueue };
      }
      if (nextWeek === CAMPAIGN_TOTAL_SHIFTS && !isEndless && finKeys[0]) {
        return {
          card: prepareBalancedCard(activePack.specialCards[finKeys[0]]),
          remQueue: nextQueue,
        };
      }

      const qIdx = nextQueue.findIndex((q) => q.triggerWeek <= nextWeek);
      if (qIdx !== -1) {
        const item = nextQueue[qIdx];
        const copy = [...nextQueue];
        copy.splice(qIdx, 1);
        const sp = activePack.specialCards[item.cardId];
        if (sp) return { card: prepareBalancedCard(sp), remQueue: copy };
      }

      const eligibleFilter = (c: DilemmaCard) =>
        (c.blockMin ?? 1) <= targetBlock && !(c.oncePerRun && nextUsed.has(c.id));

      let candidates = bagRef.current.filter(eligibleFilter);
      const freshBlockCards = candidates.filter((c) => (c.blockMin ?? 1) === targetBlock);
      if (freshBlockCards.length > 0 && Math.random() < 0.65) {
        candidates = freshBlockCards;
      }

      if (candidates.length === 0) {
        bagRef.current = shuffle(buildFullDeck(activePack));
        candidates = bagRef.current.filter(eligibleFilter);
        if (candidates.length === 0) {
          candidates = bagRef.current.filter((c) => (c.blockMin ?? 1) <= targetBlock);
        }
      }

      const picked = candidates[0] ?? activePack.deckCards[0];
      bagRef.current = bagRef.current.filter((c) => c.id !== picked.id);
      return { card: prepareBalancedCard(picked), remQueue: nextQueue };
    },
    []
  );

  const resetCardDomTransformImmediate = useCallback(() => {
    cardMotionRef.current = { dx: 0, dy: 0, rotDeg: 0 };
    liveReelStateRef.current.dragX = 0;
    if (activeCardElRef.current) {
      activeCardElRef.current.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)';
    }
    if (back1ElRef.current) {
      back1ElRef.current.style.transform = 'translate3d(0px, 10px, 0px) scale(0.955)';
      back1ElRef.current.style.opacity = '1';
    }
    lastPreviewStepRef.current = 'none:0';
    setSwipePreview({ side: null, pullRatio: 0 });
  }, []);

  const startPackRun = useCallback(
    (targetPackId: PackId, startBlock: 1 | 2 | 3 = 1, bumpAttempt = false) => {
      const p = getJobPack(targetPackId);
      const prevAttempts = meta.attemptsByPack[p.id] ?? 1;
      const nextAttempt = bumpAttempt ? prevAttempts + 1 : prevAttempts;
      const initialWeek = startBlock === 1 ? 1 : startBlock === 2 ? 13 : 25;

      sendAnonymousPulse('run_start', p.id);
      setMeta((m) => ({
        ...m,
        selectedPackId: p.id,
        attemptsByPack: { ...m.attemptsByPack, [p.id]: nextAttempt },
        telemetry: {
          ...m.telemetry,
          runsStarted: (m.telemetry.runsStarted ?? 0) + 1,
          packPlays: {
            ...m.telemetry.packPlays,
            [p.id]: (m.telemetry.packPlays?.[p.id] ?? 0) + 1,
          },
        },
      }));

      bagRef.current = shuffle(buildFullDeck(p));
      setWeek(initialWeek);
      setStats({ s1: 50, s2: 50, s3: 50, s4: 50 });
      setPoppingDeltas({ seq: 0, deltas: {} });
      setLifelineCharges(startBlock > 1 ? 2 : 1);
      setToastMsg(null);
      setIncomingSms(null);
      setReactionMood({ tone: 'idle', label: 'НА СМЕНЕ' });
      setFaceSnapshotUrl(null);
      setReelShareModalOpen(false);
      setIsFinalizingReel(false);
      setRecordedReel((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
      if (shareRunActive && !recorderRef.current) {
        setPendingRecordOnFaceLock(true);
      }
      setIqHits(0);
      setIqTotal(0);
      setLastInsight(null);
      setDecisionLog([]);
      setPinnedSide(null);
      setHeldSide(null);
      setStatsExpanded(false);
      quipTimersRef.current.forEach((t) => window.clearTimeout(t));
      quipTimersRef.current = [];
      setQuip(null);
      setQuipLeaving(false);
      quipShownLastTurnRef.current = false;
      setInsightModalOpen(false);
      setIntermission(null);
      setFlags(new Set());
      setUsedOnce(new Set());
      setActiveEnding(null);
      setActiveMiniGame(null);
      setEndlessMode(false);
      setMenuDrawerOpen(false);
      setExitingCards([]);
      setRunSwipeHighlights([]);
      setShortsCombainOpen(false);
      setSavesUsedInRun(0);
      setPendingGachaCrash(null);
      resetCardDomTransformImmediate();

      let firstCard: DilemmaCard;
      if (startBlock === 1 && nextAttempt === 1 && p.onboardingCards[0]) {
        firstCard = prepareBalancedCard(p.onboardingCards[0]);
      } else {
        firstCard = drawNextForPack(p, initialWeek, new Set(), [], false).card;
      }
      const usedForSecond = new Set<string>([firstCard.id]);
      const { card: secondCard, remQueue: qAfterSecond } = drawNextForPack(
        p,
        initialWeek + 1,
        usedForSecond,
        [],
        false
      );
      setScheduled(qAfterSecond);
      setCurrentCard(firstCard);
      setNextCard(secondCard);
      setCardSeq((s) => s + 1);

      setHasActiveRun(true);
      setInHub(false);
      sfxCardFlip();
    },
    [drawNextForPack, meta.attemptsByPack, resetCardDomTransformImmediate, shareRunActive]
  );

  const removeExitingGhost = useCallback((doneSeq: number) => {
    setExitingCards((prev) => prev.filter((item) => item.seq !== doneSeq));
  }, []);

  const commitChoice = useCallback(
    (
      side: 'left' | 'right',
      releaseOrigin?: { fromX: number; fromY: number; fromRot: number }
    ) => {
      if (activeEnding || activeMiniGame || intermission) return;
      const opt = side === 'left' ? currentCard.left : currentCard.right;
      const activeBlock = getBlockForWeek(week);
      const mult = activeBlock.riskMultiplier;

      sfxSwipeCommit(side);
      hapticSwipeCommit(Boolean(currentCard.realCase));
      if (opt.voiceClip) playVoice(opt.voiceClip);

      // Фиксируем улетающую карточку и для GPU-слоя экрана, и для 9:16 видеозаписи!
      const fromX = releaseOrigin?.fromX ?? 0;
      const snap: ExitingCardSnapshot = {
        seq: cardSeq,
        card: currentCard,
        packId: pack.id,
        blockNum: activeBlock.blockNum,
        hideFace: shareRunActive && isFaceMagnetized,
        side,
        fromX,
        fromY: releaseOrigin?.fromY ?? 0,
        fromRot: releaseOrigin?.fromRot ?? 0,
      };
      outgoingReelAnimRef.current = {
        speaker: currentCard.speaker,
        role: currentCard.role,
        cardText: currentCard.text,
        leftLabel: currentCard.left.label,
        rightLabel: currentCard.right.label,
        side,
        fromX,
        startedAtMs: performance.now(),
        durationMs: Math.abs(fromX) < 24 ? 540 : 480,
      };
      setExitingCards((prev) => [...prev.slice(-1), snap]);
      resetCardDomTransformImmediate();

      const cardInsight = alignInsightWithCard(
        currentCard.id,
        getProInsightForCard(currentCard.id)
      );
      const nextIqHits = iqHits + (cardInsight && cardInsight.smartSide === side ? 1 : 0);
      const nextIqTotal = iqTotal + (cardInsight ? 1 : 0);
      if (cardInsight) {
        const wasSmart = cardInsight.smartSide === side;
        setIqHits(nextIqHits);
        setIqTotal(nextIqTotal);
        setLastInsight({ entry: cardInsight, wasSmart });
        // Разбор «норма / ловушка» больше не всплывает посреди игры — копим его для экрана итогов
        setDecisionLog((prev) => [
          ...prev,
          {
            id: `${currentCard.id}_${week}`,
            title: currentCard.speaker,
            fact: cardInsight.shortFact,
            wasSmart,
          },
        ]);
      }

      const scaledEffects = computeBalancedEffects(opt.effects, stats, mult);
      const nextStats: Stats = {
        s1: Math.max(0, Math.min(100, stats.s1 + (scaledEffects.s1 ?? 0))),
        s2: Math.max(0, Math.min(100, stats.s2 + (scaledEffects.s2 ?? 0))),
        s3: Math.max(0, Math.min(100, stats.s3 + (scaledEffects.s3 ?? 0))),
        s4: Math.max(0, Math.min(100, stats.s4 + (scaledEffects.s4 ?? 0))),
      };

      const enteredRedZone = (['s1', 's2', 's3', 's4'] as StatKey[]).some(
        (k) => nextStats[k] <= 18 || nextStats[k] >= 85
      );

      // Сбрасываем раскрытия выбора и сворачиваем статы
      setPinnedSide(null);
      setHeldSide(null);
      setStatsExpanded(false);

      // ───── Фраза-итог между карточками ─────
      quipTimersRef.current.forEach((t) => window.clearTimeout(t));
      quipTimersRef.current = [];
      const isGameEnding = (['s1', 's2', 's3', 's4'] as StatKey[]).some(
        (k) => nextStats[k] <= 0 || nextStats[k] >= 100
      );
      const labels = Object.fromEntries(pack.pillars.map((p) => [p.key, p.label])) as Record<
        StatKey,
        string
      >;
      const builtQuip = isGameEnding
        ? null
        : buildOutcomeQuip({
            packId: pack.id,
            prev: stats,
            next: nextStats,
            deltas: scaledEffects,
            labels,
            recent: recentQuipIdsRef.current,
            shownLastTurn: quipShownLastTurnRef.current,
            authored: opt.outcome,
          });
      quipShownLastTurnRef.current = Boolean(builtQuip);
      if (builtQuip) {
        recentQuipIdsRef.current = [...recentQuipIdsRef.current.slice(-14), builtQuip.id];
        const qSeq = cardSeq;
        setQuipLeaving(false);
        setQuip(null);
        quipTimersRef.current.push(
          window.setTimeout(() => setQuip({ ...builtQuip, seq: qSeq }), 110),
          window.setTimeout(() => setQuipLeaving(true), 110 + 1650),
          window.setTimeout(() => {
            setQuip(null);
            setQuipLeaving(false);
          }, 110 + 1650 + 380)
        );
        setReactionMood(
          builtQuip.tone === 'danger'
            ? { tone: 'warn', label: 'ОПАСНОСТЬ' }
            : builtQuip.tone === 'up'
              ? { tone: 'good', label: 'В УДАРЕ' }
              : builtQuip.tone === 'down'
                ? { tone: 'warn', label: 'ПРОСАДКА' }
                : { tone: 'idle', label: 'НА СМЕНЕ' }
        );
      } else {
        setQuip(null);
        setQuipLeaving(false);
        setReactionMood(
          enteredRedZone ? { tone: 'warn', label: 'ОПАСНОСТЬ' } : { tone: 'idle', label: 'НА СМЕНЕ' }
        );
      }

      setStats(nextStats);
      setPoppingDeltas((prev) => ({ seq: prev.seq + 1, deltas: scaledEffects }));

      const nextFlags = new Set(flags);
      opt.addFlags?.forEach((f) => nextFlags.add(f));

      const nextUsed = new Set(usedOnce);
      if (currentCard.oncePerRun) nextUsed.add(currentCard.id);

      const nextWeek = week + 1;
      const nextQ = [...scheduled];
      if (opt.followUpId) {
        nextQ.push({
          cardId: opt.followUpId,
          triggerWeek: nextWeek + (opt.followUpDelay ?? 2),
        });
      }

      if (nextWeek % 8 === 0) {
        setLifelineCharges((c) => Math.min(3, c + 1));
      }

      setIncomingSms((prevSms) => {
        if (!prevSms) return null;
        if (prevSms.swipesLeft <= 1) return null;
        return { ...prevSms, swipesLeft: prevSms.swipesLeft - 1 };
      });

      // Записываем свайп для 13.5-сек Шортс-комбайна и проверки реального прототипа (Черчилль / тупняки)
      const rawUnmirrored = pack.deckCards.find((c) => c.id === currentCard.id);
      const matchedRealCase =
        currentCard.realCase && rawUnmirrored
          ? opt.label ===
            (currentCard.realCase.matchingSide === 'left'
              ? rawUnmirrored.left.label
              : rawUnmirrored.right.label)
          : undefined;
      const swipeFaceSnap =
        shareRunActive && (webcamStream || customPhotoUrl) && (trackedCutoutCanvas || rawVideoEl)
          ? captureFaceSnapshotDataUrl(trackedCutoutCanvas ?? rawVideoEl, !trackedCutoutCanvas)
          : null;
      if (swipeFaceSnap) {
        setFaceSnapshotUrl(swipeFaceSnap);
      }
      setRunSwipeHighlights((prev) => [
        ...prev,
        {
          cardId: currentCard.id,
          week,
          blockNum: curBlock.blockNum,
          speaker: currentCard.speaker,
          role: currentCard.role,
          text: currentCard.text,
          leftLabel: currentCard.left.label,
          rightLabel: currentCard.right.label,
          chosenLabel: opt.label,
          side,
          statsBefore: { ...stats },
          statsAfter: { ...nextStats },
          faceSnapUrl: swipeFaceSnap,
          matchedRealCase,
          realCase: currentCard.realCase,
        },
      ]);

      let endDef: EndingDef | undefined;
      let crashedPillarLabel = 'Баланс';
      for (const k of ['s1', 's2', 's3', 's4'] as StatKey[]) {
        if (nextStats[k] <= 0) {
          endDef = pack.endings.find((e) => e.stat === k && e.extreme === 'low');
          crashedPillarLabel = pack.pillars.find((pl) => pl.key === k)?.label ?? 'Показатель';
          break;
        }
        if (nextStats[k] >= 100) {
          endDef = pack.endings.find((e) => e.stat === k && e.extreme === 'high');
          crashedPillarLabel = pack.pillars.find((pl) => pl.key === k)?.label ?? 'Показатель';
          break;
        }
      }
      if (!endDef && nextFlags.has('victory_achieved') && !endlessMode) {
        endDef = pack.endings.find((e) => e.isVictory);
      }

      const runIqPct = nextIqTotal > 0 ? Math.round((nextIqHits / nextIqTotal) * 100) : 0;
      const justClearedBlock1 = !endDef && !endlessMode && week === 12 && nextWeek === 13;
      const justClearedBlock2 = !endDef && !endlessMode && week === 24 && nextWeek === 25;

      const smsTriggerKind: MiniGameKind | null =
        nextWeek === 5 || nextWeek === 21
          ? 'night_chat'
          : nextWeek === 10 || nextWeek === 27
            ? 'xray_scanner'
            : nextWeek === 16 || nextWeek === 32
              ? 'red_green_flag'
              : null;

      sendAnonymousPulse('swipe', pack.id);
      if (justClearedBlock1 || justClearedBlock2) {
        sendAnonymousPulse('block_clear', pack.id);
      }

      setMeta((prev) => {
        const prevBest = prev.bestWeeksByPack[pack.id] ?? 1;
        const prevBestIq = prev.bestIqByPack[pack.id] ?? 0;
        const prevCkpt = prev.checkpointBlockByPack[pack.id] ?? 1;
        const nextCkpt: 1 | 2 | 3 = justClearedBlock2
          ? 3
          : justClearedBlock1
            ? (Math.max(prevCkpt, 2) as 1 | 2 | 3)
            : prevCkpt;

        const unlocked =
          endDef && !prev.unlockedEndings.includes(endDef.id)
            ? [...prev.unlockedEndings, endDef.id]
            : prev.unlockedEndings;

        return {
          ...prev,
          deathsTotal:
            endDef && !endDef.isVictory ? (prev.deathsTotal ?? 0) + 1 : (prev.deathsTotal ?? 0),
          bestWeeksByPack: {
            ...prev.bestWeeksByPack,
            [pack.id]: Math.max(prevBest, nextWeek),
          },
          bestIqByPack:
            nextIqTotal >= 2
              ? {
                  ...prev.bestIqByPack,
                  [pack.id]: Math.max(prevBestIq, runIqPct),
                }
              : prev.bestIqByPack,
          checkpointBlockByPack: {
            ...prev.checkpointBlockByPack,
            [pack.id]: nextCkpt,
          },
          unlockedEndings: unlocked,
          telemetry: {
            ...prev.telemetry,
            swipesTotal: (prev.telemetry.swipesTotal ?? 0) + 1,
            blocksCleared:
              (prev.telemetry.blocksCleared ?? 0) +
              (justClearedBlock1 || justClearedBlock2 ? 1 : 0),
            smsEventsShown:
              (prev.telemetry.smsEventsShown ?? 0) + (!endDef && smsTriggerKind ? 1 : 0),
          },
        };
      });

      if (endDef) {
        const finalEnd = endDef;
        const isNew = !meta.unlockedEndings.includes(finalEnd.id);
        // Предлагаем продолжение за Stars ТОЛЬКО внутри Telegram и ТОЛЬКО тем, кто уже играет платные Блоки 2–3
        const eligibleForGachaSave =
          !finalEnd.isVictory &&
          week < CAMPAIGN_TOTAL_SHIFTS &&
          activeBlock.blockNum >= 2 &&
          isRunningInsideTelegramMiniApp();

        if (eligibleForGachaSave) {
          sfxGameOver();
          setIncomingSms(null);
          setPendingGachaCrash({
            endDef: finalEnd,
            isNew,
            crashedStatLabel: crashedPillarLabel,
            nextWeek,
            nextFlags,
            nextUsed,
            nextQ,
          });
          return;
        }

        setFlags(nextFlags);
        setWeek(nextWeek);
        if (recorderRef.current) {
          setIsFinalizingReel(true);
        }

        window.setTimeout(() => {
          setIncomingSms(null);
          if (finalEnd.isVictory) sfxVictory();
          else sfxGameOver();
          setReactionMood(
            finalEnd.isVictory
              ? { tone: 'good', label: 'ТРИУМФ!' }
              : { tone: 'warn', label: 'СРЫВ СМЕНЫ!' }
          );

          if (shareRunActive && (webcamStream || customPhotoUrl) && trackedCutoutCanvas) {
            const snapUrl = captureFaceSnapshotDataUrl(trackedCutoutCanvas, false);
            setFaceSnapshotUrl(snapUrl);
          }

          setActiveEnding({ def: finalEnd, isNew });
          if (recorderRef.current) {
            // Записываем 0.45 сек финального штампа и финализируем MP4 прямо для кнопки в окне итогов
            // (openPreview = false, чтобы не открывать скрытую вторую модалку под итогами!)
            window.setTimeout(() => {
              void stopReelRecording(false);
            }, 450);
          } else {
            setIsFinalizingReel(false);
          }
        }, 250);
        return;
      }

      // Переводим заблюренную нижнюю карточку на передний план (она плавно наведётся на резкость!),
      // а в фоновый заблюренный слот подкладываем следующую за ней карточку
      const incomingCard = nextCard;
      const usedWithIncoming = new Set(nextUsed);
      usedWithIncoming.add(incomingCard.id);
      const { card: upcomingBehind, remQueue } = drawNextForPack(
        pack,
        nextWeek + 1,
        usedWithIncoming,
        nextQ,
        endlessMode
      );
      setFlags(nextFlags);
      setUsedOnce(nextUsed);
      setScheduled(remQueue);
      setWeek(nextWeek);
      setCurrentCard(incomingCard);
      setNextCard(upcomingBehind);
      setCardSeq((s) => s + 1);

      if (justClearedBlock1 || justClearedBlock2) {
        if (recorderRef.current) {
          setIsFinalizingReel(true);
        }
        window.setTimeout(() => {
          sfxVictory();
          setLifelineCharges((c) => Math.min(3, c + 1));
          if (
            shareRunActive &&
            (webcamStream || customPhotoUrl) &&
            (trackedCutoutCanvas || rawVideoEl)
          ) {
            const snapUrl = captureFaceSnapshotDataUrl(
              trackedCutoutCanvas ?? rawVideoEl,
              !trackedCutoutCanvas
            );
            if (snapUrl) setFaceSnapshotUrl(snapUrl);
          }
          setIntermission(
            justClearedBlock1
              ? { clearedBlock: CAMPAIGN_BLOCKS[0], nextBlock: CAMPAIGN_BLOCKS[1] }
              : { clearedBlock: CAMPAIGN_BLOCKS[1], nextBlock: CAMPAIGN_BLOCKS[2] }
          );
          if (recorderRef.current) {
            window.setTimeout(() => {
              void stopReelRecording(false);
            }, 350);
          }
        }, 260);
        return;
      }

      if (smsTriggerKind) {
        sfxTiltTick();
        setIncomingSms(buildIncomingSmsForKind(smsTriggerKind, pack));
      }
    },
    [
      activeEnding,
      activeMiniGame,
      cardSeq,
      currentCard,
      customPhotoUrl,
      drawNextForPack,
      endlessMode,
      flags,
      intermission,
      iqHits,
      iqTotal,
      isFaceMagnetized,
      meta.unlockedEndings,
      nextCard,
      pack,
      resetCardDomTransformImmediate,
      scheduled,
      shareRunActive,
      stats,
      stopReelRecording,
      trackedCutoutCanvas,
      usedOnce,
      webcamStream,
      week,
    ]
  );

  useEffect(() => {
    if (
      inHub ||
      activeEnding ||
      museumOpen ||
      activeMiniGame ||
      inspectedPillar ||
      lifelineInfoOpen ||
      insightModalOpen ||
      installModalOpen ||
      vaultModalTab ||
      intermission ||
      menuDrawerOpen ||
      reelShareModalOpen
    ) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') commitChoice('left');
      if (e.key === 'ArrowRight') commitChoice('right');
      if (e.key === 'Escape') {
        setPinnedSide(null);
        setStatsExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeEnding,
    activeMiniGame,
    commitChoice,
    inHub,
    insightModalOpen,
    inspectedPillar,
    installModalOpen,
    intermission,
    lifelineInfoOpen,
    menuDrawerOpen,
    museumOpen,
    reelShareModalOpen,
    vaultModalTab,
  ]);

  const handleOpenIncomingSms = () => {
    if (!incomingSms) return;
    const chosenKind = incomingSms.kind;
    setIncomingSms(null);
    sfxCoffeeSave();
    setMeta((m) => ({
      ...m,
      telemetry: {
        ...m.telemetry,
        smsEventsOpened: (m.telemetry.smsEventsOpened ?? 0) + 1,
      },
    }));
    setActiveMiniGame({ kind: chosenKind, standalone: false });
  };

  const handleMiniGameComplete = (qualityRatio: number) => {
    const wasStandalone = activeMiniGame?.standalone ?? false;
    setActiveMiniGame(null);
    if (wasStandalone) return;

    const bonusHits = Math.round(qualityRatio * 3);
    setIqHits((h) => h + bonusHits);
    setIqTotal((t) => t + 3);

    if (qualityRatio >= 0.65) {
      const deltas: StatDelta = {};
      const next: Stats = { ...stats };
      for (const k of ['s1', 's2', 's3', 's4'] as StatKey[]) {
        const diff = Math.round((50 - stats[k]) * 0.35);
        if (diff !== 0) {
          next[k] = stats[k] + diff;
          deltas[k] = diff;
        }
      }
      setStats(next);
      setPoppingDeltas((p) => ({ seq: p.seq + 1, deltas }));
      setLifelineCharges((c) => Math.min(3, c + 1));
      setReactionMood({ tone: 'good', label: 'ЧЁТКО!' });
      setToastMsg('Показатели выровнены');
    } else {
      setReactionMood({ tone: 'warn', label: 'С ПОТЕРЯМИ' });
      setToastMsg('Этап пройден с потерями');
    }
    window.setTimeout(() => setToastMsg(null), 2600);
  };

  const useLifeline = () => {
    if (lifelineCharges <= 0 || activeEnding) return;
    sfxCoffeeSave();

    let worst: StatKey = 's1';
    let maxDist = -1;
    for (const k of ['s1', 's2', 's3', 's4'] as StatKey[]) {
      const d = Math.abs(stats[k] - 50);
      if (d > maxDist) {
        maxDist = d;
        worst = k;
      }
    }

    const oldV = stats[worst];
    const newV = Math.round(oldV + (50 - oldV) * 0.65);
    const diff = newV - oldV;

    setStats((prev) => ({ ...prev, [worst]: newV }));
    setPoppingDeltas((p) => ({ seq: p.seq + 1, deltas: { [worst]: diff } }));
    setLifelineCharges((c) => c - 1);
    setReactionMood({ tone: 'good', label: 'ВЫРУЧИЛ!' });

    const pName = pack.pillars.find((x) => x.key === worst)?.label ?? 'Показатель';
    setToastMsg(`${pName}: ${oldV}% → ${newV}%`);
    window.setTimeout(() => setToastMsg(null), 2200);
  };

  // ───────── ПРЯМОЙ 120Hz GPU-ДВИЖОК СВАЙПА ПО ВСЕЙ ЗОНЕ СЦЕНЫ (.card-stage) ─────────
  const onStagePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (activeEnding || activeMiniGame || intermission || inHub) return;
    // Если палец трогает живое лицо или панель настройки видео — карточка 100% неподвижна!
    if (faceBusyRef.current) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('[data-face-control="true"]')) return;

    // Зона у самого левого края (<= 22px) отдана системному жесту возврата в каталог
    if (e.clientX <= 22) return;

    // Касание карточки сворачивает раскрытую панель показателей
    if (statsExpanded) setStatsExpanded(false);

    const inlineSideEl = targetEl?.closest('[data-inline-choice]') as HTMLElement | null;
    const inlineSide =
      (inlineSideEl?.getAttribute('data-inline-choice') as 'left' | 'right' | null) ?? null;
    const onRevealPanel = Boolean(targetEl?.closest('[data-reveal-commit="true"]'));

    // Зажатие варианта (~280 мс без движения) раскрывает полную формулировку решения
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressFiredRef.current = false;
    if (inlineSide && !pinnedSide) {
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        const d = stageDragRef.current;
        if (!d || d.movedMax >= 7) return;
        longPressFiredRef.current = true;
        setHeldSide(inlineSide);
        sfxTiltTick(inlineSide);
        vibrate(6);
      }, 280);
    }

    activeCardElRef.current?.getAnimations().forEach((a) => a.cancel());

    const now = performance.now();
    stageDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: now,
      vx: 0,
      dx: 0,
      dy: 0,
      rot: 0,
      inlineBtnSide: inlineSide,
      onReveal: onRevealPanel,
      movedMax: 0,
      captured: false,
      grabPlayed: false,
      lockedSide: null,
    };
    tiltZoneRef.current = 'none';
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (faceBusyRef.current) return;

    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    const instVx = (e.clientX - drag.lastX) / dt;
    drag.vx = drag.vx * 0.52 + instVx * 0.48;
    drag.lastX = e.clientX;
    drag.lastT = now;

    const rawDx = e.clientX - drag.startX;
    const rawDy = e.clientY - drag.startY;
    const totalMove = Math.hypot(rawDx, rawDy);
    if (totalMove > drag.movedMax) drag.movedMax = totalMove;

    if (!drag.captured && totalMove > 6) {
      drag.captured = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      // Начался настоящий свайп: зажатие/пин больше не нужны — раскрытием теперь управляет палец
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setStatsExpanded(false);
      if (quip && !quipLeaving) setQuipLeaving(true);
    }

    if (!drag.grabPlayed && totalMove > 4) {
      drag.grabPlayed = true;
      sfxCardGrab();
    }

    if (totalMove > 14 && faceTuneHudOpen) {
      setFaceTuneHudOpen(false);
    }

    const dampedY = (rawDy / (1 + Math.abs(rawDy) * 0.006)) * 0.22;
    const rotDeg = rawDx * 0.046;

    drag.dx = rawDx;
    drag.dy = dampedY;
    drag.rot = rotDeg;

    // 1. Двигаем карточку напрямую через GPU transform (0 нагрузки на React!)
    cardMotionRef.current = { dx: rawDx, dy: dampedY, rotDeg };
    liveReelStateRef.current.dragX = rawDx;

    if (activeCardElRef.current) {
      activeCardElRef.current.style.transform = `translate3d(${rawDx.toFixed(
        1
      )}px, ${dampedY.toFixed(1)}px, 0) rotate(${rotDeg.toFixed(2)}deg)`;
      activeCardElRef.current.style.setProperty('--foil-shift', `${(rawDx * 0.45).toFixed(1)}%`);
    }

    const pull = Math.min(1, Math.max(0, (Math.abs(rawDx) - 6) / 64));
    if (back1ElRef.current) {
      back1ElRef.current.style.transform = `translate3d(0px, ${(10 - pull * 3.5).toFixed(
        1
      )}px, 0px) scale(${(0.955 + pull * 0.018).toFixed(3)})`;
      back1ElRef.current.style.opacity = '1';
    }

    const z: 'left' | 'none' | 'right' = rawDx < -18 ? 'left' : rawDx > 18 ? 'right' : 'none';
    if (z !== tiltZoneRef.current) {
      tiltZoneRef.current = z;
      if (z !== 'none') sfxTiltTick(z);
    }

    // Тактильный механический замок при дотягивании карточки до порога принятия решения (>= 68px)
    if (rawDx <= -68 && drag.lockedSide !== 'left') {
      drag.lockedSide = 'left';
      sfxThresholdLock('left', true);
    } else if (rawDx >= 68 && drag.lockedSide !== 'right') {
      drag.lockedSide = 'right';
      sfxThresholdLock('right', true);
    } else if (drag.lockedSide && Math.abs(rawDx) < 50) {
      const prevSide = drag.lockedSide;
      drag.lockedSide = null;
      sfxThresholdLock(prevSide, false);
    }

    // 2. Обновляем React-стейт шкал ТОЛЬКО при смене одного из 12 шагов натяжения
    const side: 'left' | 'right' | null = rawDx <= -8 ? 'left' : rawDx >= 8 ? 'right' : null;
    const step = Math.round(pull * 12);
    const stepKey = `${side ?? 'none'}:${step}`;
    if (stepKey !== lastPreviewStepRef.current) {
      lastPreviewStepRef.current = stepKey;
      setSwipePreview({ side, pullRatio: step / 12 });
    }
  };

  const onStagePointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    stageDragRef.current = null;

    const { dx, dy, rot, vx, inlineBtnSide, onReveal, movedMax } = drag;

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // ───── Короткие касания без движения (< 7px) ─────
    if (movedMax < 7) {
      if (movedMax > 0.5) resetCardDomTransformImmediate();
      if (e.type === 'pointercancel') {
        longPressFiredRef.current = false;
        setHeldSide(null);
        return;
      }
      // Зажатие закончилось — просто сворачиваем раскрытие, решение НЕ принимается
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        setHeldSide(null);
        return;
      }
      // Второй тап по раскрытому решению — подтверждаем выбор
      if (onReveal && pinnedSide) {
        const sideToCommit = pinnedSide;
        if (performance.now() - lastInlineCommitMsRef.current > 180) {
          lastInlineCommitMsRef.current = performance.now();
          commitChoice(sideToCommit, { fromX: 0, fromY: 0, fromRot: 0 });
        }
        return;
      }
      // Первый тап по варианту — раскрываем полную формулировку (пин)
      if (inlineBtnSide) {
        sfxUiTap();
        setPinnedSide((prev) => (prev === inlineBtnSide ? null : inlineBtnSide));
        return;
      }
      // Тап мимо — закрываем раскрытие
      if (pinnedSide) setPinnedSide(null);
      return;
    }

    setHeldSide(null);
    setPinnedSide(null);
    longPressFiredRef.current = false;

    // Порог принятия решения: полный увод (>= 68px) ИЛИ быстрый инерционный взмах пальцем (iOS Flick)
    if (dx <= -68 || (dx <= -26 && vx < -0.48)) {
      commitChoice('left', { fromX: dx, fromY: dy, fromRot: rot });
      return;
    }
    if (dx >= 68 || (dx >= 26 && vx > 0.48)) {
      commitChoice('right', { fromX: dx, fromY: dy, fromRot: rot });
      return;
    }

    if (Math.abs(dx) > 14) {
      sfxCardSnapBack();
    }

    // Плавный пружинный возврат строго из субпиксельной точки отпускания пальца через GPU Web Animations API!
    const fromTransform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(
      1
    )}px, 0) rotate(${rot.toFixed(2)}deg)`;
    resetCardDomTransformImmediate();

    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      activeCardElRef.current?.animate(
        [
          { transform: fromTransform },
          { transform: 'translate3d(0px, 0px, 0px) rotate(0deg)' },
        ],
        {
          duration: 380,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      );
    }
  };

  // Системный жест от левого/правого края экрана (Назад в каталог / Вперёд к смене)
  const onShellEdgeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || faceBusyRef.current) return;
    const t = e.touches[0];
    const w = window.innerWidth;
    if (!inHub && t.clientX <= 22) {
      edgeSwipeRef.current = { side: 'left_edge', startX: t.clientX, startY: t.clientY };
    } else if (inHub && hasActiveRun && t.clientX >= w - 26) {
      edgeSwipeRef.current = { side: 'right_edge', startX: t.clientX, startY: t.clientY };
    } else {
      edgeSwipeRef.current = null;
    }
  };

  const onShellEdgeTouchEnd = (e: React.TouchEvent) => {
    if (!edgeSwipeRef.current || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - edgeSwipeRef.current.startX;
    const dy = Math.abs(t.clientY - edgeSwipeRef.current.startY);
    const side = edgeSwipeRef.current.side;
    edgeSwipeRef.current = null;

    if (dy > 60) return;
    if (side === 'left_edge' && dx > 60) {
      vibrate(8);
      setInHub(true);
    } else if (side === 'right_edge' && dx < -60) {
      vibrate(8);
      setInHub(false);
    }
  };

  const mult = curBlock.riskMultiplier;
  const activePreviewSide = swipePreview.side;
  const pullRatio = swipePreview.pullRatio;

  // Какое решение сейчас раскрыто: палец тянет > зажатие > пин тапом
  const revealSide: 'left' | 'right' | null = activePreviewSide ?? heldSide ?? pinnedSide;
  if (revealSide) lastRevealSideRef.current = revealSide;
  const revealShownSide = revealSide ?? lastRevealSideRef.current;
  const revealMode: 'drag' | 'held' | 'pinned' | null = activePreviewSide
    ? 'drag'
    : heldSide
      ? 'held'
      : pinnedSide
        ? 'pinned'
        : null;
  const revealArmed = revealMode === 'drag' && pullRatio >= 1;

  const fullBalancedDeltas: StatDelta = useMemo(() => {
    if (!revealSide) return {};
    const opt = revealSide === 'left' ? currentCard.left : currentCard.right;
    return computeBalancedEffects(opt.effects, stats, mult);
  }, [revealSide, currentCard.left, currentCard.right, mult, stats]);

  useEffect(
    () => () => {
      quipTimersRef.current.forEach((t) => window.clearTimeout(t));
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    },
    []
  );

  const showSwipeHint = week <= 2 && (meta.telemetry.swipesTotal ?? 0) < 8;

  const currentAttempt = meta.attemptsByPack[pack.id] ?? 1;
  const packEndingsOpen = pack.endings.filter((e) => meta.unlockedEndings.includes(e.id)).length;
  const liveMasteryPct = iqTotal > 0 ? Math.round((iqHits / iqTotal) * 100) : null;
  const packFullyOpen = isPackFullyUnlocked(meta, pack.id);
  const savedCheckpoint = meta.checkpointBlockByPack[pack.id] ?? 1;
  const activeSoundProfile: SoundProfile = meta.soundProfile ?? 'groove';

  const onQuickSelfiePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        sfxCoffeeSave();
        setCustomPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const mm = String(Math.floor(recSeconds / 60)).padStart(2, '0');
  const ss = String(recSeconds % 60).padStart(2, '0');

  if (activeCheckRun) {
    return (
      <ActiveSkillCheckRunner
        check={activeCheckRun.check}
        token={activeCheckRun.token}
        mode={activeCheckRun.mode}
        isSelfPractice={activeCheckRun.isSelfPractice}
        muted={Boolean(meta.muted || meta.soundProfile === 'off')}
        onToggleMute={() =>
          setMeta((m) => {
            const nextMuted = !(m.muted || m.soundProfile === 'off');
            return {
              ...m,
              muted: nextMuted,
              soundProfile: nextMuted ? 'off' : m.soundProfile === 'off' ? 'groove' : m.soundProfile,
            };
          })
        }
        onExitToHub={() => {
          clearUrlCheckParams();
          setActiveCheckRun(null);
          setInHub(true);
          setHubTab('checks');
          setChecksRefreshSeq((s) => s + 1);
        }}
        onCreateOwnChallengeLink={(chk) => {
          clearUrlCheckParams();
          const rec = createNewCheckLinkRecord(chk, 'challenge', '');
          const shareUrl = buildCheckShareUrl(rec.slug, rec.token);
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(shareUrl).catch(() => {});
          }
          setActiveCheckRun(null);
          setInHub(true);
          setHubTab('checks');
          setChecksRefreshSeq((s) => s + 1);
          setOwnerTrackerModal({ check: chk, token: rec.token });
        }}
      />
    );
  }

  return (
    <div
      className="reigns-shell"
      onTouchStart={onShellEdgeTouchStart}
      onTouchEnd={onShellEdgeTouchEnd}
    >
      <SceneBackdrop packId={pack.id} blockNum={curBlock.blockNum} inDanger={anyStatDanger} />
      <input
        ref={quickSelfieInputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={onQuickSelfiePicked}
      />

      {/* ИДЕАЛЬНО ВЫРОВНЕННАЯ КОМПАКТНАЯ ВЕРХНЯЯ ПАНЕЛЬ */}
      <header className="top-bar unified-bar">
        <button
          type="button"
          className="hb-pill hb-pack-pill"
          onClick={() => {
            sfxUiTap(true);
            setInHub(true);
          }}
          title="К выбору режима (или свайп от левого края)"
        >
          <IconGrid size={15} />
          <span className="hb-pack-name">{pack.shortTitle}</span>
          <span className="hb-shift-num">{String(week).padStart(2, '0')}/36</span>
        </button>

        <div className="hb-right-group">
          {!shareRunActive ? (
            <button
              type="button"
              className="hb-pill hb-video-pill"
              onClick={() => {
                sfxUiTap(true);
                void activateSharePlaythroughMode();
              }}
              title="Включить живое лицо и запись видео"
            >
              <span className="hb-dot idle" />
              <span>Видео</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`hb-pill hb-tune-pill ${faceTuneHudOpen ? 'on' : ''}`}
                onClick={() => {
                  sfxUiTap();
                  setFaceTuneHudOpen((v) => !v);
                }}
                title="Настроить размер и положение лица"
              >
                Лицо
              </button>

              {isRecordingReel ? (
                <button
                  type="button"
                  className="hb-pill hb-video-pill recording"
                  onClick={() => {
                    sfxUiTap(true);
                    void stopReelRecording(true);
                  }}
                  title="Остановить запись и сохранить видео"
                >
                  <span className="hb-dot rec" />
                  <span>
                    {mm}:{ss}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="hb-pill hb-video-pill waiting"
                  onClick={() => {
                    sfxUiTap();
                    if (!webcamStream && !customPhotoUrl) {
                      quickSelfieInputRef.current?.click();
                    } else {
                      exitSharePlaythroughMode();
                    }
                  }}
                  title="Запись стартует автоматически, как только лицо попадёт в кадр"
                >
                  <span className="hb-dot wait" />
                  <span>{webcamStream || customPhotoUrl ? 'Ловим…' : '+ Фото'}</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="hb-circle-btn"
            onClick={() => {
              sfxUiTap();
              setMenuDrawerOpen(true);
            }}
            aria-label="Параметры"
          >
            <IconDots size={18} />
          </button>
        </div>
      </header>

      {/* ТОНКАЯ ЛИНИЯ ПРОГРЕССА 3 КАРЬЕРНЫХ БЛОКОВ */}
      <div className="sleek-career-track">
        {CAMPAIGN_BLOCKS.map((b) => {
          let fillPct = 0;
          if (week > b.endWeek) fillPct = 100;
          else if (week >= b.startWeek) {
            fillPct = Math.round(((week - b.startWeek + 1) / 12) * 100);
          }
          const locked = b.blockNum > 1 && !packFullyOpen;
          return (
            <div key={b.blockNum} className={`sct-seg ${locked ? 'locked' : ''}`}>
              <div className="sct-fill" style={{ width: `${fillPct}%` }} />
            </div>
          );
        })}
      </div>

      {/* КОМПАКТНАЯ ПОЛОСКА 4 ПОКАЗАТЕЛЕЙ: схематично в покое, подробно — по тапу (раскрывается вниз) */}
      <section
        className={`stat-strip ${statsExpanded ? 'expanded' : ''} ${revealSide ? 'previewing' : ''}`}
      >
        <button
          type="button"
          className="ss-row"
          aria-expanded={statsExpanded}
          aria-label={statsExpanded ? 'Свернуть показатели' : 'Показать показатели подробно'}
          onClick={() => {
            sfxUiTap();
            setStatsExpanded((v) => !v);
          }}
        >
          {pack.pillars.map((pil) => {
            const val = stats[pil.key];
            const fullDelta = fullBalancedDeltas[pil.key] ?? 0;
            const justChanged = poppingDeltas.deltas[pil.key] ?? 0;
            const danger = val <= 20 || val >= 84;
            const impact = revealSide && fullDelta !== 0 ? (Math.abs(fullDelta) >= 10 ? 'big' : 'small') : null;
            const impactDir = revealSide && fullDelta !== 0 ? (fullDelta > 0 ? 'up' : 'down') : null;
            const projected = Math.max(0, Math.min(100, val + fullDelta));
            const willCrash = Boolean(impact) && (projected <= 0 || projected >= 100);

            return (
              <span
                key={pil.key}
                className={`ss-item ${danger ? 'danger' : ''} ${willCrash ? 'crash-warn' : ''} ${
                  impactDir ? `impact-${impactDir}` : ''
                }`}
              >
                <span
                  key={justChanged !== 0 ? `chg_${poppingDeltas.seq}` : 'still'}
                  className={`ss-ico ${justChanged > 0 ? 'bump-up' : justChanged < 0 ? 'bump-down' : ''}`}
                >
                  <PillarSvgIcon packId={pack.id} statKey={pil.key} size={14} />
                  <i className={`ss-dot ${impact ?? ''} ${impactDir ?? ''}`} aria-hidden="true">
                    {impactDir === 'up' ? '▲' : impactDir === 'down' ? '▼' : ''}
                  </i>
                </span>
                <span className="ss-meter">
                  <i className="ss-fill" style={{ width: `${val}%` }} />
                </span>
              </span>
            );
          })}
          <span className="ss-chevron" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M3 4.5 L6 7.5 L9 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        <div className="ss-details" aria-hidden={!statsExpanded}>
          <div className="ss-details-clip">
            <div className="ss-details-grid">
              {pack.pillars.map((pil, idx) => {
                const val = stats[pil.key];
                const danger = val <= 20 || val >= 84;
                return (
                  <button
                    key={pil.key}
                    type="button"
                    tabIndex={statsExpanded ? 0 : -1}
                    className={`ss-detail ${danger ? 'danger' : ''}`}
                    style={{ transitionDelay: statsExpanded ? `${60 + idx * 35}ms` : '0ms' }}
                    onClick={() => {
                      sfxUiTap();
                      setInspectedPillar(pil);
                    }}
                  >
                    <span className="ssd-ico">
                      <PillarSvgIcon packId={pack.id} statKey={pil.key} size={16} />
                    </span>
                    <span className="ssd-copy">
                      <span className="ssd-top">
                        <b>{pil.label}</b>
                        <em>{val}%</em>
                      </span>
                      <span className="ssd-bar">
                        <i style={{ width: `${val}%` }} />
                        <s className="ssd-zone low" />
                        <s className="ssd-zone high" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="ss-details-note">
              Держите все четыре в балансе: и ноль, и сотня одинаково заканчивают смену.
            </p>
          </div>
        </div>
      </section>

      {/* КОНТЕКСТНЫЙ СЛОТ: появляется только когда есть что сказать (SMS, тост, подсказка новичку) */}
      {(() => {
        const ctxKind = incomingSms ? 'sms' : toastMsg ? 'toast' : showSwipeHint ? 'hint' : null;
        return (
          <div className={`ctx-slot ${ctxKind ? 'has' : ''}`}>
            <div className="ctx-slot-inner">
              {ctxKind === 'sms' && incomingSms ? (
                <div className="organic-sms-banner">
                  <div className="osb-dot" />
                  <button type="button" className="osb-main" onClick={handleOpenIncomingSms}>
                    <div className="osb-top-line">
                      <strong>{incomingSms.sender}</strong>
                    </div>
                    <p>{incomingSms.preview}</p>
                  </button>
                  <button type="button" className="osb-open-btn" onClick={handleOpenIncomingSms}>
                    Открыть
                  </button>
                  <button
                    type="button"
                    className="osb-dismiss-btn"
                    onClick={() => setIncomingSms(null)}
                    aria-label="Скрыть"
                  >
                    ×
                  </button>
                </div>
              ) : ctxKind === 'toast' ? (
                <div className="mission-ribbon coffee-lit">{toastMsg}</div>
              ) : ctxKind === 'hint' ? (
                <div className="ctx-hint">
                  <span className="ctx-hint-hand" aria-hidden="true">
                    ↔
                  </span>
                  Смахните карточку или зажмите вариант
                </div>
              ) : null}
            </div>
          </div>
        );
      })()}

      {/* СЦЕНА КАРТОЧКИ: ВСЯ ОБЛАСТЬ РАБОТАЕТ КАК ЧУВСТВИТЕЛЬНАЯ ЗОНА СВАЙПА, А ЛИЦО ЖИВЁТ ОТДЕЛЬНО СВЕРХУ! */}
      <main
        ref={stageElRef}
        className="card-stage spacious-stage"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerEnd}
        onPointerCancel={onStagePointerEnd}
      >
        <div className="deck-stack-wrapper">
          <div className="deck-back back-2" />

          {/* Реальная следующая карточка в мягком расфокусе позади текущей */}
          <div
            key={`under_${cardSeq}`}
            ref={back1ElRef}
            className={`dilemma-card apple-spring-card blurred-next-underlay ${
              getBlockForWeek(week + 1).blockNum === 2
                ? 'card-tier-foil'
                : getBlockForWeek(week + 1).blockNum === 3
                  ? 'card-tier-polychrome'
                  : ''
            }`}
            aria-hidden="true"
          >
            <div className="dc-focus-plane">
              <div className="dc-portrait-area">
                {nextCard.photoBanner || nextCard.portrait ? (
                  <img
                    src={nextCard.photoBanner ?? nextCard.portrait}
                    alt=""
                    className="dc-main-img"
                    draggable={false}
                  />
                ) : (
                  <EditorialCardPortrait
                    packId={pack.id}
                    cardId={nextCard.id}
                    speaker={nextCard.speaker}
                    blockNum={getBlockForWeek(week + 1).blockNum}
                    hideFaceForCutout={false}
                  />
                )}
              </div>

              <div className="dc-speaker-bar">
                <strong>{nextCard.speaker}</strong>
                <span>{nextCard.role}</span>
              </div>

              <div className="dc-question-body">
                <p>{nextCard.text}</p>
              </div>

              <div className="dc-inline-choices">
                <div className="dc-inline-side left">
                  <div className="dc-inline-copy">
                    <small className="dc-dir-kicker">← Влево</small>
                    <strong>{getChoiceShortGist(nextCard.left.label)}</strong>
                  </div>
                </div>
                <div className="dc-inline-side right">
                  <div className="dc-inline-copy">
                    <small className="dc-dir-kicker">Вправо →</small>
                    <strong>{getChoiceShortGist(nextCard.right.label)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="bnu-depth-veil" />
          </div>

          {/* Активная карточка: плавно выходит из расфокуса (unblur) как только убрали переднюю! */}
          <div
            key={cardSeq}
            ref={activeCardElRef}
            className={`dilemma-card apple-spring-card fresh-card ${
              currentCard.realCase ? 'card-real-case' : ''
            } ${
              curBlock.blockNum === 2
                ? 'card-tier-foil'
                : curBlock.blockNum === 3
                  ? 'card-tier-polychrome'
                  : ''
            } ${
              cardSeq > 1 ? 'rack-focus-appear' : ''
            } ${
              activePreviewSide === 'left'
                ? 'tilted-left'
                : activePreviewSide === 'right'
                  ? 'tilted-right'
                  : ''
            }`}
          >
            <div className="dc-focus-plane">
              <div ref={portraitAreaRef} className="dc-portrait-area">
                {curBlock.blockNum >= 2 && (
                  <span
                    className={`dc-tier-badge ${
                      curBlock.blockNum === 3 ? 'polychrome' : 'foil'
                    }`}
                  >
                    {curBlock.blockNum === 3 ? 'БЛОК III' : 'БЛОК II'}
                  </span>
                )}
                {currentCard.videoClip ? (
                  <video
                    key={currentCard.videoClip}
                    src={currentCard.videoClip}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="dc-video-loop"
                  />
                ) : currentCard.photoBanner || currentCard.portrait ? (
                  <img
                    src={currentCard.photoBanner ?? currentCard.portrait}
                    alt={currentCard.speaker}
                    className="dc-main-img"
                    draggable={false}
                  />
                ) : (
                  <EditorialCardPortrait
                    packId={pack.id}
                    cardId={currentCard.id}
                    speaker={currentCard.speaker}
                    blockNum={curBlock.blockNum}
                    hideFaceForCutout={shareRunActive && isFaceMagnetized}
                  />
                )}

              </div>

              <div className="dc-speaker-bar">
                <strong>{currentCard.speaker}</strong>
                <span>{currentCard.role}</span>
              </div>

              <div className="dc-question-body">
                <p>{currentCard.text}</p>
              </div>

              {/* Варианты: в покое — короткая суть; тап/зажатие/свайп раскрывают полный текст поверх */}
              <div className={`dc-inline-choices ${revealSide ? `revealing-${revealSide}` : ''}`}>
                {(['left', 'right'] as const).map((sideKey) => {
                  const opt = sideKey === 'left' ? currentCard.left : currentCard.right;
                  return (
                    <button
                      key={sideKey}
                      type="button"
                      data-inline-choice={sideKey}
                      aria-label={opt.label}
                      className={`dc-inline-side ${sideKey} ${revealSide === sideKey ? 'active' : ''}`}
                      onClick={(e) => {
                        // Мышь/палец обрабатываются жестами сцены; здесь — только клавиатура (Enter/Space)
                        if (e.detail !== 0) return;
                        if (pinnedSide === sideKey) {
                          commitChoice(sideKey, { fromX: 0, fromY: 0, fromRot: 0 });
                        } else {
                          setPinnedSide(sideKey);
                        }
                      }}
                    >
                      <div className="dc-inline-copy">
                        <small className="dc-dir-kicker">
                          {sideKey === 'left' ? '← Влево' : 'Вправо →'}
                        </small>
                        <strong>{getChoiceShortGist(opt.label)}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Раскрытое решение: «вырастает» из своей кнопки на всю ширину, пока палец тянет/держит */}
            <div
              className={`choice-reveal ${revealShownSide} ${revealSide ? 'open' : ''} ${
                revealArmed ? 'armed' : ''
              } ${revealMode === 'pinned' ? 'tappable' : ''}`}
              data-reveal-commit={revealMode === 'pinned' ? 'true' : undefined}
              aria-hidden={!revealSide}
              style={
                {
                  // Пока карточка уезжает за край, текст смещается внутрь видимой части экрана
                  '--cr-shift': `${revealMode === 'drag' ? Math.round(pullRatio * 64) : 0}px`,
                } as React.CSSProperties
              }
            >
              <div className="cr-inner" key={`${cardSeq}_${revealShownSide}`}>
                <small className="cr-kicker">
                  {revealShownSide === 'left' ? '← Влево' : 'Вправо →'}
                </small>
                <strong className="cr-text">
                  {revealShownSide === 'left' ? currentCard.left.label : currentCard.right.label}
                </strong>
                <div className="cr-progress">
                  <i
                    style={{
                      transform: `scaleX(${
                        revealMode === 'drag' ? Math.max(0.04, pullRatio) : revealMode ? 1 : 0
                      })`,
                    }}
                  />
                </div>
                <span className="cr-hint">
                  {revealMode === 'pinned'
                    ? 'Нажмите ещё раз — или смахните'
                    : revealMode === 'held'
                      ? 'Смахните в эту сторону, чтобы выбрать'
                      : revealArmed
                        ? 'Отпустите — решение принято'
                        : revealShownSide === 'left'
                          ? '← Тяните дальше'
                          : 'Тяните дальше →'}
                </span>
              </div>
            </div>
          </div>

          {/* Улетающая предыдущая карточка (летит независимо поверх проявляющейся новой) */}
          {exitingCards.map((snap) => (
            <OutgoingCardGhost key={snap.seq} snapshot={snap} onDone={removeExitingGhost} />
          ))}

          {/* Фраза-итог: всплывает, пока новая карточка проявляется из расфокуса */}
          {quip && (
            <div
              key={`quip_${quip.seq}`}
              className={`outcome-quip tone-${quip.tone} ${quipLeaving ? 'leaving' : ''}`}
              aria-live="polite"
            >
              <p className="oq-text">
                {quip.text.split(' ').map((w, i) => (
                  <span key={i} className="oq-word" style={{ animationDelay: `${70 + i * 38}ms` }}>
                    {w}
                  </span>
                ))}
              </p>
              {quip.moves.length > 0 && (
                <div className="oq-moves">
                  {quip.moves.slice(0, 3).map((m, i) => (
                    <span
                      key={m.key}
                      className={`oq-move ${m.dir > 0 ? 'up' : 'down'} ${m.big ? 'big' : ''}`}
                      style={{ animationDelay: `${260 + i * 60}ms` }}
                    >
                      <PillarSvgIcon packId={pack.id} statKey={m.key} size={12} />
                      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                        <path d={m.dir > 0 ? 'M4 1 L7 6 L1 6 Z' : 'M4 7 L7 2 L1 2 Z'} fill="currentColor" />
                      </svg>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* НЕЗАВИСИМЫЙ СЛОЙ ЖИВОГО ЛИЦА И НАСТРОЙКИ ВИДЕО: 0% ВЛИЯНИЯ НА ДВИЖЕНИЕ КАРТОЧКИ */}
        {shareRunActive && !inHub && (
          <InteractiveFaceStageLayer
            stageRef={stageElRef}
            portraitAreaRef={portraitAreaRef}
            cardMotionRef={cardMotionRef}
            faceBusyRef={faceBusyRef}
            hasMedia={Boolean(webcamStream || customPhotoUrl)}
            cutoutCanvas={trackedCutoutCanvas}
            pose={trackedPose}
            magnetized={isFaceMagnetized}
            freeXNorm={freeFacePos.x}
            freeYNorm={freeFacePos.y}
            scale={faceScale}
            tuneHudOpen={faceTuneHudOpen}
            onToggleTuneHud={setFaceTuneHudOpen}
            onChangeMagnetized={setIsFaceMagnetized}
            onChangeFreePos={(nx, ny) => setFreeFacePos({ x: nx, y: ny })}
            onChangeScale={setFaceScale}
            onPickSelfie={() => quickSelfieInputRef.current?.click()}
          />
        )}
      </main>

      {/* Нижний отступ под Home Indicator / панель Safari (бустер-«резерв» убран — он только занимал место) */}
      <div className="shell-bottom-safe" aria-hidden="true" />

      {menuDrawerOpen && (
        <DrawerSheet
          pack={pack}
          packEndingsOpen={packEndingsOpen}
          activeSoundProfile={activeSoundProfile}
          recordVoice={meta.recordVoice ?? true}
          onToggleRecordVoice={() => {
            sfxUiTap();
            setMeta((m) => ({ ...m, recordVoice: !(m.recordVoice ?? true) }));
          }}
          shareRunActive={shareRunActive}
          unlockClicks={meta.telemetry.unlockMoreClicks ?? 0}
          masteryPct={liveMasteryPct}
          inHubMode={inHub}
          onSelectSound={(key) =>
            setMeta((m) => ({
              ...m,
              soundProfile: key,
              muted: key === 'off',
            }))
          }
          onToggleShareRun={() => {
            if (shareRunActive) exitSharePlaythroughMode();
            else void activateSharePlaythroughMode();
          }}
          onOpenTuneFace={() => setFaceTuneHudOpen(true)}
          onTakeScreenshot={() => void takeLiveScreenshot()}
          onOpenStoriesStudio={() => setShortsCombainOpen(true)}
          onCopyDirectLinks={(mode) => {
            const slug = DIRECT_PLAY_SLUGS[pack.id] || pack.id;
            const link =
              mode === 'tg'
                ? getTelegramBotAppUrl(`play_${slug}`)
                : getDirectWebPlayUrl(slug);
            void navigator.clipboard?.writeText(link);
            setToastMsg(
              mode === 'tg'
                ? `Telegram-ссылка на «${pack.shortTitle}» скопирована`
                : `Прямая ссылка на «${pack.shortTitle}» скопирована`
            );
            window.setTimeout(() => setToastMsg(null), 2400);
          }}
          onOpenMuseum={() => setMuseumOpen(true)}
          onOpenInstall={() => setInstallModalOpen(true)}
          onOpenVault={() => setVaultModalTab('vault')}
          onOpenTelemetry={() => setVaultModalTab('telemetry')}
          onOpenPrivacy={() => setPrivacyModalOpen(true)}
          onClose={() => setMenuDrawerOpen(false)}
        />
      )}

      {/* ───────── ВЫБОР РЕЖИМА В СТИЛЕ APPLE (ЧИСТЫЙ, СПОКОЙНЫЙ, С ЕДИНЫМИ ПРЕВЬЮ-ПОРТРЕТАМИ) ───────── */}
      {inHub && (
        <div className="overlay-backdrop apple-hub-backdrop">
          <div className="hub-sheet apple-hub-sheet">
            <SceneBackdrop packId={effectiveAtmospherePackId} blockNum={1} inDanger={false} />
            <div className="apple-hub-header">
              <div className="ahh-titles">
                <h1 className="ahh-large-title">Кресло</h1>
              </div>

              <div className="ahh-actions">
                <button
                  type="button"
                  className="apple-cam-pill"
                  onClick={() => setDuelModalState({ open: true, ghost: null })}
                >
                  <span>Дуэль</span>
                </button>
                {hasActiveRun ? (
                  <button
                    type="button"
                    className="hub-resume-pill"
                    onClick={() => setInHub(false)}
                  >
                    Смена {String(week).padStart(2, '0')} →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="apple-cam-pill"
                    onClick={() => {
                      startPackRun(pack.id, 1, false);
                      void activateSharePlaythroughMode();
                    }}
                  >
                    <span className="hb-dot idle" />
                    <span>С лицом</span>
                  </button>
                )}

                <button
                  type="button"
                  className="hb-circle-btn"
                  onClick={() => setMenuDrawerOpen(true)}
                  aria-label="Меню и памятки"
                >
                  <IconDots size={18} />
                </button>
              </div>
            </div>

            {/* Компактные вкладки с бегущим индикатором (одна строка, ~34px) */}
            <div className="hub-tabs" role="tablist">
              <span
                className="hub-tabs-ink"
                aria-hidden="true"
                style={{
                  transform: `translateX(${
                    hubTab === 'jobs' ? 0 : hubTab === 'checks' ? 100 : 200
                  }%)`,
                }}
              />
              <button
                type="button"
                role="tab"
                aria-selected={hubTab === 'jobs'}
                className={hubTab === 'jobs' ? 'active' : ''}
                onClick={() => setHubTab('jobs')}
              >
                Симуляторы
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={hubTab === 'checks'}
                className={hubTab === 'checks' ? 'active' : ''}
                onClick={() => {
                  setHubTab('checks');
                  setChecksRefreshSeq((s) => s + 1);
                }}
              >
                Оценка
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={hubTab === 'minigames'}
                className={hubTab === 'minigames' ? 'active' : ''}
                onClick={() => setHubTab('minigames')}
              >
                Разминка
              </button>
            </div>

            {hubTab === 'jobs' ? (
              <div className="apple-cards-scroll">
                <div className="ios-context-chips">
                  {(
                    [
                      ['all', 'Все'],
                      ['practice', 'Рабочая практика'],
                      ['story', 'Сюжетные истории'],
                      ['tech', 'Инженерия и ИТ'],
                      ['commerce', 'Продажи и сервис'],
                    ] as ['all' | 'practice' | 'story' | 'tech' | 'commerce', string][]
                  ).map(([fkey, flabel]) => (
                    <button
                      key={fkey}
                      type="button"
                      className={jobFilter === fkey ? 'on' : ''}
                      onClick={() => {
                        sfxUiTap();
                        setJobFilter(fkey);
                      }}
                    >
                      {flabel}
                    </button>
                  ))}
                </div>

                {SHOWCASE_PACKS.filter((jp) => {
                  if (jobFilter === 'practice') return jp.hubTrack === 'practice';
                  if (jobFilter === 'story') return jp.hubTrack === 'story';
                  if (jobFilter === 'tech') {
                    return ['it_product', 'renovation_pro'].includes(jp.id);
                  }
                  if (jobFilter === 'commerce') {
                    return [
                      'office_manager',
                      'sales_rop',
                      'barista_pro',
                      'wb_seller',
                      'pvz_december',
                      'car_flipper',
                    ].includes(jp.id);
                  }
                  return true;
                }).map((jp, idx, arr) => {
                  const best = meta.bestWeeksByPack[jp.id] ?? 0;
                  const bestMastery = meta.bestIqByPack[jp.id] ?? 0;
                  const ckpt = meta.checkpointBlockByPack[jp.id] ?? 1;
                  const fullyUnlocked = isPackFullyUnlocked(meta, jp.id);
                  const isCurrent = meta.selectedPackId === jp.id;
                  const showGroupHeader =
                    jobFilter === 'all' &&
                    (idx === 0 || arr[idx - 1]?.hubTrack !== jp.hubTrack);

                  return (
                    <div key={jp.id} className="hub-pack-item-wrap">
                      {showGroupHeader && (
                        <div className="sc-sec-header hub-group-divider">
                          <span>
                            {jp.hubTrack === 'story'
                              ? 'Сюжетные истории'
                              : 'Рабочая практика и специальности'}
                          </span>
                        </div>
                      )}
                      <div
                        className={`apple-pack-row ${isCurrent ? 'is-selected' : ''}`}
                        onPointerEnter={() => setHoveredHubPackId(jp.id)}
                        onPointerLeave={() =>
                          setHoveredHubPackId((cur) => (cur === jp.id ? null : cur))
                        }
                        style={
                          isCurrent
                            ? { borderColor: getPackAtmosphere(jp.id).accentSoft }
                            : undefined
                        }
                      >
                      <button
                        type="button"
                        className="apr-main-tap"
                        onClick={() => startPackRun(jp.id, 1, false)}
                      >
                        <div className="apr-thumb-squircle">
                          <EditorialCardPortrait
                            packId={jp.id}
                            cardId={`hub_cover_${jp.id}`}
                            speaker={jp.title}
                            blockNum={1}
                          />
                        </div>

                        <div className="apr-copy">
                          <div className="apr-title-line">
                            <h3>{jp.title}</h3>
                          </div>
                          <p>{jp.subtitle}</p>
                          <div className="apr-meta">
                            {best > 1 ? (
                              <>
                                <span>Смена {best}/36</span>
                                {bestMastery > 0 && <span>· Опыт {bestMastery}%</span>}
                              </>
                            ) : (
                              <span>{jp.badge}</span>
                            )}
                          </div>
                        </div>

                        <span className="apr-chevron" aria-hidden="true">
                          ›
                        </span>
                      </button>

                      {(() => {
                        const unlockedBlk = getUnlockedBlockForPack(meta, jp.id);
                        const priceB2 = getTelegramStarsPriceForPack(jp.id, 2);
                        const priceB3 = getTelegramStarsPriceForPack(jp.id, 3);
                        return (
                          <div className="apr-modules-bar">
                            <button
                              type="button"
                              className="apr-mod-pill open-base"
                              onClick={() => startPackRun(jp.id, 1, false)}
                            >
                              Блок 1
                            </button>

                            {unlockedBlk >= 2 ? (
                              <button
                                type="button"
                                className="apr-mod-pill open-foil"
                                onClick={() => startPackRun(jp.id, 2, false)}
                              >
                                Блок 2
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="apr-mod-pill buy-foil"
                                onClick={() => {
                                  void handlePurchaseOrUnlockBlock(jp.id, 2, 'hub', () =>
                                    startPackRun(jp.id, 2, false)
                                  );
                                }}
                              >
                                Блок 2 · {priceB2} ★
                              </button>
                            )}

                            {unlockedBlk >= 3 ? (
                              <button
                                type="button"
                                className="apr-mod-pill open-poly"
                                onClick={() => startPackRun(jp.id, 3, false)}
                              >
                                Блок 3
                              </button>
                            ) : unlockedBlk === 2 ? (
                              <button
                                type="button"
                                className="apr-mod-pill buy-poly"
                                onClick={() => {
                                  void handlePurchaseOrUnlockBlock(jp.id, 3, 'hub', () =>
                                    startPackRun(jp.id, 3, false)
                                  );
                                }}
                              >
                                Блок 3 · {priceB3} ★
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="apr-mod-pill locked-later"
                                onClick={() => {
                                  setToastMsg('Сначала откройте Блок 2');
                                  window.setTimeout(() => setToastMsg(null), 2200);
                                }}
                              >
                                Блок 3 · {priceB3} ★
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : hubTab === 'checks' ? (
              <HubSkillChecksTab
                refreshTrigger={checksRefreshSeq}
                onPlaySelfCheck={(chk) => {
                  const practiceToken = generateCheckToken(chk.slug, 'challenge');
                  setActiveCheckRun({
                    check: chk,
                    token: practiceToken,
                    mode: 'challenge',
                    isSelfPractice: true,
                  });
                }}
                onOpenOwnerTracker={(chk, tok) => {
                  setOwnerTrackerModal({ check: chk, token: tok });
                }}
              />
            ) : (
              <div className="apple-cards-scroll">
                <div className="ios-context-chips">
                  {SHOWCASE_PACKS.map((jp) => (
                    <button
                      key={jp.id}
                      type="button"
                      className={meta.selectedPackId === jp.id ? 'on' : ''}
                      onClick={() => setMeta((m) => ({ ...m, selectedPackId: jp.id }))}
                    >
                      {jp.shortTitle}
                    </button>
                  ))}
                </div>

                <div className="apple-pack-row">
                  <button
                    type="button"
                    className="apr-main-tap"
                    onClick={() => setActiveMiniGame({ kind: 'night_chat', standalone: true })}
                  >
                    <div className="apr-thumb-squircle">
                      <EditorialCardPortrait
                        packId={pack.id}
                        cardId={`blitz_chat_${pack.id}`}
                        speaker="Рабочий чат"
                        blockNum={2}
                      />
                    </div>
                    <div className="apr-copy">
                      <h3>Ночной чат · 23:47</h3>
                      <p>Два срочных ответа перед полуночью без потери границ и бюджета.</p>
                      <div className="apr-meta">
                        <span>{pack.shortTitle} · 1 мин</span>
                      </div>
                    </div>
                    <span className="apr-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </div>

                <div className="apple-pack-row">
                  <button
                    type="button"
                    className="apr-main-tap"
                    onClick={() => setActiveMiniGame({ kind: 'xray_scanner', standalone: true })}
                  >
                    <div className="apr-thumb-squircle">
                      <EditorialCardPortrait
                        packId={pack.id}
                        cardId={`blitz_xray_${pack.id}`}
                        speaker="Аудитор приёмки"
                        blockNum={2}
                      />
                    </div>
                    <div className="apr-copy">
                      <h3>Рентген документов</h3>
                      <p>Сверьте обещания подрядчика с тем, что реально зашито в акте.</p>
                      <div className="apr-meta">
                        <span>Приёмка и контроль · 1 мин</span>
                      </div>
                    </div>
                    <span className="apr-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </div>

                <div className="apple-pack-row">
                  <button
                    type="button"
                    className="apr-main-tap"
                    onClick={() => setActiveMiniGame({ kind: 'red_green_flag', standalone: true })}
                  >
                    <div className="apr-thumb-squircle">
                      <EditorialCardPortrait
                        packId={pack.id}
                        cardId={`blitz_flags_${pack.id}`}
                        speaker="Эксперт отдела"
                        blockNum={3}
                      />
                    </div>
                    <div className="apr-copy">
                      <h3>Красный или зелёный флаг</h3>
                      <p>Быстрая проверка рабочих формулировок на скрытые риски.</p>
                      <div className="apr-meta">
                        <span>Блиц-диагностика · 1 мин</span>
                      </div>
                    </div>
                    <span className="apr-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="apple-hub-privacy-foot">
              <button type="button" onClick={() => setPrivacyModalOpen(true)}>
                0% сбора ПДн и cookies · Локальная работа камеры
              </button>
            </div>
          </div>
        </div>
      )}

      {ownerTrackerModal && (
        <OwnerCheckTrackerModal
          check={ownerTrackerModal.check}
          token={ownerTrackerModal.token}
          directReceipt={ownerTrackerModal.directReceipt}
          onClose={() => {
            clearUrlCheckParams();
            setOwnerTrackerModal(null);
            setChecksRefreshSeq((s) => s + 1);
          }}
          onRecordsChanged={() => setChecksRefreshSeq((s) => s + 1)}
          onTestPlaySelf={() => {
            const target = ownerTrackerModal.check;
            setOwnerTrackerModal(null);
            const practiceToken = generateCheckToken(target.slug, 'challenge');
            setActiveCheckRun({
              check: target,
              token: practiceToken,
              mode: 'challenge',
              isSelfPractice: true,
            });
          }}
        />
      )}

      {camNoticeOpen && (
        <CameraLocalNoticeModal
          defaultIncludeMic={meta.recordVoice ?? true}
          onConfirmLiveCamera={(withMic) => {
            try {
              localStorage.setItem(CAM_NOTICE_ACK_KEY, '1');
            } catch {
              // ignore
            }
            setMeta((m) => ({ ...m, recordVoice: withMic }));
            setCamNoticeOpen(false);
            void launchCameraSessionAfterConsent(withMic);
          }}
          onPickStaticSelfie={() => {
            setCamNoticeOpen(false);
            setIsFaceMagnetized(true);
            setFaceScale(1.0);
            setShareRunActive(true);
            setFaceTuneHudOpen(true);
            setPendingRecordOnFaceLock(true);
            sendAnonymousPulse('camera_on', pack.id);
            quickSelfieInputRef.current?.click();
          }}
          onClose={() => setCamNoticeOpen(false)}
        />
      )}

      {privacyModalOpen && <PrivacyZeroPiiModal onClose={() => setPrivacyModalOpen(false)} />}

      {intermission && (
        <BlockIntermissionModal
          pack={pack}
          clearedBlock={intermission.clearedBlock}
          nextBlock={intermission.nextBlock}
          stats={stats}
          iqHits={iqHits}
          iqTotal={iqTotal}
          decisionLog={decisionLog}
          runSwipeHighlights={runSwipeHighlights}
          recordedReel={recordedReel}
          isFinalizingReel={isFinalizingReel}
          isNextBlockUnlocked={
            getUnlockedBlockForPack(meta, pack.id) >= intermission.nextBlock.blockNum
          }
          onOpenShareVideo={() => setShortsCombainOpen(true)}
          onContinueNextBlock={() => {
            setIntermission(null);
            sfxCardFlip();
          }}
          onUnlockMoreAndContinue={() => {
            const targetBlk = intermission.nextBlock.blockNum === 3 ? 3 : 2;
            void handlePurchaseOrUnlockBlock(pack.id, targetBlk, 'intermission');
          }}
          onBackToHub={() => {
            setIntermission(null);
            setInHub(true);
          }}
        />
      )}

      {pendingGachaCrash && (
        <GachaContinueModal
          pack={pack}
          week={week}
          crashedStatLabel={pendingGachaCrash.crashedStatLabel}
          starsPrice={getGachaSaveStarsPrice(savesUsedInRun)}
          onAcceptSave={async () => {
            const res = await openTelegramStarsSaveCheckout(savesUsedInRun);
            if (res === 'unavailable') {
              setToastMsg('Продолжение за Stars работает внутри Telegram (@vkreslegame)');
              window.setTimeout(() => setToastMsg(null), 2800);
              openTelegramDeepLinkOutsideTma(`pack_${pack.id}`);
              return;
            }
            if (res !== 'paid') return;

            sfxCoffeeSave();
            vibrate([16, 30, 20]);
            const healed: Stats = { ...stats };
            (['s1', 's2', 's3', 's4'] as StatKey[]).forEach((k) => {
              if (healed[k] <= 0) healed[k] = 36;
              if (healed[k] >= 100) healed[k] = 64;
            });
            setStats(healed);
            setSavesUsedInRun((n) => n + 1);

            const incomingCard = nextCard;
            const usedWithIncoming = new Set(pendingGachaCrash.nextUsed);
            usedWithIncoming.add(incomingCard.id);
            const { card: upcomingBehind, remQueue } = drawNextForPack(
              pack,
              pendingGachaCrash.nextWeek + 1,
              usedWithIncoming,
              pendingGachaCrash.nextQ,
              endlessMode
            );
            setFlags(pendingGachaCrash.nextFlags);
            setUsedOnce(pendingGachaCrash.nextUsed);
            setScheduled(remQueue);
            setWeek(pendingGachaCrash.nextWeek);
            setCurrentCard(incomingCard);
            setNextCard(upcomingBehind);
            setCardSeq((s) => s + 1);
            setPendingGachaCrash(null);
            setToastMsg('Кресло удержано — продолжаем смену!');
            window.setTimeout(() => setToastMsg(null), 2400);
          }}
          onDeclineAndFinish={() => {
            const crash = pendingGachaCrash;
            setPendingGachaCrash(null);
            setFlags(crash.nextFlags);
            setWeek(crash.nextWeek);
            if (
              shareRunActive &&
              (webcamStream || customPhotoUrl) &&
              (trackedCutoutCanvas || rawVideoEl)
            ) {
              const snapUrl = captureFaceSnapshotDataUrl(
                trackedCutoutCanvas ?? rawVideoEl,
                !trackedCutoutCanvas
              );
              if (snapUrl) setFaceSnapshotUrl(snapUrl);
            }
            setActiveEnding({ def: crash.endDef, isNew: crash.isNew });
            if (recorderRef.current) {
              setIsFinalizingReel(true);
              window.setTimeout(() => {
                void stopReelRecording(false);
              }, 350);
            }
          }}
        />
      )}

      {installModalOpen && (
        <InstallHomeScreenModal
          deferredPrompt={deferredInstallPrompt}
          onTriggerAndroidInstall={async () => {
            if (!deferredInstallPrompt) return;
            await deferredInstallPrompt.prompt();
            setDeferredInstallPrompt(null);
            setInstallModalOpen(false);
          }}
          onClose={() => setInstallModalOpen(false)}
        />
      )}

      {vaultModalTab && (
        <VaultAndB2bModal
          meta={meta}
          initialTab={vaultModalTab}
          onUnlockVaultDemand={() => recordUnlockMoreAndOpen(pack.id, 'vault', true)}
          onTrackB2bClick={() => {
            sendAnonymousPulse('b2b_click', pack.id);
            setMeta((m) => ({
              ...m,
              telemetry: {
                ...m.telemetry,
                b2bLeadClicks: (m.telemetry.b2bLeadClicks ?? 0) + 1,
              },
            }));
          }}
          onClose={() => setVaultModalTab(null)}
        />
      )}

      {(inspectedPillar || lifelineInfoOpen) && (
        <MetricInfoModal
          pillar={inspectedPillar ?? undefined}
          currentValue={inspectedPillar ? stats[inspectedPillar.key] : 50}
          pack={pack}
          showLifelineInfo={lifelineInfoOpen}
          lifelineCharges={lifelineCharges}
          onClose={() => {
            setInspectedPillar(null);
            setLifelineInfoOpen(false);
          }}
        />
      )}

      {insightModalOpen && lastInsight && (
        <ProInsightModal
          pack={pack}
          entry={lastInsight.entry}
          wasSmartChoice={lastInsight.wasSmart}
          sessionHits={iqHits}
          sessionTotal={iqTotal}
          onClose={() => setInsightModalOpen(false)}
        />
      )}

      {activeMiniGame && (
        <DecisionMiniGameModal
          kind={activeMiniGame.kind}
          pack={pack}
          standalone={activeMiniGame.standalone}
          onComplete={handleMiniGameComplete}
        />
      )}

      {activeEnding && (
        <EndingModal
          pack={pack}
          ending={activeEnding.def}
          finalStats={stats}
          weeksSurvived={week}
          checkpointBlock={savedCheckpoint}
          attemptNumber={currentAttempt}
          isNewEnding={activeEnding.isNew}
          iqHits={iqHits}
          iqTotal={iqTotal}
          isPackFullyUnlocked={packFullyOpen}
          decisionLog={decisionLog}
          runSwipeHighlights={runSwipeHighlights}
          faceSnapshotUrl={faceSnapshotUrl}
          recordedReel={recordedReel}
          isFinalizingReel={isFinalizingReel}
          onOpenRecordedReel={() => setReelShareModalOpen(true)}
          onOpenShortsCombain={() => setShortsCombainOpen(true)}
          onOpenDuelChallenge={() => setDuelModalState({ open: true, ghost: null })}
          onStartReactionRun={() => {
            setActiveEnding(null);
            startPackRun(pack.id, savedCheckpoint, true);
            void activateSharePlaythroughMode();
          }}
          onTrackShare={() => {
            sendAnonymousPulse('share_click', pack.id);
            setMeta((m) => ({
              ...m,
              telemetry: {
                ...m.telemetry,
                sharesClicked: (m.telemetry.sharesClicked ?? 0) + 1,
              },
            }));
          }}
          onUnlockMoreFromEnding={() => {
            const curUnlocked = getUnlockedBlockForPack(meta, pack.id);
            const nextTarget: 2 | 3 = curUnlocked < 2 ? 2 : 3;
            void handlePurchaseOrUnlockBlock(pack.id, nextTarget, 'ending', () => {
              setActiveEnding(null);
              startPackRun(pack.id, nextTarget, false);
            });
          }}
          onRestartFromCheckpoint={() => startPackRun(pack.id, savedCheckpoint, true)}
          onRestartFromZero={() => startPackRun(pack.id, 1, true)}
          onSwitchPack={() => {
            setActiveEnding(null);
            setInHub(true);
          }}
          onContinueEndless={
            activeEnding.def.isVictory
              ? () => {
                  setEndlessMode(true);
                  setActiveEnding(null);
                  const { card: drawn, remQueue: q1 } = drawNextForPack(
                    pack,
                    week,
                    usedOnce,
                    scheduled,
                    true
                  );
                  const usedForNext = new Set(usedOnce);
                  usedForNext.add(drawn.id);
                  const { card: drawnNext, remQueue: q2 } = drawNextForPack(
                    pack,
                    week + 1,
                    usedForNext,
                    q1,
                    true
                  );
                  setScheduled(q2);
                  setCurrentCard(drawn);
                  setNextCard(drawnNext);
                  setCardSeq((s) => s + 1);
                }
              : undefined
          }
        />
      )}

      {museumOpen && (
        <MuseumModal pack={pack} meta={meta} onClose={() => setMuseumOpen(false)} />
      )}

      {shortsCombainOpen && (
        <ShortsCombainModal
          pack={pack}
          ending={activeEnding?.def ?? pack.endings[0]}
          finalStats={stats}
          weeksSurvived={week}
          swipes={runSwipeHighlights}
          recordedReel={recordedReel}
          faceSnapshotUrl={faceSnapshotUrl}
          liveFaceSource={shareRunActive ? (trackedCutoutCanvas ?? rawVideoEl) : null}
          hasLiveFace={Boolean(shareRunActive && (webcamStream || customPhotoUrl))}
          onRequestEnableFace={() => void activateSharePlaythroughMode()}
          onClose={() => setShortsCombainOpen(false)}
        />
      )}

      {duelModalState.open && (
        <DuelExperienceModal
          pack={getJobPack(duelModalState.ghost?.packId ?? pack.id)}
          availablePacks={SHOWCASE_PACKS}
          initialGhost={duelModalState.ghost}
          onSelectPack={(pid) => setMeta((m) => ({ ...m, selectedPackId: pid }))}
          onClose={() => setDuelModalState({ open: false, ghost: null })}
        />
      )}

      {toastMsg && (inHub || Boolean(intermission) || Boolean(activeEnding)) && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 6500,
            background: 'rgba(17, 25, 22, 0.96)',
            color: 'var(--text-light)',
            border: '1px solid rgba(200, 155, 79, 0.32)',
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {toastMsg}
        </div>
      )}

      {reelShareModalOpen && recordedReel && (
        <ReelReadyShareModal
          pack={pack}
          reel={recordedReel}
          masteryPct={computedMasteryPct}
          weeksSurvived={week}
          onOpenStoriesEditor={() => {
            setReelShareModalOpen(false);
            setShortsCombainOpen(true);
          }}
          onShared={() => {
            sendAnonymousPulse('share_click', pack.id);
            setMeta((m) => ({
              ...m,
              telemetry: {
                ...m.telemetry,
                sharesClicked: (m.telemetry.sharesClicked ?? 0) + 1,
              },
            }));
          }}
          onClose={() => setReelShareModalOpen(false)}
        />
      )}
    </div>
  );
}
