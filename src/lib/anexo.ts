// Regras puras da área de anexo (src/components/ui/area-de-anexo.tsx): conferir
// o arquivo contra o `accept` do campo (tipo MIME e extensão) e contra o limite
// de tamanho, dar nome legível à imagem colada da área de transferência e
// escrever o tamanho para a pessoa. Pedido do RT de 10/11/2026 (opção A: uma
// peça só para arrastar, colar ou escolher o arquivo).

import { dataHoraInput, numeroAte } from './formato.ts'

type ArquivoBasico = { name: string; type: string; size: number }

/** Tipo pela extensão, para quando o sistema entrega o arquivo sem o tipo (type vazio). */
const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  csv: 'text/csv',
  txt: 'text/plain',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/** Extensão do arquivo, sem o ponto e em minúsculas ("" quando não tem). */
export function extensao(nome: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nome.trim())
  return m ? m[1].toLowerCase() : ''
}

/** Os itens do `accept` ("application/pdf, .pdf, image/*"), em minúsculas. */
export function itensDoAccept(accept: string | undefined): string[] {
  return (accept ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
}

/**
 * O arquivo cabe no `accept`? Item com ponto confere a extensão; "tipo/*" confere
 * o começo do tipo; o resto confere o tipo exato. Sem tipo (alguns sistemas não
 * mandam ao arrastar), o tipo sai da extensão. `accept` vazio aceita tudo.
 */
export function cabeNoAccept(arquivo: Pick<ArquivoBasico, 'name' | 'type'>, accept: string | undefined): boolean {
  const itens = itensDoAccept(accept)
  if (itens.length === 0) return true
  const ext = extensao(arquivo.name)
  const tipo = (arquivo.type || MIME_POR_EXTENSAO[ext] || '').toLowerCase()
  return itens.some((item) => {
    if (item.startsWith('.')) return ext !== '' && `.${ext}` === item
    if (item.endsWith('/*')) return tipo.startsWith(item.slice(0, -1))
    return tipo === item
  })
}

/** "820 KB", "1,5 MB", "10 MB" (mínimo de 1 KB, como nas listas de anexo). */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${numeroAte(bytes / 1024 / 1024, 1)} MB`
}

/**
 * Problema do arquivo para a área de anexo, ou null. A regra da tela (`validar`)
 * vem primeiro, com a frase dela; o tipo e o tamanho conferem depois.
 */
export function problemaDoArquivo<T extends ArquivoBasico>(arquivo: T, opcoes: {
  accept?: string; maxBytes?: number; validar?: (arquivo: T) => string | null
}): string | null {
  const daTela = opcoes.validar?.(arquivo)
  if (daTela) return daTela
  if (!cabeNoAccept(arquivo, opcoes.accept)) return 'Esse tipo de arquivo não é aceito aqui.'
  if (arquivo.size <= 0) return 'O arquivo está vazio.'
  if (opcoes.maxBytes != null && arquivo.size > opcoes.maxBytes) return `O arquivo passa de ${tamanhoLegivel(opcoes.maxBytes)}.`
  return null
}

/**
 * Separa os arquivos que entram dos que não entram. Com um arquivo só
 * (`multiple` falso), vale o primeiro. No modo de vários, a frase do erro leva o
 * nome do arquivo.
 */
export function triarArquivos<T extends ArquivoBasico>(arquivos: readonly T[], opcoes: {
  accept?: string; maxBytes?: number; multiple?: boolean; validar?: (arquivo: T) => string | null
}): { aceitos: T[]; erros: string[] } {
  const lista = opcoes.multiple ? arquivos : arquivos.slice(0, 1)
  const aceitos: T[] = []
  const erros: string[] = []
  for (const a of lista) {
    const problema = problemaDoArquivo(a, opcoes)
    if (!problema) aceitos.push(a)
    else erros.push(opcoes.multiple ? `${a.name}: ${problema}` : problema)
  }
  return { aceitos, erros }
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'application/pdf': 'pdf',
}

/**
 * Nome que o navegador dá à imagem colada (captura de tela): "image.png" no
 * Chrome e no Firefox, "Pasted Graphic.png" no Safari, ou vazio.
 */
export function ehNomeDeColagem(nome: string): boolean {
  return /^(?:image|imagem|blob|pasted graphic(?: \d+)?)?(?:\.[a-z0-9]+)?$/i.test(nome.trim())
}

/**
 * "colado-2026-11-10-14-32-05.png": nome legível para o arquivo colado, com a
 * data e a hora de Brasília. `ordem` diferencia os colados juntos ("-2", "-3").
 */
export function nomeDeColado(tipo: string, agora: Date, ordem = 0, nomeOriginal = ''): string {
  const ext = EXTENSAO_POR_MIME[tipo.toLowerCase()] || extensao(nomeOriginal)
  const quando = `${dataHoraInput(agora).replace('T', '-').replace(':', '-')}-${String(agora.getSeconds()).padStart(2, '0')}`
  return `colado-${quando}${ordem > 0 ? `-${ordem + 1}` : ''}${ext ? `.${ext}` : ''}`
}
