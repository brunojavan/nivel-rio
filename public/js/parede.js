// A parede da cidade (o gesto do mundo "Marcas da enchente"): a água de agora, as cotas oficiais pintadas
// e as marcas de cheias passadas, numa régua em metros. Mais a placa esmaltada com o número e as frases.
import { atrasada, el, faixaDe, horaCurta, NOMES_FAIXA, num, ORDEM_FAIXA, tendencia } from './comum.js';

const NS = 'http://www.w3.org/2000/svg';

// Ícones desenhados, um traço só, na cor do texto.
const CAMINHOS = {
  sobe: '<path d="M12 20V5M5.5 11.5 12 5l6.5 6.5"/>',
  desce: '<path d="M12 4v15M5.5 12.5 12 19l6.5-6.5"/>',
  estavel: '<path d="M4 12h16M15 7l5 5-5 5"/>',
  volta: '<path d="M20 12H5M11 5.5 4.5 12l6.5 6.5"/>',
  mare: '<path d="M2 14c2.5-3.2 5-3.2 7.5 0s5 3.2 7.5 0 4.5-3 5-2.4"/><path d="M2 8.5c2.5-3.2 5-3.2 7.5 0s5 3.2 7.5 0" opacity=".45"/>',
  marca: '<path d="M9 5h14l-7 10z" fill="currentColor" stroke="none"/><path d="M3 18.5h26M8 23.5h16M12.5 28h7"/>',
};
export function icone(nome, rotulo = '') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', nome === 'marca' ? '0 0 32 32' : '0 0 24 24');
  s.setAttribute('class', 'icone');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', nome === 'marca' ? '2.6' : '2.4');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  if (rotulo) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', rotulo); } else s.setAttribute('aria-hidden', 'true');
  s.innerHTML = CAMINHOS[nome];
  return s;
}

const metros = (m) => (Math.abs(m) < 1 ? `${Math.round(Math.abs(m) * 100)} cm` : `${num(Math.abs(m))} m`);
const COTAS = [['atencao', 'atenção'], ['alerta', 'alerta'], ['emergencia', 'emergência']];

export function cotasDe(e) {
  if (!e.cotas || e.referencia === 'altitude') return [];
  return COTAS.filter(([k]) => e.cotas[k] != null).map(([k, nome]) => ({ faixa: k, nome, nivel: e.cotas[k] }));
}

// Cotas que a fonte ainda não confirmou (Rio do Sul): todo estado que depende delas leva "cota a confirmar".
export const cotaAConfirmar = (e) => !!e.a_conferir?.some((c) => c.startsWith('cotas'));

// Estado da estação para as frases e as cores. "parada" quando não manda leitura nova.
export function estadoDe(e) {
  if (e.situacao !== 'ativa' || atrasada(e)) return 'parada';
  return faixaDe(e.nivel, e.cotas);
}

// Frase da faixa: "Normal. Faltam 1,05 m para a cota de atenção."
export function fraseEstado(e) {
  const f = estadoDe(e);
  if (f === 'parada') {
    const p = el('p', { class: 'estado f-parada' }, el('span', { class: 'sw' }), el('b', {}, e.situacao !== 'ativa' ? 'Fora do ar. ' : 'Parada. '));
    p.append(e.situacao !== 'ativa' ? `A fonte marca esta estação como ${e.situacao}.` : e.medido_em ? `Sem leitura nova desde ${horaCurta(e.medido_em)}.` : 'Ainda sem leitura.');
    return p;
  }
  const cotas = cotasDe(e);
  if (!f || !cotas.length) {
    return el('p', { class: 'estado' }, e.referencia === 'altitude'
      ? 'Esta estação mede a altitude da água (metros acima do mar), não a régua do rio.'
      : 'A fonte não publica cota oficial para esta estação.');
  }
  const p = el('p', { class: `estado f-${f}` }, el('span', { class: 'sw' }), el('b', {}, `${NOMES_FAIXA[f]}. `));
  const acima = [...cotas].reverse().find((c) => e.nivel >= c.nivel);
  const proxima = cotas.find((c) => c.nivel > e.nivel);
  const partes = [];
  if (acima) partes.push(`${metros(e.nivel - acima.nivel)} acima da cota de ${acima.nome}`);
  if (proxima) partes.push(`${acima ? 'faltam' : 'Faltam'} ${metros(proxima.nivel - e.nivel)} para ${proxima.faixa === 'atencao' ? 'a cota de atenção' : proxima.faixa === 'alerta' ? 'o alerta' : 'a emergência'}`);
  const texto = partes.join('; ');
  p.append(texto.charAt(0).toUpperCase() + texto.slice(1) + '.');
  if (cotaAConfirmar(e)) p.append(' A cota desta estação ainda está a confirmar: as fontes publicam valores diferentes.');
  return p;
}

