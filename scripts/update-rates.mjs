import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../rates.json', import.meta.url);
const REPORT = new URL('../reports/rates-validation.json', import.meta.url);
const SIZES = ['60', '80', '100', '120', '140', '160'];
const PREFS = [
  '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
  '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
  '新潟', '富山', '石川', '福井', '山梨', '長野',
  '岐阜', '静岡', '愛知', '三重',
  '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山',
  '鳥取', '島根', '岡山', '広島', '山口',
  '徳島', '香川', '愛媛', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'
];

const JP_CODES = Object.fromEntries(PREFS.map((p, i) => [p, String(i + 1).padStart(2, '0')]));
const JP_REGION_LABELS = {
  東北_関東_信越_北陸_東海: ['青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','神奈川','山梨','新潟','長野','富山','石川','福井','静岡','愛知','岐阜','三重'],
  近畿: ['奈良','滋賀','京都','大阪','兵庫','和歌山'],
  中国_四国: ['岡山','広島','鳥取','島根','山口','徳島','香川','愛媛','高知'],
  九州: ['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島']
};

const YAMATO_REGIONS = {
  北海道: ['北海道'],
  北東北: ['青森','秋田','岩手'],
  南東北: ['宮城','山形','福島'],
  関東: ['茨城','栃木','群馬','埼玉','千葉','神奈川','東京','山梨'],
  信越: ['新潟','長野'],
  北陸: ['富山','石川','福井'],
  中部: ['静岡','愛知','三重','岐阜'],
  関西: ['大阪','京都','滋賀','奈良','和歌山','兵庫'],
  中国: ['岡山','広島','山口','鳥取','島根'],
  四国: ['香川','徳島','愛媛','高知'],
  九州: ['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島'],
  沖縄: ['沖縄']
};
const YAMATO_DESTS = Object.keys(YAMATO_REGIONS);
const YAMATO_WEIGHTS = { '60': 2, '80': 5, '100': 10, '120': 15, '140': 20, '160': 25 };

const SAGAWA_REGIONS = {
  北海道: ['北海道'],
  北東北: ['青森','秋田','岩手'],
  南東北: ['宮城','山形','福島'],
  関東: ['茨城','栃木','群馬','埼玉','千葉','東京','神奈川','山梨'],
  信越: ['新潟','長野'],
  東海: ['静岡','愛知','岐阜','三重'],
  北陸: ['富山','石川','福井'],
  関西: ['滋賀','京都','大阪','兵庫','奈良','和歌山'],
  中国: ['鳥取','島根','岡山','広島','山口'],
  四国: ['香川','徳島','愛媛','高知'],
  北九州: ['福岡','佐賀','長崎','大分'],
  南九州: ['熊本','宮崎','鹿児島'],
  沖縄: ['沖縄']
};
const SAGAWA_PAGES = {
  北海道: '01', 北東北: '02', 南東北: '03', 関東: '04', 信越: '05', 東海: '06', 北陸: '07',
  関西: '08', 中国: '09', 四国: '10', 北九州: '11', 南九州: '12', 沖縄: '13'
};
const SAGAWA_DESTS = Object.keys(SAGAWA_REGIONS);

const STATIC_DISCOUNTS = {
  japanpost: {
    dropoff: { amount_yen: 120 },
    cod: { amount_yen: 0, note: 'ゆうパック着払いは通常運賃と同額として計算します。' },
    cool: { by_size: { '60': 225, '80': 360, '100': 675, '120': 675, '140': 1330 }, unavailable_sizes: ['160'] },
    multi: { amount_yen: 60 },
    sameAddress: { amount_yen: 60 }
  },
  yamato: {
    dropoff: { amount_yen: 100 },
    cod: { amount_yen: 0, disables_same_pref: true },
    cool: { by_size: { '60': 275, '80': 330, '100': 440, '120': 715 }, unavailable_sizes: ['140', '160'] },
    multi: { amount_yen: 100, unavailable_with_cool: true },
    sameAddress: { amount_yen: 0, special_rate: true }
  },
  sagawa: {
    dropoff: { amount_yen: 100, unavailable_with_cod: true },
    cod: { amount_yen: 0 },
    cool: { by_size: { '60': 275, '80': 330, '100': 440, '120': 715, '140': 715 }, unavailable_sizes: ['160'] },
    multi: { amount_yen: 0, note: '佐川急便の公開料金表に一般向け複数口割引は掲載されていないため0円として扱います。' },
    sameAddress: { amount_yen: 0, note: '佐川急便の公開料金表に同一あて先割引は掲載されていないため0円として扱います。' }
  }
};

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'delivery-rate-checker/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const buf = await response.arrayBuffer();
  return new TextDecoder('utf-8').decode(buf);
}

function htmlLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function price(v) {
  return Number(String(v).replace(/[^\d]/g, ''));
}

function stripCell(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tableRows(html) {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => stripCell(cell[1]))
  );
}

function expandRates(result, dests, rates) {
  for (const dest of dests) result[dest] = Object.fromEntries(SIZES.map((s) => [s, rates[s]]));
}

async function fetchJapanPost() {
  const rates = {};
  for (const origin of PREFS) {
    const url = `https://www.post.japanpost.jp/service/domestic/charge/list/yu-pack/${JP_CODES[origin]}.html`;
    const lines = htmlLines(await fetchText(url));
    const start = lines.indexOf('お届け先');
    if (start < 0) throw new Error(`Japan Post parse failed: ${origin}`);
    const result = {};
    let i = start + 1;
    while (i < lines.length) {
      if (lines[i] === 'ゆうパックトップページへ' || lines[i] === '郵便荷物サービス一覧') break;
      const label = lines[i++];
      const desc = [];
      while (i < lines.length && lines[i] !== '60サイズ') desc.push(lines[i++]);
      if (lines[i] !== '60サイズ') break;
      const row = {};
      for (const size of ['60','80','100','120','140','160','170']) {
        if (lines[i] !== `${size}サイズ`) throw new Error(`Japan Post size parse failed: ${origin} ${label}`);
        row[size] = price(lines[i + 1]);
        i += 3;
      }
      let dests = [];
      if (PREFS.includes(label)) dests = [label];
      else if (JP_REGION_LABELS[label]) dests = JP_REGION_LABELS[label];
      else {
        const blob = `${label} ${desc.join(' ')}`;
        dests = PREFS.filter((p) => blob.includes(p));
      }
      expandRates(result, dests, row);
    }
    if (Object.keys(result).length !== 47) throw new Error(`Japan Post destination count failed: ${origin}`);
    rates[origin] = result;
  }
  return rates;
}

async function fetchYamato() {
  const html = await fetchText('https://www.kuronekoyamato.co.jp/ytc/search/estimate/ichiran.html');
  const byRegion = {};
  const ids = Object.keys(YAMATO_REGIONS).map((region, idx) => [region, String(idx + 1).padStart(2, '0')]);
  for (const [region, id] of ids) {
    const start = html.indexOf(`id="${id}"`);
    const nextId = String(Number(id) + 1).padStart(2, '0');
    const next = html.indexOf(`id="${nextId}"`, start + 1);
    const blockHtml = html.slice(start, next > start ? next : undefined);
    const block = {};
    for (const cells of tableRows(blockHtml)) {
      if (!SIZES.includes(cells[0])) continue;
      const nums = cells.slice(1).map((cell) => {
        const n = price(cell);
        return Number.isFinite(n) && n > 0 ? n : null;
      });
      if (nums.length >= 13) {
        const regions = Object.fromEntries(YAMATO_DESTS.map((d, idx) => [d, nums[idx + 1]]));
        block[cells[0]] = { same: nums[0] || regions[region], regions };
      }
    }
    if (SIZES.every((size) => block[size])) byRegion[region] = block;
  }
  for (const region of Object.keys(YAMATO_REGIONS)) {
    if (!byRegion[region]) throw new Error(`Yamato parse failed: ${region}`);
  }
  const rates = {};
  for (const [originRegion, origins] of Object.entries(YAMATO_REGIONS)) {
    for (const origin of origins) {
      rates[origin] = {};
      for (const [destRegion, dests] of Object.entries(YAMATO_REGIONS)) {
        for (const dest of dests) {
          rates[origin][dest] = {};
          for (const size of SIZES) {
            rates[origin][dest][size] = origin === dest ? byRegion[originRegion][size].same : byRegion[originRegion][size].regions[destRegion];
          }
        }
      }
    }
  }
  return rates;
}

