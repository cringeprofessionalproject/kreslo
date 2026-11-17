import type { EndingDef, JobPack, Stats } from '../types';
import { getBlockForWeek } from './blockCampaignEngine';
import { getIqRankInfo } from './proInsights';

function stripEmojis(input: string): string {
  return input
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      if (lines.length === maxLines - 1) {
        let truncated = current;
        while (truncated.length > 3 && ctx.measureText(`${truncated}…`).width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        lines.push(`${truncated}…`);
        return lines;
      }
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface ShareCardParams {
  pack: JobPack;
  ending: EndingDef;
  finalStats: Stats;
  weeksSurvived: number;
  attemptNumber: number;
  iqHits: number;
  iqTotal: number;
  faceSnapshotUrl?: string | null;
}

/**
 * Делает чистый нативный Retina-скриншот (1080×1920) самого экрана концовки (1:1 в тёмно-изумрудном
 * дизайне приложения, с иллюстрацией / живым лицом на плечах героя и 4 шкалами) — вместо «бумажного бланка отчёта»!
 */
export async function renderEditorialSharePoster(params: ShareCardParams): Promise<{
  canvas: HTMLCanvasElement;
  previewDataUrl: string;
  blob: Blob | null;
}> {
  const { pack, ending, finalStats, weeksSurvived, iqHits, iqTotal, faceSnapshotUrl } = params;

  const masteryPct = iqTotal > 0 ? Math.round((iqHits / iqTotal) * 100) : 78;
  const rank = getIqRankInfo(masteryPct);
  const blockReached = getBlockForWeek(weeksSurvived);

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const c = canvas.getContext('2d')!;

  // 1. Точно такой же тёмно-изумрудный студийный фон, как у экрана iPhone
  const bg = c.createRadialGradient(540, 520, 80, 540, 960, 1400);
  bg.addColorStop(0, '#1B2D25');
  bg.addColorStop(1, '#0B120F');
  c.fillStyle = bg;
  c.fillRect(0, 0, 1080, 1920);

  // Карточка экрана финала
  const sx = 54;
  const sy = 76;
  const sw = 972;
  const sh = 1768;

  drawRoundedRect(c, sx, sy, sw, sh, 40);
  c.fillStyle = '#111A16';
  c.fill();
  c.strokeStyle = 'rgba(200, 155, 79, 0.36)';
  c.lineWidth = 2.5;
  c.stroke();

  const innerX = 108;
  const innerW = 864;

  // 2. Верхний бейдж статуса и профессия
  const badgeText = stripEmojis(ending.badge) || (ending.isVictory ? 'АТТЕСТОВАН' : 'СРЫВ СМЕНЫ');
  c.font = '700 24px ui-monospace, SFMono-Regular, monospace';
  const pillW = Math.min(innerW, c.measureText(badgeText.toUpperCase()).width + 48);
  drawRoundedRect(c, innerX, 132, pillW, 52, 12);
  c.fillStyle = ending.isVictory ? 'rgba(30, 107, 82, 0.32)' : 'rgba(200, 62, 49, 0.28)';
  c.fill();
  c.strokeStyle = ending.isVictory ? 'rgba(108, 196, 161, 0.55)' : 'rgba(240, 140, 130, 0.55)';
  c.lineWidth = 2;
  c.stroke();

  c.fillStyle = ending.isVictory ? '#7AD3B0' : '#F08C82';
  c.fillText(badgeText.toUpperCase().slice(0, 42), innerX + 24, 166);

  c.fillStyle = '#C89B4F';
  c.font = '600 26px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(
    `${stripEmojis(pack.shortTitle)}  ·  Смена ${weeksSurvived}/36 (Блок ${blockReached.roman})`,
    innerX,
    228
  );

  // 3. Окно иллюстрации (как на экране финала — с персонажем и вашим вырезанным лицом!)
  const artY = 258;
  const artH = 440;
  drawRoundedRect(c, innerX, artY, innerW, artH, 28);
  c.save();
  c.clip();

  c.fillStyle = '#172922';
  c.fillRect(innerX, artY, innerW, artH);

  // Круг и плечи персонажа по центру иллюстрации
  const acx = innerX + innerW / 2;
  const acy = artY + artH;
  c.fillStyle = '#223D33';
  c.beginPath();
  c.arc(acx, acy - 140, 168, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#C89B4F';
  c.lineWidth = 2.5;
  c.stroke();

  c.fillStyle = '#121815';
  c.beginPath();
  c.moveTo(acx - 210, acy + 6);
  c.quadraticCurveTo(acx - 170, acy - 138, acx, acy - 138);
  c.quadraticCurveTo(acx + 170, acy - 138, acx + 210, acy + 6);
  c.closePath();
  c.fill();
  c.strokeStyle = '#C89B4F';
  c.lineWidth = 3;
  c.stroke();

  c.strokeStyle = '#F4EFE4';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(acx - 52, acy - 135);
  c.lineTo(acx, acy - 46);
  c.lineTo(acx + 52, acy - 135);
  c.stroke();

  drawRoundedRect(c, acx - 28, acy - 175, 56, 48, 10);
  c.fillStyle = '#EFE8D8';
  c.fill();

  if (faceSnapshotUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        c.drawImage(img, acx - 148, artY + 42, 296, 336);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = faceSnapshotUrl;
    });
  } else {
    drawRoundedRect(c, acx - 82, artY + 92, 164, 178, 70);
    c.fillStyle = '#EFE8D8';
    c.fill();
    c.strokeStyle = '#181614';
    c.lineWidth = 5;
    c.stroke();
  }

  c.restore();
  drawRoundedRect(c, innerX, artY, innerW, artH, 28);
  c.strokeStyle = 'rgba(200, 155, 79, 0.42)';
  c.lineWidth = 2;
  c.stroke();

  // 4. Заголовок и живое описание экрана финала
  let curY = artY + artH + 74;
  c.fillStyle = '#F4EFE4';
  c.font = '700 52px Georgia, serif';
  const titleLines = wrapCanvasText(c, stripEmojis(ending.title), innerW, 2);
  for (const tl of titleLines) {
    c.fillText(tl, innerX, curY);
    curY += 62;
  }

  curY += 10;
  c.fillStyle = '#B8C0BC';
  c.font = '400 32px -apple-system, BlinkMacSystemFont, sans-serif';
  const descLines = wrapCanvasText(c, stripEmojis(ending.description), innerW, 4);
  for (const dl of descLines) {
    c.fillText(dl, innerX, curY);
    curY += 46;
  }

  // 5. Четыре шкалы состояния на момент финала (как в верхней панели игры)
  curY += 24;
  const colW = (innerW - 36) / 4;
  pack.pillars.forEach((pil, idx) => {
    const gx = innerX + idx * (colW + 12);
    const val = finalStats[pil.key];
    const crit = val <= 0 || val >= 100;

    drawRoundedRect(c, gx, curY, colW, 132, 18);
    c.fillStyle = crit ? 'rgba(200, 62, 49, 0.22)' : 'rgba(255,255,255,0.04)';
    c.fill();
    c.strokeStyle = crit ? '#F08C82' : 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    c.stroke();

    c.textAlign = 'center';
    c.fillStyle = crit ? '#F08C82' : '#F4EFE4';
    c.font = '700 34px ui-monospace, monospace';
    c.fillText(`${val}%`, gx + colW / 2, curY + 56);

    c.fillStyle = '#A6ABA6';
    c.font = '600 22px -apple-system, BlinkMacSystemFont, sans-serif';
    c.fillText(stripEmojis(pil.label), gx + colW / 2, curY + 102);
    c.textAlign = 'left';
  });

  // 6. Карточка опыта внизу экрана
  curY += 168;
  drawRoundedRect(c, innerX, curY, innerW, 150, 22);
  c.fillStyle = 'rgba(30, 107, 82, 0.2)';
  c.fill();
  c.strokeStyle = 'rgba(108, 196, 161, 0.4)';
  c.lineWidth = 2;
  c.stroke();

  c.fillStyle = '#F4EFE4';
  c.font = '700 34px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(`Опыт и матчасть: ${masteryPct}%`, innerX + 34, curY + 58);

  c.fillStyle = '#C89B4F';
  c.font = '600 27px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(`${stripEmojis(rank.title)} · Лучше ${rank.percentile}% игроков`, innerX + 34, curY + 108);

  // Нижняя строка приложения
  c.fillStyle = '#7E8D86';
  c.font = '600 25px ui-monospace, monospace';
  c.textAlign = 'center';
  c.fillText('КРЕСЛО  ·  Симулятор рабочих решений', 540, 1796);
  c.textAlign = 'left';

  const previewDataUrl = canvas.toDataURL('image/png');
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );

  return { canvas, previewDataUrl, blob };
}