// Sentido do rio em palavras, com ícone. Perto da foz, a maré explica o sobe e desce.
export function infoTendencia(e) {
  const t = tendencia(e);
  if (e.mare) {
    const agora = !t || t.classe === 'estavel' ? '' : t.cmh > 0 ? ', agora subindo' : ', agora descendo';
    return { icone: 'mare', texto: `Sobe e desce com a maré${agora}`, curto: 'com a maré', classe: 'mare' };
  }
  if (!t) return { icone: 'estavel', texto: 'Sem a leitura de 1 hora antes', curto: '', classe: 'sem' };
  if (t.classe === 'estavel') return { icone: 'estavel', texto: 'Estável na última hora', curto: 'estável', classe: 'estavel' };
  const v = num(Math.abs(t.cmh), 0);
  return t.cmh > 0
    ? { icone: 'sobe', texto: `Subindo ${v} cm por hora`, curto: `subindo ${v} cm/h`, classe: 'sobe' }
    : { icone: 'desce', texto: `Descendo ${v} cm por hora`, curto: `descendo ${v} cm/h`, classe: 'desce' };
}

// A parede: escala de 0 até um pouco acima da maior coisa a mostrar (cota, cheia passada ou a água).
export function parede(e, { altura = 430 } = {}) {
  const cotas = cotasDe(e);
  const marcas = (e.marcas ?? []).filter(() => e.referencia === 'regua');
  const f = estadoDe(e);
  // A linha mais alta fica a pelo menos 40 px do topo, para o nome dela caber em cima.
  const maior = Math.max(1, e.nivel ?? 0, ...cotas.map((c) => c.nivel), ...marcas.map((m) => m.nivel));
  const topo = maior * (altura / (altura - 40));
  const m = altura / topo;
  const fig = el('figure', {
    class: `parede${f && f !== 'normal' && f !== 'parada' ? ' alta' : ''}`,
    style: `--m:${m.toFixed(3)}px;--altura:${altura}px`,
    role: 'img',
    'aria-label': rotuloParede(e, cotas, marcas),
  });

  // Régua: um número a cada metro (ou a cada 2 ou 5 m quando a escala é grande).
  const passo = topo > 30 ? 5 : topo > 12 ? 2 : 1;
  const regua = el('div', { class: 'regua', 'aria-hidden': 'true' });
  for (let v = passo; v < topo; v += passo) regua.append(el('span', { style: `bottom:${(v * m).toFixed(1)}px` }, String(v)));
  fig.append(regua);

  // Cheias passadas: as que ficariam a menos de 15 px uma da outra viram uma marca só ("1983/84 15,46 m").
  const grupos = [];
  for (const mk of [...marcas].sort((a, b) => b.nivel - a.nivel)) {
    const g = grupos.at(-1);
    if (g && (g.nivel - mk.nivel) * m < 15) g.itens.push(mk);
    else grupos.push({ nivel: mk.nivel, itens: [mk] });
  }
  // Dois anos iguais (out e nov de 2023, em Rio do Sul) levam o mês.
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const repetidos = new Set(marcas.map((x) => x.data.slice(0, 4)).filter((a, i, l) => l.indexOf(a) !== i));
  const nomeMarca = (x) => (repetidos.has(x.data.slice(0, 4)) ? `${MESES[Number(x.data.slice(5, 7)) - 1]} ${x.data.slice(0, 4)}` : x.data.slice(0, 4));
  // Cada cheia com o seu nível: quando duas ficam coladas (1984 e 1983, 12 cm de diferença), um traço só e um
  // rótulo por cheia, um embaixo do outro, a mais alta em cima.
  for (const g of grupos)
    fig.append(el('div', { class: 'historica', style: `--v:${g.nivel}`, 'aria-hidden': 'true' },
      el('span', {}, ...g.itens.map((x) => el('span', { class: 'cheia' }, el('b', {}, nomeMarca(x)), ` ${num(x.nivel)} m`)))));

  // Cotas oficiais pintadas.
  for (const c of cotas)
    fig.append(el('div', { class: `cota f-${c.faixa}${e.nivel != null && e.nivel >= c.nivel ? ' submersa' : ''}`, style: `--v:${c.nivel}`, 'aria-hidden': 'true' }, el('b', {}, c.nome), ` ${num(c.nivel)} m`));

  // A água de agora. O rótulo "Agora" só entra onde não cobre o nome de uma cota (a placa já tem o número).
  if (e.nivel != null) {
    const v = Math.max(e.nivel, 0);
    const baixa = v * m < 26;
    const perto = cotas.some((c) => { const d = (v - c.nivel) * m; return baixa ? d > -40 && d < 4 : d > -18 && d < 26; });
    fig.append(el('div', { class: `agua${baixa ? ' baixa' : ''}${f ? ` f-${f}` : ''}`, style: `--v:${v}`, 'aria-hidden': 'true' },
      perto ? null : el('span', {}, `Agora ${num(e.nivel)} m`)));
  }
  return fig;
}

