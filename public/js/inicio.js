// Tela inicial: mapa, níveis por cidade (ou por região do rio) e barragens.
// Atualiza a cada 5 minutos, só com a aba aberta.
import {
  atrasada, carregarDados, el, faixaDe, guardado, guardar, hora, idadeTexto, marca, NOMES_FAIXA, num, ORDEM_FAIXA,
  serie24, tendencia, variacao24,
} from './comum.js';
import { chipsEstacao, idadeEl, linhaEstacao, listaAvisos, nomeCurto, pintarIdade } from './componentes.js';
import { anel, barrasVariacao, sparkline } from './graficos.js';

function nivelEl(e, grande = false) {
  if (e.nivel == null) return el('span', { class: 'valor' }, el('small', {}, 'sem leitura'));
  return el('span', { class: grande ? 'valor' : '' }, num(e.nivel), el('small', {}, ' m'));
}


const ATUALIZAR_MS = 5 * 60_000;
const $ = (s) => document.querySelector(s);

const REGIOES = [
  { titulo: 'Alto Vale', sub: 'Itajaí do Oeste, Itajaí do Sul e Hercílio (Itajaí do Norte), que formam o Itajaí-Açu em Rio do Sul', rios: ['Itajaí do Oeste', 'Itajaí do Sul', 'Hercílio (Itajaí do Norte)'] },
  { titulo: 'Rio Itajaí-Açu', sub: 'De Rio do Sul até a foz, em Itajaí', rios: ['Itajaí-Açu'] },
  { titulo: 'Rio Itajaí-Mirim', sub: 'De Vidal Ramos até Itajaí', rios: ['Itajaí-Mirim'] },
  { titulo: 'Afluentes e ribeirões', sub: 'Rios menores da bacia', resto: true },
];

let dados = null;
let mapa = null;
let visao = guardado('visao', 'cidade');

function piorFaixa(lista) {
  let pior = null;
  for (const e of lista) {
    const f = faixaDe(e.nivel, e.cotas);
    if (f && (!pior || ORDEM_FAIXA[f] > ORDEM_FAIXA[pior])) pior = f;
  }
  return pior;
}

// Por cidade: um cartão por município, em ordem alfabética.
function porCidade() {
  const cidades = new Map();
  for (const e of dados.estacoes) {
    if (!cidades.has(e.municipio)) cidades.set(e.municipio, []);
    cidades.get(e.municipio).push(e);
  }
  const grade = el('div', { class: 'grade' });
  for (const [cidade, lista] of [...cidades].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))) {
    lista.sort((a, b) => Number(b.situacao === 'ativa') - Number(a.situacao === 'ativa') || Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const pior = piorFaixa(lista);
    const rios = [...new Set(lista.map((e) => e.rio).filter(Boolean))];
    const classeFaixa = pior && pior !== 'normal' ? ` faixa-${pior}` : '';

    if (lista.length === 1) {
      const e = lista[0];
      const t = tendencia(e);
      const f = faixaDe(e.nivel, e.cotas);
      grade.append(el('a', { class: `cartao${classeFaixa}${e.situacao !== 'ativa' || atrasada(e) ? ' parada' : ''}`, href: `/estacao/${e.id}` },
        el('div', { class: 'cartao-topo' },
          el('div', {}, el('h3', {}, cidade), el('div', { class: 'sub' }, e.rio ?? 'rio a confirmar')),
          el('div', { class: 'chips' }, chipsEstacao(e, dados.estacoes))),
        el('div', { class: 'destaque' }, nivelEl(e, true), t ? el('span', { class: `tendencia ${t.classe}` }, t.texto) : null),
        el('div', { class: 'grafico-mini' }, sparkline(serie24(dados, e), { esticar: true, altura: 54, cotas: e.cotas, faixa: f, rotulo: `${e.nome}: últimas 24 horas` })),
        el('div', { class: 'pe' }, el('span', {}, e.nome !== cidade ? nomeCurto(e) : '24 h'), idadeEl(e))));
    } else {
      grade.append(el('div', { class: `cartao${classeFaixa}${lista.length > 4 ? ' duplo' : ''}` },
        el('div', { class: 'cartao-topo' },
          el('div', {}, el('h3', {}, cidade), el('div', { class: 'sub' }, `${lista.length} estações · ${rios.join(', ')}`)),
          pior && pior !== 'normal' ? el('span', { class: `chip ${pior}` }, NOMES_FAIXA[pior]) : null),
        el('div', { class: 'linhas' }, lista.map((e) => linhaEstacao(dados, e)))));
    }
  }
  return grade;
}

