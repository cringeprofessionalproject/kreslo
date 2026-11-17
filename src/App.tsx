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
import {
  buildBlock2BossCard,
  buildEscalationDeckForPack,
  CAMPAIGN_BLOCKS,
  CAMPAIGN_TOTAL_SHIFTS,
  getBlockForWeek,
  type BlockMetaInfo,
} from './game/blockCampaignEngine';
import { getJobPack, JOB_PACKS } from './game/packs';
import { getProInsightForCard, isPackFullyUnlocked } from './game/proInsights';
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
  MetricInfoModal,
  MuseumModal,
} from './ui/Modals';
import { ProInsightModal } from './ui/PaywallAndSponsorModal';
import { CameraLocalNoticeModal, PrivacyZeroPiiModal } from './ui/PrivacyAndCameraNoticeModal';
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
  selectedPackId: 'it_product',
  bestWeeksByPack: {},
  bestIqByPack: {},
  checkpointBlockByPack: {},
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
      selectedPackId: parsed.selectedPackId ?? 'it_product',
      soundProfile: parsed.soundProfile ?? (parsed.muted ? 'off' : 'groove'),
      adUnlockedPacks: Array.isArray(parsed.adUnlockedPacks) ? parsed.adUnlockedPacks : [],
      bestIqByPack: parsed.telemetry ? (parsed.bestIqByPack ?? {}) : {},
      checkpointBlockByPack: parsed.checkpointBlockByPack ?? {},
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

    const keyframes: Keyframe[] = wasTapOrMicroFlick
      ? [
          {
            offset: 0,
            transform: `perspective(1100px) translate3d(${snapshot.fromX.toFixed(
              1
            )}px, ${snapshot.fromY.toFixed(1)}px, 0) rotate(${snapshot.fromRot.toFixed(
              2
            )}deg) rotateY(0deg) scale(1)`,
            opacity: 1,
          },
          {
            // Короткий тактильный подъём карточки со штампом выбора, чтобы глаз считал решение
            offset: 0.18,
            transform: `perspective(1100px) translate3d(${(dirSign * 34).toFixed(
              1
            )}px, -10px, 0) rotate(${(dirSign * 4.2).toFixed(2)}deg) rotateY(${(
              dirSign * 4
            ).toFixed(1)}deg) scale(1.024)`,
            opacity: 1,
          },
          {
            // Полная плотность вплоть до пересечения края экрана!
            offset: 0.74,
            transform: `perspective(1100px) translate3d(${(targetX * 0.72).toFixed(
              1
            )}px, 38px, 0) rotate(${(targetRot * 0.78).toFixed(2)}deg) rotateY(${(
              targetTiltY * 0.8
            ).toFixed(1)}deg) scale(0.985)`,
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
            transform: `perspective(1100px) translate3d(${snapshot.fromX.toFixed(
              1
            )}px, ${snapshot.fromY.toFixed(1)}px, 0) rotate(${snapshot.fromRot.toFixed(
              2
            )}deg) rotateY(${(dirSign * 3).toFixed(1)}deg) scale(1)`,
            opacity: 1,
          },
          {
            offset: 0.42,
            transform: `perspective(1100px) translate3d(${(
              snapshot.fromX +
              (targetX - snapshot.fromX) * 0.46
            ).toFixed(1)}px, ${(snapshot.fromY + 24).toFixed(1)}px, 0) rotate(${(
              snapshot.fromRot +
              (targetRot - snapshot.fromRot) * 0.48
            ).toFixed(2)}deg) rotateY(${(targetTiltY * 0.55).toFixed(1)}deg) scale(0.995)`,
            opacity: 1,
          },
          {
            offset: 0.78,
            transform: `perspective(1100px) translate3d(${(
              snapshot.fromX +
              (targetX - snapshot.fromX) * 0.82
            ).toFixed(1)}px, ${(snapshot.fromY + 56).toFixed(1)}px, 0) rotate(${(
              targetRot * 0.88
            ).toFixed(2)}deg) rotateY(${(targetTiltY * 0.88).toFixed(1)}deg) scale(0.965)`,
            opacity: 0.94,
          },
          {
            offset: 1,
            transform: `perspective(1100px) translate3d(${targetX}px, ${(
              snapshot.fromY + 96
            ).toFixed(1)}px, 0) rotate(${targetRot}deg) rotateY(${targetTiltY}deg) scale(0.92)`,
            opacity: 0,
          },
        ];

    const anim = el.animate(keyframes, {
      duration: wasTapOrMicroFlick ? 540 : 480,
      easing: 'cubic-bezier(0.3, 0.05, 0.22, 1)',
      fill: 'forwards',
    });

    anim.onfinish = () => onDone(snapshot.seq);
    return () => {
      anim.cancel();
    };
  }, [onDone, snapshot]);

  const chosenText =
    snapshot.side === 'left' ? snapshot.card.left.label : snapshot.card.right.label;

  return (
    <div
      ref={ghostRef}
      className={`dilemma-card apple-spring-card outgoing-ghost-card exit-${snapshot.side}`}
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

        <div className={`reigns-choice-curtain ${snapshot.side}`}>
          <div className={`rcc-volumetric-bar ${snapshot.side}`} style={{ width: '100%' }} />
          <div className="rcc-copy">
            <small>{snapshot.side === 'left' ? '← Выбор влево' : 'Выбор вправо →'}</small>
            <strong>{chosenText}</strong>
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

      <div className="dc-inline-choices">
        <div className={`dc-inline-side left ${snapshot.side === 'left' ? 'active' : ''}`}>
          <span>← {snapshot.card.left.label}</span>
        </div>
        <div className={`dc-inline-side right ${snapshot.side === 'right' ? 'active' : ''}`}>
          <span>{snapshot.card.right.label} →</span>
        </div>
      </div>
    </div>
  );
}

