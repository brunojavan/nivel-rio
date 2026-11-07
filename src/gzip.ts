// Compressão com a API nativa do runtime (não conta como código JavaScript lento).
export async function gzip(dados: Uint8Array): Promise<ArrayBuffer> {
  const fluxo = new Blob([dados]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(fluxo).arrayBuffer();
}

export async function gunzip(dados: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}
