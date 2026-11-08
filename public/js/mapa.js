// Mapa da bacia: rios destacados e um ponto por estação, com o nível. Passar o mouse mostra o nível, a
// tendência e o gráfico de 24 h; clicar abre a página da estação. No celular, o toque mostra o balão
// com o link.
//
// Fundo do mapa: OpenFreeMap (gratuito, sem chave, dados do OpenStreetMap). Se ele não responder, o mapa
// abre só com os rios e as estações, sem ruas nem nomes.
import { atrasada, cssVar, el, faixaDe, idadeTexto, NOMES_FAIXA, num, ORDEM_FAIXA, serie24, tendencia } from './comum.js';
import { corFaixa, sparkline } from './graficos.js';

const ESTILOS = { claro: 'https://tiles.openfreemap.org/styles/positron', escuro: 'https://tiles.openfreemap.org/styles/dark' };
const LIMITES = [[-51.4, -28.6], [-47.6, -25.9]];

let biblioteca = null;
async function carregarBiblioteca() {
  if (!document.querySelector('link[data-maplibre]'))
    document.head.append(el('link', { rel: 'stylesheet', href: '/vendor/maplibre/maplibre-gl.css', 'data-maplibre': true }));
  biblioteca ??= import('/vendor/maplibre/maplibre-gl.mjs');
  return biblioteca;
}

async function carregarEstilo(escuro) {
  try {
    const r = await fetch(escuro ? ESTILOS.escuro : ESTILOS.claro, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(String(r.status));
    const estilo = await r.json();
    // Menos poluição: sem placas e nomes de rua; os nomes de cidade ficam.
    estilo.layers = estilo.layers.filter((l) => !/^(highway-name|highway-shield|road_shield|airport|label_other|poi)/.test(l.id));
    return { estilo, comTexto: true };
  } catch {
    return {
      estilo: { version: 8, sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': escuro ? '#0f1720' : '#eef2f5' } }] },
      comTexto: false,
    };
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

// Cor do ponto: a faixa quando a fonte publica cotas; azul quando não publica; cinza quando parou.
function corDe(item, barragem) {
  if (barragem) return cssVar('--agua-forte');
  if (item.situacao !== 'ativa' || atrasada(item)) return cssVar('--parada');
  const f = faixaDe(item.nivel, item.cotas);
  return f ? cssVar(`--${f}`) : cssVar('--semcota');
}

function feicoes(dados) {
  const lista = [];
  for (const e of dados.estacoes) {
    if (e.latitude == null) continue;
    const f = faixaDe(e.nivel, e.cotas);
    const parada = e.situacao !== 'ativa' || atrasada(e);
    lista.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] },
      properties: {
        id: e.id, barragem: false, cor: corDe(e, false),
        rotulo: e.situacao !== 'ativa' ? 'sem dado' : e.nivel == null ? 'sem leitura' : `${num(e.nivel)} m`,
        cidade: e.municipio,
        // Menor = mais importante (o mapa esconde os rótulos menos importantes quando eles se sobrepõem).
        prioridade: (e.principal ? 0 : 20) - (f ? ORDEM_FAIXA[f] * 3 : 0) + (parada ? 40 : 0) + (e.referencia === 'altitude' ? 10 : 0),
        raio: e.principal ? 7 : 5.5,
        opacidade: parada ? 0.6 : 1,
      },
    });
  }
  for (const b of dados.barragens) {
    if (b.latitude == null) continue;
    lista.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.longitude, b.latitude] },
      properties: {
        id: b.id, barragem: true, cor: corDe(b, true),
        rotulo: b.ocupacao_pct != null ? `${num(b.ocupacao_pct, 0)}% cheia` : 'sem leitura',
        cidade: b.nome, prioridade: 1, raio: 8, opacidade: atrasada(b) ? 0.6 : 1,
      },
    });
  }
  return { type: 'FeatureCollection', features: lista };
}

