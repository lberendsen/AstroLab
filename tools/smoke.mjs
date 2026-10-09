// Teste de fumaça: abre o AstroLab num navegador sem janela, visita os lugares principais, tira capturas
// e reprova se houver erro de JavaScript na página ou se algo essencial não aparecer.
// Uso: npm run smoke            (todas as paradas)
//      npm run smoke -- rapido  (só as paradas locais, sem depender de fontes externas)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'smoke-out');
const PORT = 8090;
const QUICK = process.argv.includes('rapido');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const exe = BROWSERS.find(p => fs.existsSync(p));
if (!exe) { console.error('Nenhum Edge ou Chrome encontrado.'); process.exit(2); }

// ---------------------------------------------------------------- roteiro
// Cada parada: o que fazer, quanto esperar e o que conferir (check devolve true ou uma mensagem de erro).
const go = q => `astro.go(astro.search.searchLocal(${JSON.stringify(q)},1)[0].make())`;
const STOPS = [
  { name: 'inicio', check: `!!astro.DB.stars && astro.DB.stars.n > 100000 || 'catálogo de estrelas não carregou'` },
  { name: 'desempenho-f3', run: `dispatchEvent(new KeyboardEvent('keydown', { key: 'F3' }))`, wait: 1500,
    check: `/fps/.test(document.getElementById('perf')?.textContent || '') || 'painel de desempenho não abriu'` },
  { name: 'saturno', run: go('Saturno'), wait: 8000, check: `astro.nav.target?.name === 'Saturno' || 'não chegou em Saturno'` },
  { name: 'lua-apollo11', run: go('Apollo 11'), wait: 11000, check: `!!document.querySelector('#info h2')?.textContent.includes('Apollo') || 'ficha da Apollo 11 não abriu'` },
  { name: 'iss', run: go('Estação Espacial Internacional'), wait: 9000 },
  { name: 'voyager1', run: go('Voyager 1'), wait: 10000 },
  { name: 'trappist', run: go('TRAPPIST-1 e'), wait: 11000, check: `astro.systems.planets.length === 7 || 'TRAPPIST-1 não mostrou os 7 planetas'` },
  { name: 'orion', run: go('M 42'), wait: 10000 },
  { name: 'via-lactea', run: `[...document.querySelectorAll('#placeList button')].find(b => b.textContent.startsWith('Via Láctea')).click()`, wait: 11000 },
  { name: 'andromeda', run: go('M 31'), wait: 12000 },
  { name: 'quasares', run: `[...document.querySelectorAll('#placeList button')].find(b => b.textContent.includes('750 mil')).click()`, wait: 12000 },
  { name: 'visto-da-terra', run: `astro.select(astro.search.searchLocal('Marte',1)[0].make()); document.getElementById('aLink').click()`, wait: 9000,
    check: `!document.getElementById('linkPanel').hidden || 'painel "visto da Terra" não abriu'` },
  { name: 'massaroca', run: `document.getElementById('lkClose').click(); ${go('Terra')}; setTimeout(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' })), 7000)`, wait: 9000 },
  { name: 'cinturao', run: `(() => { const AU = 1 / 206264.806; astro.select(null); astro.flyTo({ id: 'v', name: 'Sistema Solar interno', kind: 'view', pos: () => [0, 0, 0], radius: 0, viewDist: 9 * AU, arriveDir: [0, -0.398, 0.917] }); })()`, wait: 9000,
    check: `astro.smallbodies.loadedCount() >= 100000 || 'asteroides não carregaram'` },
  { name: 'ceres', run: go('Ceres'), wait: 11000, check: `/Ceres/.test(document.querySelector('#info h2')?.textContent) || 'ficha de Ceres não abriu'` },
  { name: 'halley', run: go('Cometa Halley'), wait: 11000 },
  { name: 'geminideas', run: go('Geminídeas'), wait: 11000, check: `/Faetonte/.test(document.getElementById('infoBody').textContent) || 'chuva de meteoros sem origem'` },
  { name: 'aproximacoes', external: true, run: `document.getElementById('tNow').click(); [...document.querySelectorAll('#placeList button')].find(b => b.textContent.includes('aproximações')).click()`, wait: 6000,
    check: `document.querySelectorAll('.neoRow').length > 0 || 'lista de aproximações vazia: ' + document.getElementById('neoBody').textContent.slice(0, 80)` },
  { name: 'eclipse-2027', run: `document.getElementById('neoPanel').hidden = true; document.getElementById('btnTime').click(); document.querySelector('#timePanel [data-tab=ecl]').click(); [...document.querySelectorAll('.eclRow')].find(r => r.textContent.includes('2027') && r.textContent.includes('anular')).click()`, wait: 12000,
    check: `astro.F.date.getUTCFullYear() === 2027 || 'data do eclipse não foi aplicada'` },
  { name: 'replay-apollo11', run: `document.getElementById('btnTime').click(); document.querySelector('#timePanel [data-tab=rep]').click(); [...document.querySelectorAll('.repRow')].find(r => r.textContent.includes('Apollo')).click()`, wait: 10000,
    check: `!document.getElementById('replayCap').hidden && astro.F.date.getUTCFullYear() === 1969 || 'replay da Apollo 11 não começou'` },
  { name: 'replay-voyager-jupiter', run: `document.getElementById('rcStop').click(); document.getElementById('btnTime').click(); document.querySelector('#timePanel [data-tab=rep]').click(); [...document.querySelectorAll('.repRow')].find(r => r.textContent.includes('Voyager')).click(); setTimeout(() => { for (let i = 0; i < 3; i++) document.getElementById('rcNext').click(); }, 1500)`, wait: 16000,
    check: `/Júpiter/.test(document.getElementById('rcText').textContent) || 'replay da Voyager não chegou a Júpiter'` },
  { name: 'milenios', run: `document.getElementById('rcStop').click(); astro.F.date = new Date(946728000000 + 50000 * 31557600000)`, wait: 3000,
    check: `/ano\\s52/.test(document.getElementById('clock').textContent) || 'data de 50 mil anos não aparece no relógio: ' + document.getElementById('clock').textContent` },
  { name: 'busca-simbad', run0: `document.getElementById('tNow').click(); document.getElementById('neoPanel').hidden = true`, external: true, run: `(async () => { const i = document.getElementById('search'); i.value = 'cartwheel galaxy'; i.dispatchEvent(new Event('input')); document.querySelector('#suggest li:last-child').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); })()`, wait: 16000,
    check: `/MCG|Cartwheel|Roda/i.test(document.querySelector('#info h2')?.textContent || '') || 'busca no SIMBAD não encontrou a galáxia da Roda de Carro'` },
  { name: 'telescopio-lua', external: true, run: `astro.select(astro.search.searchLocal('Lua',1)[0].make()); dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))`, wait: 10000,
    check: `!document.getElementById('scope').hidden || 'telescópio não abriu'` },
  { name: 'transmissao-goes', external: true, run: `document.getElementById('scopeClose').click(); document.getElementById('btnFeeds').click(); document.querySelector('[data-ch=goes19-ssa]').click()`, wait: 10000,
    check: `!document.getElementById('vImg').hidden || 'imagem do GOES-19 não carregou: ' + document.getElementById('vStatus').textContent` },
];

