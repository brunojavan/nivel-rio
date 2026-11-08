// Gráficos do site. Os pequenos (linha de 24 h, anel de ocupação, régua, barras) são SVG/HTML feitos
// aqui, sem biblioteca, para a tela inicial abrir rápido. O grande, da página da estação, usa o uPlot.
import { cssVar, el, FUSO, num } from './comum.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
};

const COR_FAIXA = { normal: '--normal', atencao: '--atencao', alerta: '--alerta', emergencia: '--emergencia' };
export const corFaixa = (f) => `var(${COR_FAIXA[f] ?? '--semcota'})`;

// Linha das últimas 24 h. Largura em px; com esticar=true ocupa a largura do cartão.
// Faixa mínima de 20 cm no eixo, para um rio parado não parecer agitado.
export function sparkline(serie, { largura = 92, altura = 30, cotas = null, faixa = null, esticar = false, minimo = 0.2, rotulo = '' } = {}) {
  const W = esticar ? 300 : largura, H = altura, P = 3;
  const s = svg('svg', {
    width: esticar ? '100%' : largura, height: altura, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: esticar ? 'none' : null,
    role: 'img', 'aria-label': rotulo || 'Gráfico das últimas 24 horas', class: 'spark',
  });
  const vals = serie.v.filter((x) => x != null);
  if (vals.length < 2) {
    s.append(svg('line', { x1: 0, x2: W, y1: H / 2, y2: H / 2, stroke: 'var(--linha)', 'stroke-dasharray': '3 3', 'vector-effect': 'non-scaling-stroke' }));
    return s;
  }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  // Mostra a próxima cota acima do nível se ela estiver perto (dá a noção de quanto falta).
  const linhas = [];
  if (cotas) {
    for (const [f, v] of [['atencao', cotas.atencao], ['alerta', cotas.alerta], ['emergencia', cotas.emergencia]]) {
      if (v == null) continue;
      const faixaAtual = Math.max(hi - lo, minimo);
      if (v <= hi + faixaAtual * 1.2 && v >= lo - faixaAtual * 0.5) linhas.push([f, v]);
      if (v > hi) break;
    }
    for (const [, v] of linhas) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  if (hi - lo < minimo) { const m = (hi + lo) / 2; lo = m - minimo / 2; hi = m + minimo / 2; }
  const fim = Date.now() / 1000, ini = fim - 24 * 3600;
  const x = (t) => ((Math.max(t, ini) - ini) / (fim - ini)) * (W - 2 * P) + P;
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);

  for (const [f, v] of linhas)
    s.append(svg('line', { x1: 0, x2: W, y1: y(v), y2: y(v), stroke: corFaixa(f), 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.8, 'vector-effect': 'non-scaling-stroke' }));

  // Trechos sem buraco (buraco = mais de 2 h sem ponto; Blumenau mede de hora em hora).
  const trechos = [];
  let atual = [];
  for (let i = 0; i < serie.t.length; i++) {
    const v = serie.v[i];
    if (v == null) continue;
    if (atual.length && serie.t[i] - atual[atual.length - 1][0] > 7300) { trechos.push(atual); atual = []; }
    atual.push([serie.t[i], v]);
  }
  if (atual.length) trechos.push(atual);

  const cor = faixa && faixa !== 'normal' ? corFaixa(faixa) : 'var(--agua)';
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  const defs = svg('defs');
  const grad = svg('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 });
  grad.append(svg('stop', { offset: '0%', 'stop-color': cor, 'stop-opacity': 0.28 }), svg('stop', { offset: '100%', 'stop-color': cor, 'stop-opacity': 0 }));
  defs.append(grad);
  s.append(defs);
  for (const tr of trechos) {
    const d = tr.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    if (tr.length > 1) s.append(svg('path', { d: `${d}L${x(tr[tr.length - 1][0]).toFixed(1)} ${H}L${x(tr[0][0]).toFixed(1)} ${H}Z`, fill: `url(#${id})` }));
    s.append(svg('path', { d, fill: 'none', stroke: cor, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
  }
  const ult = trechos[trechos.length - 1]?.at(-1);
  if (ult) s.append(svg('path', { d: `M${x(ult[0]).toFixed(1)} ${y(ult[1]).toFixed(1)}h0`, stroke: cor, 'stroke-width': 6, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
  return s;
}

// Anel de ocupação da barragem.
export function anel(pct, { tamanho = 88, espessura = 10, rotulo = '' } = {}) {
  const r = (tamanho - espessura) / 2, c = 2 * Math.PI * r;
  const s = svg('svg', { width: tamanho, height: tamanho, viewBox: `0 0 ${tamanho} ${tamanho}`, role: 'img', 'aria-label': rotulo });
  const centro = tamanho / 2;
  s.append(svg('circle', { cx: centro, cy: centro, r, fill: 'none', stroke: 'var(--linha)', 'stroke-width': espessura }));
  if (pct != null) {
    const p = Math.max(0, Math.min(100, pct));
    const cor = p >= 80 ? 'var(--emergencia)' : p >= 50 ? 'var(--alerta)' : p >= 20 ? 'var(--atencao)' : 'var(--agua)';
    s.append(svg('circle', {
      cx: centro, cy: centro, r, fill: 'none', stroke: cor, 'stroke-width': espessura, 'stroke-linecap': 'round',
      'stroke-dasharray': `${(c * p) / 100} ${c}`, transform: `rotate(-90 ${centro} ${centro})`,
    }));
  }
  const t = svg('text', { x: centro, y: centro + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: 'var(--texto)', 'font-size': tamanho * 0.22, 'font-weight': 750 });
  t.textContent = pct == null ? '—' : `${num(pct, pct < 10 ? 1 : 0)}%`;
  s.append(t);
  return s;
}

// Régua vertical: o nível atual dentro das faixas de cota.
export function regua(nivel, cotas, { altura = 230, largura = 112 } = {}) {
  const s = svg('svg', { width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`, role: 'img', 'aria-label': 'Nível atual em relação às cotas' });
  const topoCota = cotas.emergencia ?? cotas.alerta ?? cotas.atencao;
  const hi = Math.max(topoCota, nivel ?? 0) * 1.15, lo = 0;
  const T = 8, B = altura - 8, X = 10, L = 30;
  const y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
  const faixas = [
    ['normal', lo, cotas.atencao ?? cotas.alerta ?? cotas.emergencia],
    ['atencao', cotas.atencao, cotas.alerta ?? cotas.emergencia],
    ['alerta', cotas.alerta, cotas.emergencia],
    ['emergencia', cotas.emergencia, hi],
  ].filter(([, a, b]) => a != null && b != null && b > a);
  for (const [f, a, b] of faixas)
    s.append(svg('rect', { x: X, y: y(b), width: L, height: y(a) - y(b), fill: corFaixa(f), opacity: 0.22 }));
  s.append(svg('rect', { x: X, y: T, width: L, height: B - T, fill: 'none', stroke: 'var(--linha)', rx: 6 }));
  if (nivel != null) {
    s.append(svg('rect', { x: X + 4, y: y(Math.min(nivel, hi)), width: L - 8, height: B - y(Math.min(nivel, hi)), fill: 'var(--agua)', opacity: 0.85, rx: 4 }));
  }
  for (const [f, v] of [['atencao', cotas.atencao], ['alerta', cotas.alerta], ['emergencia', cotas.emergencia]]) {
    if (v == null) continue;
    s.append(svg('line', { x1: X - 4, x2: X + L + 4, y1: y(v), y2: y(v), stroke: corFaixa(f), 'stroke-width': 2 }));
    const t = svg('text', { x: X + L + 8, y: y(v) + 4, 'font-size': 11, fill: corFaixa(f), 'font-weight': 700 });
    t.textContent = `${num(v, v % 1 ? 2 : 0)} m`;
    s.append(t);
  }
  return s;
}

// Barras de variação em 24 h (sobe para a direita em vermelho, desce para a esquerda em verde).
export function barrasVariacao(itens) {
  const max = Math.max(0.1, ...itens.map((i) => Math.abs(i.valor ?? 0)));
  const caixa = el('div', { class: 'barras', role: 'list' });
  for (const i of itens) {
    const largura = i.valor == null ? 0 : (Math.abs(i.valor) / max) * 50;
    const lado = (i.valor ?? 0) >= 0 ? 'left:50%' : `left:${50 - largura}%`;
    const cor = i.valor == null ? 'transparent' : i.valor >= 0.02 ? 'var(--sobe)' : i.valor <= -0.02 ? 'var(--desce)' : 'var(--suave)';
    const texto = i.valor == null ? 'sem dado' : `${i.valor >= 0 ? '+' : '−'}${num(Math.abs(i.valor) * 100, 0)} cm`;
    caixa.append(el('a', { class: 'barra-linha', role: 'listitem', href: `/estacao/${i.id}` },
      el('span', { class: 'barra-nome' }, i.nome),
      el('span', { class: 'barra-trilho' }, el('i', { style: `${lado};width:${largura}%;background:${cor}` })),
      el('span', { class: 'barra-valor num' }, texto)));
  }
  return caixa;
}

// Linha do tempo das comportas: um trilho por comporta, azul onde esteve aberta.
export function linhaTempoComportas(comportas, de, ate) {
  const caixa = el('div', { class: 'linha-tempo' });
  for (const c of comportas) {
    const trilho = el('span', { class: 'trilho', title: `Comporta ${c.nome}` });
    const m = c.mudancas;
    for (let i = 0; i < m.length; i++) {
      if (m[i][1] !== 1) continue;
      const a = Math.max(m[i][0], de), b = Math.min(i + 1 < m.length ? m[i + 1][0] : ate, ate);
      if (b <= a) continue;
      trilho.append(el('i', { style: `left:${((a - de) / (ate - de)) * 100}%;width:${((b - a) / (ate - de)) * 100}%` }));
    }
    caixa.append(el('div', { class: 'faixa-comporta' }, el('span', { class: 'suave' }, c.nome), trilho));
  }
  return caixa;
}

// Gráfico grande (uPlot): área sob a linha, faixas de cota pintadas ao fundo, buraco onde não houve medição.
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function rotulosTempo(u, splits, ax, espaco, incremento) {
  let diaAnterior = null;
  return splits.map((ts) => {
    const dia = fmtDia.format(ts * 1000);
    if (incremento >= 86_400) return dia;
    const texto = dia !== diaAnterior ? `${fmtHora.format(ts * 1000)}\n${dia}` : fmtHora.format(ts * 1000);
    diaAnterior = dia;
    return texto;
  });
}

function rgba(cor, a) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = cor;
  const h = c.fillStyle; // #rrggbb
  if (!h.startsWith('#')) return cor;
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function graficoSerie(caixa, serie, { cotas = null, unidade = ' m', casas = 2, intervalo = 300, rotulo = 'Nível', altura = 280, minimo = 0.2 } = {}) {
  caixa.replaceChildren();
  caixa._ro?.disconnect();
  if (typeof uPlot === 'undefined') { caixa.append(el('p', { class: 'vazio' }, 'Não foi possível carregar o gráfico.')); return null; }
  const limite = Math.max(3 * intervalo, 1800);
  const xs = [], ys = [];
  for (let i = 0; i < serie.t.length; i++) {
    if (serie.v[i] == null) continue;
    if (xs.length && serie.t[i] - xs[xs.length - 1] > limite) { xs.push(xs[xs.length - 1] + 1); ys.push(null); }
    xs.push(serie.t[i]); ys.push(serie.v[i]);
  }
  if (!xs.length) { caixa.append(el('p', { class: 'vazio' }, 'Ainda não há leituras guardadas neste período.')); return null; }

  const vals = ys.filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const cotasLista = cotas ? [['atencao', 'Atenção', cotas.atencao], ['alerta', 'Alerta', cotas.alerta], ['emergencia', 'Emergência', cotas.emergencia]].filter(([, , v]) => v != null) : [];
  // Inclui a próxima cota acima do máximo no eixo, para mostrar quanto falta.
  const prox = cotasLista.find(([, , v]) => v > hi);
  if (prox && prox[2] - hi < Math.max(hi - lo, 1) * 1.5) hi = prox[2];
  for (const [, , v] of cotasLista) if (v < hi && v > lo - (hi - lo)) lo = Math.min(lo, v);
  if (hi - lo < minimo) { const m = (hi + lo) / 2; lo = m - minimo / 2; hi = m + minimo / 2; }
  const folga = (hi - lo) * 0.08;

  const agua = cssVar('--agua'), suave = cssVar('--suave'), linha = cssVar('--linha');
  const eixo = { stroke: suave, grid: { stroke: linha, width: 1 }, ticks: { show: false }, font: '11px system-ui, sans-serif' };
  const fmt = (v) => (v == null ? '—' : num(v, casas) + unidade);
  const opts = {
    width: caixa.clientWidth || 320,
    height: altura,
    tzDate: (ts) => uPlot.tzDate(new Date(ts * 1000), FUSO),
    scales: { y: { range: () => [lo - folga, hi + folga] } },
    axes: [{ ...eixo, values: rotulosTempo }, { ...eixo, size: 52, values: (u, v) => v.map((x) => num(x, unidade === '%' ? 0 : 1)) }],
    series: [
      { label: 'Horário', value: (u, v) => (v == null ? '—' : fmtDiaHora.format(v * 1000)) },
      {
        label: rotulo, stroke: agua, width: 2.2, value: (u, v) => fmt(v), spanGaps: false, points: { show: xs.length < 50 },
        fill: (u) => {
          if (!Number.isFinite(u.bbox?.top) || !Number.isFinite(u.bbox?.height)) return rgba(agua, 0.15);
          const g = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
          g.addColorStop(0, rgba(agua, 0.3)); g.addColorStop(1, rgba(agua, 0.02));
          return g;
        },
      },
      ...cotasLista.map(([f, nome]) => ({ label: nome, stroke: cssVar(`--${f}`), width: 1.2, dash: [6, 4], value: (u, v) => fmt(v), points: { show: false } })),
    ],
    cursor: { y: false, points: { size: 8 } },
    legend: { live: true },
    hooks: {
      // Faixas de cota pintadas ao fundo.
      drawAxes: [(u) => {
        if (!cotasLista.length) return;
        const ctx = u.ctx;
        const limites = cotasLista.map(([f, , v]) => [f, v]);
        ctx.save();
        for (let i = 0; i < limites.length; i++) {
          const [f, a] = limites[i];
          const b = i + 1 < limites.length ? limites[i + 1][1] : hi + folga * 2;
          const ya = u.valToPos(a, 'y', true), yb = u.valToPos(b, 'y', true);
          ctx.fillStyle = rgba(cssVar(`--${f}`), 0.08);
          ctx.fillRect(u.bbox.left, Math.max(yb, u.bbox.top), u.bbox.width, Math.min(ya, u.bbox.top + u.bbox.height) - Math.max(yb, u.bbox.top));
        }
        ctx.restore();
      }],
    },
  };
  const data = [xs, ys, ...cotasLista.map(([, , v]) => xs.map(() => v))];
  const u = new uPlot(opts, data, caixa);
  caixa._ro = new ResizeObserver(() => u.setSize({ width: caixa.clientWidth, height: altura }));
  caixa._ro.observe(caixa);
  return u;
}