function balao(item, dados, toque) {
  const barragem = 'comportas' in item;
  const caixa = el('div', { class: 'balao' });
  caixa.append(el('h3', {}, item.nome), el('div', { class: 'onde' }, [item.municipio, item.rio].filter(Boolean).join(' · ')));
  const valor = el('div', { class: 'valor' });
  if (barragem) {
    valor.append(el('strong', { class: 'num' }, item.ocupacao_pct != null ? `${num(item.ocupacao_pct, 1)}%` : '—'), el('span', { class: 'suave' }, 'de ocupação'));
    const abertas = item.comportas.filter((c) => c.aberta).length;
    caixa.append(valor, el('div', { class: 'rodape-balao' }, item.comportas.length ? `${abertas} de ${item.comportas.length} comportas abertas` : ''));
  } else {
    const f = faixaDe(item.nivel, item.cotas);
    const t = tendencia(item);
    valor.append(el('strong', { class: 'num' }, item.nivel != null ? `${num(item.nivel)} m` : 'sem leitura'));
    if (t) valor.append(el('span', { class: `tendencia ${t.classe}` }, t.texto));
    if (f) valor.append(el('span', { class: `chip ${f}` }, NOMES_FAIXA[f]));
    else if (item.referencia === 'altitude') valor.append(el('span', { class: 'chip neutro' }, 'altitude'));
    caixa.append(valor);
  }
  caixa.append(sparkline(serie24(dados, item, barragem), {
    largura: 220, altura: 44, cotas: barragem ? null : item.cotas, faixa: barragem ? null : faixaDe(item.nivel, item.cotas), minimo: barragem ? 2 : 0.2,
  }));
  const idade = item.medido_em ? (Date.now() - Date.parse(item.medido_em)) / 1000 : null;
  const pe = item.situacao && item.situacao !== 'ativa' ? item.situacao : idade == null ? 'sem leitura' : atrasada(item) ? `sem leitura nova ${idadeTexto(idade)}` : `medido ${idadeTexto(idade)}`;
  caixa.append(el('div', { class: `rodape-balao${atrasada(item) ? ' idade-atrasada' : ''}` }, `${pe} · 24 h no gráfico`));
  caixa.append(toque ? el('a', { class: 'ir', href: `/estacao/${item.id}` }, 'Ver detalhes →') : el('div', { class: 'rodape-balao' }, 'Clique para ver os detalhes'));
  return caixa;
}

