// Funções usadas pela tela inicial e pela página de cada estação.

export const FUSO = 'America/Sao_Paulo';
export const NOMES_FAIXA = { normal: 'Normal', atencao: 'Atenção', alerta: 'Alerta', emergencia: 'Emergência' };
export const ORDEM_FAIXA = { normal: 0, atencao: 1, alerta: 2, emergencia: 3 };

// Pendências do catálogo (campo "conferir"), em texto para o público.
export const CONFERIR = {
  rio: 'em qual rio fica a estação',
  ordem: 'a posição da estação ao longo do rio',
  municipio: 'o município da estação',
};

export const num = (v, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const hora = (iso) => fmtDiaHora.format(new Date(iso));
// "15h10" (e "11/11, 15h10" quando não é de hoje).
const fmtHoraMin = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
export function horaCurta(iso) {
  const d = new Date(iso);
  const hm = fmtHoraMin.format(d).replace(':', 'h');
  return fmtDiaMes.format(d) === fmtDiaMes.format(new Date()) ? hm : `${fmtDiaMes.format(d)}, ${hm}`;
}

export function guardado(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
export function guardar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: tudo bem */ }
}

// Cria elemento: el('a', { class: 'x', href: '/' }, 'texto', outroElemento)
export function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f);
  return e;
}

export const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function idadeTexto(seg) {
  const min = Math.round(seg / 60);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h${min % 60 && h < 6 ? ` ${min % 60} min` : ''}`;
  return `há ${Math.floor(h / 24)} dias`;
}

export function faixaDe(nivel, cotas) {
  if (nivel == null || !cotas) return null;
  if (cotas.emergencia != null && nivel >= cotas.emergencia) return 'emergencia';
  if (cotas.alerta != null && nivel >= cotas.alerta) return 'alerta';
  if (cotas.atencao != null && nivel >= cotas.atencao) return 'atencao';
  return 'normal';
}

// Sem leitura nova há mais do dobro do intervalo normal (mais 2 min de folga da coleta).
export function atrasada(item) {
  if (!item.medido_em) return true;
  return (Date.now() - Date.parse(item.medido_em)) / 1000 > 2 * item.intervalo_s + 120;
}

// Tendência: compara com a leitura de cerca de 1 hora antes (nunca com a coleta anterior).
export function tendencia(e) {
  if (e.nivel == null || !e.h1 || !e.medido_em) return null;
  const horas = (Date.parse(e.medido_em) - Date.parse(e.h1.medido_em)) / 3_600_000;
  if (horas < 0.66 || horas > 1.75) return null;
  const cmh = ((e.nivel - e.h1.nivel) * 100) / horas;
  if (Math.abs(cmh) < 2) return { cmh, classe: 'estavel', texto: 'estável' };
  return cmh > 0
    ? { cmh, classe: 'sobe', texto: `subindo ${num(cmh, 0)} cm/h` }
    : { cmh, classe: 'desce', texto: `descendo ${num(-cmh, 0)} cm/h` };
}

// Projeção simples (fase 5): no ritmo da última hora, em quanto tempo chega à próxima cota.
// Só quando sobe pelo menos 2 cm/h e a cota está a menos de 24 h nesse ritmo. É estimativa: não leva em
// conta chuva, barragens nem a onda que vem de rio acima.
export function projecao(e) {
  const t = tendencia(e);
  if (!t || t.cmh < 2 || !e.cotas) return null;
  const proximas = [['atencao', e.cotas.atencao], ['alerta', e.cotas.alerta], ['emergencia', e.cotas.emergencia]]
    .filter(([, v]) => v != null && v > e.nivel);
  if (!proximas.length) return null;
  const [faixa, cota] = proximas[0];
  const horas = ((cota - e.nivel) * 100) / t.cmh;
  if (horas > 24) return null;
  return { faixa, cota, horas, cmh: t.cmh };
}

export function duracaoTexto(horas) {
  const min = Math.round(horas * 60);
  if (min < 60) return `${Math.max(min, 5)} min`;
  const h = Math.floor(min / 60), m = Math.round((min % 60) / 10) * 10;
  return m && h < 6 ? `${h} h ${m} min` : `${Math.round(horas)} h`;
}

// Possível sensor travado: o mesmo valor agora, 1 h e 3 h antes, enquanto outra estação do mesmo rio
// mudou pelo menos 5 cm em 3 horas. O valor não é descartado: às vezes o rio está parado mesmo
// (abaixo das barragens fechadas, por exemplo). É só um aviso para conferir.
export function talvezTravado(e, todas) {
  if (e.nivel == null || !e.h1 || !e.h3 || e.nivel !== e.h1.nivel || e.nivel !== e.h3.nivel) return false;
  return todas.some((o) => o.id !== e.id && o.rio && o.rio === e.rio && o.nivel != null && o.h3 && Math.abs(o.nivel - o.h3.nivel) >= 0.05);
}

// Dados: na primeira vez vêm embutidos na página (uma ida a menos ao servidor); depois, de /api/agora.
let primeira = true;
export async function carregarDados() {
  if (primeira) {
    primeira = false;
    const embutido = document.getElementById('dados-iniciais');
    if (embutido) {
      try { return JSON.parse(embutido.textContent); } catch { /* segue para a API */ }
    }
  }
  const r = await fetch('/api/agora', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Série de 24 h (um ponto a cada 30 min) de uma estação, com a leitura mais recente no fim.
export function serie24(dados, item, barragem = false) {
  const g = dados.graficos;
  const t = [], v = [];
  if (g) {
    const valores = (barragem ? g.barragens : g.rios)[item.id] ?? [];
    valores.forEach((x, i) => { t.push(g.de + i * g.passo); v.push(x); });
  }
  const atual = barragem ? item.ocupacao_pct : item.nivel;
  if (atual != null && item.medido_em) {
    const ta = Date.parse(item.medido_em) / 1000;
    while (t.length && t[t.length - 1] >= ta - 60) { t.pop(); v.pop(); }
    t.push(ta); v.push(atual);
  }
  // Só as últimas 24 h.
  const limite = Date.now() / 1000 - 24 * 3600 - 1800;
  while (t.length && t[0] < limite) { t.shift(); v.shift(); }
  return { t, v };
}

// Variação em 24 h (em metros), pela série de meia em meia hora.
export function variacao24(s) {
  const i = s.v.findIndex((x) => x != null);
  if (i < 0 || s.v[s.v.length - 1] == null || s.t[s.t.length - 1] - s.t[i] < 18 * 3600) return null;
  return s.v[s.v.length - 1] - s.v[i];
}

// Rótulo curto do nível de uma estação, para o mapa e as listas.
export function textoNivel(e) {
  if (e.nivel == null) return 'sem leitura';
  return `${num(e.nivel)} m`;
}

export function marca() {
  return el('a', { class: 'marca', href: '/', 'aria-label': 'Nível Rio, página inicial' },
    svgMarca(),
    el('div', {}, el('strong', {}, 'Nível Rio'), el('span', {}, 'Bacia do Itajaí, a cada 5 minutos')));
}

function svgMarca() {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('width', '34'); s.setAttribute('height', '34'); s.setAttribute('viewBox', '0 0 34 34'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect width="34" height="34" rx="10" fill="var(--agua)"/><path d="M5 20c3 0 4-3 7-3s4 3 7 3 4-3 7-3 3 2 3 2v6c0 2-2 4-4 4H9c-2 0-4-2-4-4z" fill="#fff" opacity=".95"/><path d="M5 14c3 0 4-3 7-3s4 3 7 3 4-3 7-3 3 2 3 2" stroke="#fff" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round"/>';
  return s;
}