// Por região do rio: de cima para baixo, com a variação de 24 h de cada estação.
function porRegiao() {
  const caixa = el('div', {});
  const usados = new Set();
  for (const g of REGIOES) {
    const lista = dados.estacoes.filter((e) => !usados.has(e.id) && (g.resto || g.rios.includes(e.rio)));
    lista.forEach((e) => usados.add(e.id));
    lista.sort((a, b) => (g.rios ? g.rios.indexOf(a.rio) - g.rios.indexOf(b.rio) : (a.rio ?? 'zz').localeCompare(b.rio ?? 'zz', 'pt-BR')) || (a.ordem ?? 99) - (b.ordem ?? 99));
    if (!lista.length) continue;
    const ativas = lista.filter((e) => e.situacao === 'ativa' && e.referencia !== 'altitude');
    caixa.append(el('section', { class: 'regiao' },
      el('h3', {}, g.titulo), el('p', { class: 'suave' }, g.sub),
      el('div', { class: 'grade-regiao' },
        el('div', { class: 'cartao' },
          el('p', { class: 'titulo-cartao' }, 'Quanto subiu ou desceu em 24 h'),
          barrasVariacao(ativas.map((e) => ({ id: e.id, nome: g.resto ? e.nome : e.municipio === e.nome ? e.nome : `${e.municipio}: ${nomeCurto(e)}`, valor: variacao24(serie24(dados, e)) }))),
          el('p', { class: 'suave', style: 'font-size:.75rem;margin:8px 0 0' }, 'Estações que medem altitude ficam de fora: a variação delas também vale, mas o número não é de régua.')),
        el('div', { class: 'cartao' },
          el('p', { class: 'titulo-cartao' }, g.resto ? 'Estações' : 'Estações, de cima para baixo'),
          el('div', { class: 'linhas', style: 'margin-top:0' }, lista.map((e) => linhaEstacao(dados, e, { comCidade: true })))))));
  }
  return caixa;
}

function barragens() {
  return dados.barragens.map((b) => {
    const abertas = b.comportas.filter((c) => c.aberta).length;
    return el('a', { class: 'cartao barragem', href: `/estacao/${b.id}` },
      el('div', { class: 'cartao-topo' }, el('div', {}, el('h3', {}, b.nome), el('div', { class: 'sub' }, `${b.municipio} · ${b.rio}`))),
      el('div', { class: 'corpo' },
        anel(b.ocupacao_pct, { tamanho: 88, rotulo: `Ocupação de ${b.nome}` }),
        el('div', { class: 'dados' },
          el('div', {}, el('b', {}, 'Ocupação'), b.ocupacao_pct != null ? ` ${num(b.ocupacao_pct, 1)}%` : ' sem leitura'),
          b.montante_m != null ? el('div', {}, el('b', {}, 'Nível'), ` ${num(b.montante_m)} m`) : null,
          b.comportas.length ? el('div', {}, el('b', {}, 'Comportas'), abertas ? ` ${abertas} de ${b.comportas.length} abertas` : ` todas fechadas (${b.comportas.length})`) : null)),
      b.comportas.length ? el('div', { class: 'comportas', 'aria-hidden': 'true' }, b.comportas.map((c) => el('span', { class: `comporta${c.aberta ? ' aberta' : ''}`, title: c.aberta ? 'aberta' : 'fechada' }, c.nome))) : null,
      el('div', { class: 'grafico-mini' }, sparkline(serie24(dados, b, true), { esticar: true, altura: 40, minimo: 2, rotulo: `Ocupação de ${b.nome} nas últimas 24 horas` })),
      el('div', { class: 'pe' }, el('span', {}, 'ocupação em 24 h'), idadeEl(b)));
  });
}

