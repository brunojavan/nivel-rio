// Mapa da bacia no mundo "Marcas da enchente": fundo recolorido em reboco, rios na cor da placa, um ponto
// por estação na cor da faixa (com a palavra quando passa do normal). Passar o mouse mostra o balão;
// clicar abre a página da estação; no celular, o toque abre o balão com o link.
//
// Fundo do mapa: OpenFreeMap (gratuito, sem chave, dados do OpenStreetMap). Se ele não responder, o mapa
// abre só com os rios e as estações, sem ruas nem nomes.
import { cssVar, el, guardado, horaCurta, NOMES_FAIXA, num, ORDEM_FAIXA } from './comum.js';
import { cotaAConfirmar, destaqueDaCidade, estadoDe, infoTendencia } from './parede.js';

const ESTILOS = { claro: 'https://tiles.openfreemap.org/styles/positron', escuro: 'https://tiles.openfreemap.org/styles/dark' };
const LIMITES = [[-51.4, -28.6], [-47.6, -25.9]];
// O tema vem do botão do topo (js/tema.js), não do sistema.
const escuro = () => document.documentElement.dataset.tema === 'escuro';

let biblioteca = null;
async function carregarBiblioteca() {
  if (!document.querySelector('link[data-maplibre]'))
    document.head.append(el('link', { rel: 'stylesheet', href: '/vendor/maplibre/maplibre-gl.css', 'data-maplibre': true }));
  biblioteca ??= import('/vendor/maplibre/maplibre-gl.mjs');
  return biblioteca;
}

// Recolore o estilo do OpenFreeMap com as cores da parede: terra em reboco, água em azul apagado,
// ruas quase sumidas. Placas e nomes de rua saem.
function recolorir(estilo) {
  const c = {
    terra: cssVar('--reboco-fundo'), agua: escuro() ? '#2A3A52' : '#B9C6D6', rua: escuro() ? '#323A40' : '#E4E7E8',
    texto: cssVar('--tinta-2'), halo: cssVar('--reboco-fundo'), verde: escuro() ? '#28302F' : '#CBD3CC',
  };
  estilo.layers = estilo.layers.filter((l) => !/^(highway-name|highway-shield|road_shield|airport|label_other|poi|aeroway|railway)/.test(l.id));
  for (const l of estilo.layers) {
    l.paint ??= {};
    if (l.type === 'background') l.paint['background-color'] = c.terra;
    else if (l.type === 'fill' && /water/.test(l.id)) l.paint['fill-color'] = c.agua;
    else if (l.type === 'fill' && /park|wood|landcover|landuse/.test(l.id)) { l.paint['fill-color'] = c.verde; l.paint['fill-opacity'] = 0.6; }
    else if (l.type === 'line' && /waterway/.test(l.id)) l.paint['line-color'] = c.agua;
    else if (l.type === 'line' && /highway|road|bridge|tunnel/.test(l.id)) l.paint['line-color'] = c.rua;
    else if (l.type === 'symbol') { l.paint['text-color'] = c.texto; l.paint['text-halo-color'] = c.halo; }
  }
  return estilo;
}

