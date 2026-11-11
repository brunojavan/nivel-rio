// Página de uma estação (/estacao/{id}) ou de uma barragem, no mundo "Marcas da enchente": a parede e a
// placa, a projeção quando o rio sobe, o gráfico com as cotas, as cheias passadas com fonte, o mesmo rio,
// a mesma cidade, o mapa e os detalhes da fonte.
import { carregarDados, CONFERIR, duracaoTexto, el, guardado, guardar, hora, horaCurta, NOMES_FAIXA, num, projecao } from './comum.js';
import { linhaEstacao, listaAvisos } from './componentes.js';
import { graficoSerie, linhaTempoComportas } from './graficos.js';
import { gravidade, icone, leitura } from './parede.js';

const $ = (s) => document.querySelector(s);
const id = decodeURIComponent(location.pathname.split('/')[2] ?? '');
const PERIODOS = [[24, '24 horas'], [72, '3 dias'], [168, '7 dias'], [720, '30 dias']];
let dados = null, item = null, barragem = false;
let horas = guardado('horas', 24);
if (!PERIODOS.some(([h]) => h === horas)) horas = 24;
let mapaCriado = false, mapaEstacao = null;

const nomeRio = (e) => (e.rio ? (e.rio.startsWith('Rio ') || e.rio.startsWith('Ribeirão') ? e.rio : `Rio ${e.rio}`) : 'Agora');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataPorExtenso = (iso) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

function achar() {
  item = dados.estacoes.find((e) => e.id === id) ?? dados.barragens.find((b) => b.id === id) ?? null;
  barragem = !!item && 'comportas' in item;
}

function cabeca() {
  const compartilhar = el('button', { type: 'button', class: 'botao', id: 'partilhar' }, 'Compartilhar');
  compartilhar.addEventListener('click', async () => {
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else { await navigator.clipboard.writeText(url); compartilhar.textContent = 'Link copiado'; setTimeout(() => (compartilhar.textContent = 'Compartilhar'), 2500); }
    } catch { /* cancelado */ }
  });
  return el('div', { class: 'cab-estacao' },
    el('p', { class: 'voltar' }, el('a', { href: '/' }, icone('volta'), 'Todas as estações')),
    el('div', { class: 'cab-linha' },
      el('div', {}, el('h1', {}, item.nome), el('p', { class: 'onde' }, [item.municipio, item.rio].filter(Boolean).join(', '))),
      compartilhar));
}

// Leitura de agora: parede e placa, com a projeção quando o rio sobe.
function agora() {
  if (barragem) return agoraBarragem();
  const p = projecao(item);
  const explica = p
    ? `Nesse ritmo (+${num(p.cmh, 0)} cm por hora), chega à cota de ${NOMES_FAIXA[p.faixa].toLowerCase()} (${num(p.cota)} m) em cerca de ${duracaoTexto(p.horas)}. É uma conta simples pela última hora: não considera chuva, barragens nem a água que ainda vem de rio acima.`
    : item.marcas?.length ? 'Na parede: a água de agora, as cotas oficiais e as cheias passadas.' : item.cotas ? 'Na parede: a água de agora e as cotas oficiais.' : null;
  return el('section', { class: 'bloco-cidade', 'aria-label': 'Nível agora' }, leitura(item, { titulo: nomeRio(item), explica }));
}

function agoraBarragem() {
  const abertas = item.comportas.filter((c) => c.aberta).length;
  const pct = item.ocupacao_pct;
  const altura = 360;
  const parede = el('figure', { class: 'parede', style: `--m:${(altura - 30) / 100}px;--altura:${altura}px`, role: 'img', 'aria-label': `Reservatório ${pct != null ? num(pct, 0) : '?'}% cheio` });
  const regua = el('div', { class: 'regua', 'aria-hidden': 'true' });
  for (const v of [25, 50, 75, 100]) regua.append(el('span', { style: `bottom:${(v * (altura - 30)) / 100}px` }, `${v}`));
  parede.append(regua, el('div', { class: 'cota', style: '--v:100;--c:var(--tinta);--c-txt:var(--tinta)', 'aria-hidden': 'true' }, el('b', {}, 'cheia'), ' 100%'));
  if (pct != null) parede.append(el('div', { class: 'agua', style: `--v:${pct}`, 'aria-hidden': 'true' }, el('span', {}, `${num(pct, 0)}%`)));
  const coluna = el('div', { class: 'agora' },
    el('div', { class: 'placa' }, el('p', { class: 'est' }, 'Ocupação do reservatório'), el('p', { class: 'valor' }, pct != null ? num(pct, 0) : '—', el('small', {}, '%'))),
    el('p', { class: 'estado' }, item.comportas.length
      ? abertas === item.comportas.length ? `Todas as ${abertas} comportas estão abertas: a água segue rio abaixo normalmente.`
        : abertas ? `${abertas} de ${item.comportas.length} comportas abertas.`
          : `As ${item.comportas.length} comportas estão fechadas: a barragem está segurando a água.`
      : 'Sem informação das comportas.'),
    item.montante_m != null ? el('p', { class: 'med' }, `Nível do reservatório: ${num(item.montante_m)} m acima do mar.`) : null,
    item.volume_hm3 != null ? el('p', { class: 'med' }, `Volume: ${num(item.volume_hm3, 1)} milhões de m³.`) : null,
    item.medido_em ? el('p', { class: 'med' }, `Medido ${horaCurta(item.medido_em).includes(',') ? 'em' : 'às'} ${horaCurta(item.medido_em)}.`) : null);
  return el('section', { class: 'bloco-cidade', 'aria-label': 'Reservatório agora' }, el('div', { class: 'leitura' }, parede, coluna));
}

