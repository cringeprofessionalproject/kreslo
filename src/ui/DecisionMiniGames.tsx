import { useEffect, useMemo, useState } from 'react';
import {
  sfxCoffeeSave,
  sfxGameOver,
  sfxPopCombo,
  sfxSwipeCommit,
  sfxVictory,
} from '../audio';
import {
  FLAG_STATEMENTS,
  NIGHT_CHAT_SCENARIOS,
  XRAY_CASES,
} from '../game/hypeMiniGamesData';
import type { JobPack, MiniGameKind } from '../types';

interface DecisionMiniGameProps {
  kind: MiniGameKind;
  pack: JobPack;
  standalone?: boolean; // запущено прямо из меню для быстрой записи Reels или внутри смены
  onComplete: (qualityRatio: number) => void; // 0..1 качество принятых решений
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, count);
}

export function DecisionMiniGameModal({
  kind,
  pack,
  standalone = false,
  onComplete,
}: DecisionMiniGameProps) {
  if (kind === 'night_chat') {
    return (
      <NightChatSim
        pack={pack}
        standalone={standalone}
        onComplete={onComplete}
      />
    );
  }
  if (kind === 'xray_scanner') {
    return (
      <XrayScannerSim
        pack={pack}
        standalone={standalone}
        onComplete={onComplete}
      />
    );
  }
  return (
    <RedGreenFlagSim
      pack={pack}
      standalone={standalone}
      onComplete={onComplete}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1. СИМУЛЯТОР ПЕРЕПИСКИ «РАБОЧИЙ ЧАТ В 23:47»
// ═══════════════════════════════════════════════════════════════════════

function NightChatSim({
  pack,
  standalone,
  onComplete,
}: Omit<DecisionMiniGameProps, 'kind'>) {
  const scenario = NIGHT_CHAT_SCENARIOS[pack.id] ?? NIGHT_CHAT_SCENARIOS.it_product;
  const [stepIdx, setStepIdx] = useState(0);
  const [typing, setTyping] = useState(true);
  const [pickedReplyIdx, setPickedReplyIdx] = useState<number | null>(null);
  const [scoreSum, setScoreSum] = useState(0);
  const [finished, setFinished] = useState(false);

  const step = scenario.steps[stepIdx];

  useEffect(() => {
    setTyping(true);
    const t = window.setTimeout(() => {
      setTyping(false);
      sfxPopCombo(2);
    }, 650);
    return () => window.clearTimeout(t);
  }, [stepIdx]);

  const chooseReply = (rIdx: number) => {
    if (pickedReplyIdx !== null) return;
    const chosen = step.replies[rIdx];
    setPickedReplyIdx(rIdx);
    setScoreSum((s) => s + chosen.points);
    if (chosen.points >= 80) sfxPopCombo(6);
    else sfxGameOver();
  };

  const nextChatStep = () => {
    if (stepIdx + 1 < scenario.steps.length) {
      setPickedReplyIdx(null);
      setStepIdx((i) => i + 1);
    } else {
      sfxVictory();
      setFinished(true);
    }
  };

  const maxScore = scenario.steps.length * 100;
  const ratio = scoreSum / maxScore;

  return (
    <div className="overlay-backdrop chat-backdrop">
      <div className="phone-chat-frame">
        {/* Шапка мессенджера */}
        <div className="chat-topbar">
          <div className="chat-avatar-ring">{pack.emoji}</div>
          <div className="chat-head-info">
            <strong>{scenario.chatTitle}</strong>
            <span>{typing ? '🟢 печатает сообщение…' : '🟢 в сети · ждёт ответ!'}</span>
          </div>
          <span className="chat-step-pill">
            {stepIdx + 1}/{scenario.steps.length}
          </span>
        </div>

        {!finished ? (
          <>
            <div className="chat-messages-area">
              {typing ? (
                <div className="msg-bubble incoming typing-dots">
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                </div>
              ) : (
                <div className="msg-bubble incoming">
                  <div className="msg-sender">
                    {step.avatarEmoji} {step.sender} · <small>{step.senderRole}</small>
                  </div>
                  <p>{step.incomingText}</p>
                  <span className="msg-time">{step.time}</span>
                </div>
              )}

              {pickedReplyIdx !== null && (
                <>
                  <div className="msg-bubble outgoing">
                    <p>{step.replies[pickedReplyIdx].text}</p>
                    <span className="msg-reaction-chip">
                      {step.replies[pickedReplyIdx].reactionEmoji}
                    </span>
                  </div>

                  <div
                    className={`msg-bubble outcome ${
                      step.replies[pickedReplyIdx].points >= 80 ? 'good' : 'bad'
                    }`}
                  >
                    <p>{step.replies[pickedReplyIdx].bossReply}</p>
                  </div>
                </>
              )}
            </div>

            <div className="chat-choices-dock">
              {!typing && pickedReplyIdx === null && (
                <>
                  <div className="chat-prompt-label">⚡ Что ответишь в рабочий чат?</div>
                  {step.replies.map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chat-reply-btn"
                      onClick={() => chooseReply(idx)}
                    >
                      {r.text}
                    </button>
                  ))}
                </>
              )}

              {pickedReplyIdx !== null && (
                <button type="button" className="cta-btn gold" onClick={nextChatStep}>
                  {stepIdx + 1 < scenario.steps.length ? 'Следующее пуш-сообщение →' : 'Итог переписки →'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="minigame-summary-box">
            <div className="ms-big-icon">{ratio >= 0.75 ? '👑' : '🤡'}</div>
            <h3>
              {ratio >= 0.75
                ? 'Гений рабочих чатов! Границы и проект спасены!'
                : 'Чат сожрал нервы, но ночь пережита!'}
            </h3>
            <p>
              Набрано очков адекватности: <b>{scoreSum}</b> из {maxScore}.
              {!standalone &&
                (ratio >= 0.75
                  ? ` Все 4 метрики выровнены к норме + выдан бонусный ${pack.lifelineIcon}!`
                  : ' Метрики получили лёгкую встряску.')}
            </p>
            <button
              type="button"
              className="cta-btn gold big"
              onClick={() => onComplete(ratio)}
            >
              {standalone ? '← Вернуться в меню' : '▶ Продолжить смену!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. МИНИ-ИГРА «РЕНТГЕН-СКАНЕР ИСТИНЫ» (ФЕЙСКОНТРОЛЬ / ПРОВЕРКА ВОЗВРАТОВ)
// ═══════════════════════════════════════════════════════════════════════

function XrayScannerSim({
  pack,
  standalone,
  onComplete,
}: Omit<DecisionMiniGameProps, 'kind'>) {
  const cases = useMemo(() => pickRandom(XRAY_CASES, 3), []);
  const [idx, setIdx] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; msg: string } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const item = cases[idx];

  const toggleScan = () => {
    sfxCoffeeSave();
    setScanned(true);
  };

  const makeDecision = (action: 'approve' | 'reject') => {
    if (verdict) return;
    const isRight = action === item.correctAction;
    if (isRight) {
      sfxSwipeCommit('right');
      setCorrectCount((c) => c + 1);
      setVerdict({ ok: true, msg: `✓ ВЕРНО! ${item.verdictToast}` });
    } else {
      sfxGameOver();
      setVerdict({
        ok: false,
        msg: scanned
          ? '✗ ОСЕЧКА! Посмотри внимательно на то, что показал сканер внутри!'
          : '✗ ПОДСТАВА! Ты поверил на слово, даже не включив рентген-сканер!',
      });
    }
  };

  const nextVisitor = () => {
    if (idx + 1 < cases.length) {
      setIdx((i) => i + 1);
      setScanned(false);
      setVerdict(null);
    } else {
      sfxVictory();
      setDone(true);
    }
  };

  const ratio = correctCount / cases.length;

  return (
    <div className="overlay-backdrop">
      <div className="scanner-frame">
        <div className="scanner-top">
          <span className="ending-pill gold">🔦 РЕНТГЕН-КОНТРОЛЬ</span>
          <strong>
            Гость {idx + 1} / {cases.length}
          </strong>
        </div>

        {!done ? (
          <>
            <div className="visitor-card">
              <div className="vis-head">
                <span className="vis-emoji">{item.visitorEmoji}</span>
                <div>
                  <strong>{item.visitorName}</strong>
                  <small>{item.outerTitle}</small>
                </div>
              </div>
              <p className="vis-claim">{item.outerClaim}</p>
            </div>

            {/* РЕНТГЕН-ОКНО КОРОБКИ / ПАПКИ */}
            <div className={`xray-box ${scanned ? 'is-scanned' : ''}`}>
              {!scanned ? (
                <button type="button" className="scan-trigger-btn" onClick={toggleScan}>
                  <span className="scan-ico">🔦</span>
                  <strong>НАЖМИ: ПРОСВЕТИТЬ СКАНЕРОМ!</strong>
                  <small>Узнай, что реально спрятано внутри</small>
                </button>
              ) : (
                <div className="xray-reveal">
                  <div className="xray-laser-line" />
                  <div className="xray-truth-ico">{item.xrayTruthEmoji}</div>
                  <p>{item.xrayTruthText}</p>
                </div>
              )}
            </div>

            {!verdict ? (
              <div className="choice-buttons-pair">
                <button
                  type="button"
                  className="choice-btn left"
                  onClick={() => makeDecision('reject')}
                >
                  <small>🚨 ПЕЧАТЬ ОТКАЗА</small>
                  <span>РАЗВЕРНУТЬ!</span>
                </button>
                <button
                  type="button"
                  className="choice-btn right"
                  onClick={() => makeDecision('approve')}
                >
                  <small>✅ ПЕЧАТЬ ДОПУСКА</small>
                  <span>ПРОПУСТИТЬ!</span>
                </button>
              </div>
            ) : (
              <div className={`scanner-verdict ${verdict.ok ? 'ok' : 'bad'}`}>
                <p>{verdict.msg}</p>
                <button type="button" className="cta-btn gold" onClick={nextVisitor}>
                  {idx + 1 < cases.length ? 'Следующий в очереди →' : 'Подвести итог контроля →'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="minigame-summary-box">
            <div className="ms-big-icon">{correctCount >= 2 ? '🕵️‍♂️' : '🙈'}</div>
            <h3>
              Точных решений на контроле: {correctCount} из {cases.length}!
            </h3>
            <p>
              {!standalone
                ? correctCount >= 2
                  ? `Ни одна диверсия не прошла! Шкалы стабилизированы + бонусный ${pack.lifelineIcon}!`
                  : 'Часть контрабанды просочилась, будь бдительнее со сканером!'
                : 'Идеальный сюжет для записи челленджа в Reels!'}
            </p>
            <button
              type="button"
              className="cta-btn gold big"
              onClick={() => onComplete(ratio)}
            >
              {standalone ? '← В меню' : '▶ Вернуться к смене!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 3. МИНИ-ИГРА «ДЕТЕКТОР БУЛЛШИТА: 🚩 КРАСНЫЙ ИЛИ 🟢 ЗЕЛЁНЫЙ ФЛАГ?»
// ═══════════════════════════════════════════════════════════════════════

function RedGreenFlagSim({
  pack,
  standalone,
  onComplete,
}: Omit<DecisionMiniGameProps, 'kind'>) {
  const deck = useMemo(() => pickRandom(FLAG_STATEMENTS, 4), []);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<{ ok: boolean; text: string } | null>(null);
  const [hits, setHits] = useState(0);
  const [done, setDone] = useState(false);

  const cur = deck[idx];

  const handleFlag = (flag: 'red' | 'green') => {
    if (picked) return;
    const ok = flag === cur.correctFlag;
    if (ok) {
      sfxPopCombo(hits + 3);
      setHits((h) => h + 1);
    } else {
      sfxGameOver();
    }
    setPicked({
      ok,
      text: `${ok ? '✓ Попал в точку!' : '✗ Ловушка!'} ${cur.punchline}`,
    });
  };

  const nextFlag = () => {
    if (idx + 1 < deck.length) {
      setIdx((i) => i + 1);
      setPicked(null);
    } else {
      sfxVictory();
      setDone(true);
    }
  };

  const ratio = hits / deck.length;

  return (
    <div className="overlay-backdrop">
      <div className="scanner-frame">
        <div className="scanner-top">
          <span className="ending-pill red">🚩 ДЕТЕКТОР БУЛЛШИТА</span>
          <strong>
            Фраза {idx + 1} / {deck.length}
          </strong>
        </div>

        {!done ? (
          <>
            <div className="flag-quote-box">
              <small>{cur.context}</small>
              <p>{cur.quote}</p>
            </div>

            {!picked ? (
              <div className="choice-buttons-pair">
                <button
                  type="button"
                  className="flag-big-btn red"
                  onClick={() => handleFlag('red')}
                >
                  <span>🚩</span>
                  <strong>КРАСНЫЙ ФЛАГ</strong>
                  <small>Буллшит / Бежать!</small>
                </button>
                <button
                  type="button"
                  className="flag-big-btn green"
                  onClick={() => handleFlag('green')}
                >
                  <span>🟢</span>
                  <strong>ЗЕЛЁНЫЙ ФЛАГ</strong>
                  <small>Здравый смысл!</small>
                </button>
              </div>
            ) : (
              <div className={`scanner-verdict ${picked.ok ? 'ok' : 'bad'}`}>
                <p>{picked.text}</p>
                <button type="button" className="cta-btn gold" onClick={nextFlag}>
                  {idx + 1 < deck.length ? 'Следующая фраза →' : 'Результат детектора →'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="minigame-summary-box">
            <div className="ms-big-icon">{hits >= 3 ? '🎯' : '🚩'}</div>
            <h3>Распознано флагов: {hits} из {deck.length}!</h3>
            <p>
              {!standalone
                ? hits >= 3
                  ? `Мощный иммунитет к лапше на уши! Все шкалы подтянуты к 50% + заряд ${pack.lifelineIcon}!`
                  : 'Осторожнее с красивыми обещаниями без фактов!'
                : 'А сколько флагов угадают в комментариях?!'}
            </p>
            <button
              type="button"
              className="cta-btn gold big"
              onClick={() => onComplete(ratio)}
            >
              {standalone ? '← В меню' : '▶ Дальше по смене!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
