const LEADING_FLUFF_RE =
  /^(?:вежливо|спокойно и коротко|спокойно|честно|жёстко|мгновенно|немедленно|официально|без сожаления|демонстративно|молча|покорно|послушно|бережно|мягко|срочно|сразу|быстро|уверенно|тепло улыбнуться и|развернуться и)\s+/iu;

const DANGLING_TAIL_WORDS = new Set([
  'и',
  'или',
  'но',
  'а',
  'да',
  'в',
  'во',
  'на',
  'с',
  'со',
  'по',
  'к',
  'ко',
  'у',
  'о',
  'об',
  'от',
  'до',
  'за',
  'из',
  'из-за',
  'под',
  'над',
  'при',
  'про',
  'без',
  'для',
  'через',
  'между',
  'перед',
  'около',
  'вокруг',
  'после',
  'внутри',
  'против',
  'среди',
  'не',
  'ни',
  'как',
  'что',
  'чтобы',
  'где',
  'когда',
  'если',
  'все',
  'всё',
  'весь',
  'вся',
  'всю',
  'свой',
  'свою',
  'свои',
  'своих',
  'его',
  'её',
  'их',
  'новый',
  'новую',
  'новые',
  'единый',
  'единую',
  'общий',
  'общую',
  'полный',
  'полную',
  'прямо',
  'строго',
  'лично',
  'только',
]);

function capitalizeFirst(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function trimDanglingWords(words: string[]): string[] {
  const out = [...words];
  while (out.length > 2) {
    const lastClean = out[out.length - 1].replace(/[«»".,!?;:—–-]+$/g, '').toLowerCase();
    if (DANGLING_TAIL_WORDS.has(lastClean)) {
      out.pop();
    } else {
      break;
    }
  }
  return out;
}

/**
 * Превращает развёрнутое описание выбора (70–120 символов) в ёмкую и понятную по смыслу
 * короткую формулировку (2–5 слов, до ~34 символов) для углов карточки в покое.
 * При самом свайпе игроку открывается полный текст решения в верхней плашке над пальцем.
 */
export function getChoiceShortGist(fullLabel: string, explicitShort?: string): string {
  if (explicitShort && explicitShort.trim().length > 0) {
    return explicitShort.trim();
  }

  let s = fullLabel
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D`]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (s.length <= 32) {
    return capitalizeFirst(s.replace(/[!?.]+$/, ''));
  }

  // 1. Если есть двоеточие и левая часть — законченный тезис («Стоп монтаж!», «Никаких переводов до осмотра»)
  const colonIdx = s.indexOf(':');
  if (colonIdx >= 10 && colonIdx <= 34) {
    const leftHead = s.slice(0, colonIdx).trim();
    if (!/^(?:прояснить|ответить|сказать|спросить)$/iu.test(leftHead)) {
      return capitalizeFirst(leftHead.replace(/[!?.]+$/, ''));
    }
    s = s.slice(colonIdx + 1).replace(/^[«"'\s]+/, '').trim();
  }

  // 2. Убираем вводные наречия («Вежливо отказать...» -> «Отказать...»)
  s = s.replace(LEADING_FLUFF_RE, '');

  // 3. Отсекаем пояснительные хвосты после тире, скобок и придаточных союзов
  const tailPatterns = [
    /\s+[—–-]\s+/,
    /\s*\([^)]*\)/g,
    /,\s*(?:чтобы|иначе|а\s|но\s|зато\s|лишь\s+бы|пока\s|ведь\s|где\s|когда\s|если\s|хотя\s|пусть\s|потом\s)/iu,
    /\s+(?:ради|вместо|со\s+ссылкой\s+на|с\s+учётом|при\s+условии|без\s+оглядки)\s+/iu,
  ];

  s = s.replace(tailPatterns[1], ' ').replace(/\s{2,}/g, ' ').trim();

  for (const pat of [tailPatterns[0], tailPatterns[2], tailPatterns[3]]) {
    const match = pat.exec(s);
    if (match && match.index >= 10) {
      s = s.slice(0, match.index).trim();
    }
  }

  // 4. Если фраза всё ещё длиннее 34 символов — берём первое законченное действие до запятой или союза «и»
  if (s.length > 34) {
    const commaIdx = s.indexOf(',');
    if (commaIdx >= 11 && commaIdx <= 36) {
      s = s.slice(0, commaIdx).trim();
    }
  }

  if (s.length > 36) {
    const andMatch = /\s+(?:и|или)\s+/iu.exec(s.slice(15));
    if (andMatch) {
      const cutAt = 15 + andMatch.index;
      if (cutAt >= 16 && cutAt <= 38) {
        s = s.slice(0, cutAt).trim();
      }
    }
  }

  // 5. Аккуратная подрезка по целым словам без висячих предлогов и многоточий посередине слова
  if (s.length > 38) {
    const words = s.split(/\s+/);
    const kept: string[] = [];
    let len = 0;
    for (const w of words) {
      const nextLen = kept.length === 0 ? w.length : len + 1 + w.length;
      if (nextLen > 38 && kept.length >= 2) break;
      kept.push(w);
      len = nextLen;
    }
    s = trimDanglingWords(kept).join(' ');
  } else {
    s = trimDanglingWords(s.split(/\s+/)).join(' ');
  }

  s = s.replace(/[«»".,!?;:—–-]+$/g, '').trim();
  const hasOpenQuote = s.includes('«') && !s.includes('»');
  if (hasOpenQuote) s += '»';

  return capitalizeFirst(s);
}