function secaoGrafico() {
  const periodos = el('div', { class: 'ordem', role: 'group', 'aria-label': 'Período do gráfico' });
  for (const [h, rot] of PERIODOS)
    periodos.append(el('button', {
      type: 'button', class: 'botao', 'aria-pressed': String(h === horas),
      onclick: (ev) => {
        horas = h; guardar('horas', h);
        periodos.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === ev.currentTarget)));
        desenharGrafico();
      },
    }, rot));
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-grafico' },
    el('h2', { id: 'titulo-grafico' }, barragem ? 'Como a ocupação andou' : 'Como o nível andou'),
    periodos,
    el('div', { class: 'grafico', id: 'grafico' }),
    el('dl', { class: 'estatisticas', id: 'estatisticas' }),
    barragem ? el('div', { id: 'comportas-tempo' }) : null,
    el('p', { class: 'nota', id: 'nota-grafico' }));
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
    caixa.replaceChildren(el('p', { class: 'vazio' }, 'Não foi possível carregar o gráfico. Tente de novo em instantes.'));
    return;
  }
  // A série guardada pode estar alguns minutos atrás da leitura de agora (a da placa). O gráfico termina nela,
  // para a "última leitura" do gráfico nunca ser mais velha que o número grande da página.
  const serie = barragem ? s.ocupacao_pct : s.nivel_m;
  const agora = barragem ? item.ocupacao_pct : item.nivel, tAgora = item.medido_em ? Date.parse(item.medido_em) / 1000 : null;
  const t = [...s.t], valores = [...serie];
  if (agora != null && tAgora && (!t.length || tAgora > t.at(-1))) { t.push(tAgora); valores.push(agora); }
  graficoSerie(caixa, { t: s.t, v: serie }, {
    agora: agora != null && tAgora ? { t: tAgora, v: agora } : null,
    cotas: barragem || item.referencia === 'altitude' ? null : item.cotas,
    unidade: barragem ? '%' : ' m', casas: barragem ? 1 : 2, intervalo: item.intervalo_s, rotulo: barragem ? 'Ocupação' : 'Nível',
    altura: innerWidth < 560 ? 240 : 320, minimo: barragem ? 2 : 0.2,
  });

  const pares = t.map((x, i) => [x, valores[i]]).filter(([, v]) => v != null);
  const est = $('#estatisticas');
  est.replaceChildren();
  if (pares.length) {
    const max = pares.reduce((a, b) => (b[1] > a[1] ? b : a));
    const min = pares.reduce((a, b) => (b[1] < a[1] ? b : a));
    const vari = pares.at(-1)[1] - pares[0][1];
    const u = barragem ? '%' : ' m', c = barragem ? 1 : 2;
    const quando = (t) => horaCurta(new Date(t * 1000).toISOString());
    const par = (rot, val) => [el('dt', {}, rot), el('dd', {}, val)];
    est.append(
      ...par('Máxima', `${num(max[1], c)}${u}, ${quando(max[0])}`),
      ...par('Mínima', `${num(min[1], c)}${u}, ${quando(min[0])}`),
      ...par('Variação', barragem ? `${vari >= 0 ? '+' : '−'}${num(Math.abs(vari), 1)} pontos` : `${vari >= 0 ? 'subiu' : 'desceu'} ${Math.abs(vari) < 1 ? `${num(Math.abs(vari) * 100, 0)} cm` : `${num(Math.abs(vari))} m`}`),
      ...par('Leituras', pares.length.toLocaleString('pt-BR')));
  }
  const primeira = s.t[0];
  $('#nota-grafico').textContent = primeira && primeira - (Date.now() / 1000 - horas * 3600) > 6 * 3600
    ? `O histórico guardado desta estação começa em ${hora(new Date(primeira * 1000).toISOString())}. O de agosto em diante está sendo importado aos poucos, até perto de 18 de novembro.`
    : '';
  if (barragem && s.comportas?.length) {
    const ate = Date.now() / 1000, de = ate - horas * 3600;
    $('#comportas-tempo').replaceChildren(
      el('h3', {}, 'Comportas no período'),
      el('p', { class: 'nota' }, 'Preenchido onde a comporta esteve aberta. O registro começou em 7 de novembro de 2026.'),
      linhaTempoComportas(s.comportas, de, ate));
  }
}