function rotuloParede(e, cotas, marcas) {
  const partes = [`A água está em ${e.nivel != null ? num(e.nivel) : 'nível desconhecido'} metros.`];
  if (cotas.length) partes.push(`Cotas oficiais: ${cotas.map((c) => `${c.nome} ${num(c.nivel)}`).join(', ')} metros.`);
  if (marcas.length) partes.push(`Cheias passadas: ${marcas.map((x) => `${x.data.slice(0, 4)}, ${num(x.nivel)} metros`).join('; ')}.`);
  return partes.join(' ');
}

// Placa esmaltada com o nome do ponto e o número.
export function placa(e, titulo) {
  return el('div', { class: 'placa' },
    el('p', { class: 'est' }, titulo),
    el('p', { class: 'valor' }, e.nivel != null ? num(e.nivel) : '—', el('small', {}, 'm')));
}

// Parede + placa + frases: o bloco de uma cidade (a sua, ou o caso grave em cheia).
export function leitura(e, { titulo, explica, extra = [], logo = null } = {}) {
  const t = infoTendencia(e);
  const parada = estadoDe(e) === 'parada';
  const coluna = el('div', { class: 'agora' },
    placa(e, titulo ?? e.nome),
    parada ? null : el('p', { class: `tend ${t.classe}` }, icone(t.icone), t.texto),
    e.medido_em ? el('p', { class: 'med' }, `Medido ${horaCurta(e.medido_em).includes(',') ? 'em' : 'às'} ${horaCurta(e.medido_em)}.`) : null,
    fraseEstado(e),
    logo,
    explica ? el('p', { class: 'explica' }, explica) : null,
    extra.length ? el('div', { class: 'acoes' }, ...extra) : null);
  const p = e.referencia === 'altitude' ? null : parede(e);
  return el('div', { class: 'leitura', style: p ? '' : 'grid-template-columns:1fr' }, p, coluna);
}


// O ponto que representa a cidade: o que está mais perto (ou mais acima) da sua cota de atenção.
// Sem cota em nenhum, o principal; parados ficam por último.
export function destaqueDaCidade(lista) {
  const vivas = lista.filter((e) => estadoDe(e) !== 'parada');
  const comCota = vivas.filter((e) => e.cotas?.atencao != null && e.nivel != null && e.referencia === 'regua');
  if (comCota.length) return comCota.reduce((a, b) => (b.nivel / b.cotas.atencao > a.nivel / a.cotas.atencao ? b : a));
  return vivas.find((e) => e.principal && e.referencia === 'regua') ?? vivas.find((e) => e.referencia === 'regua') ?? vivas[0] ?? lista[0];
}

// Gravidade para ordenar: emergência > alerta > atenção > resto.
export const gravidade = (e) => { const f = estadoDe(e); return f && f !== 'parada' ? ORDEM_FAIXA[f] : -1; };
