// Página de uma estação (/estacao/{id}) ou de uma barragem: nível agora, tendência, projeção, gráfico
// com as cotas, estações do mesmo rio e da mesma cidade, mapa e detalhes da fonte.
import {
  carregarDados, CONFERIR, duracaoTexto, el, faixaDe, guardado, guardar, hora, idadeTexto, marca,
  NOMES_FAIXA, num, projecao, tendencia,
} from './comum.js';
import { chipsEstacao, idadeEl, linhaEstacao, listaAvisos, pintarIdade } from './componentes.js';
import { anel, graficoSerie, linhaTempoComportas, regua } from './graficos.js';

const $ = (s) => document.querySelector(s);
const id = decodeURIComponent(location.pathname.split('/')[2] ?? '');
const PERIODOS = [[24, '24 h'], [72, '3 dias'], [168, '7 dias'], [720, '30 dias']];
let dados = null, item = null, barragem = false;
let horas = guardado('horas', 24);
if (!PERIODOS.some(([h]) => h === horas)) horas = 24;
let mapaCriado = false;

function achar() {
  item = dados.estacoes.find((e) => e.id === id) ?? dados.barragens.find((b) => b.id === id) ?? null;
  barragem = !!item && 'comportas' in item;
}

// Cabeça: nome, nível grande, tendência, projeção e a régua com as cotas.
function cabeca() {
  const principal = el('div', { class: 'cartao' });
  if (barragem) {
    principal.append(
      el('h1', {}, item.nome), el('div', { class: 'onde' }, `${item.municipio} · ${item.rio}`),
      el('div', { class: 'grande' },
        el('span', { class: 'valor' }, item.ocupacao_pct != null ? num(item.ocupacao_pct, 1) : '—', el('small', {}, '% cheia'))),
      el('div', { class: 'pe', style: 'justify-content:flex-start;gap:14px;font-size:.88rem' },
        item.montante_m != null ? el('span', {}, `Nível do reservatório: ${num(item.montante_m)} m`) : null,
        item.volume_hm3 != null ? el('span', {}, `Volume: ${num(item.volume_hm3, 1)} milhões de m³`) : null,
        idadeEl(item)));
    const lado = el('div', { class: 'cartao', style: 'display:grid;place-items:center' }, anel(item.ocupacao_pct, { tamanho: 160, espessura: 16, rotulo: `Ocupação de ${item.nome}` }));
    return el('section', { class: 'cabeca-estacao' }, principal, lado);
  }

  const f = faixaDe(item.nivel, item.cotas);
  const t = tendencia(item);
  principal.append(
    el('div', { class: 'chips' }, chipsEstacao(item, dados.estacoes)),
    el('h1', { style: 'margin-top:6px' }, item.nome),
    el('div', { class: 'onde' }, [item.municipio, item.rio ?? 'rio a confirmar'].join(' · ')),
    el('div', { class: 'grande' },
      el('span', { class: 'valor' }, item.nivel != null ? num(item.nivel) : '—', el('small', {}, 'm')),
      t ? el('span', { class: `tendencia ${t.classe}` }, t.classe === 'estavel' ? '● estável na última hora' : `${t.texto} na última hora`) : null),
    el('div', { class: 'pe', style: 'justify-content:flex-start;gap:14px;font-size:.88rem' },
      idadeEl(item),
      item.h3 ? el('span', {}, `3 h antes: ${num(item.h3.nivel)} m`) : null));
  const p = projecao(item);
  if (p)
    principal.append(el('div', { class: `projecao${p.faixa === 'emergencia' || p.faixa === 'alerta' ? ' grave' : ''}` },
      el('b', {}, `Nesse ritmo (+${num(p.cmh, 0)} cm/h), chega à cota de ${NOMES_FAIXA[p.faixa].toLowerCase()} (${num(p.cota)} m) em cerca de ${duracaoTexto(p.horas)}.`),
      ' Estimativa simples pela última hora: não considera chuva, barragens nem a água que ainda vem de rio acima.'));
  else if (f && f !== 'normal' && t?.classe === 'desce')
    principal.append(el('div', { class: 'projecao' }, `Descendo ${num(-t.cmh, 0)} cm/h, ainda acima da cota de ${NOMES_FAIXA[f].toLowerCase()}.`));

  const partes = [principal];
  if (item.cotas && item.referencia !== 'altitude') {
    const c = item.cotas;
    partes.push(el('div', { class: 'cartao regua-caixa' },
      regua(item.nivel, c),
      el('div', { style: 'font-size:.8rem;align-self:center;max-width:150px' },
        el('p', { class: 'titulo-cartao' }, 'Cotas'),
        el('div', { class: 'suave' }, `Segundo ${c.fonte}.`),
        item.a_conferir.some((x) => x.startsWith('cotas')) ? el('div', { style: 'margin-top:6px' }, 'A confirmar: as fontes publicam valores diferentes.') : null)));
  }
  return el('section', { class: 'cabeca-estacao' }, ...partes);
}

