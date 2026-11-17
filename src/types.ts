export type StatKey = 's1' | 's2' | 's3' | 's4';

export type Stats = Record<StatKey, number>;

export type StatDelta = Partial<Record<StatKey, number>>;

export interface PillarMeta {
  key: StatKey;
  icon: string;
  label: string;
  whatIsIt: string;
  zeroWarning: string;
  hundredWarning: string;
}

export interface ChoiceOption {
  label: string;
  effects: StatDelta;
  addFlags?: string[];
  followUpId?: string;
  followUpDelay?: number;
  voiceClip?: string;
}

export interface ProKnowledgeEntry {
  smartSide: 'left' | 'right';
  normTag: string;
  shortFact: string;
  deepWhy: string;
  crowdFailPct: number;
}

export interface DilemmaCard {
  id: string;
  speaker: string;
  role: string;
  portrait?: string;
  emojiAvatar?: string;
  avatarBg?: string;
  photoBanner?: string;
  videoClip?: string;
  blockMin?: 1 | 2 | 3; // С какого блока открывается карточка
  text: string;
  left: ChoiceOption;
  right: ChoiceOption;
  oncePerRun?: boolean;
}

export interface EndingDef {
  id: string;
  stat?: StatKey;
  extreme?: 'low' | 'high';
  isVictory?: boolean;
  badge: string;
  title: string;
  image?: string;
  videoClip?: string;
  emojiHero?: string;
  description: string;
  epigraph: string;
}

export type PackId =
  | 'rector_nii'
  | 'smm_insta'
  | 'plastic_surgeon'
  | 'renovation_pro'
  | 'wb_seller'
  | 'sec_sysadmin'
  | 'tender_44fz'
  | 'it_cfo'
  | 'it_product'
  | 'pvz_december'
  | 'barista_acup'
  | 'hr_family';

export type PackCategory = 'all' | 'tech_b2b' | 'market_media' | 'real_sector';

export type MiniGameKind = 'night_chat' | 'xray_scanner' | 'red_green_flag';

export type PaywallTriggerReason =
  | 'block_gate'
  | 'shift_limit'
  | 'locked_course'
  | 'post_course'
  | 'manual_preview';

export interface JobPack {
  id: PackId;
  category?: PackCategory;
  title: string;
  shortTitle: string;
  badge: string;
  emoji: string;
  coverImage?: string;
  coverVideo?: string;
  tiktokHook: string;
  subtitle: string;
  targetWeeks: number; // В v10 полная кампания = 36 смен (3 блока по 12 смен)
  lifelineName: string;
  lifelineDesc: string;
  lifelineIcon: string;
  lifelineImg?: string;
  frenzyTitle: string;
  frenzyTargets: string[];
  pillars: [PillarMeta, PillarMeta, PillarMeta, PillarMeta];
  onboardingCards: DilemmaCard[];
  specialCards: Record<string, DilemmaCard>;
  deckCards: DilemmaCard[];
  endings: EndingDef[];
  academyCta: string;
}

export interface TelemetryStats {
  runsStarted: number;
  swipesTotal: number;
  blocksCleared: number;
  sharesClicked: number;
  paywallShown: number;
  sponsorStarted: number;
  sponsorCompleted: number;
  proUnlockedAt?: string;
  b2bLeadClicks: number;
  unlockMoreClicks: number;
  unlockMoreByPack: Record<string, number>;
  unlockMoreBySource: Record<string, number>;
  smsEventsShown: number;
  smsEventsOpened: number;
  packPlays: Record<string, number>;
}

export interface PersistentMeta {
  selectedPackId: JobPack['id'];
  bestWeeksByPack: Record<string, number>;
  bestIqByPack: Record<string, number>;
  checkpointBlockByPack: Record<string, 1 | 2 | 3>; // Открытый чекпоинт блока (1, 2 или 3)
  attemptsByPack: Record<string, number>;
  unlockedEndings: string[];
  proUnlocked: boolean;
  adUnlockedPacks: PackId[]; // Профессии, где меценаты оплатили Блоки II–III
  sponsorViewsCount: number;
  muted: boolean;
  soundProfile?: 'groove' | 'asmr' | 'classic' | 'off';
  tiktokMode: boolean;
  tiktokBannerIndex: number;
  telemetry: TelemetryStats;
}