async function carregarEstilo() {
  try {
    const r = await fetch(escuro() ? ESTILOS.escuro : ESTILOS.claro, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(String(r.status));
    return { estilo: recolorir(await r.json()), comTexto: true };
  } catch {
    return { estilo: { version: 8, sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': cssVar('--reboco-fundo') } }] }, comTexto: false };
  }
}

const LOCALE = {
  'NavigationControl.ZoomIn': 'Aproximar',
  'NavigationControl.ZoomOut': 'Afastar',
  'NavigationControl.ResetBearing': 'Voltar o norte para cima',
  'FullscreenControl.Enter': 'Mapa em tela cheia',
  'FullscreenControl.Exit': 'Sair da tela cheia',
  'AttributionControl.ToggleAttribution': 'Créditos do mapa',
  'AttributionControl.MapFeedback': 'Sugerir correção no mapa',
  'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + rolagem para aproximar o mapa',
  'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + rolagem para aproximar o mapa',
  'CooperativeGesturesHandler.MobileHelpText': 'Use dois dedos para mover o mapa',
};

// As maiores cidades da bacia: o nome delas aparece antes do das menores.
const GRANDES = new Set(['Blumenau', 'Itajaí', 'Brusque', 'Rio do Sul']);

function feicoes(dados, estreito = false) {
  const lista = [];
  // Cidade com muitos pontos juntos (Itajaí, 12): de longe, um ponto só no meio deles ("Itajaí (12 pontos)", com
  // o nível do ponto mais perto da cota de atenção); de perto, todos, cada um no seu lugar.
  const porCidade = new Map();
  for (const e of dados.estacoes) porCidade.set(e.municipio, [...(porCidade.get(e.municipio) ?? []), e]);
  const destaques = new Map();
  for (const [c, es] of porCidade) if (es.length > 3) destaques.set(c, destaqueDaCidade(es).id);
  const minhaCidade = guardado('cidade', null);
  for (const e of dados.estacoes) {
    if (e.latitude == null) continue;
    const f = estadoDe(e);
    const parada = f === 'parada';
    lista.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] },
      properties: {
        id: e.id, barragem: false,
        cor: parada ? cssVar('--parada') : f ? cssVar(`--${f}`) : cssVar('--reboco-claro'),
        corTexto: f && f !== 'parada' && f !== 'normal' ? cssVar(`--${f}-txt`) : cssVar('--tinta'),
        nivel: e.situacao !== 'ativa' ? 'sem dado' : e.nivel == null ? 'sem leitura' : `${num(e.nivel)} m${e.referencia === 'altitude' ? ' (altitude)' : ''}`,
        cidade: e.municipio,
        palavra: f && f !== 'parada' && ORDEM_FAIXA[f] >= 1 ? `em ${NOMES_FAIXA[f].toLowerCase()}${cotaAConfirmar(e) ? ' (a confirmar)' : ''}` : '',
        // Menor = mais importante (o mapa esconde os rótulos que se sobrepõem, a partir dos menos importantes).
        // A cidade escolhida pelo morador ganha de todas.
        // Ordem: a cidade do morador; quem está em atenção ou pior; as cidades grandes; as barragens; o resto.
        prioridade: (e.municipio === minhaCidade && (!destaques.has(e.municipio) || destaques.get(e.municipio) === e.id) ? -60 : 0)
          + (f && f !== 'parada' && ORDEM_FAIXA[f] >= 1 ? -40 - ORDEM_FAIXA[f] * 3 : 0)
          + (GRANDES.has(e.municipio) && (!destaques.has(e.municipio) || destaques.get(e.municipio) === e.id) ? -20 : 0)
          + (e.principal ? 0 : 20) + (parada ? 40 : 0) + (e.referencia === 'altitude' ? 10 : 0),
        raio: f && f !== 'parada' && ORDEM_FAIXA[f] >= 1 ? 9 : e.principal ? 6.5 : 5,
        secundario: destaques.has(e.municipio) && (destaques.get(e.municipio) === e.id || !(f && f !== 'parada' && ORDEM_FAIXA[f] >= 1)),
        cidadeGrupo: e.municipio,
      },
    });
  }
  for (const [c, id] of destaques) {
    const d = lista.find((x) => x.properties.id === id);
    const pts = porCidade.get(c).filter((e) => e.latitude != null);
    if (!d || !pts.length) continue;
    const meio = [pts.reduce((a, e) => a + e.longitude, 0) / pts.length, pts.reduce((a, e) => a + e.latitude, 0) / pts.length];
    const n = porCidade.get(c).length;
    lista.push({
      type: 'Feature', geometry: { type: 'Point', coordinates: meio },
      properties: { ...d.properties, grupo: true, secundario: false, cidadeGrupo: estreito ? `${c}\n${n} pontos` : `${c} (${n} pontos)` },
    });
  }
  for (const b of dados.barragens) {
    if (b.latitude == null) continue;
    lista.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.longitude, b.latitude] },
      properties: {
        id: b.id, barragem: true, cor: cssVar('--placa'), corTexto: cssVar('--tinta'),
        nivel: b.ocupacao_pct != null ? `${num(b.ocupacao_pct, 0)}% cheia` : 'sem leitura', cidade: b.nome, cidadeGrupo: b.nome, palavra: '',
        prioridade: 2, raio: 8, secundario: false,
      },
    });
  }
  // Ponto na beira oeste ou leste da bacia: o nome vai para dentro do mapa, não para fora da borda.
  const lons = lista.map((f) => f.geometry.coordinates[0]);
  const oeste = Math.min(...lons), largura = Math.max(...lons) - oeste || 1;
  for (const f of lista) {
    const x = (f.geometry.coordinates[0] - oeste) / largura;
    f.properties.borda = x < 0.12 ? 'oeste' : x > 0.75 ? 'leste' : '';
    // O grupo da foz (Itajaí) põe o nome sobre o mar, onde não há outros pontos.
    if (f.properties.grupo && f.properties.borda === 'leste') f.properties.borda = 'mar';
  }
  return { type: 'FeatureCollection', features: lista };
}

