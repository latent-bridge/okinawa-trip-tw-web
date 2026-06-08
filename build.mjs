// 即時情報の自動更新ビルド（バックエンド不要・cron/Actionsで定期実行）。
// index.html 内の <!--KEY:start-->...<!--KEY:end--> をAPI取得値で置換する（冪等）。
// 取得: 為替(exchangerate-api 無料・TWD基準) / 天気(気象庁 forecast JSON)。
// 取得失敗時はフォールバック（既存の中身を保持）して落とさない。
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('./index.html', import.meta.url);
let html = readFileSync(FILE, 'utf8');

function repl(key, value) {
  const re = new RegExp(`(<!--${key}:start-->)[\\s\\S]*?(<!--${key}:end-->)`);
  if (re.test(html)) html = html.replace(re, (m, a, b) => a + value + b);
}

// JST の今日（CIはUTC）
const jst = new Date(Date.now() + 9 * 3600 * 1000);
const mm = jst.getUTCMonth() + 1, dd = jst.getUTCDate();
const stamp = `${mm}/${dd}`;

// ── 為替 TWD→JPY ───────────────────────────────
let jpyPerTwd = null;
try {
  const fx = await (await fetch('https://open.er-api.com/v6/latest/TWD')).json();
  jpyPerTwd = fx?.rates?.JPY;
  if (jpyPerTwd) {
    const yenPer100Twd = Math.round(jpyPerTwd * 100);     // NT$100 ≈ ¥X
    const twdPer100Yen = (100 / jpyPerTwd).toFixed(1);    // ¥100 ≈ NT$Y
    repl('FX_BIG', `NT$100 ≈ ¥${yenPer100Twd}`);
    repl('FX_LINE', `¥100 ≈ NT$${twdPer100Yen} · 1 TWD ≈ ¥${jpyPerTwd.toFixed(2)}`);
    repl('FX_DATE', stamp);
    // サイト内の日本円価格を自動でTWD併記（data-jpy="2180" を持つ要素）
    html = html.replace(/(<[^>]*\sdata-jpy="(\d+)"[^>]*>)[\s\S]*?(<\/[a-z]+>)/gi,
      (m, open, jpy, close) => `${open}¥${Number(jpy).toLocaleString()}（約 NT$${Math.round(jpy / jpyPerTwd / 5) * 5}）${close}`);
  }
} catch (e) { console.error('FX fetch failed:', e.message); }

// ── 天気（気象庁 forecast JSON・weatherCode先頭で簡易分類） ──
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
if (honto) { repl('WX_HONTO', honto); repl('WX_BIG', honto); }
if (miyako) repl('WX_MIYAKO', miyako);
if (yaeyama) repl('WX_YAEYAMA', yaeyama);

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
const items = (SEASON[mm] || []).map(t => `<div class="fline"><span class="st st-open">當季</span>${t}</div>`).join('\n            ');
repl('SEASON_MONTH', `${mm}月`);
if (items) repl('SEASON_ITEMS', '\n            ' + items + '\n          ');

repl('UPDATED', stamp);

writeFileSync(FILE, html);
console.log('built:', { stamp, jpyPerTwd, honto, miyako, yaeyama });
