// Fluxo do assinador (LG7, docs/regulatorio/LG7-DESENHO-TECNICO.md).
// As partes de fora (banco, folha em PDF, guarda do arquivo, quem é o médico)
// entram como dependências: o fluxo é testado com dublês e o main liga as reais.
import { createHash, randomBytes } from 'node:crypto'

import { dadosDoCertificado } from './certificado.ts'
import { atributosAssinados, conferirCms, hashParaAssinar, montarCms } from './cms.ts'
import { assinarHash, certificados, pkce, trocarCodigo, urlAutorizacao, type Fetch, type Provedor } from './docicp17.ts'
import { bytesCobertos, fecharByteRange, gravarCms, prepararPdf, type MetadadosSaude } from './pades.ts'
import { Pendentes, Sessoes } from './sessoes.ts'

export type Medico = { perfilId: string; nome: string; cpf: string | null; crmNumero: string; crmUf: string }
export type Documento = {
  id: string; tipo: string; numero: string | null; estado: string; autorId: string; assinadoEm: string | null
  unidadeNome: string; unidadeId: string; pacienteId: string
}

export type Dependencias = {
  provedores: Provedor[]
  sessoes: Sessoes
  pendentes: Pendentes
  /** médico do JWT (Supabase Auth + perfil); erro se o JWT não vale */
  quemE(jwt: string): Promise<Medico>
  /** fim do plantão em que o médico está agora (escala), ou null fora do plantão */
  fimDoPlantao(jwt: string): Promise<Date | null>
  /** documento lido com o JWT do médico (a RLS decide se ele vê) */
  documento(jwt: string, id: string): Promise<Documento | null>
  /**
   * folha A4 do documento em PDF (Edge `folha` com o JWT, renderizada pelo
   * Chromium), com o rodapé da conferência: QR code e código impresso
   */
  folhaPdf(jwt: string, documentoId: string, conferencia: { codigo: string; url: string }): Promise<Uint8Array>
  /** endereço público da conferência (o QR code aponta para ele) */
  urlConferencia: string
  banco: {
    abrirSessao(v: { perfilId: string; provedor: string; serial: string; emissor: string; cpfFinal: string; certValidoAte: Date; validaAte: Date }): Promise<string>
    encerrarSessao(sessaoId: string, motivo: string): Promise<void>
    /** grava a assinatura e o PDF juntos; o banco calcula o hash do PDF */
    registrarComPdf(v: { documentoId: string; sessaoId: string; pdf: Uint8Array; codigoSha256: string }): Promise<string>
  }
  fetch?: Fetch
  agora?: () => Date
}

export class ErroAssinador extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

const MAX_SESSAO_MS = 12 * 3600_000
// tipo do documento clínico → tipo de documento de saúde do VALIDAR (A1: o que sai para o paciente ou outro serviço)
// (tipos do CHECK de documentos_clinicos; evolução, prescrição do internado e
// parecer interno ficam com o login e o 2FA, como decidiu o RT)
const TIPO_SAUDE: Record<string, MetadadosSaude['tipo']> = {
  receita: 'prescricao',
  atestado: 'atestado',
  pedido_exames: 'solicitacao_exame',
  encaminhamento: 'relatorio',
  sumario_alta: 'relatorio',
  documento_transferencia: 'relatorio',
  laudo_aih: 'relatorio',
  // LG8, M3: solicitação e parecer da teleinterconsulta (Res. CFM 2.314/2022, art. 13, d)
  teleinterconsulta: 'relatorio',
}
export const tiposAssinaveis = () => Object.keys(TIPO_SAUDE)

export async function iniciarSessao(d: Dependencias, jwt: string, provedorId: string): Promise<{ url: string }> {
  const medico = await d.quemE(jwt)
  const p = d.provedores.find((x) => x.id === provedorId)
  if (!p) throw new ErroAssinador(400, 'Provedor de certificado não configurado')
  const agora = (d.agora ?? (() => new Date()))()
  const fim = await d.fimDoPlantao(jwt)
  if (!fim || fim <= agora) throw new ErroAssinador(403, 'A sessão de assinatura só abre dentro do plantão')
  const validaAte = new Date(Math.min(fim.getTime(), agora.getTime() + MAX_SESSAO_MS))
  const { verifier, challenge } = pkce()
  if (!medico.cpf) throw new ErroAssinador(400, 'Cadastre o CPF no seu perfil antes de assinar')
  const estado = d.pendentes.abrir({ perfilId: medico.perfilId, cpf: medico.cpf, provedor: p.id, verifier, validaAte: validaAte.toISOString() })
  return { url: urlAutorizacao(p, { estado, challenge, segundos: (validaAte.getTime() - agora.getTime()) / 1000 }) }
}

