// Dados do certificado ICP-Brasil do médico (LG7): serial, emissor, validade e
// CPF. O CPF vem do otherName 2.16.76.1.3.1 do subjectAltName (DOC-ICP-04:
// 8 dígitos da data de nascimento, depois os 11 do CPF). O assinador confere
// que o CPF do certificado é o do perfil antes de abrir a sessão.
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

import { lerCertificado } from './cms.ts'
import { OID } from './politica.ts'

export type DadosCertificado = {
  serialHex: string
  emissor: string
  titular: string
  validoDe: Date
  validoAte: Date
  cpf: string | null
}

function nomeComum(nome: pkijs.RelativeDistinguishedNames): string {
  const cn = nome.typesAndValues.find((t) => t.type === '2.5.4.3')
  return cn ? String(cn.value.valueBlock.value) : ''
}

/** CPF do otherName 2.16.76.1.3.1 (ou null se o certificado não for de pessoa física ICP-Brasil). */
export function cpfDoCertificado(cert: pkijs.Certificate): string | null {
  const san = cert.extensions?.find((e) => e.extnID === '2.5.29.17')
  if (!san) return null
  const nomes = san.parsedValue as pkijs.AltName | undefined
  for (const g of nomes?.altNames ?? []) {
    if (g.type !== 0) continue // otherName
    const other = g.value as asn1js.Sequence
    const partes = other.valueBlock.value
    const oid = (partes[0] as asn1js.ObjectIdentifier).valueBlock.toString()
    if (oid !== OID.icpPessoaFisica) continue
    // [0] EXPLICIT { OCTET STRING | PrintableString | UTF8String }
    const valor = (partes[1] as asn1js.Constructed).valueBlock.value[0] as asn1js.BaseBlock & { valueBlock: { valueHexView?: Uint8Array; value?: string } }
    const texto = valor.valueBlock.value !== undefined && typeof valor.valueBlock.value === 'string'
      ? valor.valueBlock.value
      : Buffer.from(valor.valueBlock.valueHexView ?? new Uint8Array()).toString('latin1')
    const cpf = texto.slice(8, 19)
    return /^\d{11}$/.test(cpf) ? cpf : null
  }
  return null
}

export function dadosDoCertificado(der: Uint8Array): DadosCertificado {
  const cert = lerCertificado(der)
  return {
    serialHex: Buffer.from(cert.serialNumber.valueBlock.valueHexView).toString('hex'),
    emissor: nomeComum(cert.issuer),
    titular: nomeComum(cert.subject),
    validoDe: cert.notBefore.value,
    validoAte: cert.notAfter.value,
    cpf: cpfDoCertificado(cert),
  }
}
