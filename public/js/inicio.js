// Tela inicial no mundo "Marcas da enchente": a frase da bacia, o caso grave (em cheia), a sua cidade com a
// parede, o mapa e as listas. Atualiza a cada 5 minutos, só com a aba aberta.
import { carregarDados, el, guardado, guardar, hora, horaCurta, NOMES_FAIXA, num, ORDEM_FAIXA } from './comum.js';
import { linhaEstacao, listaAvisos, nomeCurto } from './componentes.js';
import { cotaAConfirmar, destaqueDaCidade, estadoDe, gravidade, icone, infoTendencia, leitura } from './parede.js';

const ATUALIZAR_MS = 5 * 60_000;
const $ = (s) => document.querySelector(s);

const REGIOES = [
  { titulo: 'Alto Vale', sub: 'Itajaí do Oeste, Itajaí do Sul e Hercílio, que se juntam em Rio do Sul e formam o Itajaí-Açu.', rios: ['Itajaí do Oeste', 'Itajaí do Sul', 'Hercílio (Itajaí do Norte)'] },
  { titulo: 'Rio Itajaí-Açu', sub: 'De Rio do Sul até a foz, em Itajaí.', rios: ['Itajaí-Açu'] },
  { titulo: 'Rio Itajaí-Mirim', sub: 'De Vidal Ramos até Itajaí, passando por Brusque.', rios: ['Itajaí-Mirim'] },
  { titulo: 'Afluentes e ribeirões', sub: 'Rios menores que deságuam nos principais.', resto: true },
];

let dados = null;
let mapa = null;
let ordem = guardado('ordem', 'rio');
let escolhendo = false;
let pontosAbertos = false;

const cidadeSalva = () => guardado('cidade', null);
const nomeRio = (e) => (e.rio ? (e.rio.startsWith('Rio ') || e.rio.startsWith('Ribeirão') ? e.rio : `Rio ${e.rio}`) : e.nome);

// "Rio do Sul está em atenção: 5,64 m, estável. No resto da bacia, o rio está normal."
function fraseBacia() {
  const comCota = dados.estacoes.filter((e) => { const f = estadoDe(e); return f && f !== 'parada'; });
  const acima = comCota.filter((e) => ORDEM_FAIXA[estadoDe(e)] >= 1);
  const p = el('p', {});
  if (!acima.length) {
    p.append('O rio está ', faixaPalavra('normal', 'normal'), ' em todas as estações com cota oficial.');
    return p;
  }
  for (const f of ['emergencia', 'alerta', 'atencao']) {
    const grupo = acima.filter((e) => estadoDe(e) === f);
    if (!grupo.length) continue;
    const porCidade = new Map();
    for (const e of grupo) porCidade.set(e.municipio, [...(porCidade.get(e.municipio) ?? []), e]);
    const cidades = [...porCidade];
    if (cidades.length === 1 && cidades[0][1].length === 1) {
      const e = cidades[0][1][0];
      const t = infoTendencia(e);
      p.append(`${e.municipio} está em `, faixaPalavra(f), `: ${num(e.nivel)} m${t.curto ? `, ${t.curto}` : ''}${cotaAConfirmar(e) ? ' (cota a confirmar)' : ''}. `);
    } else {
      const nomes = cidades.map(([c, es]) => (es.length > 1 ? `${c} (${es.length} pontos)` : `${c}${es.some(cotaAConfirmar) ? ' (cota a confirmar)' : ''}`));
      const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0];
      p.append(`${lista} ${cidades.length > 1 || cidades[0][1].length > 1 ? 'estão' : 'está'} em `, faixaPalavra(f), '. ');
    }
  }
  if (comCota.length > acima.length) p.append('No resto da bacia, o rio está ', faixaPalavra('normal', 'normal'), '.');
  return p;
}

function faixaPalavra(f, texto = NOMES_FAIXA[f].toLowerCase()) {
  return el('b', { class: `f-${f}` }, el('span', { class: 'sw', 'aria-hidden': 'true' }), texto);
}