// Onde o nome pode ficar em volta do ponto, em ordem de preferência (deslocamentos em "em").
// O nome fica fora da área do próprio ponto (o "furo", abaixo), senão ele mesmo se bloqueia.
const EM_VOLTA = {
  top: [0, 1.2], bottom: [0, -1.2], left: [1.2, 0], right: [-1.2, 0],
  'top-left': [0.85, 0.85], 'top-right': [-0.85, 0.85], 'bottom-left': [0.85, -0.85], 'bottom-right': [-0.85, -0.85],
};
const anchors = (...ordem) => ['literal', ordem.flatMap((a) => [a, EM_VOLTA[a]])];
// Na beira, o nome vai para dentro do mapa. A cidade do morador tem mais lugares para tentar (o nome dela não
// pode sumir).
const ANCORA_POR_BORDA = ['case', ['<', ['get', 'prioridade'], -50],
  ['match', ['get', 'borda'],
    'mar', anchors('left', 'top-left', 'bottom-left', 'top', 'bottom'),
    'oeste', anchors('left', 'bottom-left', 'top-left', 'top', 'bottom'),
    'leste', anchors('right', 'bottom-right', 'top-right', 'top', 'bottom'),
    anchors('top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right')],
  ['match', ['get', 'borda'],
    'mar', anchors('left', 'top-left', 'bottom-left', 'top', 'bottom'),
    'oeste', anchors('left', 'top', 'bottom'),
    'leste', anchors('right', 'top', 'bottom'),
    anchors('top', 'bottom', 'right', 'left')]];

const CAMADAS_TOQUE = ['estacoes-toque', 'estacoes-toque-sec', 'grupo-toque'];

function balao(item, toque) {
  const barragem = 'comportas' in item;
  const caixa = el('div', { class: 'balao' }, el('h3', {}, item.nome), el('p', { class: 'rodape-balao' }, [item.municipio, item.rio].filter(Boolean).join(', ')));
  if (barragem) {
    const abertas = item.comportas.filter((c) => c.aberta).length;
    caixa.append(el('p', { class: 'valor' }, item.ocupacao_pct != null ? `${num(item.ocupacao_pct, 0)}% cheia` : 'sem leitura'),
      el('p', { class: 'rodape-balao' }, item.comportas.length ? `${abertas} de ${item.comportas.length} comportas abertas` : ''));
  } else {
    const f = estadoDe(item);
    const t = infoTendencia(item);
    caixa.append(el('p', { class: 'valor' }, item.nivel != null ? `${num(item.nivel)} m` : 'sem leitura'));
    if (f && f !== 'parada') caixa.append(el('p', { class: `estado f-${f}` }, el('span', { class: 'sw' }), el('b', {}, NOMES_FAIXA[f]), t.curto ? `, ${t.curto}` : ''));
    else if (f === 'parada') caixa.append(el('p', { class: 'estado f-parada' }, el('b', {}, 'Parada'), item.medido_em ? ` desde ${horaCurta(item.medido_em)}` : ''));
    else if (t.curto) caixa.append(el('p', { class: 'estado' }, t.texto));
  }
  if (item.medido_em) caixa.append(el('p', { class: 'rodape-balao' }, `Medido ${horaCurta(item.medido_em).includes(',') ? 'em' : 'às'} ${horaCurta(item.medido_em)}`));
  caixa.append(toque ? el('a', { class: 'ir', href: `/estacao/${item.id}` }, 'Ver a estação') : el('p', { class: 'rodape-balao' }, 'Clique para ver a estação'));
  return caixa;
}