function DrawerSheet({
  pack,
  packEndingsOpen,
  activeSoundProfile,
  shareRunActive,
  unlockClicks,
  masteryPct,
  inHubMode,
  onSelectSound,
  onToggleShareRun,
  onOpenTuneFace,
  onTakeScreenshot,
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
  shareRunActive: boolean;
  unlockClicks: number;
  masteryPct: number | null;
  inHubMode?: boolean;
  onSelectSound: (p: SoundProfile) => void;
  onToggleShareRun: () => void;
  onOpenTuneFace?: () => void;
  onTakeScreenshot: () => void;
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
  const [meta, setMeta] = useState<PersistentMeta>(loadMeta);
  const pack: JobPack = useMemo(() => getJobPack(meta.selectedPackId), [meta.selectedPackId]);

  const [inHub, setInHub] = useState(true);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [hubTab, setHubTab] = useState<'jobs' | 'minigames'>('jobs');
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
  const [exitingCards, setExitingCards] = useState<ExitingCardSnapshot[]>([]);

  const [flags, setFlags] = useState<Set<string>>(() => new Set());
  const [usedOnce, setUsedOnce] = useState<Set<string>>(() => new Set());
  const [scheduled, setScheduled] = useState<QueuedEvent[]>([]);
  const bagRef = useRef<DilemmaCard[]>(shuffle(buildFullDeck(pack)));

  const [inspectedPillar, setInspectedPillar] = useState<PillarMeta | null>(null);
  const [lifelineInfoOpen, setLifelineInfoOpen] = useState(false);
  const [activeMiniGame, setActiveMiniGame] = useState<{
    kind: MiniGameKind;
    standalone: boolean;
  } | null>(null);
  const [activeEnding, setActiveEnding] = useState<{ def: EndingDef; isNew: boolean } | null>(null);
  const [endlessMode, setEndlessMode] = useState(false);
  const [museumOpen, setMuseumOpen] = useState(false);

  // Квантованный стейт предпросмотра для шкал и шторки (обновляется только при смене шага, без 120fps нагрузки на React!)
  const [swipePreview, setSwipePreview] = useState<{
    side: 'left' | 'right' | null;
    pullRatio: number;
  }>({ side: null, pullRatio: 0 });
  const lastPreviewStepRef = useRef<string>('none:0');

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
    movedMax: number;
    grabPlayed: boolean;
    lockedSide: 'left' | 'right' | null;
  } | null>(null);
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
          setReelShareModalOpen(true);
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
    await launchCameraSessionAfterConsent(false);
  }, [launchCameraSessionAfterConsent, webcamStream]);

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
      const finKeys = Object.keys(activePack.specialCards).filter((k) => k.includes('_20'));

      if (nextWeek === 12 && midKeys[0]) {
        return {
          card: prepareBalancedCard(activePack.specialCards[midKeys[0]]),
          remQueue: nextQueue,
        };
      }
      if (nextWeek === 24 && !isEndless) {
        return { card: prepareBalancedCard(buildBlock2BossCard(activePack)), remQueue: nextQueue };
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
      back1ElRef.current.style.transform = 'translate3d(0px, 10px, 0px) scale(0.94)';
      back1ElRef.current.style.opacity = '0.82';
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
      setInsightModalOpen(false);
      setIntermission(null);
      setFlags(new Set());
      setUsedOnce(new Set());
      setScheduled([]);
      setActiveEnding(null);
      setActiveMiniGame(null);
      setEndlessMode(false);
      setMenuDrawerOpen(false);
      setExitingCards([]);
      resetCardDomTransformImmediate();

      if (startBlock === 1 && nextAttempt === 1 && p.onboardingCards[0]) {
        setCurrentCard(prepareBalancedCard(p.onboardingCards[0]));
      } else {
        const { card } = drawNextForPack(p, initialWeek, new Set(), [], false);
        setCurrentCard(card);
      }
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
        setReactionMood(
          wasSmart ? { tone: 'good', label: 'НОРМА ✓' } : { tone: 'warn', label: 'ЛОВУШКА!' }
        );
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
      if (enteredRedZone && !cardInsight) {
        setReactionMood({ tone: 'warn', label: 'ОПАСНОСТЬ' });
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

      let endDef: EndingDef | undefined;
      for (const k of ['s1', 's2', 's3', 's4'] as StatKey[]) {
        if (nextStats[k] <= 0) {
          endDef = pack.endings.find((e) => e.stat === k && e.extreme === 'low');
          break;
        }
        if (nextStats[k] >= 100) {
          endDef = pack.endings.find((e) => e.stat === k && e.extreme === 'high');
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

      // МГНОВЕННО проявляем следующую карточку снизу колоды с бархатной анимацией всплытия!
      const { card: drawn, remQueue } = drawNextForPack(
        pack,
        nextWeek,
        nextUsed,
        nextQ,
        endlessMode
      );
      setFlags(nextFlags);
      setUsedOnce(nextUsed);
      setScheduled(remQueue);
      setWeek(nextWeek);
      setCurrentCard(drawn);
      setCardSeq((s) => s + 1);

      if (justClearedBlock1) {
        window.setTimeout(() => {
          sfxVictory();
          setLifelineCharges((c) => Math.min(3, c + 1));
          setIntermission({
            clearedBlock: CAMPAIGN_BLOCKS[0],
            nextBlock: CAMPAIGN_BLOCKS[1],
          });
        }, 260);
        return;
      }
      if (justClearedBlock2) {
        window.setTimeout(() => {
          sfxVictory();
          setLifelineCharges((c) => Math.min(3, c + 1));
          setIntermission({
            clearedBlock: CAMPAIGN_BLOCKS[1],
            nextBlock: CAMPAIGN_BLOCKS[2],
          });
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
      setToastMsg('Показатели выровнены · +1 к резерву');
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

    const inlineSideEl = targetEl?.closest('[data-inline-choice]') as HTMLElement | null;
    const inlineSide =
      (inlineSideEl?.getAttribute('data-inline-choice') as 'left' | 'right' | null) ?? null;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // Останавливаем текущую анимацию возврата на карточке, если она была
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
      movedMax: 0,
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
    }

    const pull = Math.min(1, Math.max(0, (Math.abs(rawDx) - 6) / 64));
    if (back1ElRef.current) {
      back1ElRef.current.style.transform = `translate3d(0px, ${(11 * (1 - pull)).toFixed(
        1
      )}px, 0px) scale(${(0.945 + pull * 0.05).toFixed(3)})`;
      back1ElRef.current.style.opacity = (0.78 + pull * 0.22).toFixed(2);
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

    const { dx, dy, rot, vx, inlineBtnSide, movedMax } = drag;

    // Если пользователь просто коротко тапнул по нижней левой/правой подписи на карточке (< 7px)
    if (movedMax < 7 && inlineBtnSide) {
      commitChoice(inlineBtnSide, { fromX: 0, fromY: 0, fromRot: 0 });
      return;
    }

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

  const fullBalancedDeltas: StatDelta = useMemo(() => {
    if (!activePreviewSide) return {};
    const opt = activePreviewSide === 'left' ? currentCard.left : currentCard.right;
    return computeBalancedEffects(opt.effects, stats, mult);
  }, [activePreviewSide, currentCard.left, currentCard.right, mult, stats]);

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

  return (
    <div
      className="reigns-shell"
      onTouchStart={onShellEdgeTouchStart}
      onTouchEnd={onShellEdgeTouchEnd}
    >
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

      {/* КОМПАКТНАЯ ЮВЕЛИРНАЯ ПАНЕЛЬ 4 ПОКАЗАТЕЛЕЙ (ОСВОБОЖДАЕТ ПРОСТРАНСТВО ПОД ГЛАВНУЮ КАРТОЧКУ!) */}
      <section className="pillars-bar compact-jewel-pillars">
        {pack.pillars.map((pil) => {
          const val = stats[pil.key];
          const fullDelta = fullBalancedDeltas[pil.key] ?? 0;
          const prog = getProgressivePreview(val, fullDelta, pullRatio);
          const justChanged = poppingDeltas.deltas[pil.key] ?? 0;
          const danger = val <= 20 || val >= 84;
          const willCrash = prog.active && (prog.finalValue <= 0 || prog.finalValue >= 100);

          return (
            <button
              key={pil.key}
              type="button"
              className={`pillar-col clickable-pillar compact-pillar-pill ${
                danger ? 'danger-pulse' : ''
              } ${prog.active ? (prog.displayDelta > 0 ? 'preview-up' : 'preview-down') : ''} ${
                willCrash ? 'preview-crash-warn' : ''
              }`}
              onClick={() => {
                sfxUiTap();
                setInspectedPillar(pil);
              }}
            >
              <div className="pillar-vessel">
                <div
                  className={`pillar-fill ${danger ? 'critical' : ''}`}
                  style={{ height: `${val}%` }}
                />
                <span className="pillar-svg-wrap">
                  <PillarSvgIcon packId={pack.id} statKey={pil.key} size={15} />
                </span>
              </div>

              <div className="pillar-meta-stack">
                <div className="delta-badge-slot">
                  {prog.active ? (
                    <span
                      className={`preview-num clean-delta ${
                        prog.displayDelta > 0 ? 'plus' : 'minus'
                      }`}
                    >
                      {prog.displayDelta > 0 ? `+${prog.displayDelta}` : prog.displayDelta}
                    </span>
                  ) : justChanged !== 0 ? (
                    <span
                      key={`${poppingDeltas.seq}_${pil.key}`}
                      className={`floating-delta ${justChanged > 0 ? 'plus' : 'minus'}`}
                    >
                      {justChanged > 0 ? `+${justChanged}` : justChanged}
                    </span>
                  ) : (
                    <span className="pillar-val-top">{val}%</span>
                  )}
                </div>

                <div className="pillar-caption">
                  <span>{pil.label}</span>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* СТАБИЛЬНЫЙ СЛОТ КОНТЕКСТА (36px): ИСКЛЮЧАЕТ ЛЮБЫЕ ВЕРТИКАЛЬНЫЕ ПРЫЖКИ КАРТОЧКИ! */}
      <div className="context-ticker-slot">
        {incomingSms ? (
          <div className="organic-sms-banner">
            <div className="osb-dot" />
            <button type="button" className="osb-main" onClick={handleOpenIncomingSms}>
              <div className="osb-top-line">
                <strong>{incomingSms.sender}</strong>
                <span className="osb-reward">+Резерв</span>
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
        ) : toastMsg ? (
          <div className="mission-ribbon coffee-lit">{toastMsg}</div>
        ) : lastInsight ? (
          <button
            type="button"
            className={`pro-insight-bar ${lastInsight.wasSmart ? 'smart' : 'trap'}`}
            onClick={() => setInsightModalOpen(true)}
          >
            <span className="pib-tag">{lastInsight.wasSmart ? 'НОРМА' : 'ЛОВУШКА'}</span>
            <span className="pib-text">{lastInsight.entry.shortFact}</span>
            <span className="pib-more">↗</span>
          </button>
        ) : (
          <div className="quiet-shift-subtitle">
            <span>{curBlock.title} · Смахните карточку влево или вправо</span>
          </div>
        )}
      </div>

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
          <div ref={back1ElRef} className="deck-back back-1" />

          {/* Активная входящая карточка: плавно проявляется и всплывает из глубины колоды */}
          <div
            key={cardSeq}
            ref={activeCardElRef}
            className={`dilemma-card apple-spring-card ${
              cardSeq > 1 ? 'velvet-card-appear' : ''
            } ${
              activePreviewSide === 'left'
                ? 'tilted-left'
                : activePreviewSide === 'right'
                  ? 'tilted-right'
                  : ''
            }`}
          >
            <div ref={portraitAreaRef} className="dc-portrait-area">
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

              {activePreviewSide && (
                <div
                  className={`reigns-choice-curtain ${activePreviewSide}`}
                  style={{ opacity: Math.min(1, 0.38 + pullRatio * 0.62) }}
                >
                  <div
                    className={`rcc-volumetric-bar ${activePreviewSide}`}
                    style={{ width: `${Math.round(Math.max(18, pullRatio * 100))}%` }}
                  />
                  <div className="rcc-copy">
                    <small>
                      {activePreviewSide === 'left' ? '← Выбор влево' : 'Выбор вправо →'}
                    </small>
                    <strong>
                      {activePreviewSide === 'left'
                        ? currentCard.left.label
                        : currentCard.right.label}
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

            {/* Нижние зоны ответа не блокируют свайп пальцем — и тянутся, и нажимаются! */}
            <div className="dc-inline-choices">
              <button
                type="button"
                data-inline-choice="left"
                className={`dc-inline-side left ${activePreviewSide === 'left' ? 'active' : ''}`}
              >
                <div
                  className="dc-inline-fill left-dir"
                  style={{
                    width: activePreviewSide === 'left' ? `${Math.round(pullRatio * 100)}%` : '0%',
                  }}
                />
                <span>← {currentCard.left.label}</span>
              </button>

              <button
                type="button"
                data-inline-choice="right"
                className={`dc-inline-side right ${activePreviewSide === 'right' ? 'active' : ''}`}
              >
                <div
                  className="dc-inline-fill right-dir"
                  style={{
                    width: activePreviewSide === 'right' ? `${Math.round(pullRatio * 100)}%` : '0%',
                  }}
                />
                <span>{currentCard.right.label} →</span>
              </button>
            </div>
          </div>

          {/* Улетающая предыдущая карточка (летит независимо поверх проявляющейся новой) */}
          {exitingCards.map((snap) => (
            <OutgoingCardGhost key={snap.seq} snapshot={snap} onDone={removeExitingGhost} />
          ))}
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

      {/* СПОКОЙНЫЙ МИНИМАЛИСТИЧНЫЙ ПОДВАЛ */}
      <footer className="minimal-bottom-dock">
        <button
          type="button"
          disabled={lifelineCharges <= 0}
          className={`slim-lifeline-pill ${lifelineCharges > 0 ? 'ready' : ''}`}
          onClick={useLifeline}
        >
          <div className="slp-dots">
            {[0, 1, 2].map((idx) => (
              <span key={idx} className={idx < lifelineCharges ? 'on' : ''} />
            ))}
          </div>
          <span className="slp-title">{pack.lifelineName}</span>
        </button>

        <button
          type="button"
          className="slim-lifeline-help"
          onClick={() => setLifelineInfoOpen(true)}
          aria-label="Справка о резерве"
        >
          ?
        </button>
      </footer>

      {menuDrawerOpen && (
        <DrawerSheet
          pack={pack}
          packEndingsOpen={packEndingsOpen}
          activeSoundProfile={activeSoundProfile}
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
            <div className="apple-hub-header">
              <div className="ahh-titles">
                <span className="ahh-eyebrow">Симулятор решений</span>
                <h1 className="ahh-large-title">Кресло</h1>
              </div>

              <div className="ahh-actions">
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

            {/* Лаконичный переключатель iOS Segmented Control */}
            <div className="ios-segmented-control" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={hubTab === 'jobs'}
                className={hubTab === 'jobs' ? 'active' : ''}
                onClick={() => setHubTab('jobs')}
              >
                Специальности
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={hubTab === 'minigames'}
                className={hubTab === 'minigames' ? 'active' : ''}
                onClick={() => setHubTab('minigames')}
              >
                Блиц-ситуации
              </button>
            </div>

            {hubTab === 'jobs' ? (
              <div className="apple-cards-scroll">
                {JOB_PACKS.map((jp) => {
                  const best = meta.bestWeeksByPack[jp.id] ?? 0;
                  const bestMastery = meta.bestIqByPack[jp.id] ?? 0;
                  const ckpt = meta.checkpointBlockByPack[jp.id] ?? 1;
                  const fullyUnlocked = isPackFullyUnlocked(meta, jp.id);
                  const isCurrent = meta.selectedPackId === jp.id;

                  return (
                    <div
                      key={jp.id}
                      className={`apple-pack-row ${isCurrent ? 'is-selected' : ''}`}
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

                      {ckpt > 1 && fullyUnlocked && (
                        <button
                          type="button"
                          className="apr-ckpt-pill"
                          onClick={() => startPackRun(jp.id, ckpt, false)}
                        >
                          Блок {ckpt === 2 ? 'II' : 'III'} →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="apple-cards-scroll">
                <div className="ios-context-chips">
                  {JOB_PACKS.map((jp) => (
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

      {camNoticeOpen && (
        <CameraLocalNoticeModal
          onConfirmLiveCamera={(withMic) => {
            try {
              localStorage.setItem(CAM_NOTICE_ACK_KEY, '1');
            } catch {
              // ignore
            }
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
          isNextBlockUnlocked={packFullyOpen}
          onContinueNextBlock={() => {
            setIntermission(null);
            sfxCardFlip();
          }}
          onUnlockMoreAndContinue={() => {
            recordUnlockMoreAndOpen(pack.id, 'intermission', false);
            setIntermission(null);
            sfxVictory();
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
          faceSnapshotUrl={faceSnapshotUrl}
          recordedReel={recordedReel}
          isFinalizingReel={isFinalizingReel}
          onOpenRecordedReel={() => setReelShareModalOpen(true)}
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
          onUnlockMoreFromEnding={() => recordUnlockMoreAndOpen(pack.id, 'ending', false)}
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
                  const { card: drawn, remQueue } = drawNextForPack(
                    pack,
                    week,
                    usedOnce,
                    scheduled,
                    true
                  );
                  setScheduled(remQueue);
                  setCurrentCard(drawn);
                  setCardSeq((s) => s + 1);
                }
              : undefined
          }
        />
      )}

      {museumOpen && (
        <MuseumModal pack={pack} meta={meta} onClose={() => setMuseumOpen(false)} />
      )}

      {reelShareModalOpen && recordedReel && (
        <ReelReadyShareModal
          pack={pack}
          reel={recordedReel}
          masteryPct={computedMasteryPct}
          weeksSurvived={week}
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