function secaoMarcas() {
  if (!item.marcas?.length) return null;
  const fontes = [...new Map(item.marcas.map((m) => [m.url, m])).values()];
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-marcas' },
    el('h2', { id: 'titulo-marcas' }, 'Cheias passadas'),
    el('p', { class: 'sub' }, `As marcas pintadas na parede, com a altura que o rio chegou em ${item.municipio}.`),
    el('ul', { class: 'linhas marcas' }, [...item.marcas].sort((a, b) => b.nivel - a.nivel).map((m) =>
      el('li', { class: 'linha marca' }, el('span', { class: 'nome' }, dataPorExtenso(m.data)), el('span', { class: 'nivel' }, num(m.nivel), el('small', {}, ' m')), m.nota ? el('span', { class: 'sub' }, m.nota) : null))),
    // Uma fonte por nome; quando ela tem várias páginas (uma reportagem por cheia), um link por data.
    el('p', { class: 'nota' }, 'Fonte: ', ...[...new Set(fontes.map((m) => m.fonte))].flatMap((nome, i) => {
      const deste = fontes.filter((m) => m.fonte === nome);
      return [i ? '; ' : '', deste.length === 1 ? el('a', { href: deste[0].url }, nome)
        : [`${nome} (`, ...deste.flatMap((m, j) => [j ? ', ' : '', el('a', { href: m.url }, dataPorExtenso(item.marcas.find((x) => x.url === m.url).data).replace(/^\d+ de /, ''))]), ')']];
    }), '.'));
}

function secaoMesmoRio() {
  if (!item.rio) return null;
  const lista = dados.estacoes.filter((e) => e.rio === item.rio).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
  if (lista.length < 2) return null;
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-rio' },
    el('h2', { id: 'titulo-rio' }, `${nomeRio(item)}, de cima para baixo`),
    el('div', { class: 'linhas' }, lista.map((e) => {
      const l = linhaEstacao(dados, e, { comCidade: true });
      if (e.id === id) { l.classList.add('atual'); l.setAttribute('aria-current', 'page'); }
      return l;
    })));
}

function secaoMesmaCidade() {
  const lista = dados.estacoes.filter((e) => e.municipio === item.municipio && e.id !== id && e.rio !== item.rio);
  if (!lista.length) return null;
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-cidade' },
    el('h2', { id: 'titulo-cidade' }, `Outros pontos em ${item.municipio}`),
    el('div', { class: 'linhas' }, lista.sort((a, b) => gravidade(b) - gravidade(a)).map((e) => linhaEstacao(dados, e))));
}

