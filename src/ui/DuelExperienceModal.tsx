import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  initSound,
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
} from '../audio';
import { computeBalancedEffects } from '../game/balanceMath';
import { getChoiceShortGist } from '../game/choiceErgonomics';
import {
  buildDeterministicDuelDeck,
  buildDuelSharePayload,
  DUEL_BLITZ_LENGTH,
  DUEL_DAMAGE_MULT,
  type DuelGhostData,
} from '../game/duelMode';
import {
  getGachaSaveStarsPrice,
  isRunningInsideTelegramMiniApp,
  openTelegramDeepLinkOutsideTma,
  openTelegramStarsSaveCheckout,
  shareLinkViaTelegramOrNative,
} from '../game/telegramStars';
import type { DilemmaCard, JobPack, PackId, StatDelta, StatKey, Stats } from '../types';
import { EditorialCardPortrait } from './CharacterArt';
import { IconGrid, PillarSvgIcon } from './Icons';
import { SceneBackdrop } from './SceneBackdrop';

interface DuelExperienceModalProps {
  pack: JobPack;
  availablePacks: JobPack[];
  initialGhost: DuelGhostData | null;
  onSelectPack: (packId: JobPack['id']) => void;
  onClose: () => void;
}

interface DuelHistoryStep {
  idx: number;
  speaker: string;
  mySide: 'L' | 'R';
  myLabel: string;
  oppSide?: 'L' | 'R';
}

interface ExitingDuelSnapshot {
  seq: number;
  card: DilemmaCard;
  packId: PackId;
  side: 'left' | 'right';
  fromX: number;
  fromY: number;
  fromRot: number;
}

const SWIPE_THRESHOLD = 86;

