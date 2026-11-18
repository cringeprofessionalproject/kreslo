import type { PackId, StatDelta, StatKey, Stats } from '../types';

/**
 * Фраза-итог, которая всплывает между карточками (пока старая улетает,
 * а новая проявляется из расфокуса). Учитывает, какие показатели сдвинулись
 * и где они теперь — чтобы реакция была живой, а не случайной.
 */
export type OutcomeQuipTone = 'up' | 'down' | 'danger' | 'calm';

export interface OutcomeQuip {
  id: string;
  text: string;
  tone: OutcomeQuipTone;
  /** Какие показатели заметно сдвинулись (для мини-иконок под фразой, без чисел) */
  moves: { key: StatKey; dir: 1 | -1; big: boolean }[];
}

interface StatQuipBank {
  low: string[];
  high: string[];
  recover: string[];
  up: string[];
  down: string[];
}

interface PackQuipBank {
  stats: Record<StatKey, StatQuipBank>;
  /** {up} и {down} подставляются названиями показателей */
  mixed: string[];
  calm: string[];
}

const SALES_MANAGER_QUIPS: PackQuipBank = {
  stats: {
    // Бонус
    s1: {
      low: [
        'Бонус на нуле. Оклад смотрит с жалостью',
        'Премия в этом месяце — это мем',
        'Бухгалтерия перестала с тобой здороваться',
        'Ипотека прислала грустный смайлик',
      ],
      high: [
        'Бонус зашкаливает. Внедрение точит ножи',
        'Наобещал клиентам луну. Им пока нравится',
        'РОП пересчитывает твою премию и тихо плачет',
        'Столько закрыть может только гений. Или врунишка',
      ],
      recover: [
        'Деньги вернулись. Ипотека выдохнула',
        'План ожил. Можно снова не самый дешёвый кофе',
        'Касса снова звякнула. Ты жив',
      ],
      up: [
        'Оплата до обеда. Легенда',
        'Касса звякнула. Самый приятный звук',
        'Мысленно ты уже в отпуске',
        'Счёт оплачен. Можно выдохнуть',
        'Бонус растёт. Калькулятор доволен',
      ],
      down: [
        'Сделка уплыла. Бонус машет ручкой',
        'Минус к премии. Новый айфон подождёт',
        'Клиент «подумает». Бонус тоже',
        'Оплата сдвинулась на «после праздников»',
      ],
    },
    // Конверсия
    s2: {
      low: [
        'Твои КП открывает только спам-фильтр',
        'Воронка превратилась в дуршлаг',
        'Клиенты читают «ок» и исчезают',
        'Конверсия на дне. Даже бот не отвечает',
      ],
      high: [
        'Дожимаешь так, что клиенты жалуются директору',
        'Клиенты боятся брать трубку. Слишком убедительно',
        'Закрываешь даже тех, кто ошибся номером',
      ],
      recover: [
        'Воронка снова держит воду',
        'Клиенты снова отвечают. Чудо',
        'Диалоги ожили. Можно работать',
      ],
      up: [
        'Клиент сказал «давайте». Не «подумаем»!',
        'Вопрос попал прямо в боль',
        'Следующий шаг зафиксирован. Красиво',
        'Квалификация в точку',
        'ЛПР сам назначил встречу. Так бывает?',
      ],
      down: [
        'Клиент ушёл думать. Навсегда',
        '«Скиньте на почту». Классика жанра',
        'Прочитано. Без ответа',
        'Воронка дала течь',
      ],
    },
    // Тонус
    s3: {
      low: [
        'Голос сел. Следующий звонок пугает',
        'Даже гудки звучат осуждающе',
        'CRM ждёт. Ты лежишь лицом в клавиатуре',
        'Тонус на нуле. Кофе больше не помогает',
      ],
      high: [
        'Шестой эспрессо. Перебиваешь клиентов',
        'Энергии столько, что звонишь в 7:30. Зря',
        'Бодрость уровня «продам тебе этот степлер»',
      ],
      recover: [
        'Второе дыхание открыто',
        'Выдохнул. Можно снова набирать',
        'Ожил. Голос снова звонкий',
      ],
      up: [
        'Кофе зашёл. Голос звенит',
        'Задачи в CRM разобраны. Дзен',
        'Один удачный звонок — и ты в ресурсе',
        'Перерыв пошёл на пользу',
      ],
      down: [
        'Ещё один грубый отказ в копилку',
        'Энергия утекает в гудки',
        'Голос дрогнул на «добрый день»',
        'Минус тонус. Срочно за кофе',
      ],
    },
    // Доверие
    s4: {
      low: [
        'Клиенты предупреждают друг друга о тебе',
        'Твой номер подписан «не брать»',
        'Сарафан работает против тебя',
        'Доверие на нуле. Даже мама переспрашивает',
      ],
      high: [
        'Клиенты зовут тебя на дни рождения. Работать некогда',
        'Ты стал бесплатным консультантом для всех',
        'Тебя рекомендуют даже конкурентам',
      ],
      recover: [
        'Клиенты снова верят. Не подведи',
        'Репутация подлатана',
        'Мост восстановлен. Аккуратнее с ним',
      ],
      up: [
        'Клиент написал «спасибо, что честно»',
        'Сарафан заработал',
        'Тебя порекомендовали коллеге',
        'Клиент перезвонил сам. Редкость',
      ],
      down: [
        'Клиент нашёл мелкий шрифт. Неловко',
        'Обещание не сдержано. Клиент запомнил',
        'Ещё пара таких — и в чёрный список',
        'Клиент перестал ставить смайлики',
      ],
    },
  },
  mixed: [
    '{Up} растёт, {down} проседает. Классика',
    'Плюс {up}, минус {down}. За всё надо платить',
    '{Up} вверх, {down} вниз. Качели',
    'Выиграл одно, проиграл другое. Это продажи',
  ],
  calm: [
    'Тихий день. Подозрительно тихий',
    'Всё ровно. Даже РОП молчит',
    'Нормальная смена. Никто не плакал',
    'Баланс как у дзен-монаха',
    'Обычный вторник в продажах',
    'Звонок, кофе, звонок. Стабильность',
  ],
};

