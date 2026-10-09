// Reduz as texturas 8K (textures/8k) para 4096×2048 (textures/4k), usando o Edge/Chrome sem janela para decodificar e
// redimensionar (sem bibliotecas de imagem no Node). Precisa do servidor local rodando: node serve.mjs 8080
// Uso: node tools/resize-textures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'textures', '8k'), DST = path.join(ROOT, 'textures', '4k');
fs.mkdirSync(DST, { recursive: true });
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', protocolTimeout: 300000 });
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.jpg'))) {
  const out = path.join(DST, f.replace('8k_', '4k_'));
  if (fs.existsSync(out)) continue;
  const page = await browser.newPage();   // página nova por imagem: libera a memória da anterior
  await page.goto('http://localhost:8080/style.css');
  const b64 = await page.evaluate(async name => {
    // <img> decodifica JPEGs 8K que o createImageBitmap recusa
    const blob = await (await fetch(`/textures/8k/${name}`)).blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 4096; c.height = 2048;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, 4096, 2048);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, f);
  await page.close();
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`  ${path.basename(out)}: ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
}
await browser.close();
