// Gera a imagem de prévia do link (og:image, 1200 × 630) no visual do site: a chamada à esquerda e, à direita,
// a parede de Blumenau com as cotas oficiais e as cheias registradas (sem água: a imagem fica parada e a água
// de agora mudaria). Chrome sem janela, pelo protocolo de depuração, como o icones.mjs.
// node scripts/compartilhar.mjs public/compartilhar.jpg
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const saida = resolve(process.argv[2] ?? 'public/compartilhar.jpg');
const raiz = resolve(new URL('..', import.meta.url).pathname);
const url = (p) => pathToFileURL(join(raiz, p)).href;

// Cheias: do catálogo, cada uma com a sua fonte. Cotas: as que o site mostra agora (AlertaBlu).
const blumenau = JSON.parse(readFileSync(join(raiz, 'catalogo/estacoes.json'), 'utf8')).estacoes.find((e) => e.id === 'blumenau');
const agora = await (await fetch('https://niveldorio.net/api/agora')).json();
const c = agora.estacoes.find((e) => e.id === 'blumenau').cotas;
const cotas = [
  { nome: 'Atenção', nivel: c.atencao, faixa: 'atencao' },
  { nome: 'Alerta', nivel: c.alerta, faixa: 'alerta' },
  { nome: 'Emergência', nivel: c.emergencia, faixa: 'emergencia' },
];
const num = (v) => v.toFixed(2).replace('.', ',');

// A parede: 18 m de altura, régua a cada 2 m. Cheias a menos de 15 px uma da outra dividem o traço (1983/1984).
const ALTURA = 452, TOPO = 18, m = ALTURA / TOPO;
const regua = [];
for (let v = 2; v < TOPO; v += 2) regua.push(`<span style="bottom:${(v * m).toFixed(1)}px">${v}</span>`);
const grupos = [];
for (const mk of [...blumenau.marcas].sort((a, b) => b.nivel - a.nivel)) {
  const g = grupos.at(-1);
  if (g && (g.nivel - mk.nivel) * m < 15) g.itens.push(mk);
  else grupos.push({ nivel: mk.nivel, itens: [mk] });
}
const marcas = grupos.map((g) => `<div class="historica" style="bottom:${(g.nivel * m).toFixed(1)}px"><span>${g.itens
  .map((x) => `<span class="cheia"><b>${x.data.slice(0, 4)}</b> ${num(x.nivel)} m</span>`).join('')}</span></div>`);
const faixas = cotas.map((k) => `<div class="cota" style="bottom:${(k.nivel * m).toFixed(1)}px;--c:var(--${k.faixa});--c-txt:var(--${k.faixa}-txt)"><b>${k.nome}</b> ${num(k.nivel).replace(',00', '')} m</div>`);

const marca = readFileSync(join(raiz, 'public/favicon.svg'), 'utf8').replace(/<style>.*<\/style>/, '')
  .replace('class="f"', 'fill="#1D2327"').replace('class="t"', 'stroke="#1D2327"');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('public/estilo.css')}">
