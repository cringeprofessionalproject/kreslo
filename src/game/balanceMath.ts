import type { ChoiceOption, DilemmaCard, ProKnowledgeEntry, StatDelta, StatKey, Stats } from '../types';

/**
 * Детерминированный хеш строки (FNV-1a), чтобы около 50% карточек
 * зеркально меняли местами Лево ↔ Право.
 * Иначе игрок быстро замечает паттерн «всегда свайпай влево = правильный ответ».
 */
export function isCardMirrored(cardId: string): boolean {
  // Онбординг оставляем как написано в тексте подсказки
  if (cardId.includes('_onb_')) return false;
  let h = 2166136261;
  for (let i = 0; i < cardId.length; i++) {
    h ^= cardId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 1;
}

/**
 * Возвращает карточку с детерминированно перемешанными сторонами (50% влево / 50% вправо)
 * и нормализованным торговым балансом (у каждого решения есть реальная цена!).
 */
export function prepareBalancedCard(card: DilemmaCard): DilemmaCard {
  const normLeft = ensureTradeOff(card.left, card.id, 'L');
  const normRight = ensureTradeOff(card.right, card.id, 'R');

  if (!isCardMirrored(card.id)) {
    return { ...card, left: normLeft, right: normRight };
  }
  return {
    ...card,
    left: normRight,
    right: normLeft,
  };
}

/**
 * Синхронно переворачивает smartSide в базе знаний Проф-IQ, если карточка отзеркалена.
 */
export function alignInsightWithCard(
  cardId: string,
  insight: ProKnowledgeEntry | null | undefined
): ProKnowledgeEntry | null {
  if (!insight) return null;
  if (!isCardMirrored(cardId)) return insight;
  return {
    ...insight,
    smartSide: insight.smartSide === 'left' ? 'right' : 'left',
  };
}

/**
 * В реальном управлении не бывает «бесплатных» идеальных решений:
 * если в исходных данных карточка давала только плюсы (+12, +10, +8) без единого минуса,
 * добавляем реалистичную операционную цену (-6 к ресурсу времени/нервов или бюджета),
 * чтобы баланс оставался честным компромиссом в духе Reigns.
 */
function ensureTradeOff(opt: ChoiceOption, cardId: string, tag: string): ChoiceOption {
  const keys: StatKey[] = ['s1', 's2', 's3', 's4'];
  const vals = keys.map((k) => opt.effects[k] ?? 0);
  const hasPositive = vals.some((v) => v > 0);
  const hasNegative = vals.some((v) => v < 0);

  // Победный финальный ход на 36-й смене не штрафуем искусственно
  if (opt.addFlags?.includes('victory_achieved') || !hasPositive || hasNegative) {
    return opt;
  }

  // Выбираем метрику, которая не растёт в этом ответе (чаще всего s3 — нервы/ресурс команды или s2 — бюджет)
  const candidates = (['s3', 's2', 's1', 's4'] as StatKey[]).filter(
    (k) => !(opt.effects[k] && opt.effects[k]! > 0)
  );
  const pickIdx = (cardId.length + tag.charCodeAt(0)) % Math.max(1, candidates.length);
  const costKey = candidates[pickIdx] ?? 's3';

  return {
    ...opt,
    effects: {
      ...opt.effects,
      [costKey]: -6,
    },
  };
}

/**
 * Рассчитывает реальное изменение 4 показателей с учётом:
 * 1) множителя сложности карьерного Блока (I: ×1.0, II: ×1.12, III: ×1.22);
 * 2) естественной амортизации роста в верхней зоне (выше 72% рутинные «плюсы» растут плавнее,
 *    чтобы грамотный игрок не сгорал на 100% просто за соблюдение закона, но всё ещё мог
 *    перегреть метрику до 100%, если фанатично качает только один полюс!).
 */
export function computeBalancedEffects(
  rawEffects: StatDelta,
  currentStats: Stats,
  blockRiskMultiplier: number
): StatDelta {
  const out: StatDelta = {};
  for (const k of ['s1', 's2', 's3', 's4'] as StatKey[]) {
    const raw = rawEffects[k];
    if (!raw) continue;

    let scaled = raw * blockRiskMultiplier;
    const cur = currentStats[k];

    if (scaled > 0) {
      // Мягкое сопротивление потолка: чем ближе к 100%, тем сильнее инерция системы
      if (cur >= 84) {
        scaled *= 0.45;
      } else if (cur >= 70) {
        scaled *= 0.68;
      }
      out[k] = Math.max(2, Math.round(scaled));
    } else {
      // Падения и штрафы работают в полную силу (особенно на старших блоках!)
      out[k] = Math.min(-2, Math.round(scaled));
    }
  }
  return out;
}

/**
 * Прогрессивная интерполяция цифр по мере оттягивания карточки (pullRatio от 0 до 1):
 * - 0.06..0.38: цифры «только начинают оживать» (малый сдвиг с многоточием / волной ~);
 * - 0.38..0.82: цифры плавно растут прямо за пальцем;
 * - >= 0.82: фиксируются точные итоговые значения перед отпусканием карточки.
 */
export interface ProgressivePillarPreview {
  active: boolean;
  displayDelta: number; // Текущее отображаемое приращение (растёт с pullRatio)
  fullDelta: number; // Реальное финальное изменение при полном свайпе
  projectedValue: number; // Куда сместится столбик при текущем натяжении
  finalValue: number; // Точное значение после свайпа
  stage: 'none' | 'starting' | 'growing' | 'exact';
}

export function getProgressivePreview(
  currentVal: number,
  fullDelta: number,
  pullRatio: number
): ProgressivePillarPreview {
  if (!fullDelta || pullRatio < 0.06) {
    return {
      active: false,
      displayDelta: 0,
      fullDelta: 0,
      projectedValue: currentVal,
      finalValue: currentVal,
      stage: 'none',
    };
  }

  const clamped = Math.min(1, Math.max(0, pullRatio));
  const stage: 'starting' | 'growing' | 'exact' =
    clamped < 0.35 ? 'starting' : clamped < 0.85 ? 'growing' : 'exact';

  // Плавный линейный рост от 1 до реального числа без резких скачков у края!
  const sign = fullDelta > 0 ? 1 : -1;
  const absScaled = Math.max(1, Math.round(Math.abs(fullDelta) * clamped));
  const displayDelta = sign * absScaled;

  const projectedValue = Math.max(0, Math.min(100, currentVal + displayDelta));
  const finalValue = Math.max(0, Math.min(100, currentVal + fullDelta));

  return {
    active: true,
    displayDelta,
    fullDelta,
    projectedValue,
    finalValue,
    stage,
  };
}
