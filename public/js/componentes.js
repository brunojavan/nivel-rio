// Peças de interface usadas na tela inicial e na página da estação.
import { atrasada, el, faixaDe, hora, idadeTexto, NOMES_FAIXA, num, serie24, talvezTravado, tendencia } from './comum.js';
import { sparkline } from './graficos.js';

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
  if (!medido) { span.textContent = 'sem leitura'; span.classList.add('idade-atrasada'); return; }
  const seg = (Date.now() - Date.parse(medido)) / 1000;
  const velha = seg > 2 * Number(span.dataset.intervalo) + 120;
  span.textContent = velha ? `sem leitura nova ${idadeTexto(seg)}` : `medido ${idadeTexto(seg)}`;
  span.classList.toggle('idade-atrasada', velha);
  span.title = `Última medição: ${hora(medido)}`;
}

export function chipsEstacao(e, todas) {
  const chips = [];
  const f = faixaDe(e.nivel, e.cotas);
  if (e.situacao !== 'ativa') chips.push(el('span', { class: 'chip neutro' }, e.situacao));
  else if (f) chips.push(el('span', { class: `chip ${f}` }, NOMES_FAIXA[f]));
  else if (e.referencia === 'altitude') chips.push(el('span', { class: 'chip neutro', title: 'Mede a altitude da água, não a régua' }, 'altitude'));
  else if (e.referencia === 'a-confirmar') chips.push(el('span', { class: 'chip neutro' }, 'referência a confirmar'));
  if (f && e.a_conferir.some((c) => c.startsWith('cotas'))) chips.push(el('span', { class: 'chip neutro' }, 'cotas a confirmar'));
  if (todas && talvezTravado(e, todas)) chips.push(el('span', { class: 'chip neutro' }, 'possível sensor travado'));
  return chips;
}

// Linha de uma estação: nome, gráfico de 24 h, nível e tendência. Leva à página da estação.
export function linhaEstacao(dados, e, { comCidade = false, atual = false } = {}) {
  const f = faixaDe(e.nivel, e.cotas);
  const t = tendencia(e);
  const parada = e.situacao !== 'ativa' || atrasada(e);
  const sub = comCidade ? [e.municipio, e.rio].filter(Boolean).join(' · ') : e.rio ?? '';
  return el('a', { class: `linha-estacao${f && f !== 'normal' ? ` f-${f}` : ''}${parada ? ' parada' : ''}${atual ? ' atual' : ''}`, href: `/estacao/${e.id}`, 'aria-current': atual ? 'page' : null },
    el('span', { class: 'nome' }, el('b', {}, comCidade ? e.nome : nomeCurto(e)), el('span', {}, sub || ' ')),
    sparkline(serie24(dados, e), { largura: 92, altura: 30, cotas: e.cotas, faixa: f, rotulo: `${e.nome}: últimas 24 horas` }),
    el('span', { class: 'nivel' },
      e.nivel == null ? el('small', {}, e.situacao !== 'ativa' ? e.situacao : 'sem leitura') : [num(e.nivel), el('small', {}, ' m')],
      t ? el('span', { class: `tendencia ${t.classe}` }, t.texto) : el('span', { class: 'tendencia estavel' }, parada ? 'parada' : ' ')));
}

// Lista de avisos (fase 4), com a cor da faixa e o horário.
const COR_AVISO = { normal: 'var(--normal)', atencao: 'var(--atencao)', alerta: 'var(--alerta)', emergencia: 'var(--emergencia)' };
export function listaAvisos(lista, vazio) {
  if (!lista?.length) return el('p', { class: 'suave', style: 'margin:0;font-size:.9rem' }, vazio);
  return el('ul', { class: 'avisos' }, lista.map((a) => el('li', {},
    el('i', { style: `background:${a.faixa ? COR_AVISO[a.faixa] : a.tipo === 'subida' ? 'var(--sobe)' : 'var(--agua)'}` }),
    el('span', { class: 'quando num' }, hora(a.criado_em)),
    a.estacao_id ? el('a', { href: `/estacao/${a.estacao_id}` }, a.texto.replace(/^\S+\s/, '')) : el('span', {}, a.texto.replace(/^\S+\s/, '')))));
}
