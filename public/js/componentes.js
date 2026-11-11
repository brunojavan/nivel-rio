// Peças usadas na tela inicial e na página da estação, no mundo "Marcas da enchente".
import { el, hora, horaCurta, idadeTexto, NOMES_FAIXA, num } from './comum.js';
import { cotaAConfirmar, cotasDe, estadoDe, icone, infoTendencia } from './parede.js';

// Nome da estação sem o nome da cidade na frente ("Itajaí, canal retificado" → "Canal retificado").
export function nomeCurto(e) {
  const p = `${e.municipio}, `;
  const n = e.nome.startsWith(p) ? e.nome.slice(p.length) : e.nome;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function idadeEl(item) {
  const span = el('span', { class: 'idade', dataset: { medido: item.medido_em ?? '', intervalo: String(item.intervalo_s ?? 600) } });
  pintarIdade(span);
  return span;
}

export function pintarIdade(span) {
  const medido = span.dataset.medido;
  if (!medido) { span.textContent = 'sem leitura'; return; }
  const seg = (Date.now() - Date.parse(medido)) / 1000;
  const velha = seg > 2 * Number(span.dataset.intervalo) + 120;
  span.textContent = velha ? `sem leitura nova ${idadeTexto(seg)}` : `medido ${idadeTexto(seg)}`;
  span.classList.toggle('velha', velha);
  span.title = `Última medição: ${hora(medido)}`;
}

// Mini parede da linha: a água e as cotas, na mesma régua da parede grande.
function miniParede(e) {
  const cotas = cotasDe(e);
  const topo = Math.max(1, e.nivel ?? 0, ...cotas.map((c) => c.nivel)) * 1.12;
  const caixa = el('span', { class: 'mini', 'aria-hidden': 'true' });
  // Sem cota não há escala que diga algo: a mini parede fica vazia.
  if (e.nivel != null && cotas.length) caixa.append(el('i', { style: `height:${Math.min(100, (Math.max(e.nivel, 0) / topo) * 100).toFixed(1)}%` }));
  for (const c of cotas) caixa.append(el('s', { class: `f-${c.faixa}`, style: `bottom:${((c.nivel / topo) * 100).toFixed(1)}%` }));
  return caixa;
}

// Uma linha de estação: mini parede, nome, nível, sentido e faixa em palavra. Leva à página da estação.
export function linhaEstacao(dados, e, { comCidade = false, titulo = null, sub = null } = {}) {
  const f = estadoDe(e);
  const t = infoTendencia(e);
  const nome = titulo ?? (comCidade ? e.nome : nomeCurto(e));
  // Embaixo do nome, só o que o nome ainda não diz: a cidade e o rio.
  const curtoRio = (e.rio ?? '').replace(/ \(.*\)$/, '');
  const legenda = sub ?? [
    comCidade && !nome.includes(e.municipio) ? e.municipio : null,
    curtoRio && !nome.includes(curtoRio) ? e.rio : null,
  ].filter(Boolean).join(', ');
  const lado = f === 'parada'
    ? el('span', { class: 'lado f-parada' }, el('b', {}, e.situacao !== 'ativa' ? 'fora do ar' : `parada desde ${horaCurta(e.medido_em)}`))
    : f
      ? el('span', { class: `lado f-${f}` }, el('span', { class: 'sw' }), el('b', {}, NOMES_FAIXA[f]), cotaAConfirmar(e) ? ' (cota a confirmar)' : '', t.curto ? `, ${t.curto}` : '')
      : el('span', { class: 'lado' }, t.curto || ' ');
  return el('a', { class: `linha${f === 'parada' ? ' parada' : ''}`, href: `/estacao/${e.id}` },
    miniParede(e),
    el('span', { class: 'nome' }, nome),
    el('span', { class: 'nivel' }, e.nivel == null ? '—' : [num(e.nivel), el('small', {}, ' m')], e.referencia === 'altitude' ? el('span', { class: 'alt' }, ' altitude') : null),
    // Rio/cidade e estado na mesma linha embaixo, ocupando a largura toda: o estado longo ("Atenção (cota a
    // confirmar), estável") não aperta mais o nome da estação.
    el('span', { class: 'pe' }, el('span', { class: 'sub' }, legenda || (nome === e.municipio ? '' : e.municipio)), lado));
}

// Avisos (fase 4), com as aberturas de comporta agrupadas por barragem.
export function listaAvisos(lista, vazio, { porBarragem = true } = {}) {
  if (!lista?.length) return el('p', { class: 'vazio' }, vazio);
  const itens = [];
  const comportas = new Map();
  for (const a of lista) {
    if (porBarragem && a.tipo === 'comporta') {
      const g = comportas.get(a.estacao_id) ?? { ...a, abriu: 0, fechou: 0 };
      if (/ABRIU/.test(a.texto)) g.abriu++; else g.fechou++;
      if (!comportas.has(a.estacao_id)) itens.push(g);
      comportas.set(a.estacao_id, g);
    } else itens.push(a);
  }
  const ul = el('ul', { class: 'avisos' });
  for (const a of itens) {
    let texto = a.texto.replace(/^\S+\s/, '');
    if (a.abriu != null) {
      const nome = texto.split(':')[0];
      const partes = [a.abriu ? `${a.abriu} ${a.abriu > 1 ? 'comportas abriram' : 'comporta abriu'}` : null, a.fechou ? `${a.fechou} ${a.fechou > 1 ? 'fecharam' : 'fechou'}` : null].filter(Boolean);
      texto = `${nome}: ${partes.join(' e ')} nas últimas 24 horas.`;
    } else texto = texto.replace(/\b(ABRIU|FECHOU|ATENÇÃO|ALERTA|EMERGÊNCIA)\b/g, (m) => m.toLowerCase());
    ul.append(el('li', {},
      el('span', { class: 'quando' }, horaCurta(a.criado_em)),
      a.estacao_id ? el('a', { href: `/estacao/${a.estacao_id}` }, texto) : el('span', {}, texto)));
  }
  return ul;
}

export { icone };