// Cria o mapa dentro de "caixa". Opções: foco (id de uma estação para centralizar), legenda (bool).
export async function criarMapa(caixa, dados, { foco = null, zoomFoco = 11.5 } = {}) {
  const escuro = matchMedia('(prefers-color-scheme: dark)').matches;
  let ml, est;
  try {
    [ml, est] = await Promise.all([carregarBiblioteca(), carregarEstilo(escuro)]);
  } catch (e) {
    console.error('mapa', e);
    caixa.replaceChildren(el('p', { class: 'vazio' }, 'Não foi possível carregar o mapa. Os níveis estão logo abaixo.'));
    return null;
  }

  // Enquadra todas as estações; sem coordenadas (resumo antigo), a bacia inteira.
  const pontos = feicoes(dados).features.map((f) => f.geometry.coordinates);
  const limites = pontos.length
    ? pontos.reduce((b, p) => b.extend(p), new ml.LngLatBounds(pontos[0], pontos[0]))
    : new ml.LngLatBounds([-50.3, -27.8], [-48.6, -26.6]);
  let alvo = foco ? [...dados.estacoes, ...dados.barragens].find((x) => x.id === foco) : null;
  if (alvo?.latitude == null) alvo = null;

  let mapa;
  try {
    mapa = new ml.Map({
      container: caixa,
      style: est.estilo,
      bounds: alvo ? undefined : limites,
      center: alvo ? [alvo.longitude, alvo.latitude] : undefined,
      zoom: alvo ? zoomFoco : undefined,
      fitBoundsOptions: { padding: { top: 56, bottom: 30, left: 24, right: 24 } },
      maxBounds: LIMITES,
      minZoom: 6.5,
      maxZoom: 16,
      cooperativeGestures: true,
      attributionControl: false,
      locale: LOCALE,
      dragRotate: false,
      pitchWithRotate: false,
    });
  } catch (e) {
    console.error('mapa', e);
    caixa.replaceChildren(el('p', { class: 'vazio' }, 'Seu navegador não conseguiu abrir o mapa. Os níveis estão logo abaixo.'));
    return null;
  }
  mapa.touchZoomRotate.disableRotation();
  mapa.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
  mapa.addControl(new ml.FullscreenControl(), 'top-right');
  mapa.addControl(new ml.AttributionControl({ compact: true, customAttribution: 'Rios: © colaboradores do OpenStreetMap · Fundo: OpenFreeMap · Chuva: Defesa Civil de SC' }), 'bottom-right');
  if (dados.chuva?.pluviometros?.length)
    mapa.addControl(new ControleChuva((ligado) => { if (mapa.loaded() || mapa.isStyleLoaded()) ligarChuva(mapa, ligado, est.comTexto); }), 'top-right');

  const fundo = cssVar('--cartao'), agua = cssVar('--agua'), aguaForte = cssVar('--agua-forte'), texto = cssVar('--texto');
  mapa.on('load', () => {
    mapa.addSource('rios', { type: 'geojson', data: '/mapa/rios.geojson' });
    const principal = ['==', ['get', 'tipo'], 'principal'];
    mapa.addLayer({
      id: 'rios-contorno', type: 'line', source: 'rios', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': fundo, 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, ['case', principal, 5.5, 3], 12, ['case', principal, 11, 5.5]] },
    });
    mapa.addLayer({
      id: 'rios', type: 'line', source: 'rios', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': agua, 'line-opacity': ['case', principal, 0.95, 0.65],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, ['case', principal, 2.8, 1.2], 12, ['case', principal, 6, 2.6]],
      },
    });
    if (est.comTexto)
      mapa.addLayer({
        id: 'rios-nome', type: 'symbol', source: 'rios', minzoom: 8.3, filter: principal,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'nome'], 'text-font': ['Noto Sans Italic'], 'text-size': 12.5, 'symbol-spacing': 320, 'text-max-angle': 30 },
        paint: { 'text-color': aguaForte, 'text-halo-color': fundo, 'text-halo-width': 1.6 },
      });

    mapa.addSource('estacoes', { type: 'geojson', data: feicoes(dados) });
    mapa.addLayer({
      id: 'estacoes-circulo', type: 'circle', source: 'estacoes',
      layout: { 'circle-sort-key': ['-', 100, ['get', 'prioridade']] },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, ['*', ['get', 'raio'], 0.85], 12, ['*', ['get', 'raio'], 1.5]],
        'circle-color': ['get', 'cor'],
        'circle-stroke-color': ['case', ['get', 'barragem'], aguaForte, '#ffffff'],
        'circle-stroke-width': ['case', ['get', 'barragem'], 3, 2],
        'circle-opacity': ['get', 'opacidade'],
        'circle-stroke-opacity': ['get', 'opacidade'],
      },
    });
    if (alvo)
      mapa.addLayer({
        id: 'estacao-foco', type: 'circle', source: 'estacoes', filter: ['==', ['get', 'id'], alvo.id],
        paint: { 'circle-radius': 18, 'circle-color': 'transparent', 'circle-stroke-color': agua, 'circle-stroke-width': 3, 'circle-stroke-opacity': 0.6 },
      }, 'estacoes-circulo');
    if (est.comTexto)
      mapa.addLayer({
        id: 'estacoes-rotulo', type: 'symbol', source: 'estacoes',
        layout: {
          'text-field': ['format', ['get', 'rotulo'], { 'text-font': ['literal', ['Noto Sans Bold']] }, '\n', {}, ['get', 'cidade'], { 'font-scale': 0.82, 'text-font': ['literal', ['Noto Sans Regular']] }],
          'text-size': 12.5, 'text-variable-anchor': ['top', 'bottom', 'right', 'left'], 'text-radial-offset': 1, 'text-justify': 'auto',
          'symbol-sort-key': ['get', 'prioridade'], 'text-padding': 3,
        },
        paint: { 'text-color': texto, 'text-halo-color': fundo, 'text-halo-width': 1.8 },
      });
    // Área de toque maior que o ponto (no celular o ponto é pequeno para o dedo).
    mapa.addLayer({ id: 'estacoes-toque', type: 'circle', source: 'estacoes', paint: { 'circle-radius': 16, 'circle-color': '#000', 'circle-opacity': 0 } });
    caixa.closest('.mapa-bloco')?.querySelector('.mapa-carregando')?.remove();
    // Créditos começam recolhidos (no "i"), para não cobrir a legenda.
    caixa.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  });

  const podeApontar = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let popup = null, aberto = null;
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
      .setLngLat(f.geometry.coordinates).setDOMContent(balao(item, mapa._dados, toque)).addTo(mapa);
  };
  mapa._dados = dados;
  const balaoChuva = (p) => el('div', { class: 'balao' },
    el('h3', {}, `Chuva em ${p.nome}`),
    el('div', { class: 'valor' }, el('strong', { class: 'num' }, `${num(p.h24, 0)} mm`), el('span', { class: 'suave' }, 'em 24 h')),
    el('div', { class: 'rodape-balao' }, `Última hora: ${p.h1 != null ? num(p.h1, 1) : '—'} mm · 72 h: ${p.h72 != null ? num(p.h72, 0) : '—'} mm`),
    el('div', { class: 'rodape-balao' }, 'Pluviômetro da Defesa Civil de SC'));
  mapa.on('mousemove', 'chuva-circulo', (ev) => {
    if (!podeApontar || mapa.queryRenderedFeatures(ev.point, { layers: ['estacoes-toque'] }).length) return;
    const f = ev.features?.[0];
    if (!f || aberto === `chuva:${f.properties.codigo}`) return;
    popup?.remove(); aberto = `chuva:${f.properties.codigo}`;
    popup = new ml.Popup({ closeButton: false, closeOnClick: false, offset: 10, focusAfterOpen: false }).setLngLat(f.geometry.coordinates).setDOMContent(balaoChuva(f.properties)).addTo(mapa);
  });
  mapa.on('mouseleave', 'chuva-circulo', () => { if (podeApontar && aberto?.startsWith('chuva:')) { popup?.remove(); aberto = null; } });
  mapa.on('click', 'chuva-circulo', (ev) => {
    if (podeApontar || mapa.queryRenderedFeatures(ev.point, { layers: ['estacoes-toque'] }).length) return;
    const f = ev.features?.[0];
    if (!f) return;
    popup?.remove(); aberto = `chuva:${f.properties.codigo}`;
    popup = new ml.Popup({ closeButton: true, closeOnClick: true, offset: 10, focusAfterOpen: false }).setLngLat(f.geometry.coordinates).setDOMContent(balaoChuva(f.properties)).addTo(mapa);
  });
  mapa.on('mousemove', 'estacoes-toque', (ev) => { if (!podeApontar) return; mapa.getCanvas().style.cursor = 'pointer'; mostrar(ev, false); });
  mapa.on('mouseleave', 'estacoes-toque', () => { if (!podeApontar) return; mapa.getCanvas().style.cursor = ''; popup?.remove(); aberto = null; });
  mapa.on('click', 'estacoes-toque', (ev) => {
    const id = ev.features?.[0]?.properties.id;
    if (!id) return;
    if (podeApontar) location.href = `/estacao/${id}`;
    else mostrar(ev, true);
  });
  return mapa;
}

