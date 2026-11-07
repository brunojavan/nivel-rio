// Compressão com a API nativa do runtime (não conta como código JavaScript lento).
export async function gzip(dados: Uint8Array): Promise<ArrayBuffer> {
  const fluxo = new Blob([dados]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(fluxo).arrayBuffer();
}

export async function gunzip(dados: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

// O D1 pode devolver uma coluna BLOB como ArrayBuffer ou como lista de números (0 a 255).
export function bytesDoBanco(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return Uint8Array.from(v as number[]);
  throw new TypeError('coluna BLOB em formato desconhecido');
}
