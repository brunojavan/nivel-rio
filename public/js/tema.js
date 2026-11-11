// Tema claro ou escuro. O claro é o padrão; o escuro só pelo botão do topo, e a escolha fica guardada neste
// aparelho. O <head> de cada página já aplica a escolha guardada antes de desenhar (sem piscar o claro).
// Quem desenha com as cores em JavaScript (mapa e gráfico) ouve o evento "tema" e redesenha.
(() => {
  const raiz = document.documentElement;
  const botao = document.getElementById('tema');
  const meta = document.querySelector('meta[name="theme-color"]');
  const aplicar = (escuro) => {
    if (escuro) raiz.dataset.tema = 'escuro'; else delete raiz.dataset.tema;
    botao?.setAttribute('aria-pressed', String(escuro));
    if (meta) meta.content = getComputedStyle(raiz).getPropertyValue('--reboco').trim();
  };
  aplicar(raiz.dataset.tema === 'escuro');
  botao?.addEventListener('click', () => {
    const escuro = raiz.dataset.tema !== 'escuro';
    aplicar(escuro);
    try { localStorage.setItem('tema', escuro ? 'escuro' : 'claro'); } catch { /* sem armazenamento: vale só nesta visita */ }
    dispatchEvent(new CustomEvent('tema', { detail: { escuro } }));
  });
})();
