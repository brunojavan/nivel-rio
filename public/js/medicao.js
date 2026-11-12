// Google Analytics 4: propriedade "Nível Rio" na conta pessoal do Bruno, fluxo da Web niveldorio.net.
// Só conta visita no domínio próprio: localhost e nivel-rio.nivel-rio.workers.dev ficam de fora.
// Sem Google signals e sem personalização de anúncios: o site não tem anúncio e não precisa disso.
(() => {
  if (location.hostname !== 'niveldorio.net') return;
  const ID = 'G-7CHC179TKT';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.append(s);
})();
