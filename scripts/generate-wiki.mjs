import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const WEB_PROD_BASE = 'https://kreslo.heuristics.ru/';
const TG_BOT_BASE = 'https://t.me/vkreslegame';

async function main() {
  const tmpOut = path.join(rootDir, 'node_modules', '.cache-kreslo-packs.mjs');
  fs.mkdirSync(path.dirname(tmpOut), { recursive: true });

  await build({
    entryPoints: [path.join(rootDir, 'src/game/packs/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: tmpOut,
    logLevel: 'silent',
  });

  const mod = await import(`file://${tmpOut}?t=${Date.now()}`);
  const packs = mod.SHOWCASE_PACKS ?? mod.JOB_PACKS ?? [];
  const slugMap = mod.DIRECT_PLAY_SLUGS ?? {};

  const stripEmoji = (raw) =>
    String(raw ?? '')
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtFx = (fx, pillars) => {
    if (!fx) return '<span class="fx-neutral">без смещения</span>';
    const items = pillars
      .map((p) => {
        const v = fx[p.key];
        if (!v) return null;
        const cls = v > 0 ? 'pos' : 'neg';
        const sign = v > 0 ? `+${v}` : `${v}`;
        return `<span class="fx-tag ${cls}">${esc(p.label)} <b>${sign}</b></span>`;
      })
      .filter(Boolean);
    return items.length ? items.join('') : '<span class="fx-neutral">без смещения</span>';
  };

  const realCasesAll = [];
  let totalUniqueCards = 0;

  for (const p of packs) {
    const allCards = [
      ...(p.onboardingCards ?? []),
      ...(p.deckCards ?? []),
      ...Object.values(p.specialCards ?? {}),
    ];
    totalUniqueCards += allCards.length;
    for (const c of allCards) {
      if (c.realCase) {
        realCasesAll.push({
          packId: p.id,
          packTitle: stripEmoji(p.title),
          cardId: c.id,
          rc: c.realCase,
        });
      }
    }
  }

  const directLinksRowsHtml = packs
    .map((p, idx) => {
      const slug = slugMap[p.id] || p.id;
      const webUrl = `${WEB_PROD_BASE}?play=${slug}`;
      const localRelUrl = `./?play=${slug}`;
      const tgUrl = `${TG_BOT_BASE}?start=play_${slug}`;
      const cardCount =
        (p.onboardingCards?.length ?? 0) +
        (p.deckCards?.length ?? 0) +
        Object.keys(p.specialCards ?? {}).length;

      return `
        <div class="dl-row">
          <div class="dl-num">${String(idx + 1).padStart(2, '0')}</div>
          <div class="dl-main">
            <div class="dl-title-line">
              <strong>${esc(stripEmoji(p.title))}</strong>
              <span class="dl-code">?play=${esc(slug)}</span>
              <span class="dl-count">${cardCount} карт</span>
            </div>
            <div class="dl-sub">${esc(stripEmoji(p.subtitle))}</div>
          </div>
          <div class="dl-actions">
            <a class="btn-ink" href="${esc(localRelUrl)}">Играть сразу →</a>
            <button type="button" class="btn-line" data-copy="${esc(webUrl)}" onclick="copyLink(this)">Web-ссылка</button>
            <button type="button" class="btn-line" data-copy="${esc(tgUrl)}" onclick="copyLink(this)">TG-ссылка</button>
          </div>
        </div>`;
    })
    .join('\n');

  const packNavHtml = packs
    .map((p, idx) => {
      const count =
        (p.deckCards?.length ?? 0) +
        Object.keys(p.specialCards ?? {}).length +
        (p.onboardingCards?.length ?? 0);
      return `<a class="idx-pill" href="#pack-${esc(p.id)}" onclick="openPackDetails('${esc(p.id)}')"><span>${String(idx + 1).padStart(2, '0')}</span> ${esc(stripEmoji(p.title))} <em>${count}</em></a>`;
    })
    .join('\n');

  const realCasesHtml = realCasesAll
    .map(
      ({ packTitle, rc }) => `
      <article class="case-card" data-kind="${rc.kind === 'blunder' ? 'blunder' : 'win'}" data-search="${esc((rc.person + ' ' + rc.headline + ' ' + rc.story + ' ' + packTitle).toLowerCase())}">
        <div class="case-head">
          <span class="case-tag ${rc.kind === 'blunder' ? 'blunder' : 'win'}">${
            rc.kind === 'blunder' ? 'ИЗВЕСТНЫЙ ПРОСЧЁТ' : 'СИЛЬНЫЙ ХОД'
          }</span>
          <span class="case-meta">${esc(packTitle)} · ${esc(rc.year)}</span>
        </div>
        <h3>${esc(rc.person)} — ${esc(stripEmoji(rc.headline))}</h3>
        <p>${esc(stripEmoji(rc.story))}</p>
        <div class="case-source">Источник: ${esc(stripEmoji(rc.source))}</div>
      </article>`
    )
    .join('\n');

  const packsHtml = packs
    .map((p, pIdx) => {
      const slug = slugMap[p.id] || p.id;
      const cards = [
        ...(p.onboardingCards ?? []).map((c) => ({ ...c, _tag: 'СТАРТ · СМЕНА 01' })),
        ...(p.deckCards ?? []).map((c) => ({
          ...c,
          _tag: `БЛОК ${c.blockMin === 3 ? 'III' : c.blockMin === 2 ? 'II' : 'I'}`,
        })),
        ...Object.entries(p.specialCards ?? {}).map(([k, c]) => ({
          ...c,
          _tag: k.includes('boss') ? 'РУБЕЖ БЛОКА' : 'ЦЕПОЧКА ПОСЛЕДСТВИЙ',
        })),
      ];

      const rows = cards
        .map(
          (c) => `
        <article class="card-spec" data-search="${esc((c.speaker + ' ' + c.role + ' ' + c.text + ' ' + c.left.label + ' ' + c.right.label + ' ' + (c.realCase?.person ?? '')).toLowerCase())}">
          <div class="cs-top">
            <span class="cs-tier">${esc(c._tag)}</span>
            <strong>${esc(stripEmoji(c.speaker))}</strong>
            <span class="cs-role">${esc(stripEmoji(c.role || ''))}</span>
            <span class="cs-id">#${esc(c.id)}</span>
          </div>
          <p class="cs-question">${esc(stripEmoji(c.text))}</p>
          <div class="cs-choices">
            <div class="cs-choice">
              <div class="cs-dir">← ВЛЕВО</div>
              <div class="cs-label">${esc(stripEmoji(c.left.label))}</div>
              <div class="cs-fx">${fmtFx(c.left.effects, p.pillars)}</div>
            </div>
            <div class="cs-choice">
              <div class="cs-dir">ВПРАВО →</div>
              <div class="cs-label">${esc(stripEmoji(c.right.label))}</div>
              <div class="cs-fx">${fmtFx(c.right.effects, p.pillars)}</div>
            </div>
          </div>
          ${
            c.realCase
              ? `<div class="cs-case-note">
                  <span class="cs-case-kicker">${
                    c.realCase.kind === 'blunder' ? 'ПРОСЧЁТ В ИСТОРИИ' : 'ИСТОРИЧЕСКИЙ ПРЕЦЕДЕНТ'
                  }</span>
                  <span>${esc(c.realCase.person)} (${esc(c.realCase.year)}) — ${esc(stripEmoji(c.realCase.headline))}</span>
                </div>`
              : ''
          }
        </article>`
        )
        .join('\n');

      return `
      <details class="pack-block" id="pack-${esc(p.id)}" ${pIdx === 0 ? 'open' : ''}>
        <summary class="pack-summary">
          <div class="ps-left">
            <span class="ps-idx">${String(pIdx + 1).padStart(2, '0')}</span>
            <div>
              <h2>${esc(stripEmoji(p.title))}</h2>
              <p>${esc(stripEmoji(p.subtitle))} · Показатели: ${p.pillars
                .map((pl) => `<b>${esc(pl.label)}</b>`)
                .join(', ')}</p>
            </div>
          </div>
          <div class="ps-right">
            <a class="ps-play-link" href="./?play=${esc(slug)}" onclick="event.stopPropagation()">Запустить →</a>
            <span class="ps-count">${cards.length} карт</span>
          </div>
        </summary>
        <div class="pack-cards-grid">
          ${rows}
        </div>
      </details>`;
    })
    .join('\n');

  const winCount = realCasesAll.filter((x) => x.rc.kind !== 'blunder').length;
  const blunderCount = realCasesAll.filter((x) => x.rc.kind === 'blunder').length;

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0d1512" />
  <link rel="stylesheet" href="./assets/fonts/fonts.css" />
  <link rel="icon" type="image/png" href="./icon-192.png" />
  <title>КРЕСЛО · Справочник весов, прямых ссылок и исторических прецедентов</title>
  <style>
    :root {
      --pine: #0d1512;
      --pine-elevated: #15211c;
      --paper: #f4efe4;
      --sheet: #faf7f0;
      --sheet-alt: #efe9dc;
      --rule: #d8cfc0;
      --rule-strong: #bfb39f;
      --ink: #181614;
      --ink-muted: #5c5449;
      --ink-faint: #7d7467;
      --brass: #c89b4f;
      --forest: #1e6b52;
      --forest-bg: rgba(30, 107, 82, 0.10);
      --vermilion: #b8372b;
      --vermilion-bg: rgba(184, 55, 43, 0.10);
      --font-sans: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      line-height: 1.48;
      -webkit-font-smoothing: antialiased;
    }

    /* Шапка в фирменном тёмно-хвойном тоне «КРЕСЛО / Эвристика» */
    .masthead {
      background: var(--pine);
      color: #f2eee6;
      border-bottom: 1px solid rgba(200, 155, 79, 0.35);
    }
    .masthead-inner {
      max-width: 1080px;
      margin: 0 auto;
      padding: 26px 20px 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      align-items: flex-end;
      justify-content: space-between;
    }
    .mh-kicker {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--brass);
      margin-bottom: 6px;
    }
    .masthead h1 {
      margin: 0;
      font-size: clamp(24px, 3.5vw, 32px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.12;
      color: #f4efe4;
    }
    .mh-sub {
      margin: 6px 0 0;
      font-size: 14px;
      color: #a6aba6;
      max-width: 620px;
    }
    .mh-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .mh-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.15s ease, background 0.15s ease;
    }
    .mh-btn.primary {
      background: var(--brass);
      color: #141210;
    }
    .mh-btn.ghost {
      background: rgba(244, 239, 228, 0.07);
      color: #f2eee6;
      border: 1px solid rgba(244, 239, 228, 0.18);
    }
    .mh-btn:hover {
      opacity: 0.9;
    }

    .container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px 20px 80px;
    }

    .sec-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--rule-strong);
      margin: 34px 0 16px;
    }
    .sec-head:first-child {
      margin-top: 0;
    }
    .sec-head h2 {
      margin: 0;
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.015em;
    }
    .sec-kicker {
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }

    /* I. Прямые ссылки на колоды без меню */
    .dl-sheet {
      background: var(--sheet);
      border: 1px solid var(--rule);
      border-radius: 10px;
      overflow: hidden;
    }
    .dl-row {
      display: grid;
      grid-template-columns: 34px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--rule);
    }
    .dl-row:last-child {
      border-bottom: none;
    }
    .dl-num {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--ink-faint);
      font-weight: 600;
    }
    .dl-title-line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .dl-title-line strong {
      font-size: 14.5px;
      font-weight: 800;
    }
    .dl-code {
      font-family: var(--font-mono);
      font-size: 11.5px;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--sheet-alt);
      color: var(--ink-muted);
      border: 1px solid var(--rule);
    }
    .dl-count {
      font-size: 12px;
      color: var(--ink-faint);
    }
    .dl-sub {
      font-size: 12.5px;
      color: var(--ink-muted);
      margin-top: 2px;
    }
    .dl-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .btn-ink {
      display: inline-block;
      padding: 7px 12px;
      border-radius: 6px;
      background: var(--pine);
      color: #f4efe4;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn-line {
      padding: 7px 10px;
      border-radius: 6px;
      background: var(--sheet);
      color: var(--ink);
      border: 1px solid var(--rule-strong);
      font-family: var(--font-sans);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-line.copied {
      background: var(--forest);
      border-color: var(--forest);
      color: #fff;
    }

    @media (max-width: 720px) {
      .dl-row {
        grid-template-columns: 28px 1fr;
      }
      .dl-actions {
        grid-column: 1 / -1;
        padding-top: 4px;
      }
    }

    /* II. Математика движка */
    .spec-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
    }
    .spec-box {
      background: var(--sheet);
      border: 1px solid var(--rule);
      border-radius: 10px;
      padding: 14px 15px;
    }
    .spec-label {
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 5px;
    }
    .spec-val {
      font-size: 13.5px;
      color: var(--ink);
    }
    .spec-val code {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      background: var(--sheet-alt);
      padding: 1px 5px;
      border-radius: 4px;
    }

    /* Поиск и фильтры */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin: 22px 0 16px;
    }
    .search-input {
      flex: 1 1 280px;
      padding: 11px 14px;
      border-radius: 8px;
      border: 1px solid var(--rule-strong);
      background: var(--sheet);
      color: var(--ink);
      font-family: var(--font-sans);
      font-size: 14px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--pine);
    }
    .filter-tabs {
      display: inline-flex;
      border: 1px solid var(--rule-strong);
      border-radius: 8px;
      overflow: hidden;
      background: var(--sheet);
    }
    .filter-tabs button {
      border: none;
      border-right: 1px solid var(--rule);
      background: transparent;
      color: var(--ink-muted);
      padding: 9px 12px;
      font-family: var(--font-sans);
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .filter-tabs button:last-child {
      border-right: none;
    }
    .filter-tabs button.active {
      background: var(--pine);
      color: #f4efe4;
    }

    /* III. Исторические прецеденты */
    .cases-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 12px;
    }
    .case-card {
      background: var(--sheet);
      border: 1px solid var(--rule);
      border-radius: 10px;
      padding: 15px 16px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .case-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .case-tag {
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .case-tag.win {
      color: var(--forest);
      background: var(--forest-bg);
    }
    .case-tag.blunder {
      color: var(--vermilion);
      background: var(--vermilion-bg);
    }
    .case-meta {
      font-size: 12px;
      color: var(--ink-faint);
    }
    .case-card h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      line-height: 1.32;
    }
    .case-card p {
      margin: 0;
      font-size: 13.5px;
      color: var(--ink-muted);
    }
    .case-source {
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid var(--rule);
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ink-faint);
    }

    /* IV. Навигация и реестр карточек по колодам */
    .idx-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 18px;
    }
    .idx-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: 6px;
      background: var(--sheet);
      border: 1px solid var(--rule);
      color: var(--ink);
      text-decoration: none;
      font-size: 12.5px;
      font-weight: 700;
    }
    .idx-pill span {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ink-faint);
    }
    .idx-pill em {
      font-style: normal;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ink-muted);
    }
    .idx-pill:hover {
      border-color: var(--pine);
    }

    .pack-block {
      background: var(--sheet);
      border: 1px solid var(--rule);
      border-radius: 10px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .pack-summary {
      list-style: none;
      cursor: pointer;
      padding: 15px 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      background: var(--sheet);
    }
    .pack-summary::-webkit-details-marker {
      display: none;
    }
    .pack-block[open] .pack-summary {
      border-bottom: 1px solid var(--rule);
      background: var(--sheet-alt);
    }
    .ps-left {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .ps-idx {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-faint);
    }
    .ps-left h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
    }
    .ps-left p {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: var(--ink-muted);
    }
    .ps-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ps-play-link {
      font-size: 12px;
      font-weight: 700;
      color: var(--forest);
      text-decoration: none;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid rgba(30, 107, 82, 0.32);
      background: rgba(30, 107, 82, 0.06);
    }
    .ps-count {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--ink-faint);
    }

    .pack-cards-grid {
      padding: 14px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 12px;
    }
    .card-spec {
      background: #fdfbf7;
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 13px 14px;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .cs-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
      font-size: 12px;
    }
    .cs-tier {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--sheet-alt);
      color: var(--ink-muted);
    }
    .cs-role {
      color: var(--ink-faint);
    }
    .cs-id {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ink-faint);
    }
    .cs-question {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.38;
      color: var(--ink);
    }
    .cs-choices {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    @media (max-width: 480px) {
      .cs-choices {
        grid-template-columns: 1fr;
      }
    }
    .cs-choice {
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--sheet);
      border: 1px solid var(--rule);
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .cs-dir {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--ink-faint);
    }
    .cs-label {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--ink);
      line-height: 1.32;
    }
    .cs-fx {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: auto;
      padding-top: 3px;
    }
    .fx-tag {
      font-family: var(--font-mono);
      font-size: 10.5px;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .fx-tag.pos {
      color: var(--forest);
      background: var(--forest-bg);
    }
    .fx-tag.neg {
      color: var(--vermilion);
      background: var(--vermilion-bg);
    }
    .fx-neutral {
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--ink-faint);
    }
    .cs-case-note {
      padding-top: 8px;
      border-top: 1px solid var(--rule);
      font-size: 12px;
      color: var(--ink-muted);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .cs-case-kicker {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--ink-faint);
    }
  </style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div>
        <div class="mh-kicker">ЭВРИСТИКА · КРЕСЛО · СПРАВОЧНОЕ ИЗДАНИЕ</div>
        <h1>Кодекс колод, весов и прецедентов</h1>
        <p class="mh-sub">${packs.length} флагманских симуляторов (${totalUniqueCards} карточек), точные смещения показателей, прямые ссылки без главного меню и ${realCasesAll.length} задокументированных исторических кейсов.</p>
      </div>
      <div class="mh-actions">
        <a class="mh-btn ghost" href="./">Каталог симуляторов</a>
        <a class="mh-btn primary" href="https://t.me/vkreslegame" target="_blank" rel="noopener">Telegram @vkreslegame →</a>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="sec-head" id="direct-links">
      <h2>I. Прямые ссылки на мгновенный старт колод</h2>
      <span class="sec-kicker">Сразу первая карточка · без главного меню</span>
    </div>
    <section class="dl-sheet">
      ${directLinksRowsHtml}
    </section>

    <div class="sec-head" id="engine">
      <h2>II. Параметры баланса и математика смен</h2>
      <span class="sec-kicker">Правила расчёта показателей</span>
    </div>
    <section class="spec-grid">
      <div class="spec-box">
        <div class="spec-label">Эскалация по блокам</div>
        <div class="spec-val">Блок I (1–12): <code>×1.00</code> · Блок II (13–24): <code>×1.12</code> · Блок III (25–36): <code>×1.22</code></div>
      </div>
      <div class="spec-box">
        <div class="spec-label">Демпфер перегрева</div>
        <div class="spec-val">Выше <code>70%</code> положительный прирост сжимается на <code>×0.68</code>, выше <code>84%</code> — на <code>×0.45</code>.</div>
      </div>
      <div class="spec-box">
        <div class="spec-label">Дуэль на одном раскладе</div>
        <div class="spec-val"><code>6 карт</code> по общему <code>seed</code>, множитель шага <code>×1.65</code>, скрытая запись ходов соперника.</div>
      </div>
      <div class="spec-box">
        <div class="spec-label">Границы устойчивости</div>
        <div class="spec-val">Смена завершается при <code>0%</code> (истощение) или <code>100%</code> (перегрев) любого из 4 показателей.</div>
      </div>
    </section>

    <div class="toolbar">
      <input
        class="search-input"
        id="q"
        type="search"
        placeholder="Поиск по ситуациям, ответам, ролям или историческим прецедентам…"
        oninput="applyFilters()"
      />
      <div class="filter-tabs" role="tablist">
        <button type="button" class="active" data-kind="all" onclick="setCaseFilter('all', this)">Все (${realCasesAll.length})</button>
        <button type="button" data-kind="win" onclick="setCaseFilter('win', this)">Сильные ходы (${winCount})</button>
        <button type="button" data-kind="blunder" onclick="setCaseFilter('blunder', this)">Просчёты (${blunderCount})</button>
      </div>
    </div>

    <div class="sec-head" id="real-cases">
      <h2>III. Архив исторических решений и известных просчётов</h2>
      <span class="sec-kicker">${realCasesAll.length} верифицированных прецедентов</span>
    </div>
    <section class="cases-grid" id="cases-container">
      ${realCasesHtml}
    </section>

    <div class="sec-head" id="decks">
      <h2>IV. Полный реестр карточек и весов по колодам</h2>
      <span class="sec-kicker">${packs.length} колод · ${totalUniqueCards} карточек</span>
    </div>
    <nav class="idx-nav">
      ${packNavHtml}
    </nav>
    <section id="packs-container">
      ${packsHtml}
    </section>
  </main>

  <script>
    let currentKind = 'all';

    function copyLink(btn) {
      const url = btn.getAttribute('data-copy') || '';
      if (!url) return;
      const prev = btn.textContent;
      navigator.clipboard?.writeText(url);
      btn.classList.add('copied');
      btn.textContent = 'Скопировано';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = prev;
      }, 1400);
    }

    function openPackDetails(packId) {
      const el = document.getElementById('pack-' + packId);
      if (el && el.tagName === 'DETAILS') {
        el.open = true;
      }
    }

    function setCaseFilter(kind, btn) {
      currentKind = kind;
      document.querySelectorAll('.filter-tabs button').forEach((b) => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      applyFilters();
    }

    function applyFilters() {
      const needle = (document.getElementById('q')?.value || '').trim().toLowerCase();

      document.querySelectorAll('.case-card').forEach((el) => {
        const hay = el.getAttribute('data-search') || '';
        const k = el.getAttribute('data-kind') || 'win';
        const matchKind = currentKind === 'all' || k === currentKind;
        const matchText = !needle || hay.includes(needle);
        el.style.display = matchKind && matchText ? '' : 'none';
      });

      document.querySelectorAll('.pack-block').forEach((det) => {
        let visibleInPack = 0;
        det.querySelectorAll('.card-spec').forEach((card) => {
          const hay = card.getAttribute('data-search') || '';
          const match = !needle || hay.includes(needle);
          card.style.display = match ? '' : 'none';
          if (match) visibleInPack++;
        });
        if (needle && visibleInPack > 0) {
          det.open = true;
        }
      });
    }
  </script>
</body>
</html>`;

  const outPath = path.join(rootDir, 'public', 'wiki.html');
  fs.writeFileSync(outPath, html, 'utf-8');
  try {
    fs.unlinkSync(tmpOut);
  } catch {
    // ignore
  }
  console.log(`Generated ${outPath} (${packs.length} showcase packs, ${realCasesAll.length} real cases)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
