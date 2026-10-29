// ─────────────────────────────────────────────────────────────────────────────
// O serviço abre o cofre (5C-5.4b).
//
// - A chave privada fica só no VPS, num arquivo (RNDS_CHAVE_COFRE). Ao subir, o
//   serviço publica a chave pública (public.rnds_registrar_chave_publica), com
//   que o navegador cifra o certificado.
// - O certificado da unidade vem do banco cifrado (public.rnds_certificado_da_unidade);
//   o serviço o abre (src/interop/rnds/cofre.ts), lê o .pfx com o openssl e
//   grava o que leu (public.rnds_registrar_certificado): titular, CNPJ/CPF,
//   validade, impressão digital e situação.
// - O certificado que acabou de chegar é lido no ciclo seguinte, mesmo sem
//   documento na fila, e o painel mostra se abriu (public.rnds_certificados_aguardando).
// - O .pfx aberto fica só na memória: nada vai ao disco nem ao log.
// - Unidade sem certificado no cofre usa a pasta (simulador e teste ponta a ponta).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { createPrivateKey, createPublicKey, webcrypto, X509Certificate } from 'node:crypto'
import { abrirCertificado, idDaChave, type ChaveCripto, type Cifrado, type Jwk } from '../../../src/interop/rnds/cofre.ts'
import type { Certificados, CertificadoObtido } from './ciclo.ts'
import type { Certificado } from './cliente-rnds.ts'

export type Situacao = 'valido' | 'senha_incorreta' | 'invalido' | 'vencido' | 'chave_trocada'

/** O que o serviço leu do certificado (vai para public.rnds_registrar_certificado). */
export type Leitura = {
  situacao: Situacao
  titular?: string | null
  documento?: string | null
  validoAte?: Date | null
  impressao?: string | null
  erro?: string | null
}

export type CertificadoNoBanco = {
  credencial_id: string
  certificado_cifrado: Cifrado
  situacao: string
  impressao: string | null
}

/** As funções do cofre no banco (5.4a e 5.4b), com a chave de serviço. */
export interface BancoDoCofre {
  registrarChave(id: string, jwk: Jwk): Promise<void>
  certificadoDaUnidade(unidade: string): Promise<CertificadoNoBanco | null>
  aguardando(limite: number): Promise<Pick<CertificadoNoBanco, 'credencial_id' | 'certificado_cifrado'>[]>
  registrarCertificado(credencial: string, l: Leitura): Promise<void>
}

export type ChaveDoServico = { id: string; jwk: Jwk; privada: ChaveCripto }

const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' } as const