function resumoMapa() {
  const ativas = dados.estacoes.filter((e) => e.situacao === 'ativa' && !atrasada(e));
  const conta = { emergencia: 0, alerta: 0, atencao: 0 };
  let sobe = 0, desce = 0;
  for (const e of ativas) {
    const f = faixaDe(e.nivel, e.cotas);
    if (f in conta) conta[f]++;
    const t = tendencia(e);
    if (t?.classe === 'sobe') sobe++;
    else if (t?.classe === 'desce') desce++;
  }
  const chips = [];
  for (const f of ['emergencia', 'alerta', 'atencao'])
    if (conta[f]) chips.push(el('span', {}, el('i', { style: `background:var(--${f})` }), `${conta[f]} em ${NOMES_FAIXA[f].toLowerCase()}`));
  if (!chips.length) chips.push(el('span', {}, el('i', { style: 'background:var(--normal)' }), 'Nenhuma estação em atenção ou alerta'));
  if (sobe || desce)
    chips.push(el('span', { title: 'Estações subindo e descendo na última hora' },
      el('span', { class: 'tendencia sobe' }, `▲ ${sobe}`), el('span', { class: 'suave' }, 'subindo'),
      el('span', { class: 'tendencia desce' }, `▼ ${desce}`), el('span', { class: 'suave' }, 'descendo')));
  $('#resumo-mapa').replaceChildren(...chips);
}

function situacaoGeral() {
  const avisos = [];
  // Agrupado por faixa e por cidade: "Emergência: Rio do Sul 8,69 m · Blumenau 8,06 m".
  for (const f of ['emergencia', 'alerta']) {
    const lista = dados.estacoes.filter((e) => e.situacao === 'ativa' && !atrasada(e) && faixaDe(e.nivel, e.cotas) === f);
    if (!lista.length) continue;
    const porCidade = new Map();
    for (const e of lista) porCidade.set(e.municipio, [...(porCidade.get(e.municipio) ?? []), e]);
    const partes = [...porCidade].map(([cidade, es]) => (es.length === 1 ? `${cidade} ${num(es[0].nivel)} m` : `${cidade} (${es.length} pontos)`));
    avisos.push([true, `${NOMES_FAIXA[f]}: ${partes.join(' · ')}`]);
  }
  const idade = (Date.now() - Date.parse(dados.gerado_em)) / 60_000;
  if (idade > 20) avisos.push([true, `Os dados não são atualizados desde ${hora(dados.gerado_em)}. A coleta pode estar com problema; confira os canais oficiais.`]);
  for (const f of dados.fontes) {
    const ok = f.ultimo_sucesso ? Date.parse(f.ultimo_sucesso) : 0;
    if (f.ultimo_erro_em && Date.parse(f.ultimo_erro_em) > ok && Date.now() - ok > 30 * 60_000)
      avisos.push([false, `${f.nome}: sem resposta desde ${f.ultimo_sucesso ? hora(f.ultimo_sucesso) : 'o início'}.`]);
  }
  const caixa = $('#situacao-geral');
  caixa.hidden = !avisos.length;
  caixa.replaceChildren(...avisos.map(([grave, t]) => el('div', { class: grave ? 'grave' : '' }, t)));
}

