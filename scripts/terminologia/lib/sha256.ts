// ─────────────────────────────────────────────────────────────────────────────
// Conferência de SHA-256 de arquivo baixado (S10, H6): o download de fonte
// externa (ex.: SIGTAP de espelho no GitHub) só segue se o hash bater com o
// valor que quem roda conferiu na fonte oficial.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'

const RE_HEX = /^[0-9a-f]{64}$/

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Lê `--sha256 <hex>` (ou `--sha256=<hex>`) da linha de comando. Obrigatório. */
export function lerSha256Esperado(argv: string[]): string {
  let valor: string | undefined
  const i = argv.indexOf('--sha256')
  if (i >= 0) valor = argv[i + 1]
  const igual = argv.find((a) => a.startsWith('--sha256='))
  if (igual) valor = igual.slice('--sha256='.length)
  if (!valor) throw new Error('Informe o SHA-256 do zip com --sha256 <64 hex> (veja o cabeçalho do script).')
  const hex = valor.trim().toLowerCase()
  if (!RE_HEX.test(hex)) throw new Error(`--sha256 inválido: esperado 64 caracteres hexadecimais, veio "${valor}".`)
  return hex
}

/** Lança se o hash dos bytes não for o esperado. */
export function conferirSha256(bytes: Uint8Array, esperado: string): void {
  const obtido = sha256Hex(bytes)
  if (obtido !== esperado.toLowerCase()) {
    throw new Error(`SHA-256 não confere: esperado ${esperado.toLowerCase()}, obtido ${obtido}. Nada foi gravado.`)
  }
}