const QUIP_BANKS: Partial<Record<PackId, PackQuipBank>> = {
  sales_manager: SALES_MANAGER_QUIPS,
};

export function hasOutcomeQuips(packId: PackId): boolean {
  return Boolean(QUIP_BANKS[packId]);
}

const KEYS: StatKey[] = ['s1', 's2', 's3', 's4'];

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function pickFresh(pool: string[], recent: string[], prefix: string): { text: string; id: string } | null {
  if (pool.length === 0) return null;
  const fresh = pool
    .map((text, i) => ({ text, id: `${prefix}:${i}` }))
    .filter((x) => !recent.includes(x.id));
  const src = fresh.length > 0 ? fresh : pool.map((text, i) => ({ text, id: `${prefix}:${i}` }));
  return src[Math.floor(Math.random() * src.length)];
}

export interface BuildQuipInput {
  packId: PackId;
  prev: Stats;
  next: Stats;
  deltas: StatDelta;
  labels: Record<StatKey, string>;
  /** Последние показанные id фраз (чтобы не повторяться) */
  recent: string[];
  /** Была ли фраза на прошлой карточке (чтобы не приедалось) */
  shownLastTurn: boolean;
  /** Ручная фраза из данных карточки — всегда имеет приоритет */
  authored?: string;
}

export function buildOutcomeQuip(input: BuildQuipInput): OutcomeQuip | null {
  const { packId, prev, next, deltas, labels, recent, shownLastTurn, authored } = input;

  const moves = KEYS.map((key) => {
    const d = deltas[key] ?? 0;
    return { key, d };
  })
    .filter((m) => Math.abs(m.d) >= 1)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .map((m) => ({ key: m.key, dir: (m.d > 0 ? 1 : -1) as 1 | -1, big: Math.abs(m.d) >= 10 }));

  if (authored && authored.trim()) {
    const biggest = moves[0];
    return {
      id: `authored:${authored.slice(0, 24)}`,
      text: authored.trim(),
      tone: biggest ? (biggest.dir > 0 ? 'up' : 'down') : 'calm',
      moves,
    };
  }

  const bank = QUIP_BANKS[packId];
  if (!bank) return null;

  const make = (pool: string[], prefix: string, tone: OutcomeQuipTone, fill?: (t: string) => string) => {
    const pick = pickFresh(pool, recent, prefix);
    if (!pick) return null;
    return { id: pick.id, text: fill ? fill(pick.text) : pick.text, tone, moves };
  };

  // 1. Опасная зона — всегда комментируем (это самое драматичное)
  const lowDanger = KEYS.filter((k) => next[k] <= 15 && (deltas[k] ?? 0) < 0).sort(
    (a, b) => next[a] - next[b]
  )[0];
  if (lowDanger) return make(bank.stats[lowDanger].low, `${lowDanger}:low`, 'danger');

  const highDanger = KEYS.filter((k) => next[k] >= 88 && (deltas[k] ?? 0) > 0).sort(
    (a, b) => next[b] - next[a]
  )[0];
  if (highDanger) return make(bank.stats[highDanger].high, `${highDanger}:high`, 'danger');

  // 2. Вытащил показатель с края — тоже всегда
  const recovered = KEYS.find(
    (k) => (prev[k] <= 20 && next[k] >= 26) || (prev[k] >= 84 && next[k] <= 76)
  );
  if (recovered) return make(bank.stats[recovered].recover, `${recovered}:rec`, 'up');

  // 3. Крупные качели
  const bigUp = KEYS.filter((k) => (deltas[k] ?? 0) >= 8).sort(
    (a, b) => (deltas[b] ?? 0) - (deltas[a] ?? 0)
  )[0];
  const bigDown = KEYS.filter((k) => (deltas[k] ?? 0) <= -8).sort(
    (a, b) => (deltas[a] ?? 0) - (deltas[b] ?? 0)
  )[0];

  const chance = shownLastTurn ? 0.35 : 0.7;

  if (bigUp && bigDown) {
    if (Math.random() > chance) return null;
    const upL = labels[bigUp].toLowerCase();
    const downL = labels[bigDown].toLowerCase();
    return make(bank.mixed, 'mixed', 'calm', (t) =>
      t
        .replace('{Up}', cap(upL))
        .replace('{up}', upL)
        .replace('{Down}', cap(downL))
        .replace('{down}', downL)
    );
  }
  if (bigUp || bigDown) {
    if (Math.random() > chance) return null;
    const k = (bigUp ?? bigDown) as StatKey;
    return bigUp
      ? make(bank.stats[k].up, `${k}:up`, 'up')
      : make(bank.stats[k].down, `${k}:down`, 'down');
  }

  // 4. Спокойный ход — изредка, чтобы был ритм, а не шум
  const allCalm = KEYS.every((k) => next[k] >= 30 && next[k] <= 70);
  if (allCalm && !shownLastTurn && Math.random() < 0.22) {
    return make(bank.calm, 'calm', 'calm');
  }

  return null;
}
