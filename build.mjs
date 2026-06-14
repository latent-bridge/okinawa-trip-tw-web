// 即時情報の自動更新ビルド（バックエンド不要・cron/Actionsで定期実行）。
// ルート直下の *.html を対象に、<!--KEY:start-->...<!--KEY:end--> をAPI取得値で置換し（冪等・
// マーカーは index.html のみに存在）、data-jpy="円額" 要素へ TWD 併記を焼き込む（全ページ）。
// 取得: 為替(exchangerate-api 無料・TWD基準) / 天気(気象庁 forecast JSON)。
// 取得失敗時はフォールバック（既存の中身を保持）して落とさない。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FILES = readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => join(ROOT, f));

// JST の今日（CIはUTC）
const jst = new Date(Date.now() + 9 * 3600 * 1000);
const mm = jst.getUTCMonth() + 1, dd = jst.getUTCDate();
const stamp = `${mm}/${dd}`;

// ── 取得（為替 TWD→JPY / 天気） ───────────────────
let jpyPerTwd = null;
try {
  const fx = await (await fetch('https://open.er-api.com/v6/latest/TWD')).json();
  jpyPerTwd = fx?.rates?.JPY ?? null;
} catch (e) { console.error('FX fetch failed:', e.message); }

const WMAP = { '1': '晴', '2': '多雲', '3': '雨', '4': '雪' };
async function wx(code) {
  try {
    const j = await (await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${code}.json`)).json();
    const a = j[0].timeSeries[0].areas[0];
    const c = (a.weatherCodes && a.weatherCodes[0]) || '';
    return WMAP[c[0]] || '';
  } catch (e) { console.error('JMA fail', code, e.message); return ''; }
}
const [honto, miyako, yaeyama] = await Promise.all([wx('471000'), wx('472000'), wx('474000')]);

// ── 季節カレンダー（人工作成・客観的な季節事象） ──
const SEASON = {
  1: ['鯨魚觀察（慶良間外海）', '寒緋櫻（八重岳）'],
  2: ['鯨魚觀察', '寒緋櫻見頃'],
  3: ['鯨魚觀察末期', '春の陽氣'],
  4: ['海開き・潛水季開始'],
  5: ['梅雨（中旬〜）', '海葡萄盛產'],
  6: ['芒果初上市', '海葡萄', '螢火蟲・夜間活動'],
  7: ['盛夏・最佳浮潛', '芒果盛產'],
  8: ['盛夏・颱風注意', '芒果'],
  9: ['颱風季・殘暑（海泳可）'],
  10: ['秋晴・旅行適期', '潛水透明度高'],
  11: ['旅行適期・涼爽'],
  12: ['鯨魚觀察開始', '溫暖な冬・文化散策'],
};
const seasonItems = (SEASON[mm] || []).map(t => `<div class="fline"><span class="st st-open">當季</span>${t}</div>`).join('\n            ');

// ── 各ページへ適用 ───────────────────────────────
for (const file of FILES) {
  let html = readFileSync(file, 'utf8');
  const repl = (key, value) => {
    const re = new RegExp(`(<!--${key}:start-->)[\\s\\S]*?(<!--${key}:end-->)`);
    if (re.test(html)) html = html.replace(re, (m, a, b) => a + value + b);
  };

  if (jpyPerTwd) {
    repl('FX_BIG', `NT$100 ≈ ¥${Math.round(jpyPerTwd * 100)}`);
    repl('FX_LINE', `¥100 ≈ NT$${(100 / jpyPerTwd).toFixed(1)} · 1 TWD ≈ ¥${jpyPerTwd.toFixed(2)}`);
    repl('FX_DATE', stamp);
    // 日本円価格の TWD 併記（data-jpy="2180" を持つ要素・全ページ）
    html = html.replace(/(<[^>]*\sdata-jpy="(\d+)"[^>]*>)[\s\S]*?(<\/[a-z]+>)/gi,
      (m, open, jpy, close) => `${open}¥${Number(jpy).toLocaleString()}（約 NT$${Math.round(jpy / jpyPerTwd / 5) * 5}）${close}`);
  }
  if (honto) { repl('WX_HONTO', honto); repl('WX_BIG', honto); }
  if (miyako) repl('WX_MIYAKO', miyako);
  if (yaeyama) repl('WX_YAEYAMA', yaeyama);
  repl('SEASON_MONTH', `${mm}月`);
  if (seasonItems) repl('SEASON_ITEMS', '\n            ' + seasonItems + '\n          ');
  repl('UPDATED', stamp);

  writeFileSync(file, html);
}

// ── sitemap.xml / robots.txt 自動生成（ルートの *.html に追従） ──
const ORIGIN = 'https://okinawa-kaupue.com';
const lastmod = jst.toISOString().slice(0, 10); // JST基準の YYYY-MM-DD
const urlOf = (f) => {
  const name = f.split('/').pop();
  return name === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${name}`;
};
const isNoindex = (f) => /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(readFileSync(f, 'utf8'));
const urls = FILES
  .filter(f => !isNoindex(f))   // noindex（リダイレクト等）は sitemap から除外
  .map(f => ({ loc: urlOf(f), pri: f.endsWith('index.html') ? '1.0' : '0.8' }))
  .sort((a, b) => a.loc.localeCompare(b.loc));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);
writeFileSync(join(ROOT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

console.log('built:', { files: FILES.length, stamp, jpyPerTwd, honto, miyako, yaeyama, sitemap: urls.length });
