import type { DilemmaCard, JobPack, PackCategory, PackId } from '../../types';
import { HR_RECRUITER_PACK } from './hrRecruiter';
import { IT_FIN_DIRECTOR_PACK } from './itFinDirector';
import { PLASTIC_SURGEON_PACK } from './plasticSurgeon';
import { PRODUCT_MANAGER_PACK } from './productManager';
import { PVZ_MANAGER_PACK } from './pvzManager';
import { RENOVATION_PRO_PACK } from './renovationPro';
import { SALES_ROP_PACK } from './salesRop';
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

function withCategory(pack: JobPack, category: PackCategory): JobPack {
  const cleanSpecials: Record<string, DilemmaCard> = {};
  for (const [k, v] of Object.entries(pack.specialCards)) {
    cleanSpecials[k] = stripLegacyMedia(v);
  }

  return {
    ...pack,
    category,
    coverImage: undefined,
    coverVideo: undefined,
    lifelineImg: undefined,
    academyCta: '',
    badge: cleanEditorialTag(pack.badge),
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

// 12 массовых мейнстримных специальностей (Продакт-менеджер первым по умолчанию)
export const JOB_PACKS: JobPack[] = [
  withCategory(PRODUCT_MANAGER_PACK, 'tech_b2b'),
  withCategory(SMM_PRODUCER_PACK, 'market_media'),
  withCategory(SALES_ROP_PACK, 'market_media'),
  withCategory(UX_DESIGNER_PACK, 'tech_b2b'),
  withCategory(WB_SELLER_PACK, 'market_media'),
  withCategory(PLASTIC_SURGEON_PACK, 'real_sector'),
  withCategory(RENOVATION_PRO_PACK, 'real_sector'),
  withCategory(PVZ_MANAGER_PACK, 'market_media'),
  withCategory(HR_RECRUITER_PACK, 'market_media'),
  withCategory(SEC_SYSADMIN_PACK, 'tech_b2b'),
  withCategory(TENDER_SPEC_PACK, 'tech_b2b'),
  withCategory(IT_FIN_DIRECTOR_PACK, 'tech_b2b'),
];

export function getJobPack(id: PackId): JobPack {
  return JOB_PACKS.find((p) => p.id === id) ?? JOB_PACKS[0];
}