function cartaoGrafico() {
  const periodos = el('div', { class: 'periodos', role: 'group', 'aria-label': 'Período do gráfico' });
  for (const [h, rot] of PERIODOS)
    periodos.append(el('button', {
      type: 'button', 'aria-pressed': String(h === horas),
      onclick: (ev) => {
        horas = h; guardar('horas', h);
        periodos.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === ev.currentTarget)));
        desenharGrafico();
      },
    }, rot));
  return el('div', { class: 'cartao' },
    el('div', { class: 'cartao-topo', style: 'align-items:center;flex-wrap:wrap' },
      el('p', { class: 'titulo-cartao', style: 'margin:0' }, barragem ? 'Ocupação da barragem' : 'Nível do rio'), periodos),
    el('div', { class: 'grafico', id: 'grafico' }),
    el('div', { class: 'estatisticas', id: 'estatisticas' }),
    barragem ? el('div', { id: 'comportas-tempo' }) : null,
    el('p', { class: 'suave', id: 'nota-grafico', style: 'font-size:.76rem;margin:10px 0 0' }));
}

async function desenharGrafico() {
  const caixa = $('#grafico');
  caixa.replaceChildren(el('p', { class: 'vazio' }, 'Carregando o gráfico…'));
  let s;
  try {
    const r = await fetch(`/api/estacoes/${id}?horas=${horas}`);
    if (!r.ok) throw new Error();
    s = await r.json();
  } catch {
    caixa.replaceChildren(el('p', { class: 'vazio' }, 'Não foi possível carregar o gráfico.'));
    return;
  }
  const valores = barragem ? s.ocupacao_pct : s.nivel_m;
  graficoSerie(caixa, { t: s.t, v: valores }, {
    cotas: barragem || item.referencia === 'altitude' ? null : item.cotas,
    unidade: barragem ? '%' : ' m', casas: barragem ? 1 : 2, intervalo: item.intervalo_s, rotulo: barragem ? 'Ocupação' : 'Nível',
    altura: innerWidth < 560 ? 230 : 300, minimo: barragem ? 2 : 0.2,
  });

  // Números do período.
  const pares = s.t.map((t, i) => [t, valores[i]]).filter(([, v]) => v != null);
  const est = $('#estatisticas');
  if (pares.length) {
    const max = pares.reduce((a, b) => (b[1] > a[1] ? b : a));
    const min = pares.reduce((a, b) => (b[1] < a[1] ? b : a));
    const vari = pares[pares.length - 1][1] - pares[0][1];
    const u = barragem ? '%' : ' m', c = barragem ? 1 : 2;
    const caixaNum = (valor, rotulo) => el('div', {}, el('b', {}, valor), el('span', {}, rotulo));
    est.replaceChildren(
      caixaNum(num(max[1], c) + u, `máxima · ${hora(new Date(max[0] * 1000).toISOString())}`),
      caixaNum(num(min[1], c) + u, `mínima · ${hora(new Date(min[0] * 1000).toISOString())}`),
      caixaNum(`${vari >= 0 ? '+' : '−'}${barragem ? num(Math.abs(vari), 1) + ' pontos' : num(Math.abs(vari) * 100, 0) + ' cm'}`, 'variação no período'),
      caixaNum(pares.length.toLocaleString('pt-BR'), 'leituras guardadas'));
  } else est.replaceChildren();

  const primeira = s.t[0];
  const nota = $('#nota-grafico');
  if (nota) nota.textContent = primeira && primeira - (Date.now() / 1000 - horas * 3600) > 6 * 3600
    ? `O histórico guardado desta estação começa em ${hora(new Date(primeira * 1000).toISOString())}. O de 1º de agosto em diante está sendo importado aos poucos (até perto de 18 nov).`
    : '';

  if (barragem && s.comportas?.length) {
    const ate = Date.now() / 1000, de = ate - horas * 3600;
    $('#comportas-tempo').replaceChildren(
      el('p', { class: 'titulo-cartao', style: 'margin:14px 0 4px' }, 'Comportas no período (azul = aberta)'),
      linhaTempoComportas(s.comportas, de, ate),
      el('p', { class: 'suave', style: 'font-size:.74rem;margin:6px 0 0' }, 'O registro das comportas começou em 7 nov 2026; antes disso o trilho fica vazio.'));
  }
}