/** A chave privada do serviço (PEM), com a pública e o id que o navegador vê. */
export async function carregarChave(pem: string): Promise<ChaveDoServico> {
  const k = createPrivateKey(pem)
  if (k.asymmetricKeyType !== 'rsa' || (k.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error('a chave do cofre precisa ser RSA de 2048 bits ou mais')
  }
  const { kty, n, e } = createPublicKey(k).export({ format: 'jwk' })
  const jwk: Jwk = { kty, n, e, alg: 'RSA-OAEP-256', use: 'enc' }
  const privada = await webcrypto.subtle.importKey('pkcs8', k.export({ type: 'pkcs8', format: 'der' }), RSA, false, ['decrypt'])
  return { id: await idDaChave(jwk), jwk, privada }
}

type Saida = { codigo: number; saida: string; erro: string }

function openssl(args: string[], entrada: Uint8Array, senha: string): Promise<Saida> {
  return new Promise((resolve, reject) => {
    // a senha vai por variável só do processo do openssl, nunca na linha de comando
    const env: Record<string, string> = { RNDS_PFX_SENHA: senha }
    for (const v of ['PATH', 'SystemRoot', 'OPENSSL_MODULES']) if (process.env[v]) env[v] = process.env[v]!
    const p = spawn('openssl', args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    p.stdout.on('data', (c: Buffer) => out.push(c))
    p.stderr.on('data', (c: Buffer) => err.push(c))
    p.on('error', reject)
    p.on('close', (codigo) => resolve({ codigo: codigo ?? 1, saida: Buffer.concat(out).toString('utf8'), erro: Buffer.concat(err).toString('utf8') }))
    p.stdin.end(entrada)
  })
}

const PEM = /-----BEGIN ([A-Z ]+)-----[\s\S]+?-----END \1-----/g

/**
 * Lê o .pfx: chave, cadeia, titular, CNPJ/CPF, validade e impressão.
 * - Muitos A1 da ICP-Brasil usam cifras antigas (RC2): sem elas no openssl 3,
 *   tenta de novo com -legacy.
 * - O TLS usa a chave e a cadeia em PEM, não o .pfx: o Node não abre .pfx com
 *   cifra antiga.
 * - Titular e documento vêm do CN, no padrão da ICP-Brasil ("NOME:CNPJ").
 */
export async function lerPfx(pfx: Uint8Array, senha: string, agora: Date): Promise<Leitura & { certificado?: Certificado }> {
  const base = ['pkcs12', '-nodes', '-passin', 'env:RNDS_PFX_SENHA']
  let r = await openssl(base, pfx, senha)
  if (r.codigo !== 0 && /unsupported|legacy|RC2/i.test(r.erro)) r = await openssl([...base, '-legacy'], pfx, senha)
  if (r.codigo !== 0) {
    if (/mac verify|invalid password|bad decrypt/i.test(r.erro)) return { situacao: 'senha_incorreta', erro: 'a senha não abre o certificado' }
    return { situacao: 'invalido', erro: `o arquivo não é um .pfx legível (${primeiraLinha(r.erro)})` }
  }
  const blocos = [...r.saida.matchAll(PEM)].map((m) => ({ tipo: m[1], pem: m[0] }))
  const chaves = blocos.filter((b) => /PRIVATE KEY$/.test(b.tipo)).map((b) => b.pem)
  const certs = blocos.filter((b) => b.tipo === 'CERTIFICATE').map((b) => ({ pem: b.pem, x509: new X509Certificate(b.pem) }))
  if (chaves.length !== 1) return { situacao: 'invalido', erro: `o .pfx precisa ter uma chave privada (tem ${chaves.length})` }
  const chave = createPrivateKey(chaves[0])
  const folha = certs.find((c) => c.x509.checkPrivateKey(chave))
  if (!folha) return { situacao: 'invalido', erro: 'nenhum certificado do .pfx corresponde à chave' }

  const cn = /^CN=(.*)$/m.exec(folha.x509.subject)?.[1]?.trim() ?? null
  const icp = cn ? /^(.+?):(\d{14}|\d{11})$/.exec(cn) : null
  const validoAte = new Date(folha.x509.validTo)
  const leitura: Leitura = {
    situacao: validoAte <= agora ? 'vencido' : new Date(folha.x509.validFrom) > agora ? 'invalido' : 'valido',
    titular: icp ? icp[1].trim() : cn,
    documento: icp ? icp[2] : null,
    validoAte,
    impressao: folha.x509.fingerprint256,
    erro: new Date(folha.x509.validFrom) > agora ? 'o certificado ainda não começou a valer' : null,
  }
  if (leitura.situacao !== 'valido') return leitura
  // a folha primeiro, depois a cadeia: é o que o EHR Auth recebe no TLS mútuo
  const cadeia = [folha.pem, ...certs.filter((c) => c !== folha).map((c) => c.pem)].join('\n')
  return { ...leitura, certificado: { chave: chaves[0], cadeia } }
}

function primeiraLinha(s: string): string {
  return (s.split('\n').find((l) => l.trim()) ?? 'erro do openssl').trim().slice(0, 120)
}

const RETIDO: Record<Exclude<Situacao, 'valido'>, string> = {
  senha_incorreta: 'retido: o certificado da RNDS não abre com a senha enviada; envie de novo em Integrações > RNDS',
  invalido: 'retido: o certificado da RNDS não pôde ser lido; envie de novo em Integrações > RNDS',
  vencido: 'retido: o certificado da RNDS venceu; envie o renovado em Integrações > RNDS',
  chave_trocada: 'retido: o certificado da RNDS precisa ser enviado de novo (a chave do serviço mudou)',
}

type Aberto = { marca: string; certificado: Certificado; validoAte: Date }

export class CofreDeCertificados implements Certificados {
  private abertos = new Map<string, Aberto>()
  private publicada = false
  private banco: BancoDoCofre
  private chave: ChaveDoServico
  private reserva?: Certificados
  private agora: () => Date
  private log: (linha: Record<string, unknown>) => void

  constructor(o: {
    banco: BancoDoCofre
    chave: ChaveDoServico
    /** a pasta, para unidade sem certificado no cofre */
    reserva?: Certificados
    agora?: () => Date
    log?: (linha: Record<string, unknown>) => void
  }) {
    this.banco = o.banco
    this.chave = o.chave
    this.reserva = o.reserva
    this.agora = o.agora ?? (() => new Date())
    this.log = o.log ?? (() => {})
  }

  /** Publica a chave pública uma vez; tenta de novo no ciclo seguinte se falhar. */
  async publicarChave(): Promise<void> {
    if (this.publicada) return
    await this.banco.registrarChave(this.chave.id, this.chave.jwk)
    this.publicada = true
    this.log({ evento: 'chave_publicada', chave: this.chave.id })
  }

  /** Lê os certificados que acabaram de chegar, para o painel mostrar se abriram. */
  async lerAguardando(limite = 10): Promise<number> {
    const lista = await this.banco.aguardando(limite)
    for (const c of lista) await this.abrir(c.credencial_id, c.certificado_cifrado)
    return lista.length
  }

  async obter(unidade: string): Promise<CertificadoObtido> {
    const c = await this.banco.certificadoDaUnidade(unidade)
    if (!c) return this.reserva ? this.reserva.obter(unidade) : null
    if (c.situacao in RETIDO) return { retido: RETIDO[c.situacao as keyof typeof RETIDO] }
    const marca = `${c.certificado_cifrado.chave_id}:${c.certificado_cifrado.iv}`
    let a: Aberto | { retido: string } | undefined = this.abertos.get(c.credencial_id)
    if (!a || a.marca !== marca) a = await this.abrir(c.credencial_id, c.certificado_cifrado)
    if ('retido' in a) return a
    if (a.validoAte <= this.agora()) {
      // venceu com o serviço rodando: grava, e o banco pausa as unidades
      this.abertos.delete(c.credencial_id)
      await this.banco.registrarCertificado(c.credencial_id, { situacao: 'vencido', validoAte: a.validoAte, impressao: c.impressao })
      return { retido: RETIDO.vencido }
    }
    return a.certificado
  }

  private async abrir(credencial: string, cifrado: Cifrado): Promise<Aberto | { retido: string }> {
    this.abertos.delete(credencial)
    let leitura: Leitura & { certificado?: Certificado }
    if (cifrado.chave_id !== this.chave.id) {
      leitura = { situacao: 'chave_trocada', erro: 'cifrado com outra chave do serviço' }
    } else {
      let conteudo
      try {
        conteudo = await abrirCertificado(this.chave.privada, credencial, cifrado)
      } catch {
        conteudo = null
      }
      leitura = conteudo
        ? await lerPfx(conteudo.pfx, conteudo.senha, this.agora())
        : { situacao: 'invalido', erro: 'o cifrado não abre com a chave do serviço' }
    }
    const { certificado, ...gravar } = leitura
    await this.banco.registrarCertificado(credencial, gravar)
    this.log({ evento: 'certificado_lido', credencial, situacao: leitura.situacao })
    if (leitura.situacao !== 'valido' || !certificado) return { retido: RETIDO[leitura.situacao as keyof typeof RETIDO] ?? RETIDO.invalido }
    const aberto = { marca: `${cifrado.chave_id}:${cifrado.iv}`, certificado, validoAte: leitura.validoAte! }
    this.abertos.set(credencial, aberto)
    return aberto
  }
}
