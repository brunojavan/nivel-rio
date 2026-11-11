// Gráficos da página da estação, no mundo "Marcas da enchente": o nível como a parede esticada no tempo, e a
// linha do tempo das comportas.
import { cssVar, el, FUSO, num } from './comum.js';

// Linha do tempo das comportas: um trilho por comporta, preenchido onde esteve aberta.
export function linhaTempoComportas(comportas, de, ate) {
  const caixa = el('div', { class: 'linha-tempo' });
  for (const c of comportas) {
    const trilho = el('span', { class: 'trilho', role: 'img', 'aria-label': `Comporta ${c.nome}` });
    const m = c.mudancas;
    let abertaAlgum = false;
    for (let i = 0; i < m.length; i++) {
      if (m[i][1] !== 1) continue;
      const a = Math.max(m[i][0], de), b = Math.min(i + 1 < m.length ? m[i + 1][0] : ate, ate);
      if (b <= a) continue;
      abertaAlgum = true;
      trilho.append(el('i', { style: `left:${((a - de) / (ate - de)) * 100}%;width:${((b - a) / (ate - de)) * 100}%` }));
    }
    trilho.setAttribute('aria-label', `Comporta ${c.nome}: ${abertaAlgum ? 'esteve aberta no período' : 'fechada no período todo'}`);
    caixa.append(el('div', { class: 'faixa-comporta' }, el('span', {}, c.nome), trilho));
  }
  return caixa;
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function rotulosTempo(u, splits, ax, espaco, incremento) {
  let diaAnterior = null;
  return splits.map((ts) => {
    const dia = fmtDia.format(ts * 1000);
    if (incremento >= 86_400) return dia;
    const texto = dia !== diaAnterior ? `${fmtHora.format(ts * 1000).replace(':', 'h')}\n${dia}` : fmtHora.format(ts * 1000).replace(':', 'h');
    diaAnterior = dia;
    return texto;
  });
}

function rgba(cor, a) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = cor;
  const h = c.fillStyle;
  if (!h.startsWith('#')) return cor;
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Gráfico grande: a parede da cidade esticada no tempo. A água é a mesma da parede (cheia, sob a linha), as
// cotas são faixas pintadas com o nome na ponta direita, fora da área do gráfico (nunca em cima da leitura
// mais recente), e a escala sempre mostra a cota mais próxima abaixo e acima. Sem legenda: uma linha de texto
// em cima mostra a última leitura, ou o horário onde o mouse ou o dedo estiver. Buraco onde não houve medição.
const MARGEM_NOMES = 82;
// Casas decimais da régua do gráfico: as que o passo pede (0,25 m mostra 5,25, nunca "5,3").
const casasDoPasso = (passo) => (passo >= 1 ? 0 : Math.abs(passo * 10 - Math.round(passo * 10)) < 1e-6 ? 1 : 2);

export function graficoSerie(caixa, serie, { cotas = null, unidade = ' m', casas = 2, intervalo = 300, rotulo = 'Nível', altura = 280, minimo = 0.2, agora = null } = {}) {
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
  // A leitura de agora (a da placa) termina o gráfico. Colada na série, continua a linha; depois de um buraco
  // (a série guardada atrasou), entra como um ponto marcado, ligado ao último ponto guardado por um tracejado:
  // nunca some e nunca finge medições que não houve.
  let ysAgora = null;
  if (agora?.v != null && agora.t && (!xs.length || agora.t > xs.at(-1))) {
    if (xs.length && agora.t - xs.at(-1) <= limite) { xs.push(agora.t); ys.push(agora.v); }
    else {
      ysAgora = xs.map(() => null);
      if (xs.length) ysAgora[ys.length - 1] = ys.at(-1);
      xs.push(agora.t); ys.push(null); ysAgora.push(agora.v);
    }
  }
  if (!xs.length) { caixa.append(el('p', { class: 'vazio' }, 'Ainda não há leituras guardadas neste período.')); return null; }
  const valorEm = (i) => ys[i] ?? ysAgora?.[i] ?? null;

  const vals = [...ys, ...(ysAgora ?? [])].filter((v) => v != null);
  const minDado = Math.min(...vals), maxDado = Math.max(...vals);
  const cotasLista = (cotas ? [['atencao', 'atenção', cotas.atencao], ['alerta', 'alerta', cotas.alerta], ['emergencia', 'emergência', cotas.emergencia]] : [])
    .filter(([, , v]) => v != null).map(([f, nome, v]) => ({ f, nome, v })).sort((a, b) => a.v - b.v);
  // A cota mais próxima abaixo e a mais próxima acima do que o rio fez no período entram sempre na escala.
  const abaixo = cotasLista.filter((c) => c.v <= minDado).at(-1);
  const acima = cotasLista.find((c) => c.v > maxDado);
  let lo = Math.min(minDado, abaixo?.v ?? minDado), hi = Math.max(maxDado, acima?.v ?? maxDado);
  if (hi - lo < minimo) { const m = (hi + lo) / 2; lo = m - minimo / 2; hi = m + minimo / 2; }
  const folga = (hi - lo) * 0.1;
  const visiveis = cotasLista.filter((c) => c.v >= lo - folga && c.v <= hi + folga);

  const fmt = (v) => (v == null ? '—' : num(v, casas) + unidade);
  const quando = (ts) => fmtDiaHora.format(ts * 1000).replace(':', 'h');
  const ultimo = xs.length - 1;
  const padrao = `Última leitura, ${quando(xs[ultimo])}: ${fmt(valorEm(ultimo))}. Passe o mouse ou toque no gráfico para ver outro horário.`;
  const leitor = el('p', { class: 'leitor' }, padrao);
  const tela = el('div', {
    class: 'tela', role: 'img',
    'aria-label': `${rotulo} entre ${fmt(minDado)} e ${fmt(maxDado)} no período, última leitura ${fmt(valorEm(ultimo))}`
      + (visiveis.length ? `. Cotas: ${visiveis.map((c) => `${c.nome} ${fmt(c.v)}`).join(', ')}.` : '.'),
  });
  caixa.append(leitor, tela);

  const agua = cssVar('--agua'), aguaLinha = cssVar('--placa-escura'), tinta = cssVar('--tinta'), tinta2 = cssVar('--tinta-2'), claro = cssVar('--reboco-claro');
  const fonte = '13px Overpass, system-ui, sans-serif';
  const eixo = { stroke: tinta2, grid: { show: false }, ticks: { show: true, stroke: tinta2, width: 1, size: 6 }, font: fonte, border: { show: true, stroke: tinta2, width: 1 } };

  // Faixas pintadas por cima da água (como na parede) e o nome de cada cota na margem da direita.
  function pintarCotas(u) {
    if (!visiveis.length) return;
    const ctx = u.ctx, pr = uPlot.pxRatio, { left, top, width, height } = u.bbox;
    const fim = left + width;
    const ys = visiveis.map((c) => ({ c, y: Math.round(u.valToPos(c.v, 'y', true)) })).filter((p) => p.y >= top - 2 * pr && p.y <= top + height + 2 * pr);
    // Nomes de cima para baixo, sem um encostar no outro.
    const nomes = [...ys].sort((a, b) => a.y - b.y);
    const passo = 30 * pr;
    for (let i = 1; i < nomes.length; i++) nomes[i].yNome = Math.max(nomes[i].y, (nomes[i - 1].yNome ?? nomes[i - 1].y) + passo);
    nomes[0] && (nomes[0].yNome = nomes[0].y);
    ctx.save();
    for (const p of nomes) {
      ctx.fillStyle = cssVar(`--${p.c.f}`);
      ctx.fillRect(left, p.y - 2 * pr, width + 8 * pr, 4 * pr);
      ctx.fillStyle = cssVar(`--${p.c.f}-txt`);
      ctx.textAlign = 'left';
      ctx.font = `800 ${12 * pr}px Overpass, system-ui, sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(p.c.nome, fim + 12 * pr, p.yNome - 3 * pr);
      ctx.font = `600 ${12 * pr}px Overpass, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(num(p.c.v, casas) + unidade, fim + 12 * pr, p.yNome + 4 * pr);
    }
    ctx.restore();
  }

  const opts = {
    width: tela.clientWidth || 320,
    height: altura,
    padding: [12, MARGEM_NOMES, 0, 0],
    tzDate: (ts) => uPlot.tzDate(new Date(ts * 1000), FUSO),
    scales: { y: { range: () => (unidade === '%' ? [0, Math.max(hi + folga, 10)] : [lo - folga, hi + folga]) } },
    axes: [{ ...eixo, values: rotulosTempo }, { ...eixo, size: 50, values: (u, v, eixoI, espaco, passo) => v.map((x) => num(x, casasDoPasso(passo))) }],
    series: [
      {},
      { label: rotulo, stroke: aguaLinha, width: 2, fill: rgba(agua, 0.86), spanGaps: false, points: { show: xs.length < 50, size: 5, fill: aguaLinha } },
      ...(ysAgora ? [{ label: 'Agora', stroke: aguaLinha, width: 2, dash: [5, 4], spanGaps: true, points: { show: true, size: 9, width: 2, stroke: aguaLinha, fill: aguaLinha, filter: () => [ultimo] } }] : []),
    ],
    cursor: { y: false, points: { size: 11, width: 2, stroke: () => tinta, fill: () => claro } },
    legend: { show: false },
    hooks: {
      draw: [pintarCotas],
      setCursor: [(u) => {
        const i = u.cursor.idx;
        leitor.textContent = i == null || valorEm(i) == null ? padrao : `${quando(xs[i])}: ${fmt(valorEm(i))}`;
      }],
    },
  };
  const u = new uPlot(opts, ysAgora ? [xs, ys, ysAgora] : [xs, ys], tela);
  caixa._ro = new ResizeObserver(() => u.setSize({ width: tela.clientWidth, height: altura }));
  caixa._ro.observe(tela);
  return u;
}