function secaoSobre() {
  const linhas = [];
  const par = (rot, val) => linhas.push(el('dt', {}, rot), el('dd', {}, val));
  if (barragem) {
    par('Fonte', 'Defesa Civil de SC');
    if (item.jusante_m != null) par('Rio logo abaixo', `${num(item.jusante_m)} m`);
    for (const c of item.comportas) par(`Comporta ${c.nome}`, `${c.aberta ? 'aberta' : 'fechada'} ${c.desde_inicio_registro ? `(já estava assim em ${horaCurta(c.desde)}, quando o registro começou)` : `desde ${horaCurta(c.desde)}`}`);
  } else {
    par('Fonte', item.fonte);
    if (item.medido_em) par('Última medição', hora(item.medido_em));
    if (item.h1) par('Uma hora antes', `${num(item.h1.nivel)} m (${horaCurta(item.h1.medido_em)})`);
    if (item.cotas) {
      const c = item.cotas;
      par('Cotas oficiais', `${[['atenção', c.atencao], ['alerta', c.alerta], ['emergência', c.emergencia]].filter(([, v]) => v != null).map(([n, v]) => `${n} ${num(v)} m`).join(', ')}, segundo ${c.fonte}`);
    } else par('Cotas oficiais', 'a fonte não publica cota para esta estação');
    par('Medida', item.referencia === 'regua' ? 'régua do rio' : item.referencia === 'altitude' ? 'altitude da água, em metros acima do mar; não se compara com a régua de outras estações' : 'a confirmar (o número parece ser altitude)');
    par('Leituras', item.intervalo_s >= 3600 ? `uma a cada ${item.intervalo_s / 3600} hora` : `uma a cada ${item.intervalo_s / 60} minutos`);
    if (item.mare) par('Maré', 'perto da foz, o rio sobe e desce com a maré duas vezes por dia');
    for (const c of item.a_conferir) par('A confirmar', CONFERIR[c] ?? c);
  }
  if (item.observacao) par('Observação', item.observacao);
  if (item.latitude != null) par('Local', el('a', { href: `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=15/${item.latitude}/${item.longitude}`, rel: 'noopener' }, 'ver no OpenStreetMap'));
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-sobre' }, el('h2', { id: 'titulo-sobre' }, barragem ? 'Sobre esta barragem' : 'Sobre esta estação'), el('dl', { class: 'ficha' }, linhas));
}

function secaoAvisos() {
  const lista = (dados.avisos ?? []).filter((a) => a.estacao_id === id);
  if (!lista.length) return null;
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-avisos' }, el('h2', { id: 'titulo-avisos' }, 'Avisos das últimas 24 horas'), listaAvisos(lista, '', { porBarragem: false }));
}

function secaoMapa() {
  return el('section', { class: 'secao', 'aria-labelledby': 'titulo-mapa' }, el('h2', { id: 'titulo-mapa' }, 'No mapa'), el('div', { class: 'mapa mapa-pequeno', id: 'mapa-estacao' }));
}

function desenhar() {
  if (!item) {
    $('#conteudo').replaceChildren(el('h1', {}, 'Estação não encontrada'), el('p', {}, el('a', { href: '/' }, 'Ver todas as estações')));
    return;
  }
  document.title = `${item.nome}: ${barragem ? (item.ocupacao_pct != null ? `${num(item.ocupacao_pct, 0)}% cheia` : 'sem leitura') : item.nivel != null ? `${num(item.nivel)} m` : 'sem leitura'} · Nível Rio`;
  $('#dc').classList.toggle('grave', !barragem && gravidade(item) >= 2);
  $('#conteudo').replaceChildren(...[
    cabeca(),
    el('div', { class: 'estacao-topo' }, agora(), secaoGrafico()),
    secaoMarcas(),
    el('div', { class: 'colunas' }, ...[secaoMesmoRio(), secaoMesmaCidade(), secaoAvisos(), secaoSobre(), secaoMapa()].filter(Boolean)),
  ].filter(Boolean));
  desenharGrafico();
  mapaCriado = false;
  mapaEstacao?.remove();
  mapaEstacao = null;
  observarMapa();
  atualizarTopo();
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
    mapaEstacao = await criarMapa(caixa, dados, { foco: id, zoomFoco: 11 });
  }, { rootMargin: '200px' });
  obs.observe(caixa);
}

// Trocou o tema no botão do topo: gráfico e mapa pintam as cores ao desenhar, então são refeitos.
addEventListener('tema', async () => {
  if (item) desenharGrafico();
  if (!mapaEstacao) return;
  mapaEstacao.remove();
  $('#mapa-estacao').replaceChildren();
  mapaEstacao = await (await import('./mapa.js')).criarMapa($('#mapa-estacao'), dados, { foco: id, zoomFoco: 11 });
});

function atualizarTopo() {
  if (!dados) return;
  const a = $('#atualizado');
  const min = (Date.now() - Date.parse(dados.gerado_em)) / 60_000;
  a.classList.toggle('velho', min > 20);
  a.textContent = min > 20 ? `Sem atualização desde ${horaCurta(dados.gerado_em)}` : `Atualizado às ${horaCurta(dados.gerado_em)}`;
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
    $('.bloco-cidade')?.replaceWith(agora());
    if (horas <= 72) desenharGrafico();
    atualizarTopo();
  }
}

$('#marca').replaceWith(el('a', { class: 'marca', href: '/', 'aria-label': 'Nível Rio, página inicial' }, icone('marca'), 'Nível Rio'));
await carregar(true);
setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, 5 * 60_000);
setInterval(atualizarTopo, 30_000);
