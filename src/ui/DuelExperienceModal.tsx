import { useMemo, useState } from 'react';
import { sfxCardFlip, sfxCoffeeSave, sfxGameOver, sfxSwipeCommit, sfxUiTap, sfxVictory, vibrate } from '../audio';
import { computeBalancedEffects } from '../game/balanceMath';
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
import type { JobPack, StatKey, Stats } from '../types';

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
  oppSide?: 'L' | 'R';
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
  const [stats, setStats] = useState<Stats>({ s1: 50, s2: 50, s3: 50, s4: 50 });
  const [myMoves, setMyMoves] = useState<Array<'L' | 'R'>>([]);
  const [history, setHistory] = useState<DuelHistoryStep[]>([]);
  const [deadAtStep, setDeadAtStep] = useState<number | null>(null);
  const [flashBanner, setFlashBanner] = useState<{ text: string; tone: 'ok' | 'warn' | 'bad' } | null>(
    null
  );
  const [savesUsed, setSavesUsed] = useState<number>(0);
  const [copiedNote, setCopiedNote] = useState<string | null>(null);
  const [busyLock, setBusyLock] = useState<boolean>(false);

  const deck = useMemo(() => buildDeterministicDuelDeck(pack, seed), [pack, seed]);
  const isFinished = deadAtStep !== null || step >= deck.length;
  const activeCard = !isFinished ? deck[step] : null;
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

  const resetFreshMatch = (keepGhost: boolean) => {
    sfxCardFlip();
    if (!keepGhost) {
      setGhost(null);
      setSeed(Math.floor(100000 + Math.random() * 899999));
    }
    setStep(0);
    setStats({ s1: 50, s2: 50, s3: 50, s4: 50 });
    setMyMoves([]);
    setHistory([]);
    setDeadAtStep(null);
    setFlashBanner(null);
    setSavesUsed(0);
    setCopiedNote(null);
    setBusyLock(false);
  };

  const handleMakeChoice = (side: 'L' | 'R') => {
    if (busyLock || !activeCard) return;
    setBusyLock(true);
    sfxSwipeCommit(side === 'L' ? 'left' : 'right');
    vibrate(12);

    const opt = side === 'L' ? activeCard.left : activeCard.right;
    const rawFx = computeBalancedEffects(opt.effects, stats, 2);
    const nextStats: Stats = { ...stats };
    let died = false;
    (['s1', 's2', 's3', 's4'] as StatKey[]).forEach((k) => {
      const d = Math.round((rawFx[k] ?? 0) * DUEL_DAMAGE_MULT);
      nextStats[k] = Math.max(0, Math.min(100, nextStats[k] + d));
      if (nextStats[k] <= 0 || nextStats[k] >= 100) died = true;
    });

    const oppMove = ghost && step < ghost.moves.length ? ghost.moves[step] : undefined;
    const oppDiedHere = ghost && ghost.survivedCount === step;

    setStats(nextStats);
    setMyMoves((prev) => [...prev, side]);
    setHistory((prev) => [
      ...prev,
      { idx: step, speaker: activeCard.speaker, mySide: side, oppSide: oppMove },
    ]);

    if (died) {
      sfxGameOver();
      setFlashBanner({
        text: `💥 Срыв на ${step + 1}-м ходу! Подводим счёт дуэли…`,
        tone: 'bad',
      });
    } else if (oppDiedHere) {
      sfxVictory();
      setFlashBanner({
        text: `🔥 ${ghost.challengerName} погорел на этой карточке, а ты выстоял!`,
        tone: 'ok',
      });
    } else if (oppMove && oppMove === side) {
      setFlashBanner({
        text: `🤝 Совпали! ${ghost?.challengerName} тоже выбрал этот ход`,
        tone: 'ok',
      });
    } else if (oppMove) {
      setFlashBanner({
        text: `⚡ Разошлись! ${ghost?.challengerName} тут пошёл в другую сторону`,
        tone: 'warn',
      });
    } else {
      setFlashBanner({
        text: `Ход ${step + 1}/${deck.length} пройден чисто`,
        tone: 'ok',
      });
    }

    window.setTimeout(() => {
      setBusyLock(false);
      setFlashBanner(null);
      if (died) {
        setDeadAtStep(step);
      } else {
        const nextStep = step + 1;
        if (nextStep >= deck.length) {
          sfxVictory();
        }
        setStep(nextStep);
      }
    }, 880);
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
      if (healed[k] <= 0) healed[k] = 36;
      if (healed[k] >= 100) healed[k] = 64;
    });
    setStats(healed);
    setSavesUsed((n) => n + 1);
    const resumeIdx = (deadAtStep ?? 0) + 1;
    setDeadAtStep(null);
    setStep(resumeIdx);
    setCopiedNote(`Кресло удержано (${price} ★)!`);
  };

  const handleSendChallenge = () => {
    sfxUiTap();
    const mySurv = deadAtStep !== null ? deadAtStep : deck.length;
    const myData: DuelGhostData = {
      packId: pack.id,
      seed,
      moves: myMoves,
      survivedCount: mySurv,
      challengerName: tgFirstName,
    };
    const { url, text } = buildDuelSharePayload(myData, pack.shortTitle);
    if (!shareLinkViaTelegramOrNative(url, text)) {
      void navigator.clipboard?.writeText(`${text}\n${url}`);
      setCopiedNote('Ссылка на дуэль скопирована — кидай другу в чат!');
    }
  };

  const mySurvived = deadAtStep !== null ? deadAtStep : step;
  const divergence = history.find((h) => h.oppSide && h.oppSide !== h.mySide);
  const savePrice = getGachaSaveStarsPrice(savesUsed);

  return (
    <div
      className="overlay-backdrop"
      style={{ zIndex: 3100 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card ending-editorial-sheet"
        style={{
          maxWidth: 440,
          width: '94vw',
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: '16px 16px 20px',
          background: '#13111c',
          color: '#f5f3ff',
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              ⚔️ Блиц-дуэль · {pack.shortTitle}
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(245,243,255,0.6)' }}>
              {DUEL_BLITZ_LENGTH} карт на одном раскладе · Урон ×1.65 · 40 сек
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Смена колоды (если создаём новый вызов на 0-м ходу) */}
        {!ghost && step === 0 && deadAtStep === null && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
            {availablePacks.map((ap) => (
              <button
                key={ap.id}
                type="button"
                onClick={() => {
                  sfxUiTap();
                  onSelectPack(ap.id);
                  setSeed(Math.floor(100000 + Math.random() * 899999));
                }}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 700,
                  border:
                    ap.id === pack.id
                      ? '1px solid #fbbf24'
                      : '1px solid rgba(255,255,255,0.15)',
                  background:
                    ap.id === pack.id
                      ? 'rgba(251, 191, 36, 0.22)'
                      : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {ap.shortTitle}
              </button>
            ))}
          </div>
        )}

        {/* 4 показателя */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginBottom: 10,
          }}
        >
          {pack.pillars.map((pil) => {
            const val = stats[pil.key];
            const danger = val <= 22 || val >= 80;
            return (
              <div
                key={pil.key}
                style={{
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${danger ? 'rgba(244,63,94,0.55)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pil.label}
                  </span>
                  <strong style={{ color: danger ? '#fda4af' : '#fff' }}>{val}%</strong>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${val}%`,
                      height: '100%',
                      background: danger ? '#f43f5e' : '#34d399',
                      transition: 'width 0.22s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Тень соперника */}
        {ghost ? (
          <div
            style={{
              padding: '7px 11px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span>
              {ghost.survivedCount === step && !isFinished ? (
                <strong style={{ color: '#fbbf24' }}>
                  🔥 На этом ходу {ghost.challengerName} сгорел!
                </strong>
              ) : step < ghost.survivedCount ? (
                <>👻 Тень ({ghost.challengerName}): ход скрыт до твоего выбора</>
              ) : (
                <strong style={{ color: '#34d399' }}>
                  🏆 Ты уже обошёл рекорд ({ghost.survivedCount}/{DUEL_BLITZ_LENGTH})!
                </strong>
              )}
            </span>
            <span style={{ opacity: 0.7 }}>
              Цель: {ghost.survivedCount}/{DUEL_BLITZ_LENGTH}
            </span>
          </div>
        ) : (
          <div
            style={{
              padding: '7px 11px',
              borderRadius: 10,
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            Пройди 6 карт и отправь ссылку другу — у него выпадут <strong>те же самые карты</strong> и твоя тень!
          </div>
        )}

        {/* Активная карточка ИЛИ итог дуэли */}
        {!isFinished && activeCard ? (
          <div
            style={{
              padding: 15,
              borderRadius: 18,
              background: '#faf6ee',
              color: '#17171c',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#57534e',
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              <span>{activeCard.speaker}</span>
              <span>
                Ход {step + 1}/{deck.length}
              </span>
            </div>

            <div
              style={{
                fontSize: 15.5,
                fontWeight: 700,
                lineHeight: 1.36,
                marginBottom: 14,
                minHeight: 62,
              }}
            >
              {activeCard.text}
            </div>

            {flashBanner ? (
              <div
                style={{
                  padding: '11px 12px',
                  borderRadius: 12,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  background:
                    flashBanner.tone === 'bad'
                      ? '#fee2e2'
                      : flashBanner.tone === 'warn'
                        ? '#fef3c7'
                        : '#dcfce7',
                  color:
                    flashBanner.tone === 'bad'
                      ? '#991b1b'
                      : flashBanner.tone === 'warn'
                        ? '#92400e'
                        : '#166534',
                }}
              >
                {flashBanner.text}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleMakeChoice('L')}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 12,
                    border: '1.5px solid rgba(23,23,28,0.16)',
                    background: '#fff',
                    color: '#17171c',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 10.5, opacity: 0.55, fontWeight: 700 }}>← Влево</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }}>
                    {activeCard.left.label}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleMakeChoice('R')}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 12,
                    border: '1.5px solid rgba(23,23,28,0.16)',
                    background: '#fff',
                    color: '#17171c',
                    textAlign: 'right',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 10.5, opacity: 0.55, fontWeight: 700 }}>Вправо →</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }}>
                    {activeCard.right.label}
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
                {ghost
                  ? mySurvived > ghost.survivedCount
                    ? `🏆 Ты вынес соперника (${mySurvived}/${deck.length} против ${ghost.survivedCount}/${deck.length})!`
                    : mySurvived === ghost.survivedCount
                      ? `⚔️ Ничья на одном ходу (${mySurvived}/${deck.length} vs ${ghost.survivedCount}/${deck.length})`
                      : `💀 ${ghost.challengerName} продержался дольше (${ghost.survivedCount}/${deck.length} против ${mySurvived}/${deck.length})`
                  : mySurvived >= deck.length
                    ? `🏆 Чистое прохождение ${deck.length} из ${deck.length}!`
                    : `💥 Ты срезался на ${mySurvived + 1}-м ходу (${mySurvived}/${deck.length})`}
              </div>
              {divergence && ghost && (
                <div style={{ fontSize: 12.5, color: 'rgba(245,243,255,0.8)', marginTop: 4 }}>
                  <strong>Точка расхождения ({divergence.speaker}):</strong>{' '}
                  {ghost.challengerName} свайпнул{' '}
                  {divergence.oppSide === 'L' ? 'влево' : 'вправо'}, а ты — наоборот.
                </div>
              )}
            </div>

            {proofCard?.realCase && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background:
                    proofCard.realCase.kind === 'blunder'
                      ? 'rgba(244, 63, 94, 0.13)'
                      : 'rgba(16, 185, 129, 0.13)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 3 }}>
                  {proofCard.realCase.kind === 'blunder'
                    ? `💀 Знаменитый тупняк из расклада (${proofCard.realCase.person}, ${proofCard.realCase.year}):`
                    : `🏛 Реальный кейс из расклада (${proofCard.realCase.person}, ${proofCard.realCase.year}):`}
                </div>
                <div>{proofCard.realCase.story}</div>
              </div>
            )}

            {copiedNote && (
              <div style={{ fontSize: 12, color: '#86efac', textAlign: 'center', fontWeight: 700 }}>
                {copiedNote}
              </div>
            )}

            {deadAtStep !== null && (
              <button
                type="button"
                className="cta-btn primary big"
                onClick={() => void handlePaidClutchContinue()}
              >
                ☕ Удержать кресло с {deadAtStep + 1}-го хода · {savePrice} ★
              </button>
            )}

            <button
              type="button"
              className="cta-btn primary big"
              onClick={handleSendChallenge}
              style={{
                background: 'linear-gradient(120deg, #fbbf24, #f59e0b)',
                color: '#181104',
              }}
            >
              ⚔️ Отправить этот расклад другу в Telegram →
            </button>

            <button
              type="button"
              className="cta-btn secondary"
              onClick={() => resetFreshMatch(Boolean(ghost))}
            >
              {ghost ? 'Реванш на этом раскладе' : 'Новый расклад'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