// ---------------------------------------------------------------- execução
const server = spawn(process.execPath, [path.join(ROOT, 'serve.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, ASTROLAB_NO_REFRESH: '1' } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(800);

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1400,850'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 850 });
const errors = [], warnings = [];
page.on('pageerror', e => errors.push(`[página] ${e.message}`));
page.on('console', m => {
  if (m.type() === 'error' && !/Failed to load resource|CORS policy|net::ERR/.test(m.text())) errors.push(`[console] ${m.text()}`);
  if (m.type() === 'warning' && /three|WebGL|GLSL|shader/i.test(m.text())) warnings.push(m.text());
});

const results = [];
let fail = false;
try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('done') || /Erro/.test(document.getElementById('loadStep')?.textContent), { timeout: 90000 });
  await sleep(2000);
  for (const s of STOPS) {
    if (QUICK && s.external) continue;
    const before = errors.length;
    const t0 = Date.now();
    let msg = 'ok';
    try {
      if (s.run0) await page.evaluate(s.run0);
      if (s.run) await page.evaluate(s.run);
      await sleep(s.wait || 1500);
      if (s.check) { const r = await page.evaluate(s.check); if (r !== true) msg = String(r); }
    } catch (e) { msg = 'exceção: ' + e.message.split('\n')[0]; }
    if (errors.length > before) msg = (msg === 'ok' ? '' : msg + '; ') + errors.slice(before).join(' | ');
    const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); (function f() { n++; performance.now() - t < 1000 ? requestAnimationFrame(f) : r(n); })(); }));
    await page.screenshot({ path: path.join(OUT, `${String(results.length).padStart(2, '0')}-${s.name}.png`) });
    const ok = msg === 'ok', soft = !ok && s.external;
    if (!ok && !soft) fail = true;
    results.push({ name: s.name, ok, soft, msg, fps, s: ((Date.now() - t0) / 1000).toFixed(0) });
    console.log(`${ok ? '✔' : soft ? '⚠' : '✘'} ${s.name.padEnd(18)} ${String(fps).padStart(3)} fps  ${ok ? '' : msg}`);
  }
} catch (e) {
  fail = true;
  console.log('✘ falha geral:', e.message);
} finally {
  await browser.close();
  server.kill();
}
if (warnings.length) console.log(`\nAvisos de GPU/shader (${warnings.length}):\n  ` + [...new Set(warnings)].slice(0, 5).join('\n  '));
const softs = results.filter(r => r.soft).length;
console.log(`\n${fail ? 'REPROVADO' : 'APROVADO'}: ${results.filter(r => r.ok).length}/${results.length} paradas ok${softs ? `, ${softs} com fonte externa fora do ar (não reprova)` : ''}. Capturas em tools/smoke-out/`);
process.exit(fail ? 1 : 0);