// Chuva (fase 5): números gerais e os pluviômetros que mais marcaram.
function chuva() {
  const lista = (dados.chuva?.pluviometros ?? []).filter((p) => p.h24 != null);
  $('#bloco-chuva').hidden = !lista.length;
  if (!lista.length) return;
  const ordenada = [...lista].sort((a, b) => b.h24 - a.h24);
  const media = lista.reduce((s, p) => s + p.h24, 0) / lista.length;
  const hora1 = [...lista].filter((p) => p.h1 != null).sort((a, b) => b.h1 - a.h1)[0];
  const max = ordenada[0].h24;
  const numero = (valor, rotulo) => el('div', {}, el('b', {}, valor), el('span', {}, rotulo));
  $('#chuva').replaceChildren(
    el('div', { class: 'estatisticas', style: 'margin-top:0' },
      numero(`${num(media, 0)} mm`, `média de ${lista.length} pluviômetros`),
      numero(`${num(max, 0)} mm`, `maior: ${ordenada[0].nome}`),
      numero(hora1 ? `${num(hora1.h1, 1)} mm` : '—', hora1 ? `na última hora: ${hora1.nome}` : 'na última hora'),
      numero(`${num(ordenada.filter((p) => p.h24 >= 50).length, 0)}`, 'com 50 mm ou mais')),
    el('div', { class: 'barras-chuva' }, ordenada.slice(0, 14).map((p) => el('div', { class: 'barra-linha', role: 'listitem' },
      el('span', { class: 'barra-nome' }, p.nome),
      el('span', { class: 'barra-trilho', style: 'background:none' }, el('i', { style: `left:0;width:${(p.h24 / max) * 100}%;background:${corChuva(p.h24)}` })),
      el('span', { class: 'barra-valor num' }, `${num(p.h24, 0)} mm`)))),
    el('p', { class: 'suave', style: 'font-size:.75rem;margin:8px 0 0' }, `Leitura de ${hora(dados.chuva.gerado_em)}. A média dos pluviômetros não é a chuva média da bacia: eles não estão espalhados por igual. Pluviômetro com defeito pode marcar zero.`));
}
function corChuva(mm) {
  const escala = [[0, '#a9d3ff'], [15, '#5fa8f5'], [30, '#1f6fd1'], [60, '#4b3bbf'], [100, '#9b1f8c']];
  let c = escala[0][1];
  for (const [lim, cor] of escala) if (mm >= lim) c = cor;
  return c;
}

function listarFontes() {
  $('#fontes').replaceChildren(...dados.fontes.map((f) => {
    let t = f.ultimo_sucesso ? `${f.nome}: última resposta em ${hora(f.ultimo_sucesso)}` : `${f.nome}: ainda sem resposta`;
    if (f.ultimo_erro_em && (!f.ultimo_sucesso || f.ultimo_erro_em > f.ultimo_sucesso)) t += ` (falhou em ${hora(f.ultimo_erro_em)})`;
    return el('li', {}, t);
  }));
}

function atualizarIdades() {
  document.querySelectorAll('.idade').forEach(pintarIdade);
  if (!dados) return;
  const min = (Date.now() - Date.parse(dados.gerado_em)) / 60_000;
  const a = $('#atualizado');
  a.textContent = `Atualizado ${idadeTexto(min * 60)}`;
  a.title = `Resumo montado em ${hora(dados.gerado_em)}`;
  a.classList.toggle('velho', min > 20);
}

function desenharLista() {
  $('#aba-cidade').setAttribute('aria-selected', String(visao === 'cidade'));
  $('#aba-regiao').setAttribute('aria-selected', String(visao === 'regiao'));
  $('#titulo-visao').textContent = visao === 'cidade' ? 'Níveis por cidade' : 'Níveis por região do rio';
  $('#lista').replaceChildren(visao === 'cidade' ? porCidade() : porRegiao());
}

function desenhar() {
  situacaoGeral();
  resumoMapa();
  desenharLista();
  $('#barragens').replaceChildren(...barragens());
  chuva();
  $('#avisos').replaceChildren(listaAvisos(dados.avisos, 'Nenhum aviso nas últimas 24 horas. Os avisos começaram a ser registrados em 8 nov 2026.'));
  listarFontes();
  atualizarIdades();
}

async function carregar() {
  try {
    dados = await carregarDados();
  } catch {
    $('#atualizado').textContent = 'Sem conexão. Tentando de novo…';
    setTimeout(carregar, 30_000);
    return;
  }
  desenhar();
  if (mapa) (await import('./mapa.js')).atualizarMapa(mapa, dados);
}

async function abrirMapa() {
  const { criarMapa, legenda } = await import('./mapa.js');
  $('#legenda').replaceWith(legenda());
  mapa = await criarMapa($('#mapa'), dados);
  if (!mapa) $('.mapa-carregando')?.remove();
}

// Início.
$('#marca').replaceWith(marca());
for (const [id, v] of [['#aba-cidade', 'cidade'], ['#aba-regiao', 'regiao']])
  $(id).addEventListener('click', () => { visao = v; guardar('visao', v); if (dados) desenharLista(); });

await carregar();
if (dados) abrirMapa();
setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, ATUALIZAR_MS);
setInterval(atualizarIdades, 30_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dados && Date.now() - Date.parse(dados.gerado_em) > ATUALIZAR_MS) carregar();
});
