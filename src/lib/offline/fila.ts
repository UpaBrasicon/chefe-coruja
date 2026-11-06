// Fila local criptografada (ADR 0009). IndexedDB sobrevive a fechar o
// navegador e a reiniciar o aparelho. Cada item é cifrado com AES-GCM.
// Um item só sai da fila quando o servidor confirma o recebimento.
//
// A chave é da pessoa e vem do SERVIDOR (chave_fila(), migration
// 20270227000001; A em O1 a O5 pelo RT em 05/11/2026): entregue depois do
// segundo fator, fica só na memória (importada como não exportável) e numa
// cópia da aba para a recarga sem rede (O2). Sair apaga as duas; a fila
// continua no aparelho, ilegível até a mesma pessoa entrar de novo (O4). Antes
// a chave era gerada e guardada no aparelho para sempre: num computador
// compartilhado, um script da origem podia ler a fila de outra pessoa.

export type ItemSync = {
  id: string
  tipo: 'observacao' | 'documento'
  hora: string // ISO, relógio do servidor
  sem_conexao: boolean
  ultimo_contato: string | null
  aparelho_id: string
  dados: Record<string, unknown>
}

export type ItemNaFila = ItemSync & { recusado?: string }

type Guardado = { id: string; perfil: string; iv: Uint8Array<ArrayBuffer>; cifra: ArrayBuffer; recusado?: string }

const BANCO = 'chefe-coruja-offline'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('chaves')
      db.createObjectStore('fila', { keyPath: 'id' }).createIndex('perfil', 'perfil')
    }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => falha(req.error)
  })
}

function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, falha) => {
    req.onsuccess = () => ok(req.result)
    req.onerror = () => falha(req.error)
  })
}

const COPIA_ABA = 'cc-chave-fila'
let chaveServidor: CryptoKey | null = null

function deBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function aba(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}

/** Recebe a chave da pessoa (base64 de 32 bytes, do servidor) ou `null` ao sair. */
export async function definirChaveFila(b64: string | null): Promise<void> {
  if (!b64) {
    chaveServidor = null
    try { aba()?.removeItem(COPIA_ABA) } catch { /* sem armazenamento */ }
    return
  }
  const bytes = deBase64(b64)
  if (bytes.length !== 32) throw new Error('chave da fila inválida')
  chaveServidor = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  try { aba()?.setItem(COPIA_ABA, b64) } catch { /* sem armazenamento: vale só na memória */ }
}

export const temChaveFila = () => chaveServidor !== null

/** Recarga sem rede (O2): usa a cópia da chave que ficou nesta aba. */
export async function chaveFilaDaAba(): Promise<boolean> {
  if (chaveServidor) return true
  const b64 = aba()?.getItem(COPIA_ABA)
  if (!b64) return false
  await definirChaveFila(b64)
  return true
}

async function chave(): Promise<CryptoKey | null> {
  if (chaveServidor) return chaveServidor
  return (await chaveFilaDaAba()) ? chaveServidor : null
}

async function cifrar(k: CryptoKey, item: ItemSync) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(item)))
  return { iv, cifra }
}

async function decifrar(k: CryptoKey, g: Guardado): Promise<ItemSync | null> {
  try {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: g.iv }, k, g.cifra)
    return JSON.parse(new TextDecoder().decode(claro)) as ItemSync
  } catch {
    return null // outra chave (trocada pelo administrador, O5, ou ainda a antiga do aparelho)
  }
}

async function brutosDe(perfil: string): Promise<Guardado[]> {
  const db = await abrir()
  return (await pedido(db.transaction('fila').objectStore('fila').index('perfil').getAll(perfil))) as Guardado[]
}

async function gravar(guardados: Guardado[]) {
  const db = await abrir()
  const tx = db.transaction('fila', 'readwrite')
  for (const g of guardados) tx.objectStore('fila').put(g)
  await new Promise<void>((ok, falha) => {
    tx.oncomplete = () => ok()
    tx.onerror = () => falha(tx.error)
  })
}

export async function enfileirar(perfil: string, itens: ItemSync[]): Promise<void> {
  const k = await chave()
  if (!k) throw new Error('SEM_CHAVE_FILA: entre de novo com conexão para registrar sem rede neste aparelho.')
  const guardados: Guardado[] = []
  for (const item of itens) guardados.push({ id: item.id, perfil, ...(await cifrar(k, item)) })
  await gravar(guardados)
}

/** O que esta pessoa consegue ler agora. Sem a chave, nada (a fila fica no aparelho). */
export async function listar(perfil: string): Promise<ItemNaFila[]> {
  const brutos = await brutosDe(perfil)
  if (brutos.length === 0) return []
  const k = await chave()
  if (!k) return []
  const itens: ItemNaFila[] = []
  for (const g of brutos) {
    const item = await decifrar(k, g)
    if (item) itens.push({ ...item, recusado: g.recusado })
  }
  return itens
}

/** Quantos registros desta pessoa estão no aparelho, sem precisar da chave (aviso de saída, O4). */
export async function contar(perfil: string): Promise<{ pendentes: number; recusados: number }> {
  const brutos = await brutosDe(perfil)
  const recusados = brutos.filter((g) => g.recusado).length
  return { pendentes: brutos.length - recusados, recusados }
}

/**
 * O3: a fila gravada com a chave antiga do aparelho passa para a chave do
 * servidor, e a chave antiga é apagada. Devolve quantos registros passaram.
 */
export async function migrarFilaAntiga(perfil: string): Promise<number> {
  const nova = await chave()
  if (!nova) return 0
  const db = await abrir()
  const antiga = (await pedido(db.transaction('chaves').objectStore('chaves').get(perfil))) as CryptoKey | undefined
  if (!antiga) return 0
  const passaram: Guardado[] = []
  for (const g of await brutosDe(perfil)) {
    const item = await decifrar(antiga, g)
    if (item) passaram.push({ id: g.id, perfil, recusado: g.recusado, ...(await cifrar(nova, item)) })
  }
  if (passaram.length) await gravar(passaram)
  await pedido(db.transaction('chaves', 'readwrite').objectStore('chaves').delete(perfil))
  return passaram.length
}

/** Remove os confirmados pelo servidor. */
export async function remover(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await abrir()
  const tx = db.transaction('fila', 'readwrite')
  for (const id of ids) tx.objectStore('fila').delete(id)
  await new Promise<void>((ok, falha) => {
    tx.oncomplete = () => ok()
    tx.onerror = () => falha(tx.error)
  })
}

/** Recusado pelo servidor: fica guardado com o motivo, fora das novas tentativas. */
export async function marcarRecusado(id: string, motivo: string): Promise<void> {
  const db = await abrir()
  const store = db.transaction('fila', 'readwrite').objectStore('fila')
  const g = (await pedido(store.get(id))) as Guardado | undefined
  if (!g) return
  g.recusado = motivo
  await pedido(db.transaction('fila', 'readwrite').objectStore('fila').put(g))
}

/** Identificador deste aparelho (não identifica a pessoa). */
export function aparelhoId(): string {
  try {
    let id = localStorage.getItem('cc-aparelho')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('cc-aparelho', id)
    }
    return id
  } catch {
    return 'sem-armazenamento'
  }
}