// Em alerta ou emergência, o caso mais grave fora da sua cidade toma o topo.
function blocoGrave() {
  const caixa = $('#grave');
  const minha = cidadeSalva();
  const graves = dados.estacoes.filter((e) => gravidade(e) >= 2 && e.municipio !== minha).sort((a, b) => gravidade(b) - gravidade(a));
  $('#dc').classList.toggle('grave', dados.estacoes.some((e) => gravidade(e) >= 2));
  if (!graves.length) { caixa.hidden = true; caixa.replaceChildren(); return; }
  const e = graves[0];
  const f = estadoDe(e);
  caixa.hidden = false;
  caixa.className = `bloco-cidade grave f-${f}`;
  caixa.replaceChildren(
    el('div', { class: 'cabeca' },
      el('h2', {}, el('span', {}, `Em ${NOMES_FAIXA[f].toLowerCase()}`), e.municipio),
      el('a', { href: `/estacao/${e.id}` }, 'Ver o gráfico')),
    leitura(e, {
      titulo: e.nome === e.municipio ? nomeRio(e) : nomeCurto(e),
      explica: graves.length === 2 ? 'Mais uma estação também está em alerta ou emergência: veja a lista abaixo.'
        : graves.length > 2 ? `Mais ${graves.length - 1} estações também estão em alerta ou emergência: veja a lista abaixo.` : null,
    }));
}

// Sua cidade: a parede do ponto que a representa, ou a pergunta "Onde você mora?".
function blocoCidade() {
  const caixa = $('#cidade');
  const cidade = cidadeSalva();
  const lista = dados.estacoes.filter((e) => e.municipio === cidade);
  if (!cidade || !lista.length || escolhendo) { caixa.className = 'escolher'; caixa.replaceChildren(...escolher(cidade)); return; }

  const d = destaqueDaCidade(lista);
  const outras = lista.filter((e) => e.id !== d.id);
  const explica = lista.length > 1
    ? `O ponto de ${cidade} mais perto da cota de atenção.`
    : d.marcas?.length ? 'Na parede: a água de agora, as cotas oficiais e as cheias passadas.' : d.cotas ? 'Na parede: a água de agora e as cotas oficiais.' : null;
  const extra = [el('a', { href: `/estacao/${d.id}` }, 'Ver o gráfico e o histórico')];
  // "Mais N pontos" logo abaixo do estado, para caber na primeira tela do celular.
  const logo = outras.length
    ? el('button', { type: 'button', class: 'link', 'aria-expanded': String(pontosAbertos), onclick: () => { pontosAbertos = !pontosAbertos; blocoCidade(); } },
      pontosAbertos ? `Esconder os outros pontos` : `Mais ${outras.length} ${outras.length > 1 ? 'pontos' : 'ponto'} em ${cidade}`)
    : null;
  caixa.className = 'bloco-cidade';
  caixa.replaceChildren(...[
    el('div', { class: 'cabeca' },
      el('h2', {}, el('span', {}, 'Sua cidade'), cidade),
      el('button', { type: 'button', class: 'link', onclick: () => { escolhendo = true; blocoCidade(); } }, 'Trocar cidade')),
    leitura(d, { titulo: lista.length > 1 ? nomeCurto(d) : nomeRio(d), explica, extra, logo }),
    pontosAbertos && outras.length
      ? el('div', { class: 'linhas', style: 'margin-top:14px' }, outras.sort((a, b) => gravidade(b) - gravidade(a)).map((e) => linhaEstacao(dados, e)))
      : null,
  ].filter(Boolean));
}