function cartaoMesmoRio() {
  if (!item.rio) return null;
  const lista = dados.estacoes.filter((e) => e.rio === item.rio).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
  if (!lista.length || (lista.length === 1 && lista[0].id === id)) return null;
  return el('div', { class: 'cartao' },
    el('p', { class: 'titulo-cartao' }, `Rio ${item.rio.replace(/^Rio /, '')}, de cima para baixo`),
    el('div', { class: 'linhas', style: 'margin-top:0' }, lista.map((e) => linhaEstacao(dados, e, { comCidade: true, atual: e.id === id }))));
}

function cartaoMesmaCidade() {
  const lista = dados.estacoes.filter((e) => e.municipio === item.municipio && e.id !== id && e.rio !== item.rio);
  if (!lista.length) return null;
  return el('div', { class: 'cartao' },
    el('p', { class: 'titulo-cartao' }, `Outras estações em ${item.municipio}`),
    el('div', { class: 'linhas', style: 'margin-top:0' }, lista.map((e) => linhaEstacao(dados, e))));
}

function cartaoComportas() {
  if (!barragem || !item.comportas.length) return null;
  return el('div', { class: 'cartao' },
    el('p', { class: 'titulo-cartao' }, 'Comportas agora'),
    el('ul', { class: 'info' }, item.comportas.map((c) => el('li', {},
      el('span', { class: `comporta${c.aberta ? ' aberta' : ''}`, style: 'margin-right:8px' }, c.nome),
      c.aberta ? 'aberta' : 'fechada',
      el('span', { class: 'suave' }, c.desde_inicio_registro ? ` (já estava assim em ${hora(c.desde)}, quando o registro começou)` : ` desde ${hora(c.desde)}`)))));
}

function cartaoAvisos() {
  const lista = (dados.avisos ?? []).filter((a) => a.estacao_id === id);
  if (!lista.length) return null;
  return el('div', { class: 'cartao' }, el('p', { class: 'titulo-cartao' }, 'Avisos das últimas 24 horas'), listaAvisos(lista, ''));
}

function cartaoSobre() {
  const li = (rotulo, texto) => el('li', {}, el('b', {}, `${rotulo}: `), texto);
  const linhas = [];
  if (barragem) {
    linhas.push(li('Fonte', 'Defesa Civil de SC'));
    if (item.medido_em) linhas.push(li('Última leitura', hora(item.medido_em)));
    if (item.jusante_m != null) linhas.push(li('Rio logo abaixo da barragem', `${num(item.jusante_m)} m`));
    if (item.vertido_m != null) linhas.push(li('Vertedouro', `${num(item.vertido_m)} m`));
  } else {
    linhas.push(li('Fonte', item.fonte));
    if (item.medido_em) linhas.push(li('Última medição', hora(item.medido_em)));
    if (item.h1) linhas.push(li('1 hora antes', `${num(item.h1.nivel)} m (${hora(item.h1.medido_em)})`));
    if (item.cotas) {
      const c = item.cotas;
      const partes = [['atenção', c.atencao], ['alerta', c.alerta], ['emergência', c.emergencia]].filter(([, v]) => v != null).map(([n, v]) => `${n} ${num(v)} m`);
      linhas.push(li('Cotas', `${partes.join(' · ')} (segundo ${c.fonte})`));
    } else linhas.push(li('Cotas', 'a fonte não publica cotas para esta estação'));
    linhas.push(li('Referência', item.referencia === 'regua' ? 'régua do rio' : item.referencia === 'altitude' ? 'altitude da água (metros acima do nível do mar); não se compara com a régua de outras estações' : 'a confirmar (o número parece ser altitude)'));
    linhas.push(li('Intervalo normal', item.intervalo_s >= 3600 ? `uma leitura a cada ${item.intervalo_s / 3600} h` : `uma leitura a cada ${item.intervalo_s / 60} min`));
    for (const c of item.a_conferir) linhas.push(li('A confirmar', CONFERIR[c] ?? c));
  }
  if (item.observacao) linhas.push(li('Observação', item.observacao));
  if (item.latitude != null) linhas.push(li('Local', el('a', { href: `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=15/${item.latitude}/${item.longitude}`, rel: 'noopener' }, `${num(item.latitude, 4)}, ${num(item.longitude, 4)}`)));
  return el('div', { class: 'cartao' }, el('p', { class: 'titulo-cartao' }, barragem ? 'Sobre esta barragem' : 'Sobre esta estação'), el('ul', { class: 'info' }, linhas));
}

