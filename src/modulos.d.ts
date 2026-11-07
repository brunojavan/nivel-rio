// Arquivos .graphql entram no código como texto (ver "rules" no wrangler.jsonc).
declare module '*.graphql' {
  const conteudo: string;
  export default conteudo;
}