function escolher(atual) {
  const cidades = [...new Set(dados.estacoes.map((e) => e.municipio))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const select = el('select', { id: 'escolha-cidade', name: 'cidade' },
    el('option', { value: '' }, 'Escolha a cidade'),
    ...cidades.map((c) => el('option', { value: c, selected: c === atual }, c)));
  const form = el('form', {
    onsubmit: (ev) => {
      ev.preventDefault();
      if (!select.value) return select.focus();
      guardar('cidade', select.value);
      escolhendo = false;
      pontosAbertos = false;
      desenhar();
      $('#cidade').scrollIntoView({ block: 'nearest' });
    },
  }, el('label', { class: 'so-leitor', for: 'escolha-cidade' }, 'Cidade'), select, el('button', { type: 'submit', class: 'botao' }, 'Mostrar'));
  return [
    el('h2', {}, 'Onde você mora?'),
    el('p', {}, 'Escolha a sua cidade para ver o rio dela primeiro. A escolha fica guardada só neste aparelho.'),
    form,
    atual ? el('button', { type: 'button', class: 'link', onclick: () => { escolhendo = false; blocoCidade(); } }, 'Cancelar') : null,
  ].filter(Boolean);
}

// Todas as estações: primeiro quem está em atenção ou pior; depois na ordem do rio ou de A a Z.
function lista() {
  const caixa = el('div', {});
  const graves = dados.estacoes.filter((e) => gravidade(e) >= 1).sort((a, b) => gravidade(b) - gravidade(a));
  if (graves.length)
    caixa.append(el('h3', {}, 'Em atenção ou pior'), el('div', { class: 'linhas graves' }, graves.map((e) => linhaEstacao(dados, e, { comCidade: true }))));

  if (ordem === 'az') {
    const cidades = new Map();
    for (const e of dados.estacoes) cidades.set(e.municipio, [...(cidades.get(e.municipio) ?? []), e]);
    caixa.append(el('h3', {}, 'Cidades de A a Z'), el('div', { class: 'linhas' },
      [...cidades].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([c, es]) => {
        const d = destaqueDaCidade(es);
        const sub = es.length > 1 ? `${nomeCurto(d)}; e mais ${es.length - 1} ${es.length > 2 ? 'pontos' : 'ponto'}` : nomeRio(d);
        return linhaEstacao(dados, d, { titulo: c, sub });
      })));
    return caixa;
  }

  const usados = new Set(graves.map((e) => e.id));
  const colunas = el('div', { class: 'colunas' });
  for (const g of REGIOES) {
    const es = dados.estacoes.filter((e) => !usados.has(e.id) && (g.resto || g.rios.includes(e.rio)));
    es.forEach((e) => usados.add(e.id));
    es.sort((a, b) => (g.rios ? g.rios.indexOf(a.rio) - g.rios.indexOf(b.rio) : (a.rio ?? 'zz').localeCompare(b.rio ?? 'zz', 'pt-BR')) || (a.ordem ?? 99) - (b.ordem ?? 99));
    if (!es.length) continue;
    colunas.append(el('div', {}, el('h3', {}, g.titulo), el('p', {}, g.sub),
      el('div', { class: 'linhas' }, es.map((e) => linhaEstacao(dados, e, { comCidade: true })))));
  }
  caixa.append(colunas);
  return caixa;
}

function barragens() {
  return dados.barragens.map((b) => {
    const abertas = b.comportas.filter((c) => c.aberta).length;
    return el('a', { class: 'barragem', href: `/estacao/${b.id}` },
      el('span', {}, el('span', { class: 'nome' }, b.nome), el('span', { class: 'sub' }, ` em ${b.municipio}, ${b.rio}`)),
      el('span', { class: 'ocup' }, b.ocupacao_pct != null ? `${num(b.ocupacao_pct, 0)}% cheia` : 'sem leitura'),
      el('span', { class: 'reservatorio', 'aria-hidden': 'true' }, el('i', { style: `width:${Math.min(100, b.ocupacao_pct ?? 0)}%` })),
      b.comportas.length
        ? el('span', { class: 'comportas' }, ...b.comportas.map((c) => el('i', { class: c.aberta ? 'aberta' : '', title: `${c.nome}: ${c.aberta ? 'aberta' : 'fechada'}` })),
          el('span', {}, abertas === b.comportas.length ? `todas as ${abertas} comportas abertas` : abertas ? `${abertas} de ${b.comportas.length} comportas abertas` : `as ${b.comportas.length} comportas fechadas`,
            b.medido_em ? `, medido ${horaCurta(b.medido_em).includes(',') ? 'em' : 'às'} ${horaCurta(b.medido_em)}` : ''))
        : null);
  });
}

function chuva() {
  const pl = (dados.chuva?.pluviometros ?? []).filter((p) => p.h24 != null);
  $('#bloco-chuva').hidden = !pl.length;
  if (!pl.length) return;
  // Os nomes do Estado trazem códigos ("(M)", "(H)"); sem eles, nomes repetidos ganham um número.
  const vistos = new Map();
  const nomeLimpo = (p) => {
    const n = p.nome.replace(/\s*\([MH]\)$/, '');
    const k = (vistos.get(n) ?? 0) + 1;
    vistos.set(n, k);
    return k > 1 ? `${n} ${k}` : n;
  };
  const ord = [...pl].sort((a, b) => b.h24 - a.h24).map((p) => ({ ...p, nome: nomeLimpo(p) }));
  const media = pl.reduce((s, p) => s + p.h24, 0) / pl.length;
  const max = Math.max(ord[0].h24, 1);
  $('#chuva-resumo').textContent = `Até ${num(ord[0].h24, 0)} mm em ${ord[0].nome}. Média dos ${pl.length} pluviômetros da Defesa Civil na bacia: ${num(media, 0)} mm. Leitura de ${horaCurta(dados.chuva.gerado_em)}.`;
  $('#chuva').replaceChildren(...ord.slice(0, 10).map((p) => el('li', { class: 'linha' },
    el('span', { class: 'nome' }, p.nome),
    el('span', { class: 'barra', 'aria-hidden': 'true' }, el('i', { style: `width:${((p.h24 / max) * 100).toFixed(1)}%` })),
    el('span', { class: 'nivel' }, num(p.h24, 0), el('small', {}, ' mm')))));
}