export async function retornoDoProvedor(d: Dependencias, estado: string, codigo: string): Promise<{ validaAte: string }> {
  const pend = d.pendentes.tomar(estado)
  if (!pend) throw new ErroAssinador(400, 'Pedido de autorização vencido ou desconhecido. Comece de novo.')
  const p = d.provedores.find((x) => x.id === pend.provedor)
  if (!p) throw new ErroAssinador(400, 'Provedor de certificado não configurado')
  const { token } = await trocarCodigo(p, codigo, pend.verifier, d.fetch)
  const lista = await certificados(p, token, d.fetch)
  const agora = (d.agora ?? (() => new Date()))()
  const c = lista.find((x) => dadosDoCertificado(x.certificadoDer).validoAte > agora)
  if (!c) throw new ErroAssinador(400, 'Nenhum certificado válido nesta conta do provedor')
  const dados = dadosDoCertificado(c.certificadoDer)
  // o CPF do certificado tem de ser o do médico do perfil (a sessão é dele)
  if (dados.cpf !== pend.cpf) throw new ErroAssinador(403, 'O CPF do certificado não é o do seu cadastro')
  const validaAte = new Date(Math.min(new Date(pend.validaAte).getTime(), dados.validoAte.getTime()))
  const sessaoId = await d.banco.abrirSessao({
    perfilId: pend.perfilId, provedor: p.id, serial: dados.serialHex, emissor: dados.emissor,
    cpfFinal: dados.cpf.slice(-4), certValidoAte: dados.validoAte, validaAte,
  })
  d.sessoes.guardar({
    sessaoId, perfilId: pend.perfilId, provedor: p.id, alias: c.alias, token, validaAte: validaAte.toISOString(),
    certificadoDer: Buffer.from(c.certificadoDer).toString('base64'), cadeiaDer: c.cadeiaDer.map((x) => Buffer.from(x).toString('base64')),
  })
  return { validaAte: validaAte.toISOString() }
}

export async function assinarDocumento(d: Dependencias, jwt: string, documentoId: string): Promise<{ assinaturaId: string; codigo: string }> {
  const medico = await d.quemE(jwt)
  const s = d.sessoes.daPessoa(medico.perfilId)
  if (!s) throw new ErroAssinador(409, 'Sem sessão de assinatura. Inicie a sessão no começo do plantão.')
  const doc = await d.documento(jwt, documentoId)
  if (!doc) throw new ErroAssinador(404, 'Documento não encontrado')
  if (doc.autorId !== medico.perfilId) throw new ErroAssinador(403, 'Só o autor assina o documento')
  if (doc.estado !== 'ativo' || !doc.numero) throw new ErroAssinador(409, 'Só documento emitido e numerado é assinado')
  if (doc.assinadoEm) throw new ErroAssinador(409, 'Documento já assinado')
  const tipo = TIPO_SAUDE[doc.tipo]
  if (!tipo) throw new ErroAssinador(400, 'Este tipo de documento não é assinado com ICP-Brasil (fica com o login e o 2FA)')
  const p = d.provedores.find((x) => x.id === s.provedor)
  if (!p) throw new ErroAssinador(400, 'Provedor de certificado não configurado')

  const agora = (d.agora ?? (() => new Date()))()
  // o código da conferência vai impresso no documento antes de assinar; o banco guarda só o hash
  const codigo = codigoDeConferencia()
  const folha = await d.folhaPdf(jwt, documentoId, { codigo, url: d.urlConferencia })
  const preparado = await prepararPdf(folha, {
    tipo, crmNumero: medico.crmNumero, crmUf: medico.crmUf, nomeMedico: medico.nome,
    motivo: `Documento nº ${doc.numero}`, local: doc.unidadeNome, quando: agora,
  })
  const { pdf: fechado, faixa } = fecharByteRange(preparado)
  const cobertos = bytesCobertos(fechado, faixa)
  const certificadoDer = Buffer.from(s.certificadoDer, 'base64')
  const cadeiaDer = s.cadeiaDer.map((x) => Buffer.from(x, 'base64'))
  const atributos = atributosAssinados(createHash('sha256').update(cobertos).digest(), certificadoDer)
  const raw = await assinarHash(p, s.token, s.alias, hashParaAssinar(atributos), `Documento nº ${doc.numero}`, d.fetch)
  const cms = montarCms({ atributos, assinaturaRaw: raw, certificadoDer, cadeiaDer })
  const conferido = await conferirCms(cms, cobertos, agora)
  if (!conferido.ok) throw new ErroAssinador(502, `A assinatura devolvida pelo provedor não confere (${conferido.motivo})`)
  const assinado = gravarCms(fechado, faixa, cms)
  const assinaturaId = await d.banco.registrarComPdf({
    documentoId: doc.id, sessaoId: s.sessaoId, pdf: assinado,
    codigoSha256: createHash('sha256').update(codigo).digest('hex'),
  })
  return { assinaturaId, codigo }
}

// 32 símbolos sem os parecidos (0/O, 1/I): 160 bits, alfanumérico como pede o VALIDAR
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function codigoDeConferencia(): string {
  return [...randomBytes(32)].map((b) => ALFABETO[b % 32]).join('')
}

export async function encerrarSessao(d: Dependencias, jwt: string, motivo = 'encerrada pelo médico'): Promise<void> {
  const medico = await d.quemE(jwt)
  const s = d.sessoes.daPessoa(medico.perfilId)
  d.sessoes.encerrar(medico.perfilId)
  if (s) await d.banco.encerrarSessao(s.sessaoId, motivo)
}
