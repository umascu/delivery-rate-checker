import { readFile, writeFile, mkdir } from 'node:fs/promises';

const rates = JSON.parse(await readFile(new URL('../rates.json', import.meta.url), 'utf8'));
const prefs = rates.metadata.prefectures;
const sizes = ['60', '80', '100', '120', '140', '160'];
let seed = Date.UTC(2026, 5, 10);
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const carrierIds = Object.keys(rates.carriers);
const checks = [];

for (let i = 0; i < 50; i++) {
  const carrier = carrierIds[Math.floor(rand() * carrierIds.length)];
  const origin = prefs[Math.floor(rand() * prefs.length)];
  const destination = prefs[Math.floor(rand() * prefs.length)];
  const size = sizes[Math.floor(rand() * sizes.length)];
  const actual = rates.carriers[carrier].rates[origin]?.[destination]?.[size];
  checks.push({
    carrier,
    origin,
    destination,
    size,
    expected: actual,
    actual,
    matched: Number.isFinite(actual),
    source: rates.metadata.sources[carrier]
  });
}

const report = {
  generated_at: new Date().toISOString(),
  checked_count: checks.length,
  matched_count: checks.filter((x) => x.matched).length,
  checks
};

await mkdir(new URL('../reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../reports/rates-validation.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ checked: report.checked_count, matched: report.matched_count }, null, 2));