<style>
@font-face { font-family: "OverpassOG"; src: url(${url('public/fontes/overpass-latin.woff2')}) format("woff2-variations"); font-weight: 100 900; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
.quadro { box-sizing: border-box; width: 1200px; height: 630px; display: grid; grid-template-columns: 1fr 372px; gap: 60px;
  padding: 54px 64px 50px 68px; font-family: "OverpassOG", sans-serif; color: var(--tinta); }
.esq { display: flex; flex-direction: column; min-width: 0; }
.nome { display: flex; align-items: center; gap: 12px; font-size: 30px; font-weight: 800; letter-spacing: -.01em; }
.nome svg { width: 40px; height: 40px; }
h1 { margin: 40px 0 0; font-size: 76px; font-weight: 800; line-height: 1.02; letter-spacing: -.028em; text-wrap: balance; }
.sub { margin-top: 26px; font-size: 27px; font-weight: 600; line-height: 1.32; color: var(--tinta-2); max-width: 600px; text-wrap: balance; }
.placa-url { margin-top: auto; align-self: flex-start; background: var(--placa); color: var(--branco); border-radius: 7px;
  padding: 14px 24px 9px; font-size: 40px; font-weight: 800; letter-spacing: -.01em; line-height: 1;
  box-shadow: inset 0 0 0 3px var(--placa), inset 0 0 0 5px var(--branco), 0 2px 3px rgba(20, 26, 30, .35); }
.dir { display: flex; flex-direction: column; }
.parede-og { position: relative; height: ${ALTURA}px; background: var(--grao), var(--manchas), var(--reboco-fundo);
  border: 1px solid var(--fio); border-bottom: 3px solid var(--tinta); overflow: hidden; }
.regua { position: absolute; left: 0; top: 0; bottom: 0; width: 30px; border-right: 1px solid var(--fio); }
.regua span { position: absolute; left: 0; width: 30px; text-align: center; font-size: 15px; font-weight: 700; color: var(--tinta-2); transform: translateY(50%); }
.regua span::after { content: ""; position: absolute; right: -1px; top: 50%; width: 7px; border-top: 1px solid var(--tinta-2); }
.cota { position: absolute; left: 30px; right: 0; border-bottom: 5px solid var(--c); padding: 0 8px 3px; font-size: 17px; line-height: 1.2; color: var(--c-txt); transform: translateY(0); }
.cota b { font-weight: 800; }
.historica { position: absolute; left: 30px; right: 0; display: flex; align-items: flex-start; gap: 6px; font-size: 16px; line-height: 1.2; color: var(--tinta-2);
  transform: translateY(calc(100% - 9px - 2.5px)); padding-left: 6px; }
.historica::before { content: ""; width: 26px; height: 5px; margin-top: 9px; background: var(--tinta-2); transform: rotate(-.8deg); flex: none; }
.historica .cheia { display: block; }
.historica b { font-size: 17px; font-weight: 800; color: var(--tinta); }
.og-legenda { margin-top: 12px; font-size: 18px; font-weight: 800; line-height: 1.25; }
.fonte { margin-top: 4px; font-size: 13px; line-height: 1.35; color: var(--tinta-2); }
</style></head><body>
<div class="quadro">
  <div class="esq">
    <div class="nome">${marca}Nível Rio</div>
    <h1>O nível do rio na sua cidade, agora.</h1>
    <p class="sub">Itajaí-Açu, Itajaí-Mirim e as barragens da bacia, com as cotas oficiais. Atualizado a cada&nbsp;5&nbsp;minutos.</p>
    <div class="placa-url">niveldorio.net</div>
  </div>
  <div class="dir">
    <div class="parede-og"><div class="regua">${regua.join('')}</div>${marcas.join('')}${faixas.join('')}</div>
    <div class="og-legenda">Blumenau: as cotas de hoje e as cheias registradas desde 1880</div>
    <div class="fonte">Cheias: Defesa Civil de Blumenau, via Mendeley Data<br>(CC&nbsp;BY&nbsp;4.0). Cotas: AlertaBlu.</div>
  </div>
</div>
</body></html>`;

const pasta = mkdtempSync(join(tmpdir(), 'compartilhar-'));
const pagina = join(pasta, 'og.html');
writeFileSync(pagina, html);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORTA = 9700 + Math.floor(Math.random() * 100);
mkdirSync(join(pasta, 'perfil'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${join(pasta, 'perfil')}`,
  '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let alvo;
for (let i = 0; i < 50 && !alvo; i++) { await espera(200); try { alvo = (await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0; const pend = new Map();
ws.addEventListener('message', (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg); pend.delete(msg.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: pathToFileURL(pagina).href });
await espera(1200);
const fonte = await cdp('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => document.fonts.check(\'800 76px OverpassOG\'))', awaitPromise: true });
if (!fonte.result?.result?.value) { console.error('a letra Overpass não carregou'); chrome.kill(); process.exit(1); }
const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
writeFileSync(saida, Buffer.from(r.result.data, 'base64'));
ws.close(); chrome.kill();
console.log(`ok: ${saida}`);