function cartaoMapa() {
  const caixa = el('div', { class: 'mapa mapa-pequeno', id: 'mapa-estacao' });
  return el('div', { class: 'cartao' }, el('p', { class: 'titulo-cartao' }, 'No mapa'), caixa);
}

function desenhar() {
  if (!item) {
    $('#conteudo').replaceChildren(el('p', { class: 'vazio' }, 'Estação não encontrada. ', el('a', { href: '/' }, 'Ver todas')));
    return;
  }
  document.title = `${item.nome}: ${barragem ? (item.ocupacao_pct != null ? `${num(item.ocupacao_pct, 1)}%` : '—') : item.nivel != null ? `${num(item.nivel)} m` : 'sem leitura'} · Nível Rio`;
  $('#conteudo').replaceChildren(
    cabeca(),
    el('div', { class: 'cartoes-estacao' },
      el('div', { class: 'coluna' }, cartaoGrafico(), cartaoMapa()),
      el('div', { class: 'coluna' }, cartaoAvisos(), cartaoComportas(), cartaoMesmoRio(), cartaoMesmaCidade(), cartaoSobre())));
  desenharGrafico();
  mapaCriado = false;
  observarMapa();
  atualizarIdades();
}

// O mapa só carrega quando aparece na tela (a biblioteca é pesada).
function observarMapa() {
  const caixa = $('#mapa-estacao');
  if (!caixa) return;
  const obs = new IntersectionObserver(async (entradas) => {
    if (!entradas.some((e) => e.isIntersecting) || mapaCriado) return;
    mapaCriado = true;
    obs.disconnect();
    const { criarMapa } = await import('./mapa.js');
    criarMapa(caixa, dados, { foco: id, zoomFoco: 11 });
  }, { rootMargin: '200px' });
  obs.observe(caixa);
}

function atualizarIdades() {
  document.querySelectorAll('.idade').forEach(pintarIdade);
  if (!dados) return;
  const min = (Date.now() - Date.parse(dados.gerado_em)) / 60_000;
  const a = $('#atualizado');
  a.textContent = `Atualizado ${idadeTexto(min * 60)}`;
  a.classList.toggle('velho', min > 20);
}

async function carregar(primeiraVez = false) {
  try {
    dados = await carregarDados();
  } catch {
    $('#atualizado').textContent = 'Sem conexão. Tentando de novo…';
    setTimeout(carregar, 30_000);
    return;
  }
  achar();
  if (primeiraVez || !item) desenhar();
  else {
    // Atualização: refaz a cabeça e a coluna lateral; o gráfico só no período de 24 h.
    const novaCabeca = cabeca();
    $('.cabeca-estacao').replaceWith(novaCabeca);
    const colunas = document.querySelectorAll('.coluna');
    colunas[1]?.replaceChildren(...[cartaoAvisos(), cartaoComportas(), cartaoMesmoRio(), cartaoMesmaCidade(), cartaoSobre()].filter(Boolean));
    if (horas <= 72) desenharGrafico();
    atualizarIdades();
  }
}

// Início.
$('#marca').replaceWith(marca());
const botao = $('#partilhar');
botao.hidden = false;
botao.addEventListener('click', async () => {
  const url = location.href.split('#')[0];
  try {
    if (navigator.share) await navigator.share({ title: document.title, url });
    else { await navigator.clipboard.writeText(url); botao.textContent = 'Link copiado'; setTimeout(() => (botao.textContent = 'Compartilhar'), 2500); }
  } catch { /* cancelado */ }
});
await carregar(true);
setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, 5 * 60_000);
setInterval(atualizarIdades, 30_000);
