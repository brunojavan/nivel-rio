// Gera os ícones raster a partir de public/favicon.svg (Chrome sem janela, pelo protocolo de depuração).
// node icones.mjs <favicon.svg> <pasta-saida>
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [svgPath, saida] = process.argv.slice(2);
// Versão clara do desenho (o raster não acompanha o tema): tinta sobre o reboco.
const svg = readFileSync(svgPath, 'utf8').replace(/<style>.*<\/style>/, '').replace('class="f"', 'fill="#1D2327"').replace('class="t"', 'stroke="#1D2327"');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORTA = 9800 + Math.floor(Math.random() * 100);
const perfil = saida + '/perfil'; mkdirSync(perfil, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let alvo;
for (let i = 0; i < 50 && !alvo; i++) { await espera(200); try { alvo = (await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0; const pend = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp('Page.enable');
await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
// tamanho, nome, fração do desenho, raio do canto (o iPhone arredonda sozinho o de 180)
const alvos = [[16, 'i16.png', 0.86, 2], [32, 'i32.png', 0.84, 4], [48, 'i48.png', 0.82, 6], [180, 'apple-touch-icon.png', 0.64, 0]];
for (const [t, nome, frac, raio] of alvos) {
  const html = `<html><body style="margin:0"><div style="width:${t}px;height:${t}px;background:#CFD4D6;border-radius:${raio}px;display:flex;align-items:center;justify-content:center">${svg.replace('<svg ', `<svg width="${Math.round(t * frac)}" height="${Math.round(t * frac)}" `)}</div></body></html>`;
  await cdp('Emulation.setDeviceMetricsOverride', { width: t, height: t, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await espera(600);
  const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: t, height: t, scale: 1 } });
  writeFileSync(`${saida}/${nome}`, Buffer.from(r.result.data, 'base64'));
}
ws.close(); chrome.kill();
// favicon.ico com as três PNG dentro (o formato aceita PNG desde o Windows Vista).
const pngs = [16, 32, 48].map((t) => [t, readFileSync(`${saida}/i${t}.png`)]);
const cab = Buffer.alloc(6); cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
let pos = 6 + 16 * pngs.length; const dirs = [];
for (const [t, b] of pngs) {
  const d = Buffer.alloc(16); d.writeUInt8(t, 0); d.writeUInt8(t, 1); d.writeUInt8(0, 2); d.writeUInt8(0, 3);
  d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(b.length, 8); d.writeUInt32LE(pos, 12); pos += b.length; dirs.push(d);
}
writeFileSync(`${saida}/favicon.ico`, Buffer.concat([cab, ...dirs, ...pngs.map(([, b]) => b)]));
console.log('ok');
