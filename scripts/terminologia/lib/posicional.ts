// ─────────────────────────────────────────────────────────────────────────────
// Parser de arquivos posicionais (fixed-width) do DATASUS.
//
// Os arquivos da Tabela Unificada SIGTAP vêm como `.txt` sem separador, com um
// arquivo `*_layout.txt` descrevendo cada coluna:
//   Coluna,Tamanho,Inicio,Fim,Tipo
//   CO_PROCEDIMENTO,10,1,10,VARCHAR2
//
// Este parser lê o layout (CSV `;`) e corta cada linha pelas posições.
// Encoding: Windows-1252 (DATASUS) ou UTF-8 (detectado).
// ─────────────────────────────────────────────────────────────────────────────

export type ColunaLayout = {
  nome: string
  tamanho: number
  inicio: number // 1-based
  fim: number // 1-based
}

export type LinhaPosicional = Record<string, string>

/** Converte o conteúdo do *_layout.txt em definições de coluna. */
export function parsearLayout(conteudoLayout: string): ColunaLayout[] {
  const linhas = conteudoLayout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !/^Coluna[,;]/i.test(l)) // pula cabeçalho

  const colunas: ColunaLayout[] = []
  for (const linha of linhas) {
    const partes = linha.split(',').map((p) => p.trim())
    const [nome, tamanho, inicio, fim] = partes
    const t = Number(tamanho)
    const i = Number(inicio)
    const f = Number(fim)
    if (nome && !Number.isNaN(t) && !Number.isNaN(i) && !Number.isNaN(f)) {
      colunas.push({ nome, tamanho: t, inicio: i, fim: f })
    }
  }
  return colunas
}

/** Corta uma linha nas posições do layout; valores vazios viram ''. */
export function parsearLinhaPosicional(linha: string, colunas: ColunaLayout[]): LinhaPosicional {
  const obj: LinhaPosicional = {}
  for (const c of colunas) {
    const trecho = linha.slice(c.inicio - 1, c.fim).trim()
    obj[c.nome] = trecho
  }
  return obj
}

/** Lê o conteúdo bruto e aplica o layout em todas as linhas. */
export function parsearArquivoPosicional(conteudo: string, colunas: ColunaLayout[]): LinhaPosicional[] {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim() !== '')
  return linhas.map((l) => parsearLinhaPosicional(l, colunas))
}