function atualizarTopo() {
  const a = $('#atualizado');
  const min = (Date.now() - Date.parse(dados.gerado_em)) / 60_000;
  a.classList.toggle('velho', min > 20);
  a.textContent = min > 20 ? `Sem atualização desde ${horaCurta(dados.gerado_em)}` : `Atualizado às ${horaCurta(dados.gerado_em)}`;
  a.title = `Resumo montado em ${hora(dados.gerado_em)}`;
}

function desenhar() {
  const frase = fraseBacia();
  if ($('#bacia').textContent !== frase.textContent) $('#bacia').replaceChildren(...frase.childNodes);
  blocoGrave();
  blocoCidade();
  $('#ordem-rio').setAttribute('aria-pressed', String(ordem === 'rio'));
  $('#ordem-az').setAttribute('aria-pressed', String(ordem === 'az'));
  $('#lista').replaceChildren(lista());
  $('#barragens').replaceChildren(...barragens());
  chuva();
  // Avisos de "sobe rápido" de estações que não medem régua (altitude) saíram da regra em 11 nov; os antigos também somem.
  const regua = new Set(dados.estacoes.filter((e) => e.referencia === 'regua').map((e) => e.id));
  const avisos = (dados.avisos ?? []).filter((a) => a.tipo !== 'subida' || regua.has(a.estacao_id));
  $('#avisos').replaceChildren(listaAvisos(avisos, 'Nenhum aviso nas últimas 24 horas.'));
  $('#fontes').replaceChildren(...dados.fontes.map((f) => {
    let t = f.ultimo_sucesso ? `${f.nome}: última resposta às ${horaCurta(f.ultimo_sucesso)}` : `${f.nome}: ainda sem resposta`;
    if (f.ultimo_erro_em && (!f.ultimo_sucesso || f.ultimo_erro_em > f.ultimo_sucesso)) t += ` (falhou às ${horaCurta(f.ultimo_erro_em)})`;
    return el('li', {}, t);
  }));
  atualizarTopo();
}

async function carregar() {
  try {
    dados = await carregarDados();
  } catch {
    const a = $('#atualizado');
    a.classList.add('velho');
    a.textContent = dados ? `Sem conexão. Dados de ${horaCurta(dados.gerado_em)}` : 'Sem conexão. Tentando de novo…';
    setTimeout(carregar, 30_000);
    return;
  }
  desenhar();
  if (mapa) (await import('./mapa.js')).atualizarMapa(mapa, dados);
}

// Início.
$('#marca').replaceWith(el('a', { class: 'marca', href: '/', 'aria-label': 'Nível Rio, página inicial' }, icone('marca'), 'Nível Rio'));
$('#ordem-rio').addEventListener('click', () => { ordem = 'rio'; guardar('ordem', ordem); if (dados) desenhar(); });
$('#ordem-az').addEventListener('click', () => { ordem = 'az'; guardar('ordem', ordem); if (dados) desenhar(); });

await carregar();
if (dados) import('./mapa.js').then(async ({ criarMapa }) => { mapa = await criarMapa($('#mapa'), dados); });

// Trocou o tema no botão do topo: o mapa pinta as cores na criação, então é refeito com as novas.
addEventListener('tema', async () => {
  if (!mapa) return;
  mapa.remove();
  $('#mapa').replaceChildren(el('div', { class: 'mapa-carregando' }, 'Carregando o mapa…'));
  mapa = await (await import('./mapa.js')).criarMapa($('#mapa'), dados);
});
setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, ATUALIZAR_MS);
setInterval(() => { if (dados) atualizarTopo(); }, 30_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dados && Date.now() - Date.parse(dados.gerado_em) > ATUALIZAR_MS) carregar();
});