export function atualizarMapa(mapa, dados) {
  if (!mapa) return;
  mapa._dados = dados;
  mapa.getSource('estacoes')?.setData(feicoes(dados));
  mapa.getSource('chuva')?.setData(feicoesChuva(dados));
}

// Chuva das últimas 24 h (fase 5): um círculo por pluviômetro, maior e mais escuro quanto mais choveu.
export const ESCALA_CHUVA = [[0, '#d6ebff'], [5, '#a9d3ff'], [15, '#5fa8f5'], [30, '#1f6fd1'], [60, '#4b3bbf'], [100, '#9b1f8c']];
function feicoesChuva(dados) {
  const lista = dados.chuva?.pluviometros ?? [];
  return {
    type: 'FeatureCollection',
    features: lista.filter((p) => p.h24 != null).map((p) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { codigo: p.codigo, nome: p.nome, h1: p.h1, h24: p.h24, h72: p.h72, rotulo: `${Math.round(p.h24)} mm` },
    })),
  };
}

function ligarChuva(mapa, ligado, comTexto) {
  if (!mapa.getSource('chuva')) {
    mapa.addSource('chuva', { type: 'geojson', data: feicoesChuva(mapa._dados) });
    const cor = ['interpolate', ['linear'], ['get', 'h24'], ...ESCALA_CHUVA.flat()];
    mapa.addLayer({
      id: 'chuva-circulo', type: 'circle', source: 'chuva',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'h24'], 0, 5, 30, 10, 100, 18, 200, 24],
        'circle-color': cor, 'circle-opacity': 0.72, 'circle-stroke-color': cor, 'circle-stroke-width': 1, 'circle-stroke-opacity': 1,
      },
    }, mapa.getLayer('estacoes-circulo') ? 'estacoes-circulo' : undefined);
    if (comTexto)
      mapa.addLayer({
        id: 'chuva-rotulo', type: 'symbol', source: 'chuva', minzoom: 8,
        layout: { 'text-field': ['get', 'rotulo'], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-allow-overlap': false },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,.45)', 'text-halo-width': 1.2 },
      }, mapa.getLayer('estacoes-circulo') ? 'estacoes-circulo' : undefined);
  }
  for (const id of ['chuva-circulo', 'chuva-rotulo']) if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', ligado ? 'visible' : 'none');
}

