// Guarda das sessões de assinatura no assinador (LG7, A3).
//
// O token do provedor dá o poder de assinar pelo médico até o fim da sessão.
// Por isso ele só existe aqui: cifrado com AES-256-GCM (chave no .env do VPS),
// nunca no banco, no navegador ou no log. O arquivo cifrado sobrevive à
// reinicialização do contêiner; a sessão vencida é apagada na leitura.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

export type Sessao = {
  sessaoId: string // id em private.sessoes_assinatura
  perfilId: string
  provedor: string
  alias: string
  certificadoDer: string // base64
  cadeiaDer: string[] // base64
  validaAte: string // ISO
  token: string
}

export class Cofre {
  private readonly chave: Buffer
  constructor(chaveHex: string) {
    if (!/^[0-9a-f]{64}$/i.test(chaveHex)) throw new Error('ASSINADOR_CHAVE precisa de 32 bytes em hexadecimal')
    this.chave = Buffer.from(chaveHex, 'hex')
  }
  cifrar(texto: string): string {
    const iv = randomBytes(12)
    const c = createCipheriv('aes-256-gcm', this.chave, iv)
    const corpo = Buffer.concat([c.update(texto, 'utf8'), c.final()])
    return Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64')
  }
  decifrar(b64: string): string {
    const b = Buffer.from(b64, 'base64')
    const d = createDecipheriv('aes-256-gcm', this.chave, b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
  }
}

export class Sessoes {
  private readonly porPerfil = new Map<string, string>() // perfilId → sessão cifrada
  private readonly cofre: Cofre
  private readonly arquivo?: string
  private readonly agora: () => Date
  constructor(cofre: Cofre, arquivo?: string, agora: () => Date = () => new Date()) {
    this.cofre = cofre
    this.arquivo = arquivo
    this.agora = agora
    if (arquivo && existsSync(arquivo)) {
      const salvo = JSON.parse(readFileSync(arquivo, 'utf8')) as Record<string, string>
      for (const [k, v] of Object.entries(salvo)) this.porPerfil.set(k, v)
    }
  }
  private gravar() {
    if (!this.arquivo) return
    const tmp = `${this.arquivo}.tmp`
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.porPerfil)), { mode: 0o600 })
    renameSync(tmp, this.arquivo)
  }
  guardar(s: Sessao) {
    this.porPerfil.set(s.perfilId, this.cofre.cifrar(JSON.stringify(s)))
    this.gravar()
  }
  /** A sessão válida do médico, ou undefined (a vencida é apagada). */
  daPessoa(perfilId: string): Sessao | undefined {
    const c = this.porPerfil.get(perfilId)
    if (!c) return undefined
    const s = JSON.parse(this.cofre.decifrar(c)) as Sessao
    if (new Date(s.validaAte) <= this.agora()) {
      this.encerrar(perfilId)
      return undefined
    }
    return s
  }
  encerrar(perfilId: string) {
    if (this.porPerfil.delete(perfilId)) this.gravar()
  }
  /** Apaga as vencidas (rodar de tempos em tempos). Devolve quantas saíram. */
  limpar(): number {
    let n = 0
    for (const k of [...this.porPerfil.keys()]) if (!this.daPessoa(k)) n++
    return n
  }
}

/** Pedidos de autorização em andamento (estado OAuth → quem e o verifier), por 10 minutos. */
export class Pendentes {
  private readonly m = new Map<string, { perfilId: string; cpf: string; provedor: string; verifier: string; validaAte: string; criado: number }>()
  private readonly agora: () => number
  constructor(agora: () => number = () => Date.now()) {
    this.agora = agora
  }
  abrir(v: { perfilId: string; cpf: string; provedor: string; verifier: string; validaAte: string }): string {
    const estado = randomBytes(24).toString('base64url')
    this.m.set(estado, { ...v, criado: this.agora() })
    return estado
  }
  /** Consome o estado (uso único). */
  tomar(estado: string) {
    const v = this.m.get(estado)
    this.m.delete(estado)
    if (!v || this.agora() - v.criado > 10 * 60_000) return undefined
    return v
  }
}
