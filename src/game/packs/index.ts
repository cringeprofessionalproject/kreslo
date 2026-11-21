import type { DilemmaCard, HubPackTrack, JobPack, PackCategory, PackId } from '../../types';
import { AI_AGENT_PACK } from './aiAgent';
import { BARISTA_PRO_PACK } from './baristaPro';
import { CAR_FLIPPER_PACK } from './carFlipper';
import { CCTV_INSTALLER_PACK } from './cctvInstaller';
import { HR_RECRUITER_PACK } from './hrRecruiter';
import { IT_FIN_DIRECTOR_PACK } from './itFinDirector';
import { NVC_MASTER_PACK } from './nvcMaster';
import { OFFICE_MANAGER_PACK } from './officeManager';
import { PLASTIC_SURGEON_PACK } from './plasticSurgeon';
import { PRODUCT_MANAGER_PACK } from './productManager';
import { PVZ_MANAGER_PACK } from './pvzManager';
import { RENOVATION_PRO_PACK } from './renovationPro';
import { SALES_MANAGER_PACK } from './salesManager';
import { SALES_ROP_PACK } from './salesRop';
import { SCS_DESIGNER_PACK } from './scsDesigner';
import { SEC_SYSADMIN_PACK } from './secSysadmin';
import { SMM_PRODUCER_PACK } from './smmProducer';
import { TENDER_SPEC_PACK } from './tenderSpec';
import { UX_DESIGNER_PACK } from './uxDesigner';
import { WB_SELLER_PACK } from './wbSeller';

function cleanEditorialTag(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function stripLegacyMedia(card: DilemmaCard): DilemmaCard {
  return {
    ...card,
    portrait: undefined,
    photoBanner: undefined,
    videoClip: undefined,
    left: { ...card.left, voiceClip: undefined },
    right: { ...card.right, voiceClip: undefined },
  };
}

function withMeta(
  pack: JobPack,
  category: PackCategory,
  hubTrack: HubPackTrack,
  badgeOverride?: string,
  titleOverride?: string
): JobPack {
  const cleanSpecials: Record<string, DilemmaCard> = {};
  for (const [k, v] of Object.entries(pack.specialCards)) {
    cleanSpecials[k] = stripLegacyMedia(v);
  }

  return {
    ...pack,
    title: titleOverride ?? pack.title,
    category,
    hubTrack,
    coverImage: undefined,
    coverVideo: undefined,
    lifelineImg: undefined,
    academyCta: '',
    badge: badgeOverride ?? cleanEditorialTag(pack.badge),
    targetWeeks: 36,
    onboardingCards: pack.onboardingCards.map(stripLegacyMedia),
    deckCards: pack.deckCards.map(stripLegacyMedia),
    specialCards: cleanSpecials,
    endings: pack.endings.map((e) => ({
      ...e,
      image: undefined,
      videoClip: undefined,
      badge: cleanEditorialTag(e.badge),
    })),
  };
}

// Золотая девятка флагманских колод для витрины «КРЕСЛО» (прокачаны на 36 смен с реальными кейсами и тупняками)
export const SHOWCASE_PACKS: JobPack[] = [
  withMeta(OFFICE_MANAGER_PACK, 'market_media', 'practice', 'Интриги, шеф и дедлайны', 'Офис на грани'),
  withMeta(SALES_ROP_PACK, 'market_media', 'practice', 'Сделки, давление и команда', 'Переговоры и Босс продаж'),
  withMeta(IT_PRODUCT_PACK_ALIAS(), 'tech_b2b', 'practice', 'Продукт, метрики и релизы'),
  withMeta(RENOVATION_PRO_PACK, 'real_sector', 'practice', 'Архитектура, смета и стройка'),
  withMeta(BARISTA_PRO_PACK, 'real_sector', 'practice', 'Гости, касса и команда', 'Своя кофейня'),

  withMeta(PVZ_MANAGER_PACK, 'market_media', 'story', 'Сюжет · Пиковый сезон'),
  withMeta(WB_SELLER_PACK, 'market_media', 'story', 'Сюжет · Поставки и маркетплейсы'),
  withMeta(CAR_FLIPPER_PACK, 'real_sector', 'story', 'Сюжет · Вторичный авторынок', 'Автоподбор и Перекуп'),
  withMeta(PLASTIC_SURGEON_PACK, 'real_sector', 'story', 'Сюжет · Частная клиника'),
];

function IT_PRODUCT_PACK_ALIAS(): JobPack {
  return PRODUCT_MANAGER_PACK;
}

// Полный реестр всех 20 колод (включая резервные колоды для совместимости сохранений и проверок)
export const JOB_PACKS: JobPack[] = [
  ...SHOWCASE_PACKS,
  withMeta(NVC_MASTER_PACK, 'market_media', 'practice', 'Ненасильственное общение и границы'),
  withMeta(SALES_MANAGER_PACK, 'market_media', 'practice', 'Продажи, сделки и клиенты'),
  withMeta(SCS_DESIGNER_PACK, 'tech_b2b', 'practice', 'Инженерия и кабельные системы'),
  withMeta(CCTV_INSTALLER_PACK, 'real_sector', 'practice', 'Слаботочные системы и объекты'),
  withMeta(SEC_SYSADMIN_PACK, 'tech_b2b', 'practice', 'Инфраструктура и защита данных'),
  withMeta(IT_FIN_DIRECTOR_PACK, 'tech_b2b', 'practice', 'Финансы, налоги и учёт'),
  withMeta(TENDER_SPEC_PACK, 'tech_b2b', 'practice', 'Госзакупки и контракты'),
  withMeta(UX_DESIGNER_PACK, 'tech_b2b', 'practice', 'Интерфейсы и дизайн-системы'),
  withMeta(AI_AGENT_PACK, 'tech_b2b', 'story', 'Сюжет · Взгляд изнутри нейросети'),
  withMeta(SMM_PRODUCER_PACK, 'market_media', 'story', 'Сюжет · Медиа и дедлайны'),
  withMeta(HR_RECRUITER_PACK, 'market_media', 'story', 'Сюжет · Подбор и команда'),
];

export function getJobPack(id: PackId): JobPack {
  return JOB_PACKS.find((p) => p.id === id) ?? JOB_PACKS[0];
}
