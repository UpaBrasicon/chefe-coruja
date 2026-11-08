// Aviso de versão nova (achado 2 da conferência das telas de 08/11/2026): uma
// aba aberta nunca troca o código sozinha, porque o app é de página única. O
// navegador só pega a versão nova numa carga completa. A casca confere de
// tempos em tempos o index.html publicado; se o script principal do build mudou,
// oferece "Atualizar". Não recarrega sozinha: pode haver formulário em curso.

/** Intervalo entre duas conferências com a aba visível. */
export const INTERVALO_CONFERENCIA_MS = 5 * 60_000

const SCRIPT_PRINCIPAL = /src="((?:https?:\/\/[^"/]+)?\/assets\/index-[^"]+\.js)"/

/** O caminho do script principal do build ("/assets/index-<hash>.js"), ou null. */
export function scriptPrincipal(html: string): string | null {
  const achado = SCRIPT_PRINCIPAL.exec(html)?.[1]
  if (!achado) return null
  return achado.replace(/^https?:\/\/[^/]+/, '')
}

/** Há versão nova só se os dois lados forem conhecidos e diferentes. Na dúvida, não. */
export function versaoMudou(carregado: string | null, htmlPublicado: string): boolean {
  if (!carregado) return false
  const publicado = scriptPrincipal(htmlPublicado)
  if (!publicado) return false
  return carregado.replace(/^https?:\/\/[^/]+/, '') !== publicado
}
