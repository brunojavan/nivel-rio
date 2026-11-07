'use strict';
// Nível Rio: tela inicial. Busca /api/agora a cada 5 minutos, só com a aba aberta.

const FUSO = 'America/Sao_Paulo';
const ATUALIZAR_MS = 5 * 60_000;

const GRUPOS = [
  { titulo: 'Barragens', barragens: true },
  { titulo: 'Alto Vale', sub: 'Itajaí do Oeste, Itajaí do Sul e Hercílio', rios: ['Itajaí do Oeste', 'Itajaí do Sul', 'Hercílio (Itajaí do Norte)'] },
  { titulo: 'Rio Itajaí-Açu', sub: 'de Rio do Sul até a foz', rios: ['Itajaí-Açu'] },
  { titulo: 'Rio Itajaí-Mirim', sub: 'de Vidal Ramos até Itajaí', rios: ['Itajaí-Mirim'] },
  { titulo: 'Afluentes e ribeirões', resto: true },
];

const NOMES_FAIXA = { normal: 'Normal', atencao: 'Atenção', alerta: 'Alerta', emergencia: 'Emergência' };

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const num = (v, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const hora = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function guardado(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
function guardar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: tudo bem */ }
}

function idadeTexto(seg) {
  const min = Math.round(seg / 60);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h${min % 60 && h < 6 ? ` ${min % 60} min` : ''}`;
  return `há ${Math.floor(h / 24)} dias`;
}

function faixaDe(nivel, cotas) {
  if (nivel == null || !cotas) return null;
  if (cotas.emergencia != null && nivel >= cotas.emergencia) return 'emergencia';
  if (cotas.alerta != null && nivel >= cotas.alerta) return 'alerta';
  if (cotas.atencao != null && nivel >= cotas.atencao) return 'atencao';
  return 'normal';
}

// Tendência: compara com a leitura de cerca de 1 hora antes (nunca com a coleta anterior).
function tendencia(atual, nivel, h1) {
  if (nivel == null || !h1 || !atual) return null;
  const horas = (Date.parse(atual) - Date.parse(h1.medido_em)) / 3_600_000;
  if (horas < 0.66 || horas > 1.75) return null;
  const cmh = ((nivel - h1.nivel) * 100) / horas;
  if (Math.abs(cmh) < 2) return { classe: 'estavel', texto: 'estável' };
  return cmh > 0
    ? { classe: 'sobe', texto: `▲ ${num(cmh, 0)} cm/h` }
    : { classe: 'desce', texto: `▼ ${num(-cmh, 0)} cm/h` };
}

let dados = null;
const abertos = new Set();

async function carregar() {
  try {
    const r = await fetch('/api/agora', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    dados = await r.json();
    desenhar();
  } catch (e) {
    $('#atualizado').textContent = 'Não foi possível carregar os dados agora. Tentando de novo em instantes…';
    setTimeout(carregar, 30_000);
  }
}

function desenhar() {
  const todas = $('#todas').checked;
  const conteudo = $('#conteudo');
  conteudo.replaceChildren();
  const usados = new Set();

  for (const g of GRUPOS) {
    let itens;
    if (g.barragens) itens = dados.barragens.map((b) => ({ barragem: b }));
    else {
      const lista = dados.estacoes.filter((e) => !usados.has(e.id) && (g.resto || g.rios.includes(e.rio)));
      lista.forEach((e) => usados.add(e.id));
      lista.sort((a, b) => (g.rios ? g.rios.indexOf(a.rio) - g.rios.indexOf(b.rio) : (a.rio ?? '').localeCompare(b.rio ?? '')) || (a.ordem ?? 99) - (b.ordem ?? 99));
      itens = lista.filter((e) => todas || e.principal).map((e) => ({ estacao: e }));
    }
    if (!itens.length) continue;

    const h2 = document.createElement('h2');
    h2.className = 'grupo';
    h2.textContent = g.titulo;
    if (g.sub) { const s = document.createElement('span'); s.className = 'suave'; s.textContent = g.sub; h2.append(s); }
    const lista = document.createElement('div');
    lista.className = 'lista';
    for (const it of itens) lista.append(it.barragem ? cartaoBarragem(it.barragem) : cartaoEstacao(it.estacao));
    conteudo.append(h2, lista);
  }

  situacaoGeral();
  atualizarIdades();
}

function novoCartao(id) {
  const art = $('#tpl-estacao').content.firstElementChild.cloneNode(true);
  art.dataset.id = id;
  const botao = $('.linha', art);
  botao.addEventListener('click', () => alternarDetalhe(art));
  return art;
}

function cartaoEstacao(e) {
  const art = novoCartao(e.id);
  $('.titulo', art).textContent = e.nome;
  $('.local', art).textContent = e.rio && !['Itajaí-Açu', 'Itajaí-Mirim'].includes(e.rio) ? `${e.municipio} · ${e.rio}` : e.municipio;

  const nivel = $('.nivel', art);
  if (e.nivel != null) nivel.innerHTML = `${num(e.nivel)} <small>m</small>`;
  else nivel.innerHTML = '<small>sem leitura</small>';

  const t = tendencia(e.medido_em, e.nivel, e.h1);
  const tend = $('.tendencia', art);
  if (t) { tend.textContent = t.texto; tend.classList.add(t.classe); }

  const faixa = $('.faixa', art);
  const f = faixaDe(e.nivel, e.cotas);
  if (e.situacao && e.situacao !== 'ativa') { faixa.textContent = e.situacao; faixa.className = 'faixa neutra'; }
  else if (f) {
    faixa.textContent = NOMES_FAIXA[f];
    faixa.className = `faixa ${f}`;
    if (f !== 'normal') art.classList.add(f);
  } else if (e.referencia === 'altitude') { faixa.textContent = 'altitude'; faixa.className = 'faixa neutra'; }
  else if (e.referencia === 'a-confirmar') { faixa.textContent = 'referência a confirmar'; faixa.className = 'faixa neutra'; }
  if (f && e.a_conferir.some((c) => c.startsWith('cotas'))) {
    const extra = document.createElement('span');
    extra.className = 'faixa neutra';
    extra.textContent = 'cotas a confirmar';
    faixa.after(extra);
  }

  const idade = $('.idade', art);
  idade.dataset.medido = e.medido_em ?? '';
  idade.dataset.intervalo = e.intervalo_s;
  if (abertos.has(e.id)) abrirDetalhe(art, e);
  return art;
}

function cartaoBarragem(b) {
  const art = novoCartao(b.id);
  $('.titulo', art).textContent = b.nome;
  $('.local', art).textContent = `${b.municipio} · ${b.rio}`;
  const nivel = $('.nivel', art);
  if (b.ocupacao_pct != null) nivel.innerHTML = `${num(b.ocupacao_pct, 1)}<small>%</small>`;
  else nivel.innerHTML = '<small>sem leitura</small>';
  const tend = $('.tendencia', art);
  tend.textContent = b.montante_m != null ? `nível ${num(b.montante_m)} m` : '';

  const meta = $('.meta', art);
  if (b.comportas.length) {
    const abertas = b.comportas.filter((c) => c.aberta).length;
    const faixa = $('.faixa', art);
    faixa.className = 'faixa neutra';
    faixa.textContent = abertas ? `${abertas} de ${b.comportas.length} comportas abertas` : `${b.comportas.length} comportas fechadas`;
    const chips = document.createElement('span');
    chips.className = 'comportas';
    chips.setAttribute('aria-hidden', 'true');
    for (const c of b.comportas) {
      const s = document.createElement('span');
      s.className = `comporta${c.aberta ? ' aberta' : ''}`;
      s.textContent = c.nome;
      s.title = c.aberta ? 'aberta' : 'fechada';
      chips.append(s);
    }
    meta.prepend(chips);
  }
  const idade = $('.idade', art);
  idade.dataset.medido = b.medido_em ?? '';
  idade.dataset.intervalo = b.intervalo_s;
  if (abertos.has(b.id)) abrirDetalhe(art, b);
  return art;
}

function atualizarIdades() {
  const agora = Date.now();
  for (const el of document.querySelectorAll('.idade')) {
    const medido = el.dataset.medido;
    if (!medido) { el.textContent = 'sem dados ainda'; continue; }
    const seg = (agora - Date.parse(medido)) / 1000;
    const atrasada = seg > 2 * Number(el.dataset.intervalo) + 120;
    el.textContent = atrasada ? `sem leitura nova ${idadeTexto(seg)}` : `medido ${idadeTexto(seg)}`;
    el.classList.toggle('atrasada', atrasada);
    el.title = `Última medição: ${hora(medido)}`;
  }
  if (dados) {
    const seg = (agora - Date.parse(dados.gerado_em)) / 1000;
    $('#atualizado').textContent = `Atualizado ${idadeTexto(seg)} (${hora(dados.gerado_em)})`;
  }
}

function situacaoGeral() {
  const avisos = [];
  const ordem = { emergencia: 3, alerta: 2, atencao: 1 };
  const altas = dados.estacoes
    .map((e) => ({ e, f: faixaDe(e.nivel, e.cotas) }))
    .filter((x) => x.f && ordem[x.f] >= 2)
    .sort((a, b) => ordem[b.f] - ordem[a.f]);
  if (altas.length) avisos.push(altas.map((x) => `${x.e.nome}: ${NOMES_FAIXA[x.f].toLowerCase()}`).join(' · '));

  const idade = (Date.now() - Date.parse(dados.gerado_em)) / 60_000;
  if (idade > 20) avisos.push(`Os dados não são atualizados desde ${hora(dados.gerado_em)}. A coleta pode estar com problema; confira os canais oficiais.`);
  for (const f of dados.fontes) {
    const ok = f.ultimo_sucesso ? Date.parse(f.ultimo_sucesso) : 0;
    if (f.ultimo_erro_em && Date.parse(f.ultimo_erro_em) > ok && Date.now() - ok > 30 * 60_000)
      avisos.push(`${f.nome}: sem resposta desde ${f.ultimo_sucesso ? hora(f.ultimo_sucesso) : 'o início'}.`);
  }
  const el = $('#situacao-geral');
  el.hidden = !avisos.length;
  el.replaceChildren(...avisos.map((a) => { const p = document.createElement('div'); p.textContent = a; return p; }));
}

// Detalhe com gráfico.
function alternarDetalhe(art) {
  const id = art.dataset.id;
  const item = dados.estacoes.find((e) => e.id === id) ?? dados.barragens.find((b) => b.id === id);
  if (abertos.has(id)) {
    abertos.delete(id);
    $('.detalhe', art).hidden = true;
    $('.detalhe', art).replaceChildren();
    $('.linha', art).setAttribute('aria-expanded', 'false');
  } else {
    abertos.add(id);
    abrirDetalhe(art, item);
  }
}

function abrirDetalhe(art, item) {
  const det = $('.detalhe', art);
  det.hidden = false;
  $('.linha', art).setAttribute('aria-expanded', 'true');
  const barragem = 'comportas' in item;

  const periodos = document.createElement('div');
  periodos.className = 'periodos';
  const grafico = document.createElement('div');
  grafico.className = 'grafico';
  const horasSalvas = guardado('horas', 24);
  for (const [h, rot] of [[24, '24 h'], [72, '3 dias'], [168, '7 dias']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = rot;
    b.setAttribute('aria-pressed', String(h === horasSalvas));
    b.addEventListener('click', () => {
      periodos.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      guardar('horas', h);
      desenharGrafico(grafico, item, h, barragem);
    });
    periodos.append(b);
  }

  const info = document.createElement('ul');
  info.className = 'info';
  const li = (texto) => { const l = document.createElement('li'); l.textContent = texto; info.append(l); };
  if (item.medido_em) li(`Última medição: ${hora(item.medido_em)}`);
  if (barragem) {
    if (item.volume_hm3 != null) li(`Volume: ${num(item.volume_hm3, 1)} milhões de m³`);
    if (item.jusante_m != null) li(`Rio logo abaixo da barragem: ${num(item.jusante_m)} m`);
    for (const c of item.comportas)
      li(`Comporta ${c.nome}: ${c.aberta ? 'aberta' : 'fechada'} ${c.desde_inicio_registro ? `(já estava assim em ${hora(c.desde)}, quando o registro começou)` : `desde ${hora(c.desde)}`}`);
    li('Fonte: Defesa Civil de SC');
  } else {
    if (item.h1) li(`1 hora antes: ${num(item.h1.nivel)} m (${hora(item.h1.medido_em)})`);
    if (item.h3) li(`3 horas antes: ${num(item.h3.nivel)} m (${hora(item.h3.medido_em)})`);
    if (item.cotas) {
      const c = item.cotas;
      const partes = [['atenção', c.atencao], ['alerta', c.alerta], ['emergência', c.emergencia]].filter(([, v]) => v != null).map(([n, v]) => `${n} ${num(v)} m`);
      li(`Cotas: ${partes.join(' · ')} (segundo ${c.fonte})`);
    } else li('Cotas: a fonte não publica cotas para esta estação.');
    if (item.referencia === 'altitude') li('Esta estação mede a altitude da água, não a régua: o número não se compara com o de outras estações.');
    for (const c of item.a_conferir) li(`A confirmar: ${c}`);
    li(`Fonte: ${item.fonte}`);
  }
  if (item.observacao) li(item.observacao);

  det.replaceChildren(periodos, grafico, info);
  desenharGrafico(grafico, item, horasSalvas, barragem);
}

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Rótulos do eixo do tempo em português: hora; o dia aparece embaixo quando muda.
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

async function desenharGrafico(el, item, horas, barragem) {
  el.textContent = 'Carregando o gráfico…';
  let serie;
  try {
    const r = await fetch(`/api/estacoes/${item.id}?horas=${horas}`);
    if (!r.ok) throw new Error();
    serie = await r.json();
  } catch {
    el.textContent = 'Não foi possível carregar o gráfico.';
    return;
  }
  const valores = barragem ? serie.ocupacao_pct : serie.nivel_m;
  if (!serie.t.length || typeof uPlot === 'undefined') {
    el.textContent = 'Ainda não há leituras guardadas neste período.';
    return;
  }

  // Só marca ponto onde houve medição: um intervalo grande vira um buraco no gráfico, não uma reta.
  const limite = Math.max(3 * (item.intervalo_s ?? 600), 1800);
  const xs = [], ys = [];
  for (let i = 0; i < serie.t.length; i++) {
    if (valores[i] == null) continue;
    if (xs.length && serie.t[i] - xs[xs.length - 1] > limite) { xs.push(xs[xs.length - 1] + 1); ys.push(null); }
    xs.push(serie.t[i]);
    ys.push(valores[i]);
  }
  if (!xs.length) { el.textContent = 'Ainda não há leituras guardadas neste período.'; return; }

  const unidade = barragem ? '%' : ' m';
  const fmt = (v) => (v == null ? '—' : num(v, barragem ? 1 : 2) + unidade);
  const cotas = !barragem && item.cotas ? item.cotas : null;
  const linhasCota = cotas
    ? [['Atenção', cotas.atencao, '--atencao'], ['Alerta', cotas.alerta, '--alerta'], ['Emergência', cotas.emergencia, '--emergencia']].filter(([, v]) => v != null)
    : [];

  const vMin = Math.min(...ys.filter((v) => v != null));
  const vMax = Math.max(...ys.filter((v) => v != null));
  const topo = cotas?.atencao != null ? Math.max(vMax, cotas.atencao) : vMax;
  const folga = Math.max((topo - vMin) * 0.08, barragem ? 1 : 0.05);

  const suave = cssVar('--suave'), linha = cssVar('--linha');
  const eixo = { stroke: suave, grid: { stroke: linha, width: 1 }, ticks: { stroke: linha, width: 1 }, font: '11px system-ui, sans-serif' };
  const opts = {
    width: el.clientWidth || 320,
    height: 220,
    tzDate: (ts) => uPlot.tzDate(new Date(ts * 1000), FUSO),
    scales: { y: { range: () => [vMin - folga, topo + folga] } },
    axes: [{ ...eixo, values: rotulosTempo }, { ...eixo, size: 48, values: (u, vals) => vals.map((v) => num(v, barragem ? 0 : 1)) }],
    series: [
      { label: 'Horário', value: (u, v) => (v == null ? '—' : fmtDiaHora.format(v * 1000)) },
      { label: barragem ? 'Ocupação' : 'Nível', stroke: cssVar('--grafico-linha'), width: 2, value: (u, v) => fmt(v), spanGaps: false, points: { show: xs.length < 60 } },
      ...linhasCota.map(([rotulo, , cor]) => ({ label: rotulo, stroke: cssVar(cor), width: 1, dash: [6, 4], value: (u, v) => fmt(v), points: { show: false } })),
    ],
    cursor: { y: false },
    legend: { live: true },
  };
  const data = [xs, ys, ...linhasCota.map(([, v]) => xs.map(() => v))];
  el.replaceChildren();
  el._ro?.disconnect();
  const u = new uPlot(opts, data, el);
  el._ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height: 220 }));
  el._ro.observe(el);
}

// Início.
$('#todas').checked = guardado('todas', false);
$('#todas').addEventListener('change', (ev) => { guardar('todas', ev.target.checked); if (dados) desenhar(); });

let timer = null;
function agendar() {
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, ATUALIZAR_MS);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dados && Date.now() - Date.parse(dados.gerado_em) > ATUALIZAR_MS) carregar();
});
setInterval(atualizarIdades, 30_000);
carregar();
agendar();