export async function criarMapa(caixa, dados, { foco = null, zoomFoco = 11.5 } = {}) {
  let ml, est;
  try {
    [ml, est] = await Promise.all([carregarBiblioteca(), carregarEstilo()]);
  } catch (e) {
    console.error('mapa', e);
    caixa.replaceChildren(el('p', { class: 'vazio' }, 'Não foi possível carregar o mapa. Os níveis estão logo abaixo.'));
    return null;
  }
  // Enquadra os pontos da bacia (do Alto Vale à foz). No celular o mapa é baixo e largo como a bacia, para não
  // sobrar terra fora dela em cima e embaixo.
  const pontos = [...dados.estacoes, ...dados.barragens].filter((x) => x.latitude != null).map((x) => [x.longitude, x.latitude]);
  const limites = pontos.length
    ? pontos.reduce((b, p) => b.extend(p), new ml.LngLatBounds(pontos[0], pontos[0]))
    : new ml.LngLatBounds([-50.15, -27.72], [-48.62, -26.68]);
  const estreito = caixa.clientWidth < 520;
  let alvo = foco ? [...dados.estacoes, ...dados.barragens].find((x) => x.id === foco) : null;
  if (alvo?.latitude == null) alvo = null;

  let mapa;
  try {
    mapa = new ml.Map({
      container: caixa, style: est.estilo,
      bounds: alvo ? undefined : limites, center: alvo ? [alvo.longitude, alvo.latitude] : undefined, zoom: alvo ? zoomFoco : undefined,
      // Mais folga à direita (os rótulos de Itajaí, na foz, ficam na beira), proporcional à largura do mapa.
      fitBoundsOptions: { padding: estreito ? { top: 30, bottom: 30, left: 72, right: 70 } : { top: 40, bottom: 40, left: 50, right: 110 } },
      maxBounds: LIMITES, minZoom: 6.5, maxZoom: 16, cooperativeGestures: true, attributionControl: false,
      locale: LOCALE, dragRotate: false, pitchWithRotate: false,
    });
  } catch (e) {
    console.error('mapa', e);
    caixa.replaceChildren(el('p', { class: 'vazio' }, 'Seu navegador não conseguiu abrir o mapa. Os níveis estão nas listas.'));
    return null;
  }
  mapa.touchZoomRotate.disableRotation();
  // No celular os botões ficam em cima à esquerda: é o canto sem estações (a foz, com Itajaí, fica em cima à
  // direita, e o Alto Vale embaixo à esquerda).
  const cantoBotoes = estreito ? 'top-left' : 'top-right';
  mapa.addControl(new ml.NavigationControl({ showCompass: false }), cantoBotoes);
  mapa.addControl(new ml.FullscreenControl(), cantoBotoes);
  mapa.addControl(new ml.AttributionControl({ compact: true, customAttribution: 'Rios: © colaboradores do OpenStreetMap · Fundo: OpenFreeMap' }), 'bottom-right');

  const tinta = cssVar('--tinta'), placa = cssVar('--placa'), halo = cssVar('--reboco-fundo');
  mapa.on('load', () => {
    mapa.addSource('rios', { type: 'geojson', data: '/mapa/rios.geojson' });
    const principal = ['==', ['get', 'tipo'], 'principal'];
    mapa.addLayer({
      id: 'rios', type: 'line', source: 'rios', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': placa, 'line-opacity': ['case', principal, 0.95, 0.6],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, ['case', principal, 2.6, 1.1], 12, ['case', principal, 5.5, 2.4]],
      },
    });
    if (est.comTexto)
      mapa.addLayer({
        id: 'rios-nome', type: 'symbol', source: 'rios', minzoom: 8.3, filter: principal,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'nome'], 'text-font': ['Noto Sans Italic'], 'text-size': 12.5, 'symbol-spacing': 320, 'text-max-angle': 30 },
        paint: { 'text-color': placa, 'text-halo-color': halo, 'text-halo-width': 1.6 },
      });

    mapa.addSource('estacoes', { type: 'geojson', data: feicoes(dados, estreito) });
    if (alvo)
      mapa.addLayer({ id: 'estacao-foco', type: 'circle', source: 'estacoes', filter: ['all', ['==', ['get', 'id'], alvo.id], ['!=', ['get', 'grupo'], true]], paint: { 'circle-radius': 17, 'circle-color': 'transparent', 'circle-stroke-color': tinta, 'circle-stroke-width': 2.5 } });
    const SEC = 10; // zoom a partir do qual os pontos secundários aparecem
    // Três grupos de pontos: os principais (sempre), os secundários (só de perto) e o ponto que junta uma cidade
    // cheia de estações (só de longe).
    const grupoF = ['==', ['get', 'grupo'], true];
    const principalF = ['all', ['!=', ['get', 'secundario'], true], ['!', grupoF]], secundarioF = ['==', ['get', 'secundario'], true];
    const pintura = {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, ['*', ['get', 'raio'], 0.85], 12, ['*', ['get', 'raio'], 1.4]],
      'circle-color': ['get', 'cor'], 'circle-stroke-color': tinta, 'circle-stroke-width': ['case', ['get', 'barragem'], 2.5, 1.8],
    };
    mapa.addLayer({ id: 'estacoes-circulo', type: 'circle', source: 'estacoes', filter: principalF, layout: { 'circle-sort-key': ['-', 100, ['get', 'prioridade']] }, paint: pintura });
    mapa.addLayer({ id: 'estacoes-circulo-sec', type: 'circle', source: 'estacoes', minzoom: SEC, filter: secundarioF, paint: pintura });
    mapa.addLayer({ id: 'grupo-circulo', type: 'circle', source: 'estacoes', maxzoom: SEC, filter: grupoF, paint: pintura });
    if (est.comTexto) {
      const texto = (cidade) => ['format',
        ['get', 'nivel'], { 'text-font': ['literal', ['Noto Sans Bold']] }, '\n', {},
        cidade, { 'font-scale': 0.85, 'text-font': ['literal', ['Noto Sans Regular']] },
        ['case', ['==', ['get', 'palavra'], ''], '', ['concat', '\n', ['get', 'palavra']]], { 'font-scale': 0.9, 'text-font': ['literal', ['Noto Sans Bold']], 'text-color': ['get', 'corTexto'] }];
      const rotulo = {
        'text-size': 13, 'text-variable-anchor-offset': ANCORA_POR_BORDA, 'text-justify': 'auto',
        // No celular, mais espaço em volta de cada nome: menos nomes, sem um encostar no outro.
        'symbol-sort-key': ['get', 'prioridade'], 'text-padding': 2,
      };
      const pinturaTexto = { 'text-color': tinta, 'text-halo-color': halo, 'text-halo-width': 2 };
      // No celular só ganham nome a cidade do morador, quem está em atenção ou pior e as cidades grandes; os outros
      // pontos se veem pelo toque. Não cabe mais que isso num mapa de 340 px sem um nome cobrir o outro.
      const comNome = estreito ? ['all', principalF, ['<=', ['get', 'prioridade'], -20]] : principalF;
      // A cidade do morador e quem está em atenção ou pior ganham uma camada própria, acima do "furo": o nome
      // delas nunca some para desviar de um ponto (perto de Rio do Sul, os pontos são muitos).
      const urgente = ['<=', ['get', 'prioridade'], -30];
      mapa.addLayer({ id: 'estacoes-rotulo', type: 'symbol', source: 'estacoes', filter: ['all', comNome, ['!', urgente]], layout: { ...rotulo, 'text-field': texto(['get', 'cidade']) }, paint: pinturaTexto });
      mapa.addLayer({ id: 'grupo-rotulo', type: 'symbol', source: 'estacoes', maxzoom: SEC, filter: grupoF, layout: { ...rotulo, 'text-field': texto(['get', 'cidadeGrupo']) }, paint: pinturaTexto });
      mapa.addLayer({ id: 'estacoes-rotulo-sec', type: 'symbol', source: 'estacoes', minzoom: SEC, filter: secundarioF, layout: { ...rotulo, 'text-field': texto(['get', 'cidade']) }, paint: pinturaTexto });
      // Cada ponto ocupa o seu lugar: um ícone transparente do tamanho do círculo, posto antes dos nomes, faz
      // os nomes desviarem dos pontos (senão "Botuverá" ficava em cima do ponto de Brusque).
      // No celular, só os pontos que têm nome: com todos, o furo apagaria quase todos os nomes.
      if (!mapa.hasImage('furo')) mapa.addImage('furo', { width: 24, height: 24, data: new Uint8Array(24 * 24 * 4) });
      const furo = {
        'icon-image': 'furo', 'icon-allow-overlap': true, 'icon-ignore-placement': false,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 7, ['/', ['*', ['get', 'raio'], 1.7], 24], 12, ['/', ['*', ['get', 'raio'], 2.8], 24]],
      };
      mapa.addLayer({ id: 'estacoes-furo', type: 'symbol', source: 'estacoes', filter: comNome, layout: furo });
      if (!estreito) mapa.addLayer({ id: 'estacoes-furo-sec', type: 'symbol', source: 'estacoes', minzoom: SEC, filter: secundarioF, layout: furo });
      mapa.addLayer({ id: 'grupo-furo', type: 'symbol', source: 'estacoes', maxzoom: SEC, filter: grupoF, layout: furo });
      mapa.addLayer({ id: 'estacoes-rotulo-urgente', type: 'symbol', source: 'estacoes', filter: ['all', comNome, urgente], layout: { ...rotulo, 'text-field': texto(['get', 'cidade']) }, paint: pinturaTexto });
    }
    mapa.addLayer({ id: 'estacoes-toque', type: 'circle', source: 'estacoes', filter: principalF, paint: { 'circle-radius': 18, 'circle-color': '#000', 'circle-opacity': 0 } });
    mapa.addLayer({ id: 'estacoes-toque-sec', type: 'circle', source: 'estacoes', minzoom: SEC, filter: secundarioF, paint: { 'circle-radius': 18, 'circle-color': '#000', 'circle-opacity': 0 } });
    mapa.addLayer({ id: 'grupo-toque', type: 'circle', source: 'estacoes', maxzoom: SEC, filter: grupoF, paint: { 'circle-radius': 18, 'circle-color': '#000', 'circle-opacity': 0 } });
    caixa.querySelector('.mapa-carregando')?.remove();
    caixa.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  });

  const podeApontar = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let popup = null, aberto = null;
  // No celular, o toque abre um painel embaixo do mapa (o balão saía cortado na borda).
  const painel = el('div', { class: 'painel-mapa', role: 'region', 'aria-label': 'Estação escolhida no mapa', 'aria-live': 'polite', hidden: true });
  caixa.append(painel);
  const fecharPainel = () => { painel.hidden = true; painel.replaceChildren(); aberto = null; };
  const achar = (id) => [...mapa._dados.estacoes, ...mapa._dados.barragens].find((x) => x.id === id);
  const mostrar = (ev, toque) => {
    const f = ev.features?.[0];
    if (!f) return;
    const id = f.properties.id;
    if (aberto === id && popup?.isOpen()) return;
    const item = achar(id);
    if (!item) return;
    popup?.remove();
    aberto = id;
    popup = new ml.Popup({ closeButton: toque, closeOnClick: toque, offset: 14, maxWidth: '280px', focusAfterOpen: false })
      .setLngLat(f.geometry.coordinates).setDOMContent(balao(item, toque)).addTo(mapa);
  };
  mapa._dados = dados;
  mapa._estreito = estreito;
  for (const camada of CAMADAS_TOQUE) {
    mapa.on('mousemove', camada, (ev) => { if (!podeApontar) return; mapa.getCanvas().style.cursor = 'pointer'; mostrar(ev, false); });
    mapa.on('mouseleave', camada, () => { if (!podeApontar) return; mapa.getCanvas().style.cursor = ''; popup?.remove(); aberto = null; });
    mapa.on('click', camada, (ev) => {
      const id = ev.features?.[0]?.properties.id;
      if (!id) return;
      if (podeApontar) { location.href = `/estacao/${id}`; return; }
      const item = achar(id);
      if (!item) return;
      aberto = id;
      painel.replaceChildren(el('button', { type: 'button', class: 'botao fechar', onclick: fecharPainel }, 'Fechar'), balao(item, true));
      painel.hidden = false;
    });
  }
  // Toque fora de qualquer estação fecha o painel.
  mapa.on('click', (ev) => {
    if (podeApontar) return;
    const camadas = CAMADAS_TOQUE.filter((c) => mapa.getLayer(c));
    if (!mapa.queryRenderedFeatures(ev.point, { layers: camadas }).length) fecharPainel();
  });
  return mapa;
}

export function atualizarMapa(mapa, dados) {
  if (!mapa) return;
  mapa._dados = dados;
  mapa.getSource('estacoes')?.setData(feicoes(dados, mapa._estreito));
}