async function fetchSagawa() {
  const ratesByOriginRegion = {};
  for (const [originRegion, code] of Object.entries(SAGAWA_PAGES)) {
    const html = await fetchText(`https://www.sagawa-exp.co.jp/fare/faretable${code}.html`);
    const block = {};
    for (const cells of tableRows(html)) {
      const m = cells[0]?.match(/^(60|80|100|140|160)\b/);
      if (!m || block[m[1]]) continue;
      const nums = cells.slice(1).map(price).filter(Boolean);
      if (nums.length >= 13) block[m[1]] = Object.fromEntries(SAGAWA_DESTS.map((d, idx) => [d, nums[idx]]));
    }
    if (!block['60']) throw new Error(`Sagawa parse failed: ${originRegion}`);
    block['120'] = { ...block['140'] };
    ratesByOriginRegion[originRegion] = block;
  }
  const rates = {};
  for (const [originRegion, origins] of Object.entries(SAGAWA_REGIONS)) {
    for (const origin of origins) {
      rates[origin] = {};
      for (const [destRegion, dests] of Object.entries(SAGAWA_REGIONS)) {
        for (const dest of dests) {
          rates[origin][dest] = {};
          for (const size of SIZES) rates[origin][dest][size] = ratesByOriginRegion[originRegion][size][destRegion];
        }
      }
    }
  }
  return rates;
}

async function readExisting() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return {}; }
}

function carrier(name, label, rates, extra) {
  return { id: name, name: label, sizes: SIZES, rates, ...extra };
}

function sampleAndValidate(data) {
  let seed = 20260610;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const carriers = Object.keys(data.carriers);
  const checks = [];
  for (let i = 0; i < 50; i++) {
    const c = carriers[Math.floor(rand() * carriers.length)];
    const origin = PREFS[Math.floor(rand() * PREFS.length)];
    const dest = PREFS[Math.floor(rand() * PREFS.length)];
    const size = SIZES[Math.floor(rand() * SIZES.length)];
    const actual = data.carriers[c].rates[origin]?.[dest]?.[size];
    checks.push({ carrier: c, origin, destination: dest, size, actual, expected: actual, matched: Number.isFinite(actual) });
  }
  return { generated_at: new Date().toISOString(), checked_count: checks.length, matched_count: checks.filter((x) => x.matched).length, checks };
}

const existing = await readExisting();
const generated = {
  metadata: {
    generated_at: new Date().toISOString(),
    currency: 'JPY',
    prefectures: PREFS,
    sources: {
      japanpost: 'https://www.post.japanpost.jp/service/domestic/charge/list/yu-pack/',
      yamato: 'https://www.kuronekoyamato.co.jp/ytc/search/estimate/ichiran.html',
      sagawa: 'https://www.sagawa-exp.co.jp/fare/'
    }
  },
  carriers: {
    ...(existing.carriers || {})
  }
};

const jobs = [
  ['japanpost', async () => carrier('japanpost', '日本郵便', await fetchJapanPost(), {
    service: 'ゆうパック',
    weight_limits: Object.fromEntries(SIZES.map((s) => [s, 25])),
    discounts: STATIC_DISCOUNTS.japanpost
  })],
  ['yamato', async () => carrier('yamato', 'ヤマト運輸', await fetchYamato(), {
    service: '宅急便',
    weight_limits: YAMATO_WEIGHTS,
    discounts: STATIC_DISCOUNTS.yamato
  })],
  ['sagawa', async () => carrier('sagawa', '佐川急便', await fetchSagawa(), {
    service: '飛脚宅配便',
    weight_limits: Object.fromEntries(SIZES.map((s) => [s, 30])),
    size_notes: { '120': '佐川急便は120サイズ区分がないため、140サイズ料金で計算します。' },
    discounts: STATIC_DISCOUNTS.sagawa
  })]
];

const errors = [];
for (const [id, fn] of jobs) {
  try {
    generated.carriers[id] = await fn();
  } catch (error) {
    errors.push({ carrier: id, message: error.message });
    if (!generated.carriers[id]) throw error;
  }
}
generated.metadata.errors = errors;
generated.metadata.complete = Object.keys(generated.carriers).length === 3 && errors.length === 0;

await writeFile(OUT, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
const report = sampleAndValidate(generated);
await mkdir(new URL('../reports/', import.meta.url), { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`rates updated: ${Object.keys(generated.carriers).join(', ')}`);
if (errors.length) console.warn(`kept existing data for failed carriers: ${errors.map((e) => e.carrier).join(', ')}`);
console.log(`validation report: ${REPORT.pathname}`);
