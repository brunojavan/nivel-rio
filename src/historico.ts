const decoder = new TextDecoder();

// Confere a resposta do histórico sem ler o JSON inteiro, que custa CPU demais no plano grátis
// (10 ms por execução). Respostas pequenas (erro ou estação com poucas leituras) são lidas normalmente.
export function conferirHistorico(corpo: Uint8Array): { erro: string | null; itens: number | null } {
  const texto = decoder.decode(corpo);
  if (corpo.byteLength < 65_536) {
    try {
      const d = JSON.parse(texto);
      if (d?.errors?.length) return { erro: 'GraphQL: ' + JSON.stringify(d.errors).slice(0, 300), itens: null };
      const lista = d?.data?.historic?.items;
      return Array.isArray(lista) ? { erro: null, itens: lista.length } : { erro: 'resposta inesperada', itens: null };
    } catch {
      return { erro: 'JSON inválido', itens: null };
    }
  }
  if (!texto.startsWith('{"data":{"historic":{"items":[')) return { erro: 'resposta inesperada', itens: null };
  let itens = 0;
  for (let i = texto.indexOf('"ts":"'); i !== -1; i = texto.indexOf('"ts":"', i + 6)) itens++;
  return { erro: null, itens };
}
