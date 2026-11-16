// Caminhos da guarda (S10, H1): todo caminho que vem de fora (índice da guarda,
// nome de objeto do Storage) passa por aqui antes de virar arquivo em disco.
//
// Regra: caminho relativo com "/" entre as partes; nenhuma parte vazia, "." ou
// ".."; nenhuma "\" ou ":" (no Windows, ":" grava em fluxo alternativo do NTFS);
// nenhum caractere de controle; nada de caminho absoluto. E, no fim, o alvo
// resolvido tem de ficar DENTRO da pasta-base.
import { createHash } from 'node:crypto'
import { resolve, sep } from 'node:path'

// eslint-disable-next-line no-control-regex
const PROIBIDO = /[\\:\u0000-\u001f\u007f-\u009f]/

/** Motivo de o caminho relativo ser recusado, ou null se for aceito. */
export function motivoRecusa(rel) {
  if (typeof rel !== 'string' || rel === '') return 'caminho vazio'
  if (rel.startsWith('/') || /^[a-zA-Z]:/.test(rel)) return 'caminho absoluto'
  for (const parte of rel.split('/')) {
    if (parte === '') return 'parte vazia (barra dupla ou no fim)'
    if (parte === '.' || parte === '..') return 'parte "." ou ".."'
    if (PROIBIDO.test(parte)) return 'caractere proibido (\\, : ou de controle)'
  }
  return null
}

export const caminhoValido = (rel) => motivoRecusa(rel) === null

/**
 * Caminho absoluto de `rel` dentro de `base`; lança erro se `rel` for recusado
 * ou se o alvo resolvido sair da pasta-base.
 */
export function caminhoConfinado(base, rel) {
  const motivo = motivoRecusa(rel)
  if (motivo) throw new Error(`caminho recusado: ${motivo}`)
  const raiz = resolve(base)
  const alvo = resolve(raiz, ...rel.split('/'))
  if (!alvo.startsWith(raiz.endsWith(sep) ? raiz : raiz + sep)) throw new Error('caminho recusado: sai da pasta de destino')
  return alvo
}

/** Resumo de um nome para log, sem o nome (que pode identificar paciente). */
export const resumoNome = (nome) =>
  `${String(nome).length} caractere(s), sha256 ${createHash('sha256').update(String(nome)).digest('hex').slice(0, 12)}`

/**
 * Separa os anexos do Storage em aceitos e pulados. Pula nome inválido e a
 * colisão arquivo×pasta (objeto "x" e objeto "x/y" no mesmo bucket: os dois
 * não cabem no disco); o "x" é o pulado. Não lança erro: a guarda segue.
 * lista: [{ bucket, nome }] → { aceitos: [{ bucket, nome }], pulados: [{ bucket, motivo, resumo }] }
 */
export function planejarAnexos(lista) {
  const aceitos = []
  const pulados = []
  const vistos = new Map()   // bucket → Set de nomes
  const pastas = new Map()   // bucket → Set de prefixos que são pasta
  for (const { bucket, nome } of lista) {
    const mb = caminhoValido(bucket) && !bucket.includes('/') ? null : 'bucket com nome inválido'
    const mn = motivoRecusa(nome)
    if (mb || mn) { pulados.push({ bucket: mb ? '(inválido)' : bucket, motivo: mb ?? mn, resumo: resumoNome(nome) }); continue }
    if (!vistos.has(bucket)) { vistos.set(bucket, new Set()); pastas.set(bucket, new Set()) }
    if (vistos.get(bucket).has(nome)) { pulados.push({ bucket, motivo: 'nome repetido', resumo: resumoNome(nome) }); continue }
    vistos.get(bucket).add(nome)
    const partes = nome.split('/')
    for (let i = 1; i < partes.length; i++) pastas.get(bucket).add(partes.slice(0, i).join('/'))
    aceitos.push({ bucket, nome })
  }
  return {
    aceitos: aceitos.filter((a) => {
      if (!pastas.get(a.bucket).has(a.nome)) return true
      pulados.push({ bucket: a.bucket, motivo: 'colisão arquivo×pasta', resumo: resumoNome(a.nome) })
      return false
    }),
    pulados,
  }
}
