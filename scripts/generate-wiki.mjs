import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtFx = (fx, pillars) => {
    if (!fx) return '—';
    return pillars
      .map((p) => {
        const v = fx[p.key];
        if (!v) return null;
        const cls = v > 0 ? 'pos' : 'neg';
        const sign = v > 0 ? `+${v}` : `${v}`;
        return `<span class="chip ${cls}">${esc(p.label)}: ${sign}</span>`;
      })
      .filter(Boolean)
      .join(' ');
  };

  const realCasesAll = [];
  for (const p of packs) {
    const allCards = [
      ...(p.onboardingCards ?? []),
      ...(p.deckCards ?? []),
      ...Object.values(p.specialCards ?? {}),
    ];
    for (const c of allCards) {
      if (c.realCase) {
        realCasesAll.push({ packTitle: p.title, card: c, rc: c.realCase });
      }
    }
  }

  const packNavHtml = packs
    .map(
      (p) =>
        `<a class="nav-pill" href="#pack-${esc(p.id)}">${esc(p.emoji || '🪑')} ${esc(p.title)} <small>(${(p.deckCards?.length ?? 0) + Object.keys(p.specialCards ?? {}).length + (p.onboardingCards?.length ?? 0)})</small></a>`
    )
    .join('\n');

  const realCasesHtml = realCasesAll
    .map(
      ({ packTitle, rc }) => `
      <div class="rc-card ${rc.kind === 'blunder' ? 'blunder' : 'win'}">
        <div class="rc-top">
          <span class="rc-badge">${rc.kind === 'blunder' ? '💀 Знаменитый тупняк' : '🏛 Сильный ход истории'}</span>
          <span class="rc-pack">${esc(packTitle)}</span>
        </div>
        <h3>${esc(rc.person)} · ${esc(rc.year)} — ${esc(rc.headline)}</h3>
        <p>${esc(rc.story)}</p>
        <div class="rc-src">Источник: ${esc(rc.source)}</div>
      </div>`
    )
    .join('\n');

  const packsHtml = packs
    .map((p) => {
      const cards = [
        ...(p.onboardingCards ?? []).map((c) => ({ ...c, _tag: 'Старт (Смена 1)' })),
        ...(p.deckCards ?? []).map((c) => ({
          ...c,
          _tag: `Блок ${c.blockMin ?? 1}`,
        })),
        ...Object.entries(p.specialCards ?? {}).map(([k, c]) => ({
          ...c,
          _tag: k.includes('boss') ? 'Босс рубежа' : 'Секретная цепочка',
        })),
      ];

      const rows = cards
        .map(
          (c) => `
        <article class="w-card" data-search="${esc((c.speaker + ' ' + c.text + ' ' + c.left.label + ' ' + c.right.label).toLowerCase())}">
          <div class="wc-meta">
            <span class="wc-block">${esc(c._tag)}</span>
            <strong>${esc(c.speaker)}</strong>
            <span class="wc-id">#${esc(c.id)}</span>
          </div>
          <p class="wc-q">${esc(c.text)}</p>
          <div class="wc-choices">
            <div class="wc-side">
              <div class="wc-dir">← Влево: <b>${esc(c.left.label)}</b></div>
              <div class="wc-fx">${fmtFx(c.left.effects, p.pillars)}</div>
            </div>
            <div class="wc-side">
              <div class="wc-dir">Вправо → <b>${esc(c.right.label)}</b></div>
              <div class="wc-fx">${fmtFx(c.right.effects, p.pillars)}</div>
            </div>
          </div>
          ${
            c.realCase
              ? `<div class="wc-proof">
                  <b>${c.realCase.kind === 'blunder' ? '💀 Прототип-тупняк' : '🏛 Реальный прототип'}:</b>
                  ${esc(c.realCase.person)} (${esc(c.realCase.year)}) — ${esc(c.realCase.headline)}
                </div>`
              : ''
          }
        </article>`
        )
        .join('\n');

      return `
      <section class="pack-sec" id="pack-${esc(p.id)}">
        <div class="pack-head">
          <h2>${esc(p.emoji || '🪑')} ${esc(p.title)}</h2>
          <p>${esc(p.subtitle)} · Шкалы: ${p.pillars.map((pl) => `<b>${esc(pl.label)}</b>`).join(' · ')}</p>
        </div>
        <div class="cards-grid">
          ${rows}
        </div>
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>КРЕСЛО · Фандом, веса карточек и реальные кейсы</title>
  <style>
    :root {
      --bg: #0e0b18;
      --card: #181328;
      --border: rgba(255,255,255,0.11);
      --text: #f5f3ff;
      --muted: #a39eb8;
      --accent: #ff6b57;
      --pos: #34d399;
      --neg: #fb7185;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 28px 16px 72px; }
    header {
      display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;
      padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 22px;
    }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
    .play-cta {
      display: inline-block; padding: 11px 20px; border-radius: 999px;
      background: linear-gradient(120deg, #ff6b57, #ff3ca6); color: #fff;
      font-weight: 800; text-decoration: none; font-size: 14px;
    }
    .formula-box {
      background: var(--card); border: 1px solid var(--border); border-radius: 18px;
      padding: 16px 18px; margin-bottom: 22px; font-size: 14px;
    }
    .formula-box h2 { margin: 0 0 8px; font-size: 17px; }
    .formula-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .f-item { background: rgba(255,255,255,0.04); padding: 10px 12px; border-radius: 12px; }
    .search-bar {
      width: 100%; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--border);
      background: var(--card); color: #fff; font-size: 15px; margin-bottom: 16px;
    }
    .nav-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
    .nav-pill {
      padding: 7px 13px; border-radius: 999px; background: var(--card);
      border: 1px solid var(--border); color: var(--text); text-decoration: none; font-size: 13px; font-weight: 700;
    }
    .nav-pill small { color: var(--muted); font-weight: 500; }
    .rc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; margin-bottom: 34px; }
    .rc-card {
      padding: 15px; border-radius: 16px; background: var(--card); border: 1px solid var(--border);
    }
    .rc-card.blunder { border-color: rgba(251, 113, 133, 0.42); }
    .rc-card.win { border-color: rgba(52, 211, 153, 0.42); }
    .rc-top { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 6px; }
    .rc-badge { font-weight: 800; }
    .rc-pack { color: var(--muted); }
    .rc-card h3 { margin: 0 0 6px; font-size: 15.5px; }
    .rc-card p { margin: 0 0 8px; font-size: 13.5px; color: #ddd9ec; }
    .rc-src { font-size: 11.5px; color: var(--muted); }
    .pack-sec { margin-bottom: 42px; }
    .pack-head h2 { margin: 0 0 4px; font-size: 22px; }
    .pack-head p { margin: 0 0 14px; color: var(--muted); font-size: 13.5px; }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 12px; }
    .w-card {
      background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 14px;
    }
    .wc-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; }
    .wc-block {
      padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,0.08); font-weight: 700; font-size: 11px;
    }
    .wc-id { margin-left: auto; color: var(--muted); font-family: ui-monospace, monospace; font-size: 11px; }
    .wc-q { margin: 0 0 10px; font-size: 14.5px; font-weight: 600; }
    .wc-choices { display: flex; flex-direction: column; gap: 8px; }
    .wc-side { background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 10px; font-size: 12.5px; }
    .wc-fx { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: ui-monospace, monospace; }
    .chip.pos { background: rgba(52, 211, 153, 0.16); color: var(--pos); }
    .chip.neg { background: rgba(251, 113, 133, 0.16); color: var(--neg); }
    .wc-proof {
      margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12px; color: #fcd34d;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>🪑 КРЕСЛО · Кодекс механик и весов</h1>
        <div style="color: var(--muted); font-size: 14px;">Открытая база весов карточек, формул движка и реальных исторических прототипов</div>
      </div>
      <a class="play-cta" href="https://t.me/vkreslegame" target="_blank" rel="noopener">Играть в @vkreslegame →</a>
    </header>

    <section class="formula-box">
      <h2>⚙️ Математика движка «КРЕСЛО»</h2>
      <div class="formula-grid">
        <div class="f-item"><b>Множители блоков:</b><br/>Блок 1 (1–12): <code>×1.00</code> · Блок 2 Foil (13–24): <code>×1.12</code> · Блок 3 Polychrome (25–36): <code>×1.22</code></div>
        <div class="f-item"><b>Демпфер перегрева:</b><br/>При шкале &gt;70% прирост сжимается на <code>×0.68</code>, выше 84% — на <code>×0.45</code> (защита от случайного потолка).</div>
        <div class="f-item"><b>Блиц-дуэль 1 на 1:</b><br/>6 карт по единому <code>seed</code>, хардкор-множитель урона <code>×1.65</code> + живая тень ходов соперника.</div>
        <div class="f-item"><b>Условие вылета:</b><br/>Любая из 4 шкал достигает <code>0%</code> (истощение) или <code>100%</code> (перегрев). Победа — сдача 36-й смены.</div>
      </div>
    </section>

    <input class="search-bar" id="q" type="search" placeholder="Поиск по ситуациям, ответам, персонажам или кейсам…" oninput="filterCards(this.value)" />

    <nav class="nav-row">
      <a class="nav-pill" href="#real-cases">🏛 Полка Черчилля и Тупняков (${realCasesAll.length})</a>
      ${packNavHtml}
    </nav>

    <section id="real-cases">
      <h2 style="margin: 0 0 12px; font-size: 21px;">🏛 Реальные исторические ходы и знаменитые тупняки (${realCasesAll.length})</h2>
      <div class="rc-grid">
        ${realCasesHtml}
      </div>
    </section>

    ${packsHtml}
  </div>

  <script>
    function filterCards(val) {
      const needle = (val || '').trim().toLowerCase();
      document.querySelectorAll('.w-card').forEach((el) => {
        const hay = el.getAttribute('data-search') || '';
        el.style.display = !needle || hay.includes(needle) ? '' : 'none';
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