// Botão do mapa para mostrar ou esconder a chuva.
class ControleChuva {
  constructor(aoMudar) { this.aoMudar = aoMudar; this.ligado = false; }
  onAdd() {
    this.caixa = el('div', { class: 'maplibregl-ctrl maplibregl-ctrl-group ctrl-chuva' });
    this.botao = el('button', { type: 'button', 'aria-pressed': 'false', title: 'Mostrar a chuva das últimas 24 horas' }, '☔ Chuva 24 h');
    this.botao.addEventListener('click', () => {
      this.ligado = !this.ligado;
      this.botao.setAttribute('aria-pressed', String(this.ligado));
      this.aoMudar(this.ligado);
    });
    this.caixa.append(this.botao);
    return this.caixa;
  }
  onRemove() { this.caixa.remove(); }
}

// Legenda e resumo que ficam por cima do mapa.
export function legenda() {
  const item = (cor, texto) => el('span', {}, el('i', { style: `background:${cor}` }), texto);
  const caixa = el('div', { class: 'legenda recolhida', role: 'note', 'aria-label': 'Legenda do mapa', onclick: (ev) => ev.currentTarget.classList.toggle('recolhida') },
    el('span', { class: 'legenda-titulo' }, 'Legenda ▾'),
    item(corFaixa('normal'), 'Normal'), item(corFaixa('atencao'), 'Atenção'), item(corFaixa('alerta'), 'Alerta'),
    item(corFaixa('emergencia'), 'Emergência'), item('var(--semcota)', 'Sem cota publicada'), item('var(--parada)', 'Sem leitura recente'),
    item('var(--agua-forte)', 'Barragem'));
  return caixa;
}
