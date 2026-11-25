// Páginas da fonte no texto corrido das ferramentas (pedido do RT de
// 24/11/2026, item 14c da revisão): "(p. 20, 34–35)" polui a leitura. É só
// exibição: o conteúdo clínico não muda, o bloco Fonte do pé segue com as
// páginas e o botão "Mostrar páginas da fonte" devolve tudo. Sem import, para
// o teste rodar no node (src/lib/paginasFonte.test.ts).

const NUM = String.raw`\d+(?:\s*[–-]\s*\d+)?`
const LISTA = String.raw`${NUM}(?:\s*(?:,|e)\s*${NUM})*`
const PAG = String.raw`\bpp?\.\s*${LISTA}`

/** "(p. 20, 34–35)", "(pp. 12-14)", "(p. 32; p. 33)": o parêntese inteiro sai, com o espaço antes. */
const SO_PAGINA = new RegExp(String.raw`\s*\(\s*${PAG}(?:\s*[;,]\s*${PAG})*\s*\)`, 'g')
/** ", p. 329" dentro de outra referência: "(Tabela 1, p. 329)" vira "(Tabela 1)". */
const NA_REF = new RegExp(String.raw`\s*[,;]\s*${PAG}(?=\s*[);,]|\s*$)`, 'g')
/** Trecho que é só a página ("p. 41"), quando o texto vem partido em pedaços. */
const SOZINHA = new RegExp(String.raw`^\s*${PAG}\s*$`)

/** O texto sem as citações de página. */
export function semPaginas(texto: string): string {
  if (!/\bpp?\.\s*\d/.test(texto)) return texto
  if (SOZINHA.test(texto)) return ''
  return texto.replace(SO_PAGINA, '').replace(NA_REF, '')
}

/** O trecho é só uma página (o "(" e o ")" ao lado também saem). */
export function ehSoPagina(texto: string): boolean {
  return SOZINHA.test(texto)
}
