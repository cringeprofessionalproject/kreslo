import type { JobPack } from '../../types';

export const RECTOR_NII_PACK: JobPack = {
  id: 'rector_nii',
  title: 'Ректор НИИ «Эвристика»',
  shortTitle: 'Ректор НИИ',
  badge: '🏛 ФЛАГМАНСКИЙ ЛОР + ВИДЕО',
  emoji: '🏛️',
  coverImage: './assets/portraits/arkady_smile.jpg',
  coverVideo: './assets/clips/clip_unseal_door.mp4',
  tiktokHook: 'Челлендж: Выживи 20 недель ректором безумного советского НИИ! 💀🏛️',
  subtitle: 'Потолки 4 метра, 20 кофемашин Starbucks, Гоша с изолентой и фламинго под Томском.',
  targetWeeks: 20,
  lifelineName: 'Глоток «A CUP» из подстаканника',
  lifelineDesc:
    'Экстренный двойной эспрессо ректора: мгновенно тянет самую критическую метрику обратно к безопасным 50%! Перезаряжается каждые 6 недель.',
  lifelineIcon: '☕',
  lifelineImg: './assets/sprites/podstakannik.png',
  frenzyTitle: '⚡ АВРАЛ В ОТДЕЛЕ 0! ЛОПАЙ КОСЯКИ ГОШИ!',
  frenzyTargets: ['🦩', '💥', '🔌', '☕', '📕', '🦅'],
  academyCta:
    'Все персонажи, «Отдел 0», дрон «Альфа-Коптер» и Профессор N ждут тебя в большом интерактивном кампусе Академии «Эвристика»!',
  pillars: [
    {
      key: 's1',
      icon: '💰',
      label: 'Казна',
      whatIsIt:
        'Деньги института на свет, отопление 4-метровых потолков, зерно Эфиопии и полевые тесты.',
      zeroWarning:
        'На 0% здание НИИ за долги передадут под овощебазу квашеной капусты!',
      hundredWarning:
        'На 100% Учёный совет от шальных денег купит позолоченный «Майбах» в холл и попадёт под семь проверок!',
    },
    {
      key: 's2',
      icon: '🔧',
      label: 'Железо',
      whatIsIt:
        'Инженерная мощь «Отдела 0», серверная, прототипы и неуёмная энергия сисадмина Гоши.',
      zeroWarning:
        'На 0% оборвётся последний переходник на 4К-проекторе и встанут все стенды!',
      hundredWarning:
        'На 100% Гоша объединит 20 лазерных кофемашин в единый сверхразум и уведёт НИИ в Томск!',
    },
    {
      key: 's3',
      icon: '🎯',
      label: 'Спрос',
      whatIsIt:
        'Реальная польза для живых клиентов, сарафанное радио и интерес рынка к разработкам НИИ.',
      zeroWarning:
        'На 0% вы превратитесь в институт-призрак: идеальные чертежи в сейфе, о которых не знает ни одна живая душа!',
      hundredWarning:
        'На 100% вы наобещаете квантовых соколов всей стране без рабочего макета — заказчики возьмут вахту штурмом!',
    },
    {
      key: 's4',
      icon: '🛡️',
      label: 'Порядок',
      whatIsIt:
        'Пропускной режим Зинаиды Петровны, чистота документов по 152-ФЗ и здравая дисциплина.',
      zeroWarning:
        'На 0% данные утекут с сервера за 4 евро, и строгий ревизор повесит амбарный замок на двери!',
      hundredWarning:
        'На 100% наступит диктатура бюрократии: 96 страниц ТЗ и 14 печатей даже на чашку кофе!',
    },
  ],
  onboardingCards: [
    {
      id: 'nii_onb_1',
      speaker: 'Аркадий Ильич',
      role: 'Ректор Академии «Эвристика»',
      portrait: './assets/portraits/arkady_smile.jpg',
      videoClip: './assets/clips/clip_unseal_door.mp4',
      text: 'Добро пожаловать в выкупленный советский НИИ! Свайпай карту влево или вправо. Нажми на любой из 4 значков сверху, чтобы узнать, как не угробить институт!',
      left: {
        label: 'Осмотреть архивы',
        effects: { s4: 8, s2: -4 },
        voiceClip: './assets/voice/cast_arkady_b.mp3',
      },
      right: {
        label: 'Вскрыть «Отдел 0»!',
        effects: { s2: 8, s4: -4 },
        voiceClip: './assets/voice/cast_arkady_b.mp3',
      },
    },
  ],
  specialCards: {
    nii_chain_flamingo: {
      id: 'nii_chain_flamingo',
      speaker: 'Зинаида Петровна',
      role: 'Экстренные новости на вахте',
      portrait: './assets/portraits/zinaida_talk.jpg',
      videoClip: './assets/clips/clip_flamingo_vhs.mp4',
      text: 'Срочно включите телевизор! Гоша перепутал плюс на минус в ГЛОНАСС — ваш сокол увёл стаю розовых фламинго в ноябрьскую тайгу под Томск!',
      left: {
        label: 'Оплатить спасение птиц!',
        effects: { s1: -18, s3: 12, s4: 8 },
      },
      right: {
        label: 'Спрятать чертежи в сейф!',
        effects: { s4: -20, s3: -14, s1: 6 },
      },
    },
    nii_chain_free_coffee: {
      id: 'nii_chain_free_coffee',
      speaker: 'Аркадий Ильич',
      role: 'Возмущённый голос из ректората',
      portrait: './assets/portraits/arkady_skeptic.jpg',
      videoClip: './assets/clips/clip_arkady_closeup.mp4',
      text: 'В смысле — БЕСПЛАТНЫЙ кофе для всего потока?! Вы вообще видели закупочную цену свежей Эфиопии Иргачефф?!',
      left: {
        label: 'Вернуть ценник 150 ₽!',
        effects: { s1: 16, s3: -10, s4: 6 },
      },
      right: {
        label: 'Гуляем за счёт ректора!',
        effects: { s1: -18, s3: 16 },
      },
    },
    nii_chain_aero: {
      id: 'nii_chain_aero',
      speaker: 'Виктор Петрович',
      role: 'Орнитолог аэропорта',
      portrait: './assets/broll/broll_03_m2_seagulls_propane_cannon.jpg',
      text: 'Одна чайка в турбине Боинга принесла нам 45 млн ₽ убытка, а к газовым пушкам стая привыкла за 2 недели! Покажете ваш пенопластовый макет за 5-км периметром полосы?',
      left: {
        label: 'Ждите полгода титановый!',
        effects: { s2: 14, s3: -18, s1: -12 },
      },
      right: {
        label: 'Едем тестить на выходных!',
        effects: { s1: 22, s3: 14, s4: 8 },
      },
    },
    nii_boss_prof_n_10: {
      id: 'nii_boss_prof_n_10',
      speaker: 'Профессор N',
      role: 'Проверка на экваторе (Неделя 10)',
      portrait: './assets/portraits/nikolaev_skeptic.jpg',
      text: 'Кепку и тёмные очки не снимаю. Аркадий ставит вашему проекту 5 из 5, а Гоша бурчит про 2 из 5. Как разрешите спор?',
      left: {
        label: 'Проверим в бою на клиенте!',
        effects: { s3: 12, s4: 8, s2: -6 },
        voiceClip: './assets/voice/cast_prof_n_fish_drama3.mp3',
      },
      right: {
        label: 'Запишем в отчёт среднее 3,5!',
        effects: { s4: -14, s3: -12, s1: 6 },
        voiceClip: './assets/voice/cast_prof_n_fish_drama3.mp3',
      },
    },
    nii_boss_finale_20: {
      id: 'nii_boss_finale_20',
      speaker: 'Профессор N',
      role: 'Финальный Комитет (Неделя 20)',
      portrait: './assets/portraits/nikolaev_smile.jpg',
      videoClip: './assets/clips/clip_arkady_closeup.mp4',
      text: 'Двадцатая неделя позади — НИИ жив и гудит! Последний вопрос комиссии перед золотым дипломом: с чего начинается любой продукт?',
      left: {
        label: 'С живого клиента и его боли!',
        effects: { s1: 6, s3: 6, s4: 6 },
        addFlags: ['victory_achieved'],
        voiceClip: './assets/voice/cast_prof_n_fish_drama3.mp3',
      },
      right: {
        label: 'С титановых крыльев на весь бюджет!',
        effects: { s2: 35, s1: -30, s3: -25 },
      },
    },
  },
  deckCards: [
    {
      id: 'nii_d1',
      speaker: 'Гоша Сысоев',
      role: 'Находка в «Отделе 0»',
      portrait: './assets/portraits/gosha_talk.jpg',
      videoClip: './assets/clips/clip_falcon_tunnel.mp4',
      text: 'В аэродинамической трубе пылится секретный дрон «Сокол 0-42»! Пульнём боевой образец с крыши прямо сейчас или склеим макет из пенопласта за 18 тысяч?',
      oncePerRun: true,
      left: {
        label: 'Пенопластовый макет!',
        effects: { s1: -6, s3: 12, s4: 6 },
        followUpId: 'nii_chain_aero',
        followUpDelay: 2,
      },
      right: {
        label: 'Пуляй боевой с крыши!',
        effects: { s2: 18, s4: -14 },
        followUpId: 'nii_chain_flamingo',
        followUpDelay: 2,
        voiceClip: './assets/voice/cast_gosha_a.mp3',
      },
    },
    {
      id: 'nii_d2',
      speaker: 'Гоша Сысоев',
      role: 'Коридор второго этажа',
      portrait: './assets/portraits/gosha_wide.jpg',
      videoClip: './assets/clips/clip_coffee_corridor.mp4',
      text: 'Двадцать дорогущих кофемашин со спектрометром стоят вдоль стены с 90-х! Разрешите примотать к ним веб-камеру и нейросеть синей изолентой?',
      oncePerRun: true,
      left: {
        label: 'Отставить! Засыпем зерно A CUP',
        effects: { s1: 14, s2: -8, s3: 10 },
      },
      right: {
        label: 'Приматывай компьютерное зрение!',
        effects: { s2: 20, s1: -16, s3: -8 },
      },
    },
    {
      id: 'nii_d3',
      speaker: 'Иржан',
      role: 'Волонтёр в холле',
      portrait: './assets/portraits/irzhan_smile.jpg',
      text: 'А давайте объявим первокурсникам безлимитный БЕСПЛАТНЫЙ эспрессо из ректорских запасов! Весь поток будет в восторге!',
      oncePerRun: true,
      left: {
        label: 'Строго 1 стакан за зачёт',
        effects: { s4: 10, s1: 8, s3: -4 },
      },
      right: {
        label: 'Бесплатный кофе всем!',
        effects: { s3: 16, s1: -12 },
        followUpId: 'nii_chain_free_coffee',
        followUpDelay: 1,
        voiceClip: './assets/voice/cast_ark_cof_indignant.mp3',
      },
    },
    {
      id: 'nii_d4',
      speaker: 'Зинаида Петровна',
      role: 'Доска объявлений у вахты',
      portrait: './assets/portraits/zinaida.jpg',
      photoBanner: './assets/portraits/gosha_brad_pitt.jpg',
      text: 'Кто-то повесил листовку «Компьютерный мастер Георгий» с отрывными телефонами и фото Брэда Питта! Сорвать халтуру?',
      oncePerRun: true,
      left: {
        label: 'Сорвать немедленно!',
        effects: { s4: 12, s2: -10 },
      },
      right: {
        label: 'Пусть висит — лиды приведёт!',
        effects: { s3: 12, s1: 8, s4: -10 },
      },
    },
    {
      id: 'nii_d5',
      speaker: 'Вера Сергеевна',
      role: 'Куратор Бюро 152-ФЗ',
      portrait: './assets/portraits/vera.jpg',
      text: 'Гоша поднял базу анкет на немецком сервере за 4 евро и прилепил галочку «Согласен на передачу биометрии всем подряд»! Рубим рубильник?',
      left: {
        label: 'Срочно перенести в Москву!',
        effects: { s4: 16, s1: -10, s2: -6 },
        voiceClip: './assets/voice/cast_vera_a.mp3',
      },
      right: {
        label: 'Зато 4 евро — экономия!',
        effects: { s1: 10, s4: -24 },
      },
    },
    {
      id: 'nii_d6',
      speaker: 'Агроном Кузьмич',
      role: 'Черешневые сады',
      portrait: './assets/portraits/arkady_talk.jpg',
      text: 'Скворцы едят черешню 2 недели в июне, мы платим студентам с трещотками 40 тысяч. Но ваш дрон за 2 миллиона — задумка супер, вы молодцы! Делаете скидку?',
      left: {
        label: 'Уходим: тут нет экономики!',
        effects: { s1: 12, s3: 8, s2: -6 },
      },
      right: {
        label: 'Хвалят же! Пилим агро-версию!',
        effects: { s1: -20, s2: 14, s3: -14 },
      },
    },
    {
      id: 'nii_d7',
      speaker: 'Гоша Сысоев',
      role: 'Прокладка сети СКС',
      portrait: './assets/portraits/gosha_talk.jpg',
      text: 'До проектора 128 метров! Скручу куски витой пары пальцами прямо рядом с силовым кабелем столовой 380 Вольт — никто и не заметит!',
      left: {
        label: 'Переделать по ГОСТу в лотке!',
        effects: { s1: -12, s2: 14, s4: 10 },
      },
      right: {
        label: 'Крути изолентой, пора начинать!',
        effects: { s1: 8, s2: -20, s4: -10 },
      },
    },
    {
      id: 'nii_d8',
      speaker: 'Плановый отдел',
      role: 'Талмуд в кожаном переплёте',
      portrait: './assets/portraits/vera.jpg',
      text: 'Мы написали ТЗ на 96 страниц для продукта «Электронный нос для всех жителей планеты»! Выпишете премию за фундаментальный труд?',
      left: {
        label: 'В шредер! Ищите 1 реальную боль',
        effects: { s3: 14, s1: 8, s4: -10 },
      },
      right: {
        label: 'Солидная папка! Выдать премию!',
        effects: { s4: 16, s1: -16, s3: -16 },
      },
    },
    {
      id: 'nii_d9',
      speaker: 'Делегация Завода',
      role: 'Любители бесплатных доработок',
      portrait: './assets/portraits/arkady_skeptic.jpg',
      text: 'Платить в этом году не планируем, но подпишем красивый «Меморандум о намерениях», если вы бесплатно допилите нам 12 функций!',
      left: {
        label: 'Только платный пилот на 2 недели!',
        effects: { s1: 18, s3: 8, s4: -6 },
      },
      right: {
        label: 'Ура, меморандум в рамочку!',
        effects: { s1: -20, s2: 12, s3: -12 },
      },
    },
    {
      id: 'nii_d10',
      speaker: 'Зинаида Петровна',
      role: 'Кот Василий в серверной',
      portrait: './assets/portraits/zinaida_talk.jpg',
      text: 'Вахтенный кот Василий спит на горячем коммутаторе! Гоша грозится выгнать кота, а без Василия мыши перегрызут архив!',
      left: {
        label: 'Купить коту лежанку с подогревом',
        effects: { s1: -8, s2: 10, s4: 10 },
      },
      right: {
        label: 'Оставить кота прямо на сервере!',
        effects: { s4: 8, s2: -16 },
      },
    },
    {
      id: 'nii_d11',
      speaker: 'Иржан',
      role: 'Вечер после зачёта',
      portrait: './assets/portraits/irzhan_talk.jpg',
      text: 'Студенты нашли в актовом зале советские колонки и просят устроить пятничный концерт с разбором факапов стартапов!',
      left: {
        label: 'В 21:00 тишина и отбой!',
        effects: { s4: 14, s3: -12 },
      },
      right: {
        label: 'Врубайте звук, зовите гостей!',
        effects: { s3: 16, s4: -12, s1: -6 },
      },
    },
    {
      id: 'nii_d12',
      speaker: 'Главный теплотехник',
      role: 'Диагностика ржавых труб',
      portrait: './assets/portraits/nikolaev.jpg',
      text: 'Как проверим гипотезу внутри трубы? Гоша требует миллион на титановые гусеницы, а Аркадий предлагает за день протащить датчик на верёвке!',
      left: {
        label: 'Датчик на верёвке за выходные!',
        effects: { s1: 14, s3: 12, s2: -8 },
      },
      right: {
        label: 'Дать миллион на титановый танк!',
        effects: { s1: -22, s2: 18, s3: -10 },
      },
    },
  ],
  endings: [
    {
      id: 'nii_s1_low',
      stat: 's1',
      extreme: 'low',
      badge: '💸 КАЗНА = 0%',
      title: 'Овощебаза квашеной капусты №4',
      image: './assets/broll/intro_1_nii.jpg',
      description:
        'За долги по отоплению 4-метровых потолков корпус НИИ сдали под склад бочек с соленьями. Гоша перепрошивает кассовые весы.',
      epigraph: '«Зато дубовый паркет отлично держит рассол!»',
    },
    {
      id: 'nii_s1_high',
      stat: 's1',
      extreme: 'high',
      badge: '🤑 КАЗНА = 100%',
      title: 'Позолоченный «Майбах» в лектории',
      videoClip: './assets/clips/clip_coffee_corridor.mp4',
      description:
        'От избытка шальных денег руководство увешало серверную хрустальными люстрами, привлекло все ревизии Москвы и улетело на мальдивский симпозиум.',
      epigraph: '«Учить забыли, зато какой размах!»',
    },
    {
      id: 'nii_s2_low',
      stat: 's2',
      extreme: 'low',
      badge: '🔌 ЖЕЛЕЗО = 0%',
      title: 'Последний переходник пал смертью храбрых',
      image: './assets/plates/fluke_bg.jpg',
      description:
        'Погас 4К-проектор, отвалился интернет, закончилась синяя изолента — занятия пришлось перенести на скамейку у метро.',
      epigraph: '«Зато 100% защита от кибератак!»',
    },
    {
      id: 'nii_s2_high',
      stat: 's2',
      extreme: 'high',
      badge: '🤖 ЖЕЛЕЗО = 100%',
      title: 'Восстание 20 кофемашин Starbucks',
      videoClip: './assets/clips/clip_flamingo_vhs.mp4',
      description:
        'Гоша соединил 20 лазерных спектрометров с дроном «0-42» в единый ИИ-разум — они пробили крышу и увели здание НИИ к фламинго под Томск!',
      epigraph: '«Оно живое, Аркадий Ильич, и требует свежего зерна!»',
    },
    {
      id: 'nii_s3_low',
      stat: 's3',
      extreme: 'low',
      badge: '👻 СПРОС = 0%',
      title: 'Секретный институт-невидимка',
      image: './assets/broll/intro_2_folder042.jpg',
      description:
        'Вы год пилили «идеальный продукт» в бункере, не спросив ни одного клиента. На торжественное открытие пришла только кошка вахтёрши.',
      epigraph: '«Ползли вправо по полу — и доползли до плинтуса!»',
    },
    {
      id: 'nii_s3_high',
      stat: 's3',
      extreme: 'high',
      badge: '🔥 СПРОС = 100%',
      title: 'Штурм обманутых директоров',
      image: './assets/broll/broll_03_m2_seagulls_propane_cannon.jpg',
      description:
        'Вы продали рекламу несуществующих дронов всем аэропортам страны. Толпа заказчиков с факелами снесла турникет Зинаиды Петровны!',
      epigraph: '«Обещать единорога легче, чем склеить пенопласт!»',
    },
    {
      id: 'nii_s4_low',
      stat: 's4',
      extreme: 'low',
      badge: '🚨 ПОРЯДОК = 0%',
      title: 'Амбарный замок Роскомнадзора',
      image: './assets/portraits/vera.jpg',
      description:
        'Анкеты утекли с сервера Гоши за 4 евро, а на проходной жарили шашлык. Вера Сергеевна лишь развела руками перед опечатанной дверью.',
      epigraph: '«Ч. 5 ст. 18 шутить не любит!»',
    },
    {
      id: 'nii_s4_high',
      stat: 's4',
      extreme: 'high',
      badge: '📕 ПОРЯДОК = 100%',
      title: 'Тотальная диктатура 96 страниц',
      image: './assets/plates/bureau.jpg',
      description:
        'Бюрократия победила жизнь: чтобы налить стаканчик кофе A CUP, нужно заполнить формуляр №0-42 в трёх экземплярах и ждать визу полгода.',
      epigraph: '«Идеальный порядок — как на кладбище кофемашин!»',
    },
    {
      id: 'nii_victory',
      isVictory: true,
      badge: '🏆 ЗОЛОТОЙ ЗАЧЁТ ПРОФЕССОРА N',
      title: 'Академия «Эвристика» покорила рынок!',
      videoClip: './assets/clips/clip_arkady_closeup.mp4',
      description:
        'Вы прошли все 20 недель на лезвии баланса! Дроны спасают самолёты от чаек, кофейни A CUP гудят, документы в идеале, а Профессор N жмёт руку!',
      epigraph: '«Вот что бывает, когда начинаешь с живого клиента!»',
    },
  ],
};