function OutgoingDuelCardGhost({
  snapshot,
  onDone,
}: {
  snapshot: ExitingDuelSnapshot;
  onDone: (seq: number) => void;
}) {
  const ghostRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ghostRef.current;
    if (!el) return;
    const dirSign = snapshot.side === 'left' ? -1 : 1;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 430;
    const exitDist = Math.max(560, Math.round(vw * 1.22));
    const targetX = dirSign * exitDist;
    const targetRot = dirSign * 24;
    const wasTap = Math.abs(snapshot.fromX) < 22;

    const keyframes: Keyframe[] = wasTap
      ? [
          {
            offset: 0,
            transform: `perspective(1100px) translate3d(0px, 0px, 0) rotate(0deg) scale(1)`,
            opacity: 1,
          },
          {
            offset: 0.18,
            transform: `perspective(1100px) translate3d(${dirSign * 30}px, -8px, 0) rotate(${dirSign * 4}deg) scale(1.02)`,
            opacity: 1,
          },
          {
            offset: 1,
            transform: `perspective(1100px) translate3d(${targetX}px, 88px, 0) rotate(${targetRot}deg) scale(0.93)`,
            opacity: 0,
          },
        ]
      : [
          {
            offset: 0,
            transform: `perspective(1100px) translate3d(${snapshot.fromX.toFixed(1)}px, ${snapshot.fromY.toFixed(1)}px, 0) rotate(${snapshot.fromRot.toFixed(2)}deg) scale(1)`,
            opacity: 1,
          },
          {
            offset: 1,
            transform: `perspective(1100px) translate3d(${targetX}px, ${(snapshot.fromY + 90).toFixed(1)}px, 0) rotate(${targetRot}deg) scale(0.93)`,
            opacity: 0,
          },
        ];

    const anim = el.animate(keyframes, {
      duration: wasTap ? 500 : 440,
      easing: 'cubic-bezier(0.3, 0.05, 0.22, 1)',
      fill: 'forwards',
    });
    anim.onfinish = () => onDone(snapshot.seq);
    return () => anim.cancel();
  }, [onDone, snapshot]);

  const chosenText =
    snapshot.side === 'left' ? snapshot.card.left.label : snapshot.card.right.label;

  return (
    <div
      ref={ghostRef}
      className={`dilemma-card apple-spring-card outgoing-ghost-card card-tier-foil exit-${snapshot.side}`}
    >
      <div className="dc-portrait-area">
        <EditorialCardPortrait
          packId={snapshot.packId}
          cardId={snapshot.card.id}
          speaker={snapshot.card.speaker}
          blockNum={2}
        />
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

export function DuelExperienceModal({
  pack,
  availablePacks,
  initialGhost,
  onSelectPack,
  onClose,
}: DuelExperienceModalProps) {
  const [seed, setSeed] = useState<number>(
    () => initialGhost?.seed ?? Math.floor(100000 + Math.random() * 899999)
  );
  const [ghost, setGhost] = useState<DuelGhostData | null>(initialGhost);
  const [step, setStep] = useState<number>(0);
  const [cardSeq, setCardSeq] = useState<number>(1);
  const [stats, setStats] = useState<Stats>({ s1: 50, s2: 50, s3: 50, s4: 50 });
  const [statsExpanded, setStatsExpanded] = useState<boolean>(false);
  const [poppingDeltas, setPoppingDeltas] = useState<{ seq: number; deltas: StatDelta }>({
    seq: 0,
    deltas: {},
  });
  const [myMoves, setMyMoves] = useState<Array<'L' | 'R'>>([]);
  const [history, setHistory] = useState<DuelHistoryStep[]>([]);
  const [deadAtStep, setDeadAtStep] = useState<number | null>(null);
  const [turnNote, setTurnNote] = useState<string | null>(null);
  const [savesUsed, setSavesUsed] = useState<number>(0);
  const [copiedNote, setCopiedNote] = useState<string | null>(null);

  const [previewSide, setPreviewSide] = useState<'left' | 'right' | null>(null);
  const [pinnedSide, setPinnedSide] = useState<'left' | 'right' | null>(null);
  const [pullRatio, setPullRatio] = useState<number>(0);
  const [exitingCards, setExitingCards] = useState<ExitingDuelSnapshot[]>([]);

  const activeCardElRef = useRef<HTMLDivElement | null>(null);
  const backElRef = useRef<HTMLDivElement | null>(null);
  const noteTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    captured: boolean;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    lockedThreshold: boolean;
    lastTickBucket: number;
  }>({
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

  const deck = useMemo(() => buildDeterministicDuelDeck(pack, seed), [pack, seed]);
  const isFinished = deadAtStep !== null || step >= deck.length;
  const activeCard = !isFinished ? deck[step] : null;
  const nextCard = !isFinished && step + 1 < deck.length ? deck[step + 1] : null;
  const proofCard = useMemo(() => deck.find((c) => c.realCase), [deck]);

  const tgFirstName = useMemo(() => {
    if (typeof window === 'undefined') return 'Игрок';
    const u = (
      window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { user?: { first_name?: string } } } };
      }
    ).Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
    return u?.trim() || 'Соперник';
  }, []);

  const activeRevealSide = previewSide ?? pinnedSide;
  const revealShownSide: 'left' | 'right' = activeRevealSide ?? 'left';

  const previewDeltas = useMemo<StatDelta>(() => {
    if (!activeCard || !activeRevealSide) return {};
    const opt = activeRevealSide === 'left' ? activeCard.left : activeCard.right;
    const raw = computeBalancedEffects(opt.effects, stats, 2);
    const out: StatDelta = {};
    (['s1', 's2', 's3', 's4'] as StatKey[]).forEach((k) => {
      out[k] = Math.round((raw[k] ?? 0) * DUEL_DAMAGE_MULT);
    });
    return out;
  }, [activeCard, activeRevealSide, stats]);

  const removeExitingGhost = useCallback((seq: number) => {
    setExitingCards((prev) => prev.filter((item) => item.seq !== seq));
  }, []);

  const resetFreshMatch = (keepGhost: boolean) => {
    sfxCardFlip();
    if (!keepGhost) {
      setGhost(null);
      setSeed(Math.floor(100000 + Math.random() * 899999));
    }
    setStep(0);
    setCardSeq((s) => s + 1);
    setStats({ s1: 50, s2: 50, s3: 50, s4: 50 });
    setMyMoves([]);
    setHistory([]);
    setDeadAtStep(null);
    setTurnNote(null);
    setPreviewSide(null);
    setPinnedSide(null);
    setPullRatio(0);
    setSavesUsed(0);
    setCopiedNote(null);
  };

  const commitCardChoice = (
    sideKey: 'left' | 'right',
    motion: { fromX: number; fromY: number; fromRot: number }
  ) => {
    if (!activeCard) return;
    const moveCode: 'L' | 'R' = sideKey === 'left' ? 'L' : 'R';
    sfxSwipeCommit(sideKey);
    vibrate(12);

    const seqNow = cardSeq;
    setExitingCards((prev) => [
      ...prev.slice(-2),
      {
        seq: seqNow,
        card: activeCard,
        packId: pack.id,
        side: sideKey,
        fromX: motion.fromX,
        fromY: motion.fromY,
        fromRot: motion.fromRot,
      },
    ]);

    const opt = sideKey === 'left' ? activeCard.left : activeCard.right;
    const rawFx = computeBalancedEffects(opt.effects, stats, 2);
    const appliedDeltas: StatDelta = {};
    const nextStats: Stats = { ...stats };
    let died = false;

    (['s1', 's2', 's3', 's4'] as StatKey[]).forEach((k) => {
      const d = Math.round((rawFx[k] ?? 0) * DUEL_DAMAGE_MULT);
      appliedDeltas[k] = d;
      nextStats[k] = Math.max(0, Math.min(100, nextStats[k] + d));
      if (nextStats[k] <= 0 || nextStats[k] >= 100) died = true;
    });

    const oppMove = ghost && step < ghost.moves.length ? ghost.moves[step] : undefined;
    const oppDiedHere = ghost && ghost.survivedCount === step;

    setStats(nextStats);
    setPoppingDeltas((p) => ({ seq: p.seq + 1, deltas: appliedDeltas }));
    setMyMoves((prev) => [...prev, moveCode]);
    setHistory((prev) => [
      ...prev,
      {
        idx: step,
        speaker: activeCard.speaker,
        mySide: moveCode,
        myLabel: getChoiceShortGist(opt.label),
        oppSide: oppMove,
      },
    ]);

    setPreviewSide(null);
    setPinnedSide(null);
    setPullRatio(0);

    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);

    if (died) {
      sfxGameOver();
      setDeadAtStep(step);
      return;
    }

    if (oppDiedHere) {
      setTurnNote(`На этом ходу ${ghost.challengerName} выбыл — вы удержали баланс`);
    } else if (oppMove && oppMove === moveCode) {
      setTurnNote(`Ход совпал с выбором соперника (${ghost?.challengerName})`);
    } else if (oppMove) {
      setTurnNote(`Решения разошлись: ${ghost?.challengerName} выбрал другой ход`);
    } else {
      setTurnNote(null);
    }

    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => setTurnNote(null), 2100);

    const nextStep = step + 1;
    if (nextStep >= deck.length) {
      sfxVictory();
    }
    setStep(nextStep);
    setCardSeq((s) => s + 1);
  };

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
      cardEl.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
      cardEl.style.transform = '';
    }
    const backEl = backElRef.current;
    if (backEl) {
      const plane = backEl.querySelector('.dc-focus-plane') as HTMLElement | null;
      if (plane) plane.style.filter = '';
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isFinished || !activeCard) return;
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
        setPinnedSide(null);
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
      return;
    }

    // Короткое нажатие по кнопке выбора или открытой плашке полного текста
    if (!d.captured || Math.hypot(d.dx, d.dy) < 8) {
      const target = e.target as HTMLElement | null;
      const revealTap = target?.closest('[data-duel-reveal-commit="true"]');
      if (revealTap && pinnedSide) {
        commitCardChoice(pinnedSide, { fromX: 0, fromY: 0, fromRot: 0 });
        return;
      }
      const btn = target?.closest('button[data-inline-choice]') as HTMLButtonElement | null;
      const btnSide = btn?.getAttribute('data-inline-choice') as 'left' | 'right' | null;
      if (btnSide) {
        sfxUiTap();
        if (pinnedSide === btnSide) {
          commitCardChoice(btnSide, { fromX: 0, fromY: 0, fromRot: 0 });
        } else {
          setPinnedSide(btnSide);
        }
        return;
      }
      if (pinnedSide) {
        setPinnedSide(null);
      }
    }

    if (Math.abs(d.dx) > 14) sfxCardSnapBack();
    setPreviewSide(null);
    setPullRatio(0);
    resetDragDom();
  };

  const handlePaidClutchContinue = async () => {
    const price = getGachaSaveStarsPrice(savesUsed);
    if (!isRunningInsideTelegramMiniApp()) {
      openTelegramDeepLinkOutsideTma();
      return;
    }
    const res = await openTelegramStarsSaveCheckout(savesUsed);
    if (res !== 'paid') return;

    sfxCoffeeSave();
    vibrate([16, 28, 18]);
    const healed: Stats = { ...stats };
    (['s1', 's2', 's3', 's4'] as StatKey[]).forEach((k) => {
      if (healed[k] <= 0) healed[k] = 38;
      if (healed[k] >= 100) healed[k] = 62;
    });
    setStats(healed);
    setSavesUsed((n) => n + 1);
    const resumeIdx = (deadAtStep ?? 0) + 1;
    setDeadAtStep(null);
    setStep(resumeIdx);
    setCardSeq((s) => s + 1);
    setCopiedNote(`Кресло удержано (${price} ★)`);
  };

  const buildCurrentSharePayload = () => {
    const mySurv = deadAtStep !== null ? deadAtStep : deck.length;
    const myData: DuelGhostData = {
      packId: pack.id,
      seed,
      moves: myMoves,
      survivedCount: mySurv,
      challengerName: tgFirstName,
    };
    return buildDuelSharePayload(myData, pack.shortTitle);
  };

  const handleSendTelegramChallenge = () => {
    sfxUiTap();
    const { url, text } = buildCurrentSharePayload();
    if (!shareLinkViaTelegramOrNative(url, text)) {
      void navigator.clipboard?.writeText(`${text}\n${url}`);
      setCopiedNote('Telegram-ссылка на расклад скопирована');
    }
  };

  const handleCopyWebDuelLink = () => {
    sfxUiTap();
    const { webUrl } = buildCurrentSharePayload();
    void navigator.clipboard?.writeText(webUrl);
    setCopiedNote('Прямая Web-ссылка на этот расклад скопирована');
  };

  const mySurvived = deadAtStep !== null ? deadAtStep : step;
  const savePrice = getGachaSaveStarsPrice(savesUsed);
  const duelDanger =
    stats.s1 <= 20 ||
    stats.s1 >= 84 ||
    stats.s2 <= 20 ||
    stats.s2 >= 84 ||
    stats.s3 <= 20 ||
    stats.s3 >= 84 ||
    stats.s4 <= 20 ||
    stats.s4 >= 84;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3100,
        background: 'var(--bg-canvas)',
        transition: 'background-color 420ms ease',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div className={`reigns-shell ${isFinished ? 'sc-completed-shell' : 'sc-active-runner'}`}>
        <SceneBackdrop packId={pack.id} blockNum={2} inDanger={!isFinished && duelDanger} />
        <header className="top-bar unified-bar">
          <button
            type="button"
            data-no-drag="1"
            className="hb-pill hb-pack-pill"
            onClick={() => {
              sfxUiTap(true);
              onClose();
            }}
          >
            <IconGrid size={15} />
            <span className="hb-pack-name">Дуэль · {pack.shortTitle}</span>
            {!isFinished && (
              <span className="hb-shift-num">
                {String(step + 1).padStart(2, '0')}/{String(DUEL_BLITZ_LENGTH).padStart(2, '0')}
              </span>
            )}
          </button>

          <div className="hb-right-group">
            <span
              className="sc-top-badge"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                opacity: 0.78,
              }}
            >
              #{seed}
            </span>
            <button
              type="button"
              data-no-drag="1"
              className="hb-circle-btn"
              onClick={() => {
                sfxUiTap();
                onClose();
              }}
              aria-label="Закрыть дуэль"
            >
              ×
            </button>
          </div>
        </header>

        {!isFinished && activeCard ? (
          <>
            {/* 6 сегментов блиц-расклада */}
            <div className="sc-ten-segments">
              {deck.map((c, idx) => (
                <div
                  key={c.id}
                  className={`sc-seg-dot ${idx < step ? 'done' : idx === step ? 'cur' : ''}`}
                />
              ))}
            </div>

            {/* Штатная полоска 4 показателей КРЕСЛА с предпросмотром сдвига ×1.65 */}
            <section
              className={`stat-strip ${statsExpanded ? 'expanded' : ''} ${
                activeRevealSide ? 'previewing' : ''
              }`}
            >
              <button
                type="button"
                data-no-drag="1"
                className="ss-row"
                aria-expanded={statsExpanded}
                onClick={() => {
                  sfxUiTap();
                  setStatsExpanded((v) => !v);
                }}
              >
                {pack.pillars.map((pil) => {
                  const val = stats[pil.key];
                  const fullDelta = previewDeltas[pil.key] ?? 0;
                  const justChanged = poppingDeltas.deltas[pil.key] ?? 0;
                  const danger = val <= 20 || val >= 84;
                  const impact =
                    activeRevealSide && fullDelta !== 0
                      ? Math.abs(fullDelta) >= 12
                        ? 'big'
                        : 'small'
                      : null;
                  const impactDir =
                    activeRevealSide && fullDelta !== 0 ? (fullDelta > 0 ? 'up' : 'down') : null;
                  const projected = Math.max(0, Math.min(100, val + fullDelta));
                  const willCrash = Boolean(impact) && (projected <= 0 || projected >= 100);

                  return (
                    <span
                      key={pil.key}
                      className={`ss-item ${danger ? 'danger' : ''} ${
                        willCrash ? 'crash-warn' : ''
                      } ${impactDir ? `impact-${impactDir}` : ''}`}
                    >
                      <span
                        key={justChanged !== 0 ? `d_chg_${poppingDeltas.seq}` : 'still'}
                        className={`ss-ico ${
                          justChanged > 0 ? 'bump-up' : justChanged < 0 ? 'bump-down' : ''
                        }`}
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
                    {pack.pillars.map((pil) => {
                      const val = stats[pil.key];
                      const danger = val <= 20 || val >= 84;
                      return (
                        <div key={pil.key} className={`ss-detail ${danger ? 'danger' : ''}`}>
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
                        </div>
                      );
                    })}
                  </div>
                  <p className="ss-details-note">
                    Блиц-режим: 6 общих карт по единому коду расклада, шаг показателей ×1.65.
                  </p>
                </div>
              </div>
            </section>

            {/* Выбор колоды на 1-м ходу (если создаём новый вызов) или статус соперника */}
            {!ghost && step === 0 ? (
              <div
                className="ios-context-chips"
                style={{ padding: '4px 14px 6px', flexShrink: 0 }}
              >
                {availablePacks.map((ap) => (
                  <button
                    key={ap.id}
                    type="button"
                    data-no-drag="1"
                    className={ap.id === pack.id ? 'on' : ''}
                    onClick={() => {
                      sfxUiTap();
                      onSelectPack(ap.id);
                      setSeed(Math.floor(100000 + Math.random() * 899999));
                    }}
                  >
                    {ap.shortTitle}
                  </button>
                ))}
              </div>
            ) : (
              <div className="context-ticker-slot">
                {turnNote ? (
                  <div className="mission-ribbon coffee-lit">{turnNote}</div>
                ) : ghost ? (
                  <div className="sc-semantics-ribbon">
                    <span>
                      {ghost.survivedCount === step
                        ? `На этой карточке ${ghost.challengerName} выбыл`
                        : step < ghost.survivedCount
                          ? `Соперник (${ghost.challengerName}): ход скрыт до выбора`
                          : `Результат ${ghost.challengerName} (${ghost.survivedCount}/6) уже превзойдён`}
                    </span>
                    <span className="sem-dot">·</span>
                    <span>
                      Цель {ghost.survivedCount}/{DUEL_BLITZ_LENGTH}
                    </span>
                  </div>
                ) : (
                  <div className="sc-semantics-ribbon">
                    <span>Расклад #{seed}</span>
                    <span className="sem-dot">·</span>
                    <span>Урон ×1.65 · после 6 карт откроется ссылка вызова</span>
                  </div>
                )}
              </div>
            )}

            {/* Родная 120Hz сцена карточки КРЕСЛА */}
            <main
              className="card-stage spacious-stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <div className="deck-stack-wrapper">
                <div className="deck-back back-2" />

                {nextCard && (
                  <div
                    key={`duel_under_${cardSeq}`}
                    ref={backElRef}
                    className="dilemma-card apple-spring-card blurred-next-underlay card-tier-foil"
                    aria-hidden="true"
                  >
                    <div className="dc-focus-plane">
                      <div className="dc-portrait-area">
                        <EditorialCardPortrait
                          packId={pack.id}
                          cardId={nextCard.id}
                          speaker={nextCard.speaker}
                          blockNum={2}
                        />
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
                )}

                <div
                  key={`duel_cur_${cardSeq}`}
                  ref={activeCardElRef}
                  className={`dilemma-card apple-spring-card fresh-card card-tier-foil ${
                    cardSeq > 1 ? 'rack-focus-appear' : ''
                  } ${
                    previewSide === 'left'
                      ? 'tilted-left'
                      : previewSide === 'right'
                        ? 'tilted-right'
                        : ''
                  }`}
                >
                  <div className="dc-focus-plane">
                    <div className="dc-portrait-area">
                      <span className="dc-tier-badge foil">
                        ДУЭЛЬ · {step + 1}/{DUEL_BLITZ_LENGTH}
                      </span>
                      <EditorialCardPortrait
                        packId={pack.id}
                        cardId={activeCard.id}
                        speaker={activeCard.speaker}
                        blockNum={2}
                      />
                    </div>

                    <div className="dc-speaker-bar">
                      <strong>{activeCard.speaker}</strong>
                      <span>{activeCard.role}</span>
                    </div>

                    <div className="dc-question-body">
                      <p>{activeCard.text}</p>
                    </div>

                    <div
                      className={`dc-inline-choices ${
                        activeRevealSide ? `revealing-${activeRevealSide}` : ''
                      }`}
                    >
                      {(['left', 'right'] as const).map((sideKey) => {
                        const opt = sideKey === 'left' ? activeCard.left : activeCard.right;
                        return (
                          <button
                            key={sideKey}
                            type="button"
                            data-inline-choice={sideKey}
                            className={`dc-inline-side ${sideKey} ${
                              activeRevealSide === sideKey ? 'active' : ''
                            }`}
                            onClick={(ev) => {
                              if (ev.detail !== 0) return;
                              if (pinnedSide === sideKey) {
                                commitCardChoice(sideKey, { fromX: 0, fromY: 0, fromRot: 0 });
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

                  <div
                    className={`choice-reveal ${revealShownSide} ${
                      activeRevealSide ? 'open' : ''
                    } ${pullRatio >= 1 || pinnedSide ? 'armed' : ''} ${
                      pinnedSide ? 'tappable' : ''
                    }`}
                    data-duel-reveal-commit={pinnedSide ? 'true' : undefined}
                    aria-hidden={!activeRevealSide}
                    style={
                      {
                        '--cr-shift': `${previewSide ? Math.round(pullRatio * 64) : 0}px`,
                      } as React.CSSProperties
                    }
                  >
                    <div className="cr-inner">
                      <small className="cr-kicker">
                        {revealShownSide === 'left' ? '← Влево' : 'Вправо →'}
                      </small>
                      <strong className="cr-text">
                        {revealShownSide === 'left'
                          ? activeCard.left.label
                          : activeCard.right.label}
                      </strong>
                      <div className="cr-progress">
                        <i
                          style={{
                            transform: `scaleX(${
                              previewSide ? Math.max(0.06, pullRatio) : pinnedSide ? 1 : 0
                            })`,
                          }}
                        />
                      </div>
                      <span className="cr-hint">
                        {pinnedSide
                          ? 'Нажмите ещё раз — или смахните карточку'
                          : pullRatio >= 1
                            ? 'Отпустите — ход зафиксирован'
                            : revealShownSide === 'left'
                              ? '← Тяните влево'
                              : 'Тяните вправо →'}
                      </span>
                    </div>
                  </div>
                </div>

                {exitingCards.map((snap) => (
                  <OutgoingDuelCardGhost
                    key={snap.seq}
                    snapshot={snap}
                    onDone={removeExitingGhost}
                  />
                ))}
              </div>
            </main>

            <div className="shell-bottom-safe" aria-hidden="true" />
          </>
        ) : (
          /* ИТОГОВЫЙ ПРОТОКОЛ ДУЭЛИ В СТИЛЕ КРЕСЛО / ЭВРИСТИКА */
          <div className="apple-cards-scroll" style={{ padding: '14px 16px 32px' }}>
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(200, 155, 79, 0.24)',
                borderRadius: 16,
                padding: '18px 16px',
                marginBottom: 12,
              }}
            >
              <span className="eyebrow-tag">
                РАСКЛАД #{seed} · {pack.title.toUpperCase()}
              </span>
              <h2 className="sheet-serif-title" style={{ margin: '6px 0 6px' }}>
                {ghost
                  ? mySurvived > ghost.survivedCount
                    ? 'Вы обошли соперника'
                    : mySurvived === ghost.survivedCount
                      ? mySurvived >= DUEL_BLITZ_LENGTH
                        ? 'Оба удержали все 6 ходов'
                        : `Ничья на ${mySurvived + 1}-м ходу`
                      : `${ghost.challengerName} прошёл дальше`
                  : deadAtStep !== null
                    ? `Срыв на ${deadAtStep + 1}-м ходу из ${DUEL_BLITZ_LENGTH}`
                    : `Все ${DUEL_BLITZ_LENGTH} ходов пройдены чисто`}
              </h2>
              <p className="ending-desc" style={{ margin: '0 0 14px' }}>
                {ghost
                  ? 'Сравнение решений на идентичной последовательности карточек.'
                  : 'Отправьте этот расклад коллеге или другу — у него выпадут ровно те же 6 ситуаций и ваша скрытая траектория.'}
              </p>

              {/* Табло счёта */}
              <div className="elegant-stats-strip" style={{ marginBottom: 12 }}>
                <div className="ess-cell accent">
                  <strong>
                    {mySurvived}/{DUEL_BLITZ_LENGTH}
                  </strong>
                  <span>Ваш счёт</span>
                </div>
                {ghost && (
                  <div className="ess-cell">
                    <strong>
                      {ghost.survivedCount}/{DUEL_BLITZ_LENGTH}
                    </strong>
                    <span>{ghost.challengerName}</span>
                  </div>
                )}
                {pack.pillars.map((p) => {
                  const v = stats[p.key];
                  return (
                    <div key={p.key} className={`ess-cell ${v <= 0 || v >= 100 ? 'crashed' : ''}`}>
                      <strong>{v}%</strong>
                      <span>{p.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Пошаговая сверка ходов */}
              {history.length > 0 && (
                <div
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {history.map((h) => {
                    const same = h.oppSide && h.oppSide === h.mySide;
                    const diff = h.oppSide && h.oppSide !== h.mySide;
                    return (
                      <div
                        key={h.idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '7px 10px',
                          borderRadius: 9,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              opacity: 0.55,
                              marginRight: 6,
                            }}
                          >
                            0{h.idx + 1}
                          </span>
                          <strong>{h.speaker}</strong>
                          <span style={{ opacity: 0.7, marginLeft: 6 }}>· {h.myLabel}</span>
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                            color: same
                              ? 'var(--forest-light)'
                              : diff
                                ? 'var(--brass)'
                                : 'var(--text-dim)',
                          }}
                        >
                          {same
                            ? 'совпали'
                            : diff
                              ? 'разошлись'
                              : h.mySide === 'L'
                                ? '← влево'
                                : 'вправо →'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Исторический прецедент расклада */}
            {proofCard?.realCase && (
              <div
                style={{
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  border: '1px solid var(--paper-Rule)',
                  borderRadius: 14,
                  padding: '14px 15px',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color:
                      proofCard.realCase.kind === 'blunder'
                        ? 'var(--vermilion)'
                        : 'var(--forest)',
                    marginBottom: 4,
                  }}
                >
                  {proofCard.realCase.kind === 'blunder'
                    ? `Известный просчёт · ${proofCard.realCase.person} (${proofCard.realCase.year})`
                    : `Исторический прецедент · ${proofCard.realCase.person} (${proofCard.realCase.year})`}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                  {proofCard.realCase.headline}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.42 }}>
                  {proofCard.realCase.story}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    opacity: 0.78,
                    marginTop: 6,
                  }}
                >
                  Источник: {proofCard.realCase.source}
                </div>
              </div>
            )}

            {copiedNote && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--forest-light)',
                  marginBottom: 10,
                }}
              >
                {copiedNote}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="cta-btn primary big"
                onClick={handleSendTelegramChallenge}
              >
                Отправить вызов в Telegram →
              </button>

              <button
                type="button"
                className="cta-btn subtle"
                onClick={handleCopyWebDuelLink}
              >
                Скопировать прямую Web-ссылку на расклад
              </button>

              {deadAtStep !== null && (
                <button
                  type="button"
                  className="cta-btn subtle tier-unlock-foil"
                  onClick={() => void handlePaidClutchContinue()}
                >
                  Удержать кресло с {deadAtStep + 1}-го хода · {savePrice} ★
                </button>
              )}

              <div className="two-col-btns">
                {ghost ? (
                  <button
                    type="button"
                    className="cta-btn subtle"
                    onClick={() => resetFreshMatch(true)}
                  >
                    Переиграть расклад
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cta-btn subtle"
                  onClick={() => resetFreshMatch(false)}
                >
                  Новый расклад
                </button>
                <button type="button" className="cta-btn subtle" onClick={onClose}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
