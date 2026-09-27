// Fila local criptografada (ADR 0009). IndexedDB sobrevive a fechar o
// navegador e a reiniciar o aparelho. Cada item é cifrado com AES-GCM; a chave
// é da pessoa logada, gerada no aparelho e guardada como NÃO exportável — o
// conteúdo em disco não se lê sem o navegador desta origem.
// Um item só sai da fila quando o servidor confirma o recebimento.

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

async function chave(perfil: string): Promise<CryptoKey> {
  const db = await abrir()
  const existente = await pedido(db.transaction('chaves').objectStore('chaves').get(perfil))
  if (existente) return existente as CryptoKey
  const nova = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await pedido(db.transaction('chaves', 'readwrite').objectStore('chaves').put(nova, perfil))
  return nova
}

export async function enfileirar(perfil: string, itens: ItemSync[]): Promise<void> {
  const k = await chave(perfil)
  const guardados: Guardado[] = []
  for (const item of itens) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(item)))
    guardados.push({ id: item.id, perfil, iv, cifra })
  }
  const db = await abrir()
  const tx = db.transaction('fila', 'readwrite')
  for (const g of guardados) tx.objectStore('fila').put(g)
  await new Promise<void>((ok, falha) => {
    tx.oncomplete = () => ok()
    tx.onerror = () => falha(tx.error)
  })
}

export async function listar(perfil: string): Promise<ItemNaFila[]> {
  const db = await abrir()
  const brutos = (await pedido(db.transaction('fila').objectStore('fila').index('perfil').getAll(perfil))) as Guardado[]
  if (brutos.length === 0) return []
  const k = await chave(perfil)
  const itens: ItemNaFila[] = []
  for (const g of brutos) {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: g.iv }, k, g.cifra)
    itens.push({ ...(JSON.parse(new TextDecoder().decode(claro)) as ItemSync), recusado: g.recusado })
  }
  return itens
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
